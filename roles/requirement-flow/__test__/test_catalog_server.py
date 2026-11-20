"""Run the project reader over the same CLI, models and signed artifacts as an installed project."""
from concurrent.futures import ThreadPoolExecutor
from http.client import HTTPConnection
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest
from urllib.parse import quote, urlencode, urlsplit


FLOW = Path(__file__).resolve().parents[1] / "skills/requirement-flow/flow.py"


class CatalogServerTest(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.project = Path(temp.name).resolve() / "项目"
        self.project.mkdir()
        self.store = self.project / ".requirements"
        self.cli = [sys.executable, "-B", str(FLOW), "--project", str(self.project)]

    def command(self, *args, success=True):
        r = subprocess.run(self.cli + list(args), cwd=self.project, capture_output=True, text=True, timeout=15)
        if success:
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            return r.stdout
        self.assertNotEqual(r.returncode, 0, r.stdout)
        return r.stderr

    def start(self, *options, task=None):
        command = ["task", task, "serve"] if task else ["serve"]
        server = subprocess.Popen(self.cli + [*command, *options], cwd=self.project,
                                  stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        def close():
            server.terminate()
            server.communicate(timeout=10)
        self.addCleanup(close)
        self.port = urlsplit(server.stdout.readline().strip()).port
        self.assertTrue(self.port, None if self.port else server.stderr.read())

    def fetch(self, path, *, form=None, headers=None):
        conn = HTTPConnection("127.0.0.1", self.port, timeout=8)
        try:
            headers = dict(headers or {})
            if form is not None:
                headers["Content-Type"] = "application/x-www-form-urlencoded"
            conn.request("POST" if form is not None else "GET", path, urlencode(form) if form is not None else None,
                         headers=headers)
            response = conn.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            conn.close()

    def graph(self, prefix):
        status, _, data = self.fetch(prefix)
        self.assertEqual(status, 200, data)
        return json.loads(re.search(rb'<script type="application/json" id="data">(.+?)</script>', data)[1])

    def cards(self):
        status, _, data = self.fetch("/catalog.json")
        self.assertEqual(status, 200, data)
        return {row["id"]:row for row in json.loads(data)["tasks"]}

    def test_empty_project_discovers_new_tasks_and_separates_invalid_records(self):
        self.start()
        self.assertEqual(self.cards(), {})
        self.assertFalse(self.store.exists())
        self.command("new", "new", "--request", "</script><img src=x>")
        row = self.cards()["new"]
        self.assertEqual((row["basis"], row["total"], row["passed"], row["stories"]), ("none", 0, 0, 0))
        self.assertNotIn(b"</script><img src=x>", self.fetch("/")[2])
        model = self.store / "active/new/model.json"
        bad = self.store / "active/bad"
        bad.mkdir()
        (bad / "model.json").write_bytes(b"{}")
        external = self.project.parent / "outside"
        external.mkdir()
        (external / "model.json").write_bytes(model.read_bytes())
        if os.name != "nt":
            (self.store / "active/link").symlink_to(external, target_is_directory=True)
            self.assertEqual(self.fetch("/tasks/link/model.json")[0], 404)
        for path in ("/tasks/%2E%2E/model.json", "/tasks/a%2Fb/", "/tasks/%FF/", "/.requirements/", "/tasks/new/evidence/../../model.json"):
            self.assertEqual(self.fetch(path)[0], 404, path)
        self.assertEqual(self.fetch("/", headers={"Host":"unrelated.invalid"})[0], 403)
        cards = self.cards()
        self.assertEqual(cards["new"]["href"], "/tasks/new/")
        self.assertIsNone(cards["bad"]["href"])
        self.assertEqual(cards["bad"]["state"], "error")
        self.assertNotIn(str(self.project), str(cards["bad"]))

    def test_catalog_tags_reflect_current_story_scope(self):
        self.command("new", "demo", "--request", "保存记录并支持导出")
        stories = {}
        for key, title, tags in (("export", "导出记录", [" ＡＰＩ ", "api", " ", 42, "导出"]),
                                 ("save", " 保存记录 ", [" "]), ("copy", "保存记录", [])):
            stories[f"S-{key}"] = {"title":title, "actor":"运营", "goal":title, "tags":tags,
                                   "examples":[{"id":f"AC-{key}", "given":"有记录", "when":title, "then":"可回读"}]}
        choice = {"title":"导出交付范围", "owner":"产品", "why":"确定本期范围", "stories":["S-export"],
                  "options":{"keep":{"label":"本期交付", "consequence":"核验导出"},
                             "defer":{"label":"下期交付", "consequence":"本期撤出导出"}}}
        plan = self.project / "plan.json"
        plan.write_text(json.dumps({"stories":stories, "decisions":{"D-scope":choice}}))
        self.command("task", "demo", "plan", "plan.json", "--rev", "1", "--why", "登记范围")
        self.start()
        self.assertEqual(self.cards()["demo"]["tags"], ["ＡＰＩ", "导出"])
        self.assertEqual(self.graph("/tasks/demo/")["model"]["work"]["stories"]["S-export"]["tags"],
                         stories["S-export"]["tags"])

        self.command("task", "demo", "decision", "D-scope", "defer", "--rev", "2", "--actor", "产品",
                     "--why", "本期只做保存")
        plan.write_text(json.dumps({"stories":{"S-export":{**stories["S-export"], "examples":[]}},
                                    "retire_scenarios":{"AC-export":{"decision":"D-scope", "is":"defer"}}}))
        self.command("task", "demo", "plan", "plan.json", "--rev", "3", "--why", "撤出导出场景")
        self.assertEqual(self.cards()["demo"]["tags"], ["保存记录"])

    def test_scoped_writes_sources_redirects_and_read_only_archive(self):
        self.command("init")
        names = ("甲", "乙")
        for name in names:
            self.command("new", name, "--request", name + "的验收")
            (self.project / (name + ".md")).write_text(name + "的依据")
            patch = {"stories":{"S":{"title":"选择方案","actor":"运营","goal":"保存选择","basis":name + ".md:1",
                                     "examples":[{"id":"SC","given":"已编辑","when":"保存","then":"可回读"}]}},
                     "decisions":{"D":{"title":"保存选项","owner":"运营","why":"需要一致口径","stories":["S"],
                                       "options":{"a":{"label":"甲","consequence":"选择甲"},
                                                  "b":{"label":"乙","consequence":"选择乙"}}}}}
            (self.project / "plan.json").write_text(json.dumps(patch))
            self.command("task", name, "plan", "plan.json", "--rev", "1", "--why", "确认选择")
        self.start("--default-task", names[0])
        self.assertIn("正在使用", self.command("upgrade", success=False))
        a, b = ("/tasks/" + quote(name) + "/" for name in names)
        graph_a, graph_b = self.graph(a), self.graph(b)
        self.assertNotEqual(graph_a["csrf"], graph_b["csrf"])
        for legacy in ("/?features=S&view=detail", "/handbook.html?q=test"):
            status, _, page = self.fetch(legacy)
            self.assertEqual(status, 200)
            self.assertIn(a.encode(), page)
            self.assertIn(b"history.replaceState(history.state", page)
            self.assertIn(b"location.reload()", page)
        self.assertEqual(self.fetch(a + "handbook.html?q=test")[1]["Location"], a + "?q=test")
        self.assertEqual(self.fetch("/?scope=all&q=test")[0], 200)
        self.assertEqual(json.loads(self.fetch("/model.json")[2])["work"]["id"], names[0])
        self.assertTrue(json.loads(self.fetch("/version", headers={"X-Requirement-Flow":"previous-process"})[2])["session_changed"])
        source = "source-location?" + urlencode({"ref":"甲.md:1"})
        header = {"X-Requirement-Flow":graph_a["csrf"]}
        self.assertEqual(json.loads(self.fetch(a + source,headers=header)[2])["preview"]["lines"], ["甲的依据"])
        self.assertEqual(self.fetch(b + source, headers=header)[0], 409)
        self.assertEqual(self.fetch(b + source, headers={"X-Requirement-Flow":graph_b["csrf"]})[0], 404)
        form = {"csrf":graph_a["csrf"], "decision":"D", "choice":"a", "revision":"2"}
        self.assertEqual(self.fetch(b + "decision", form=form)[0], 403)
        with ThreadPoolExecutor(2) as pool:
            results = list(pool.map(lambda _:self.fetch(a + "decision?features=S", form=form), range(2)))
        self.assertEqual(sorted(r[0] for r in results), [303, 409])
        self.assertEqual(next(r[1]["Location"] for r in results if r[0] == 303), a + "?features=S#work")
        self.assertEqual(self.graph(b)["model"]["work"]["revision"], 2)
        self.command("archive", names[0], "--allow-incomplete")
        folder = self.store / "archive" / names[0]
        files = {p.name:p.read_bytes() for p in folder.iterdir() if p.is_file()}
        self.assertTrue(self.graph(a)["read_only"])
        self.assertEqual(self.fetch(a + "decision", form={**form,"revision":"3"})[0], 405)
        self.assertEqual(self.cards()[names[0]]["bucket"], "archive")
        self.assertEqual(files, {p.name:p.read_bytes() for p in folder.iterdir() if p.is_file()})

    def test_single_task_root_keeps_legacy_routes_and_opens_the_project_home(self):
        for task in ("chosen", "other"):
            self.command("new", task, "--request", "验收" + task)
        decision = {"title": "提交方式", "why": "需明确", "owner": "运营", "stories": [],
                    "options": {"save": {"label": "保存", "consequence": "保留草稿"},
                                "send": {"label": "提交", "consequence": "提交审核"}}}
        (self.project / "plan.json").write_text(json.dumps({"decisions": {"D": decision}}))
        self.command("task", "chosen", "plan", "plan.json", "--rev", "1", "--why", "明确提交方式")
        self.start(task="chosen")
        graph = self.graph("/")
        self.assertEqual(graph["model"]["work"]["id"], "chosen")
        self.assertEqual(self.graph("/handbook.html?view=detail")["home_href"], "/home")
        self.assertEqual(json.loads(self.fetch("/model.json")[2])["work"]["id"], "chosen")
        self.assertEqual(json.loads(self.fetch("/dispatch")[2])["revision"], 2)
        status, headers, _ = self.fetch("/decision", form={"csrf": graph["csrf"], "decision": "D",
                                                           "choice": "save", "revision": "2"})
        self.assertEqual((status, headers.get("Location")), (303, "/#work"))
        status, _, home = self.fetch("/home?scope=active")
        self.assertEqual(status, 200)
        self.assertIn(b'id="catalog-data"', home)
        cards = self.cards()
        self.assertEqual(set(cards), {"chosen", "other"})
        second = self.graph(cards["other"]["href"])
        self.assertEqual((second["model"]["work"]["id"], second["home_href"]), ("other", "/home"))
        self.assertNotEqual(self.graph("/")["csrf"], second["csrf"])

    def test_offline_snapshot_links_only_to_a_project_local_index(self):
        self.command("new", "demo", "--request", "独立图")
        workspace = self.store / "active" / "demo"
        def home():
            page = (workspace / "handbook.html").read_bytes()
            payload = json.loads(re.search(rb'<script type="application/json" id="data">(.+?)</script>', page)[1])
            return payload.get("home_href")
        self.assertIsNone(home())
        index = self.store / "index.html"
        index.write_text("<title>项目需求首页</title>", encoding="utf-8")
        self.command("task", "demo")
        self.assertEqual(home(), "../../index.html")
        index.unlink()
        if os.name != "nt":
            outside = self.project.parent / "outside.html"
            outside.write_text("unrelated", encoding="utf-8")
            index.symlink_to(outside)
        self.command("task", "demo")
        self.assertIsNone(home())

    def test_research_and_revoked_receipts_show_current_progress(self):
        self.command("new", "research", "--request", "确认可用接口", "--outcome", "research")
        self.command("new", "delivery", "--request", "验算库存")
        patch = {"stories":{"S":{"title":"库存","actor":"运营","goal":"看到数量",
                                 "examples":[{"id":"SC","given":"有库存","when":"核算","then":"数量吻合"}]}},
                 "actions":{"V":{"title":"核验数量","kind":"验证","stories":["S"],"read_stories":["S"],
                                 "decisions":[],"contracts":[],"depends_on":[],"covers":["SC"],"done":"数量吻合"}}}
        (self.project / "plan.json").write_text(json.dumps(patch))
        self.command("task","delivery","plan","plan.json","--rev","1","--why","登记验收")
        self.start()
        self.assertEqual((self.cards()["research"]["basis"],self.cards()["research"]["passed"]), ("research",0))
        self.command("task","research","finish","A-intake","--actor","调研员","--rev","1","--output","接口可用",
                     "--evidence","调研记录")
        self.assertEqual((self.cards()["research"]["total"],self.cards()["research"]["passed"]), (1,1))
        self.assertEqual((self.cards()["delivery"]["basis"],self.cards()["delivery"]["passed"]), ("scenarios",0))
        self.command("task","delivery","verify-run","V","--scenario","SC","--actor","验证员","--rev","2",
                     "--environment","本地断言","--",sys.executable,"-c","assert sum([1, 2]) == 3; print('verified: 3')")
        self.command("task","delivery","finish","V","--actor","验证员","--rev","3","--output","数量吻合",
                     "--evidence","实际运行")
        row = self.cards()["delivery"]
        self.assertEqual((row["total"], row["passed"]), (1,1))
        self.command("archive", "delivery", "--allow-incomplete")
        proof = next((self.store / "archive/delivery/evidence").glob("*/receipt.json"))
        proof.write_text("{}")
        row = self.cards()["delivery"]
        self.assertEqual((row["passed"], row["total"], row["stale"]), (0,1,1))
        graph = self.graph(row["href"])
        self.assertTrue(graph["read_only"])
        self.assertEqual(graph["queue"]["scenarios"][0]["status"], "stale")
