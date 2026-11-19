"""Project inventory and task-scoped routes for the local requirements reader."""
from collections import OrderedDict
from contextlib import ExitStack
import hashlib
import hmac
import json
import re
import secrets
from threading import Lock
from urllib.parse import parse_qs, quote, unquote, urlsplit

import sync as engine


def task_href(key):
    return "/tasks/" + quote(key, safe="") + "/"


def task_card(work, queue):
    cases = queue["scenarios"]
    history = work.get("history") or {}
    basis = "scenarios" if cases else "none"
    total = len(cases)
    passed = sum(case["status"] == "passed" for case in cases)
    if history and not work["actions"] and not work["events"]:
        # Migrated notes are useful to read but contain no executable acceptance record.
        basis, passed, total = "history", 0, 0
    elif not cases and work.get("outcome") == "research":
        checks = {key for key, action in work["actions"].items()
                  if action["kind"] == "调研" and engine.condition_value(work, action.get("when")) is not False}
        basis = "research" if checks else "none"
        total = len(checks)
        passed = sum(item["id"] in checks for item in queue["progress"]["completed"])
    updated = next((event["time"] for event in reversed(work["events"]) if event.get("time")), None)
    return {
        "id":work["id"], "title":work["title"], "summary":(work.get("goal") or work["raw_request"])[:360],
        "stories":len(work["stories"]), "state":queue["state"], "outcome":work.get("outcome","delivery"),
        "updatedAt":updated or history.get("completed_at") or history.get("created_at"),
        "basis":basis, "passed":passed, "total":total,
        "stale":sum(case["status"] == "stale" for case in cases),
        "failed":sum(case["status"] == "failed" for case in cases), "href":task_href(work["id"]),
    }


class CardReader:
    """Cache only migrated notes without external evidence or mutable workflow state."""
    def __init__(self, report):
        self.report = report
        self.cache = OrderedDict()
        self.lock = Lock()

    def __call__(self, path):
        archived = path.parent.name == "archive"
        if archived:
            stamp = engine.knowledge.fingerprint(path / "model.json")
            with self.lock:
                hit = self.cache.get(path)
                if hit and hit[0] == stamp:
                    self.cache.move_to_end(path)
                    return hit[1]
        card = task_card(*self.report(path))
        if archived and card["basis"] == "history":
            with self.lock:
                self.cache[path] = (stamp, card)
                self.cache.move_to_end(path)
                if len(self.cache) > 512:
                    self.cache.popitem(last=False)
        return card


def catalog_data(project, groups, default_task):
    tasks = []
    for bucket, rows in groups.items():
        for row in rows:
            if "error" in row:
                row = {"id":row["id"], "title":row["id"], "summary":"", "state":"error", "stories":0,
                       "outcome":"delivery", "basis":"none", "passed":0, "total":0, "stale":0, "failed":0,
                       "updatedAt":None, "href":None, "error":"需求记录无法读取，请检查目录与模型。"}
            tasks.append({**row, "bucket":bucket})
    if project.parent.name == "worktrees":
        name = project.parent.parent.name
    elif project.name == "root" and (project.parent / "worktrees").is_dir():
        name = project.parent.name
    else:
        name = project.name
    return {"project":name, "tasks":tasks, "defaultHref":task_href(default_task) if default_task else None}


def serve(project, port, source_root, default_task, *, inventory, open_task):
    if not 0 <= port <= 65535:
        raise ValueError("端口应在 0 至 65535 之间。")
    checkout_root = engine.source_paths.select_source_root(project, source_root)
    template = (engine.RUNTIME / "catalog.html").read_text(encoding="utf-8").replace(
        "@@THEME@@", (engine.RUNTIME / "theme.css").read_text(encoding="utf-8"))
    signing_key = secrets.token_bytes(32)
    legacy_reads = {"/version","/source-location","/context","/dispatch","/model.json","/lesson-source","/lesson-evidence"}

    class ProjectHandler(engine.TaskHandler):
        checkout = checkout_root
        timeout = 15

        def redirect(self, target):
            self.send_response(302)
            self.send_header("Location", target)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", "0")
            self.end_headers()

        def resume_legacy_page(self):
            # HTTP redirects discard the previous graph's history.state, including unsaved decision notes.
            target = task_href(default_task)
            js_url = json.dumps(target).replace("<","\\u003c")
            self.send_content(200, f"""<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<title>返回需求图</title><script>
(() => {{
  const target = {js_url} + location.search + location.hash
  try {{ history.replaceState(history.state, '', target) }}
  catch {{ location.replace(target); return }}
  location.reload()
}})()
</script><a href="{target}">打开需求图</a></html>""", "text/html")

        def show_catalog(self, url):
            query = parse_qs(url.query, keep_blank_values=True)
            legacy = "view" in query or "features" in query or ("q" in query and "scope" not in query)
            if default_task and url.path == "/" and legacy:
                self.resume_legacy_page()
                return
            data = catalog_data(project, inventory(), default_task)
            if url.path == "/catalog.json":
                self.send_content(200, engine.encoded(data), "application/json")
            else:
                payload = json.dumps(data, separators=(",",":"), ensure_ascii=False)
                safe = payload.replace("&","\\u0026").replace("<","\\u003c").replace(">","\\u003e")
                self.send_content(200, template.replace("@@CATALOG_DATA@@",safe), "text/html")

        def route(self, *, write):
            if self.headers.get("Host") != self.host():
                self.send_error(403)
                return
            url = urlsplit(self.path)
            if not write and url.path in ("/","/catalog.json"):
                self.show_catalog(url)
                return
            match = re.fullmatch(r"/tasks/([^/]+)(/.*)?", url.path)
            if match:
                try:
                    key = unquote(match[1], errors="strict")
                except UnicodeError:
                    self.send_error(404)
                    return
                endpoint = match[2]
            elif default_task and not write and url.path == "/handbook.html":
                self.resume_legacy_page()
                return
            elif default_task and (url.path in legacy_reads or url.path == "/decision"
                                   or re.fullmatch(r"/evidence/E[0-9]+", url.path)):
                # Already-open single-task pages can poll and reconnect after the server upgrade.
                key, endpoint = default_task, url.path
            else:
                self.send_error(404)
                return
            with ExitStack() as lease:
                try:
                    self.task_id, self.workspace = lease.enter_context(open_task(key))
                except (ValueError, OSError):
                    self.send_error(404)
                    return
                self.task_prefix = task_href(self.task_id)
                if endpoint in (None, "/handbook.html"):
                    if write:
                        self.send_error(404)
                    else:
                        self.redirect(self.task_prefix + ("?" + url.query if url.query else ""))
                    return
                self.path = endpoint + ("?" + url.query if url.query else "")
                self.read_only = self.workspace.parent.name == "archive"
                self.token = hmac.new(signing_key, self.task_id.encode(), hashlib.sha256).hexdigest()
                if write:
                    super().do_POST()
                else:
                    super().do_GET()

        def handle_route(self, write):
            try:
                self.route(write=write)
            except (BrokenPipeError, ConnectionResetError, TimeoutError):
                pass
            except (OSError, ValueError, KeyError, TypeError, IndexError, AttributeError, RecursionError):
                self.send_content(422, "需求记录暂时无法读取，请检查模型与来源文件。", "text/plain")

        def do_GET(self):
            self.handle_route(False)

        def do_POST(self):
            self.handle_route(True)

    engine.run_server(port, ProjectHandler)
