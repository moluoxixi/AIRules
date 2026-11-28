"""HTTP checks for a read-only Markdown reader and its document relationships."""
import importlib.util
import io
import hashlib
from contextlib import nullcontext
from html import unescape as html_unescape
import json
from pathlib import Path
import queue
import re
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError
from urllib.parse import parse_qs, quote, unquote, urlencode, urljoin, urlsplit
from urllib.request import build_opener, ProxyHandler, Request


SCRIPT = Path(__file__).resolve().parents[1] / "skills/requirement-flow/scripts/reader.py"
PREPARE_EXAMPLE = Path(__file__).resolve().parent / "prepare_reader_example.py"
READER_RUNNER = """import faulthandler, runpy, sys
faulthandler.dump_traceback_later(5)
script = sys.argv.pop(1)
runpy.run_path(script, run_name="__main__")
"""


class ReaderTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="requirement-flow-reader-test-")
        self.addCleanup(temporary.cleanup)
        self.base = Path(temporary.name)
        self.project = self.base / "示例 project"
        self.project.mkdir()
        self.entry = self.write("docs/business/index.md", """# 门店库存业务

## [现状] 入口

[办理流程](%E6%B5%81%E7%A8%8B%20%E8%AF%B4%E6%98%8E.md#%E4%BF%9D%E5%AD%98)
[复制任务](../changes/copy.md#实施范围)
[实现依据](../../src/copy.py)
[缺失依据](../../src/not-found.py)
[隐藏配置](../../.env)
[外部规范](https://example.invalid/policy#save)

```markdown
[代码示例中的伪链接](../../src/never.py)
```
""")
        self.flow = self.write("docs/business/流程 说明.md", "# 办理流程\n\n## 保存\n\n重新读取数量。\n")
        self.task = self.write("docs/changes/copy.md", """# 复制已取消申请

## [拟议变更] 实施范围

[业务现状](../business/index.md)
""")
        self.write("docs/changes/unlinked.md", "# 另一个任务\n\n尚无业务链接。\n")
        self.source = self.write("src/copy.py", "raise RuntimeError('Reader must not execute project sources')\n")
        self.write("src/never.py", "NOT_A_REAL_REFERENCE = True\n")
        self.write("src/unrelated.py", "UNRELATED = True\n")
        self.write(".env", "FIXTURE_ONLY_DO_NOT_RENDER\n")
        self.opener = build_opener(ProxyHandler({}))
        self.start_server()

    def start_server(self, entry="docs/business/index.md", tasks=None):
        self.__dict__.pop("url", None)
        task_args = [part for name in (tasks if tasks is not None else ["docs/changes"])
                     for part in ("--tasks", name)]
        self.process = subprocess.Popen(
            [sys.executable, "-u", "-B", "-c", READER_RUNNER, str(SCRIPT), "--project", str(self.project),
             "--entry", entry, *task_args, "--port", "0"],
            cwd=self.base, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding="utf-8",
        )
        self.addCleanup(self.stop_server)
        lines = queue.Queue()

        def read_output():
            for line in self.process.stdout:
                lines.put(line)

        self.output_thread = threading.Thread(target=read_output, daemon=True)
        self.output_thread.start()
        output = []
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            try:
                line = lines.get(timeout=0.1)
            except queue.Empty:
                if self.process.poll() is not None:
                    break
                continue
            output.append(line)
            found = re.search(r"http://127\.0\.0\.1:\d+", line)
            if found:
                self.url = found.group()
                break
        else:
            sys.stderr.write("Reader startup diagnostics:\n" + "".join(output))
            sys.stderr.flush()
            self.fail("Reader did not print its local URL: " + "".join(output))
        if not hasattr(self, "url"):
            sys.stderr.write("Reader startup diagnostics:\n" + "".join(output))
            sys.stderr.flush()
            self.fail("Reader exited before startup: " + "".join(output))

    def stop_server(self):
        if self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)
        self.output_thread.join(timeout=2)
        self.process.stdout.close()

    def write(self, relative, content):
        path = self.project / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content.encode("utf-8"))
        return path

    def get(self, route):
        try:
            response = self.opener.open(self.url + route, timeout=5)
        except HTTPError as error:
            response = error
        with response:
            return response.status, response.read(), response.headers

    def catalog(self):
        status, body, _ = self.get("/api/catalog")
        self.assertEqual(status, 200, body.decode("utf-8", errors="replace"))
        return json.loads(body)

    def content(self, path):
        return self.get("/content/" + quote(path, safe="/"))

    def snapshot(self):
        output = {}
        for path in self.project.rglob("*"):
            relative = path.relative_to(self.project).as_posix()
            if path.is_symlink():
                output[relative] = ("link", str(path.readlink()))
            elif path.is_dir():
                output[relative] = ("directory",)
            else:
                output[relative] = ("file", path.read_bytes())
        return output

    def test_plain_markdown_links_connect_business_and_task_in_both_directions(self):
        catalog = self.catalog()
        self.assertEqual(catalog["entry"], "docs/business/index.md")
        documents = {page["path"]: page for page in catalog["documents"]}
        business = documents["docs/business/index.md"]
        task = documents["docs/changes/copy.md"]
        self.assertEqual(business["kind"], "document")
        self.assertEqual(task["kind"], "task")
        link = next(link for link in business["links"] if link["target"] == task["path"])
        self.assertEqual(unquote(link["fragment"]), "实施范围")
        self.assertTrue(link["exists"])
        self.assertIn(business["path"], {page["path"] for page in task["backlinks"]})
        self.assertIn(task["path"], {page["path"] for page in business["backlinks"]})
        self.assertEqual(documents["docs/changes/unlinked.md"]["kind"], "task")

    def test_code_formatted_labels_link_documents_without_indexing_code_examples(self):
        pages = {
            "遗失手牌": "lost-key",
            "受理 close()": "close",
            "柜门例外": "door",
            "指引": "guide",
        }
        for title, name in pages.items():
            self.write("ops/" + name + ".md", "# " + title + "\n")
        self.entry.write_text("""# 泳馆储物柜

[`遗失手牌`](../../ops/lost-key.md)
[受理 `close()`][流程]
[`柜门例外`][]
[`指引`]

[流程]: ../../ops/close.md
[`柜门例外`]: ../../ops/door.md
[`指引`]: ../../ops/guide.md

`[示例](../../src/never.py)` 与 ``[示例 `参数`](../../src/never.py)``

```md
[`示例`](../../src/never.py)
```
""", encoding="utf-8")
        catalog = self.catalog()
        entry = next(doc for doc in catalog["documents"] if doc["path"] == catalog["entry"])
        self.assertEqual([(link["label"], link["target"]) for link in entry["links"]],
                         [(title, "ops/" + name + ".md") for title, name in pages.items()])
        self.assertEqual([item["label"] for item in catalog["navigation"]][1:], list(pages))
        self.assertEqual(self.content("ops/lost-key.md")[0], 200)
        self.assertEqual(self.content("src/never.py")[0], 404)

    def task_pair(self):
        directory = ".requirements/active/locker"
        model = {"protocol": {"name": "retained snapshot"},
                 "work": {"id": "locker", "title": "原有储物柜任务", "revision": 7}}
        canonical = json.dumps(model, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
        model_path = self.write(directory + "/model.json", json.dumps(model, ensure_ascii=False, indent=2) + "\n")
        html = ('<!doctype html><meta content="' + hashlib.sha256(canonical).hexdigest() +
                '" name="model-sha256"><h1>原有储物柜任务</h1><a href="model.json">AI 记录</a>' +
                '<script>document.body.dataset.original="yes";'
                'document.querySelector("a").href="model.json"</script>')
        page_path = self.write(directory + "/handbook.html", html)
        return page_path, model_path

    def task_page_url(self, page):
        return "/task-page/" + page["sha256"] + "/" + page["model_sha256"] + "/" + quote(page["path"], safe="/")

    def test_retained_task_page_binds_model_links_without_editing_sources_or_sandbox(self):
        html, model = self.task_pair()
        name = html.relative_to(self.project).as_posix()
        self.entry.write_bytes(("# 业务入口\n\n[原任务](../../" + name + ")\n").encode())
        before = self.snapshot()
        catalog = self.catalog()
        self.assertEqual(len(catalog["task_pages"]), 1)
        page = catalog["task_pages"][0]
        self.assertEqual((page["id"], page["title"], page["revision"]), ("locker", "原有储物柜任务", 7))
        self.assertTrue(page["synchronized"])
        self.assertEqual(page["sha256"], hashlib.sha256(html.read_bytes()).hexdigest())
        self.assertEqual(page["model_sha256"], hashlib.sha256(model.read_bytes()).hexdigest())
        self.assertEqual(page["backlinks"][0]["path"], "docs/business/index.md")
        entry = next(row for row in catalog["documents"] if row["path"] == catalog["entry"])
        self.assertEqual(entry["links"][0]["kind"], "task-page")
        self.assertEqual(catalog["navigation"][1]["path"], name)
        self.assertIn(name, {item["path"] for item in catalog["sources"]})
        self.assertIn(page["model_path"], {item["path"] for item in catalog["sources"]})
        status, body, headers = self.get(self.task_page_url(page))
        self.assertEqual(status, 200, body)
        model_url = urljoin(self.task_page_url(page), "model.json")
        self.assertEqual(body, html.read_bytes())
        self.assertEqual(headers.get_content_type(), "text/html")
        status, embedded, embed_headers = self.get(self.task_page_url(page) + "?embed=1")
        self.assertEqual(status, 200, embedded)
        self.assertEqual(embedded, body + b'<style>.app-head>header{display:none!important}</style>')
        self.assertEqual(embed_headers["Content-Security-Policy"], headers["Content-Security-Policy"])
        self.assertEqual(self.get(self.task_page_url(page))[1], body)
        self.assertEqual(self.get(model_url + "?embed=1")[1], model.read_bytes())
        self.assertEqual(self.catalog()["task_pages"][0], page)
        policy = headers["Content-Security-Policy"]
        for directive in ["sandbox allow-scripts", "default-src 'none'", "script-src 'unsafe-inline'",
                          "style-src 'unsafe-inline'", "img-src data:", "connect-src 'none'",
                          "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'self'"]:
            self.assertIn(directive, policy)
        self.assertNotIn("allow-same-origin", policy)
        self.assertEqual(headers["Cache-Control"], "no-store")
        status, body, headers = self.get(model_url)
        self.assertEqual((status, body), (200, model.read_bytes()))
        self.assertEqual(headers.get_content_type(), "application/json")
        self.assertEqual(self.content(name)[1], html.read_bytes())
        self.assertEqual(self.content(page["model_path"])[1], model.read_bytes())
        self.assertEqual(self.get("/task-page/" + name)[0], 400)
        self.assertEqual(self.get("/task-page/" + page["model_path"])[0], 400)
        old_route = "/task-page/" + name + "?" + urlencode({
            "sha256": page["sha256"], "model_sha256": page["model_sha256"]})
        status, rejected, _ = self.get(old_route)
        self.assertEqual(status, 400)
        self.assertIn("刷新", json.loads(rejected)["error"])
        self.assertEqual(self.snapshot(), before)

    def test_original_model_links_reject_updated_and_removed_pairs(self):
        html, model = self.task_pair()
        name = html.relative_to(self.project).as_posix()
        self.entry.write_text(f"# Entry\n\n[Task](../../{name})\n", encoding="utf-8")
        content = html.read_text(encoding="utf-8").replace('href="model.json"',
            'href="./model.json?download=1&amp;sha256=wrong&amp;model_sha256=wrong#proof"')
        script = '<script>const example = \'<a href="model.json">\';</script>'
        html.write_text(content + script, encoding="utf-8")
        page = self.catalog()["task_pages"][0]
        body = self.get(self.task_page_url(page))[1].decode("utf-8")
        model_url = urljoin(self.task_page_url(page), html_unescape(re.search(r'<a href="([^"]+)"', body)[1]))
        parsed = urlsplit(model_url)
        self.assertEqual(parsed.fragment, "proof")
        self.assertEqual(parse_qs(parsed.query), {"download": ["1"], "sha256": ["wrong"],
                                                "model_sha256": ["wrong"]})
        self.assertIn("/" + page["sha256"] + "/" + page["model_sha256"] + "/", parsed.path)
        self.assertIn(script, body)
        self.assertEqual(self.get(model_url)[1], model.read_bytes())
        # Startup code can restore this relative href; its URL still inherits both versions.
        runtime_model_url = urljoin(self.task_page_url(page), "model.json")
        self.assertEqual(self.get(runtime_model_url)[1], model.read_bytes())

        updated = json.loads(model.read_bytes())
        updated["work"]["revision"] += 1
        model.write_text(json.dumps(updated, ensure_ascii=False), encoding="utf-8")
        canonical = json.dumps(updated, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
        html.write_text(re.sub(r'content="[a-f0-9]+"',
                        'content="' + hashlib.sha256(canonical).hexdigest() + '"', content), encoding="utf-8")
        self.assertEqual(self.get(self.task_page_url(page))[0], 409)
        status, rejected, _ = self.get(model_url)
        self.assertEqual(status, 409, rejected)
        self.assertIn("刷新", json.loads(rejected)["error"])
        self.assertEqual(self.get(runtime_model_url)[0], 409)
        current = self.catalog()["task_pages"][0]
        new_body = self.get(self.task_page_url(current))[1].decode("utf-8")
        current_model_url = urljoin(self.task_page_url(current), html_unescape(re.search(r'<a href="([^"]+)"', new_body)[1]))
        self.assertEqual(self.get(current_model_url)[1], model.read_bytes())
        # Query parameters cannot upgrade a stale versioned path to current files.
        self.assertEqual(self.get(runtime_model_url + "?" + urlencode({
            "sha256": current["sha256"], "model_sha256": current["model_sha256"]}))[0], 409)
        model.unlink()
        self.assertEqual(self.get(model_url)[0], 404)
        self.assertEqual(self.get(current_model_url)[0], 404)
        self.assertEqual(self.get(runtime_model_url)[0], 404)

    def test_task_links_keep_supported_view_query_and_fragment_only(self):
        html, _ = self.task_pair()
        name = html.relative_to(self.project).as_posix()
        self.entry.write_text(f"# Entry\n\n[Detail](../../{name}?view=detail&features=one%2Ctwo&q=keyword"
                              "&sha256=untrusted&model_sha256=untrusted&embed=0#node=story%26one%2Ftwo)\n"
                              f"[Overview](../../{name}?view=overview#node=story-1)\n"
                              f"[Invalid view](../../{name}?view=invalid#node=story-1)\n", encoding="utf-8")
        catalog = self.catalog()
        document = next(doc for doc in catalog["documents"] if doc["path"] == catalog["entry"])
        link = document["links"][0]
        self.assertEqual(link["fragment"], "node=story%26one%2Ftwo")
        self.assertEqual(parse_qs(link["query"]), {"view": ["detail"], "features": ["one,two"],
                                                 "q": ["keyword"]})
        self.assertEqual(catalog["navigation"][1]["query"], link["query"])
        self.assertEqual(len(catalog["navigation"]), 4)
        self.assertEqual(document["links"][2]["query"], "")

    def test_markdown_destinations_decode_html_entities_once_like_rendered_href_attributes(self):
        html, _ = self.task_pair()
        name = html.relative_to(self.project).as_posix()
        # Attribute values follow the bundled marked output after one HTML entity decode.
        rendered_suffixes = [
            ("&amp;q=甲", "&q=%E7%94%B2", {"view": ["detail"], "q": ["甲"]}),
            ("&amp;amp;q=甲", "&amp;q=%E7%94%B2", {"view": ["detail"]}),
            ("&q=甲", "&q=%E7%94%B2", {"view": ["detail"], "q": ["甲"]}),
        ]
        for separator, rendered, expected_query in rendered_suffixes:
            for style in ("inline", "angle", "reference"):
                with self.subTest(separator=separator, style=style):
                    target = f"../../{name}?view=detail{separator}#node=退款%26例外%2F一"
                    markdown = (f"[Task]({target})" if style == "inline" else
                                f"[Task](<{target}>)" if style == "angle" else
                                f"[Task][task]\n\n[task]: {target}")
                    self.entry.write_text("# Entry\n\n" + markdown + "\n", encoding="utf-8")
                    catalog = self.catalog()
                    document = next(doc for doc in catalog["documents"] if doc["path"] == catalog["entry"])
                    link = document["links"][0]
                    dom_href = f"../../{name}?view=detail{rendered}#node=%E9%80%80%E6%AC%BE%26%E4%BE%8B%E5%A4%96%2F%E4%B8%80"
                    dom_parts = urlsplit(dom_href)
                    dom_query = {key: value for key, value in parse_qs(dom_parts.query).items()
                                 if key in {"view", "q", "features"}}
                    self.assertEqual(parse_qs(link["query"]), expected_query)
                    self.assertEqual(parse_qs(link["query"]), dom_query)
                    self.assertEqual(link["fragment"], "node=%E9%80%80%E6%AC%BE%26%E4%BE%8B%E5%A4%96%2F%E4%B8%80")
                    self.assertEqual(quote(link["fragment"], safe="=%"), dom_parts.fragment)
                    self.assertEqual(catalog["navigation"][1]["query"], link["query"])

    def test_destination_entities_follow_attribute_context_without_decoding_twice(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_attribute_entities", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        cases = [
            ("stock&notes.md", "stock&notes.md"),
            ("stock&amp;notes.md", "stock&notes.md"),
            ("handbook.html?view=detail&notices=1&q=甲", "handbook.html?view=detail&notices=1&q=甲"),
            ("handbook.html?q=甲&copycat", "handbook.html?q=甲&copycat"),
            ("handbook.html?q=甲&copy=1", "handbook.html?q=甲&copy=1"),
            ("handbook.html?q=甲&copy9", "handbook.html?q=甲&copy9"),
            ("handbook.html?q=甲&copy.", "handbook.html?q=甲©."),
            ("handbook.html?q=甲&copy", "handbook.html?q=甲©"),
            ("handbook.html?q=甲&copy;A", "handbook.html?q=甲©A"),
            ("handbook.html?q=&copy甲", "handbook.html?q=©甲"),
            ("handbook.html?q=&notin;", "handbook.html?q=∉"),
            ("handbook.html?q=&unknown;", "handbook.html?q=&unknown;"),
            ("handbook.html?q=&#65x", "handbook.html?q=Ax"),
            ("handbook.html?q=&#x41;=", "handbook.html?q=A="),
            ("handbook.html?q=&#0;", "handbook.html?q=�"),
            ("handbook.html?q=甲&amp;乙", "handbook.html?q=甲&乙"),
            ("handbook.html?q=甲&amp;amp;乙", "handbook.html?q=甲&amp;乙"),
            ("handbook.html?q=&#38;amp;", "handbook.html?q=&amp;"),
            ("handbook.html?q=甲%26乙%2F丙#node=退款%26例外%2F一",
             "handbook.html?q=甲%26乙%2F丙#node=退款%26例外%2F一"),
        ]
        with module.MarkdownMetadata() as metadata:
            for target, expected in cases:
                for style in ("inline", "angle", "reference"):
                    with self.subTest(target=target, style=style):
                        markdown = (f"[Task]({target})" if style == "inline" else
                                    f"[Task](<{target}>)" if style == "angle" else
                                    f"[Task][task]\n\n[task]: {target}")
                        actual = metadata.read(markdown)['links']
                        self.assertEqual([(label, unquote(href)) for label, href in actual], [("Task", unquote(expected))])
                        for encoded in ("%26", "%2F"):
                            self.assertEqual(actual[0][1].count(encoded), expected.count(encoded))

    def test_filename_and_query_entity_prefixes_remain_reachable(self):
        source = self.write("docs/business/stock&notes.md", "# Stock notes\n\n保留字面的业务例外。\n")
        html, _ = self.task_pair()
        name = html.relative_to(self.project).as_posix()
        self.entry.write_text("# Entry\n\n[Raw](stock&notes.md)\n[Entity](stock&amp;notes.md)\n"
                              f"[Task](../../{name}?view=detail&notices=1&q=甲#node=退款%26例外%2F一)\n",
                              encoding="utf-8")
        catalog = self.catalog()
        name = source.relative_to(self.project).as_posix()
        self.assertIn(name, {row["path"] for row in catalog["documents"]})
        self.assertIn(name, {row["path"] for row in catalog["navigation"]})
        entry = next(row for row in catalog["documents"] if row["path"] == catalog["entry"])
        self.assertEqual([row["target"] for row in entry["links"][:2]], [name, name])
        self.assertEqual(parse_qs(entry["links"][2]["query"]), {"view": ["detail"], "q": ["甲"]})
        self.assertEqual(entry["links"][2]["fragment"], "node=%E9%80%80%E6%AC%BE%26%E4%BE%8B%E5%A4%96%2F%E4%B8%80")
        self.assertEqual(self.content(name)[1], source.read_bytes())

    def test_task_digest_match_only_reports_the_declared_digest(self):
        html, _ = self.task_pair()
        # A matching declaration does not inspect or certify a separate embedded payload.
        html.write_bytes(html.read_bytes() + b'<script type="application/json">{"revision":"old"}</script>')
        self.entry.write_text("# Entry\n\n[Task](../../" + html.relative_to(self.project).as_posix() + ")\n",
                              encoding="utf-8")
        self.assertTrue(self.catalog()["task_pages"][0]["synchronized"])

    def test_bom_model_keeps_its_raw_digest_and_canonical_pair_identity(self):
        html, model = self.task_pair()
        model.write_bytes(b"\xef\xbb\xbf" + model.read_bytes())
        name = html.relative_to(self.project).as_posix()
        self.entry.write_text("# Business\n[Task](../../" + name + ")\n", encoding="utf-8")
        catalog = self.catalog()
        self.assertEqual(catalog["task_errors"], {})
        page = catalog["task_pages"][0]
        self.assertTrue(page["synchronized"])
        self.assertEqual(page["model_sha256"], hashlib.sha256(model.read_bytes()).hexdigest())
        route = self.task_page_url(page)
        self.assertEqual(self.get(urljoin(route, "model.json"))[1], model.read_bytes())

    def test_unpaired_handbook_remains_a_plain_business_source(self):
        page = self.write("manual/handbook.html", "<!doctype html><h1>普通业务依据</h1>")
        self.entry.write_bytes(b"# Business\n\n[Manual](../../manual/handbook.html)\n")
        catalog = self.catalog()
        self.assertEqual(catalog["task_pages"], [])
        entry = next(item for item in catalog["documents"] if item["path"] == catalog["entry"])
        self.assertEqual(entry["links"][0]["kind"], "source")
        status, body, headers = self.content("manual/handbook.html")
        self.assertEqual((status, body), (200, page.read_bytes()))
        self.assertEqual(headers.get_content_type(), "text/plain")
        versioned = "/task-page/" + "0" * 64 + "/" + "0" * 64 + "/manual/handbook.html"
        self.assertEqual(self.get(versioned)[0], 404)

    def test_plain_handbook_keeps_its_local_identity_and_actual_read_error(self):
        name = "manual/handbook.html"
        page = self.write(name, "<h1>Business reference</h1>")
        original = page.read_bytes()
        self.entry.write_text("# Business\n[Manual](../../manual/handbook.html?view=detail#node=refund)\n",
                              encoding="utf-8")
        source = self.catalog()["sources"][0]
        saved_url = "/content/" + name + "?sha256=" + source["sha256"]
        for failure, status, message in (("large", 413, "超过 2 MiB"),
                                         ("encoding", 415, "不是 UTF-8"),
                                         ("removed", 404, "不存在或不是文件")):
            with self.subTest(failure=failure):
                if failure == "removed":
                    page.unlink()
                else:
                    page.write_bytes(b"x" * (2 * 1024 * 1024 + 1) if failure == "large" else b"\xff")
                catalog = self.catalog()
                doc = next(doc for doc in catalog["documents"] if doc["path"] == catalog["entry"])
                link = doc["links"][0]
                self.assertEqual((link["target"], link["kind"], link["fragment"]),
                                 (name, "source", "node=refund"))
                self.assertEqual(link["status"], status)
                self.assertIn(message, link["error"])
                actual, body, _ = self.get(saved_url)
                self.assertEqual(actual, status, body)
                self.assertIn(message, json.loads(body)["error"])
                page.write_bytes(original)
                self.assertEqual(self.get(saved_url)[0], 200)

    def test_bad_task_model_is_warned_and_non_string_titles_use_the_existing_directory(self):
        _, model = self.task_pair()
        self.stop_server()
        self.start_server(tasks=[model.parent.relative_to(self.project).as_posix()])
        for value in [b'{"work":{"title":NaN}}', b'{"work":{"title":Infinity}}', b'{broken']:
            with self.subTest(value=value):
                model.write_bytes(value)
                status, body, _ = self.get("/api/catalog")
                self.assertEqual(status, 200)
                catalog = json.loads(body, parse_constant=lambda constant: self.fail("Non-JSON number: " + constant))
                self.assertEqual(catalog["task_pages"], [])
                self.assertTrue(catalog["warnings"])
        for title in [None, ["bad title"], {"bad": "title"}, " "]:
            with self.subTest(title=title):
                model.write_bytes(json.dumps({"work": {"id": "locker", "title": title, "revision": 7}}).encode())
                page = self.catalog()["task_pages"][0]
                self.assertEqual(page["title"], "locker")
                self.assertFalse(page["synchronized"])

    def test_retained_task_directory_or_either_file_is_discovered_without_markdown_link(self):
        html, model = self.task_pair()
        for path in [html.parent, html, model]:
            with self.subTest(path=str(path)):
                self.stop_server()
                self.start_server(tasks=[path.relative_to(self.project).as_posix()])
                pages = self.catalog()["task_pages"]
                self.assertEqual(len(pages), 1)
                self.assertEqual(pages[0]["path"], html.relative_to(self.project).as_posix())
                self.assertTrue(pages[0]["synchronized"])
                self.assertEqual(pages[0]["backlinks"], [])

    def test_retained_task_rejects_changed_removed_private_or_unregistered_sources(self):
        html, model = self.task_pair()
        name = html.relative_to(self.project).as_posix()
        self.entry.write_bytes(("# 业务入口\n\n[原任务](../../" + name + ")\n").encode())
        page = self.catalog()["task_pages"][0]
        html.write_bytes(html.read_bytes() + b"<!-- changed -->")
        self.assertEqual(self.get(self.task_page_url(page))[0], 409)
        page = self.catalog()["task_pages"][0]
        value = json.loads(model.read_bytes())
        value["work"]["revision"] += 1
        model.write_bytes(json.dumps(value, ensure_ascii=False).encode())
        self.assertEqual(self.get(self.task_page_url(page))[0], 409)
        current = self.catalog()["task_pages"][0]
        self.assertFalse(current["synchronized"])
        self.assertEqual(current["revision"], 8)
        self.assertEqual(self.get(self.task_page_url(current))[0], 200)
        model_bytes = model.read_bytes()
        model.unlink()
        self.assertEqual(self.get(self.task_page_url(current))[0], 404)
        model.write_bytes(model_bytes)
        html.unlink()
        self.assertEqual(self.get(self.task_page_url(current))[0], 404)
        for private in [".env", ".secrets/handbook.html", "%2e%2e/handbook.html"]:
            with self.subTest(private=private):
                route = "/task-page/" + "0" * 64 + "/" + "0" * 64 + "/" + private
                self.assertEqual(self.get(route)[0], 403)
        self.write("unregistered/handbook.html", "<!doctype html>Unregistered")
        route = "/task-page/" + "0" * 64 + "/" + "0" * 64 + "/unregistered/handbook.html"
        self.assertEqual(self.get(route)[0], 404)

    def test_navigation_uses_entry_link_order_and_keeps_recursive_markdown_as_documents(self):
        specification = self.write("spec/current.md", "# 当前规范\n\n保存后应重新回读数量。\n")
        self.flow.write_text("# 办理流程\n\n[规范依据](../../spec/current.md#数量)\n", encoding="utf-8")
        self.entry.write_text("""# 门店库存业务

[先看本次变更](../changes/copy.md#实施范围)
[再看办理流程](流程%20说明.md#保存)
[相同入口再次出现](流程%20说明.md#保存)
[另一条规则](流程%20说明.md#恢复)
[无法读取的来源](../../spec/missing.md)
""", encoding="utf-8")
        catalog = self.catalog()
        self.assertEqual(catalog["navigation"], [
            {"path": "docs/business/index.md", "label": "门店库存业务", "fragment": "", "query": ""},
            {"path": "docs/changes/copy.md", "label": "先看本次变更", "fragment": "实施范围", "query": ""},
            {"path": "docs/business/流程 说明.md", "label": "再看办理流程", "fragment": "保存", "query": ""},
            {"path": "docs/business/流程 说明.md", "label": "另一条规则", "fragment": "恢复", "query": ""},
            {"path": "spec/missing.md", "label": "无法读取的来源", "fragment": "", "query": ""},
        ])
        documents = {page["path"]: page for page in catalog["documents"]}
        self.assertEqual(documents["spec/current.md"]["kind"], "document")
        self.assertEqual(documents["docs/business/流程 说明.md"]["kind"], "document")
        self.assertNotIn("spec/current.md", {link["path"] for link in catalog["navigation"]})
        self.assertNotIn("docs/changes/unlinked.md", {link["path"] for link in catalog["navigation"]})
        self.assertIn("docs/changes/unlinked.md", documents)
        self.assertEqual(self.content("spec/current.md")[1], specification.read_bytes())
        self.assertIn("docs/business/流程 说明.md", {page["path"] for page in documents["spec/current.md"]["backlinks"]})

    def test_a_single_link_is_enough_for_relationships_without_writing_a_reciprocal_link(self):
        self.task.write_text("# 复制已取消申请\n\n只保留业务页指向本任务的链接。\n", encoding="utf-8")
        before = self.snapshot()
        documents = {page["path"]: page for page in self.catalog()["documents"]}
        task = documents["docs/changes/copy.md"]
        self.assertEqual(task["links"], [])
        self.assertIn("docs/business/index.md", {page["path"] for page in task["backlinks"]})
        self.assertEqual(self.snapshot(), before)

        self.entry.write_text("# 门店库存业务\n\n[办理流程](流程%20说明.md)\n", encoding="utf-8")
        self.task.write_text("# 复制已取消申请\n\n[保存规则](../business/流程%20说明.md#保存)\n", encoding="utf-8")
        before = self.snapshot()
        documents = {page["path"]: page for page in self.catalog()["documents"]}
        flow = documents["docs/business/流程 说明.md"]
        self.assertEqual(flow["links"], [])
        self.assertIn("docs/changes/copy.md", {page["path"] for page in flow["backlinks"]})
        task_link = documents["docs/changes/copy.md"]["links"][0]
        self.assertEqual((task_link["label"], task_link["fragment"]), ("保存规则", "保存"))
        self.assertEqual(self.snapshot(), before)

    def test_encoded_names_and_anchors_resolve_to_the_original_markdown(self):
        catalog = self.catalog()
        documents = {page["path"]: page for page in catalog["documents"]}
        self.assertIn("docs/business/流程 说明.md", documents)
        link = next(link for link in documents["docs/business/index.md"]["links"]
                    if link["target"] == "docs/business/流程 说明.md")
        self.assertEqual(unquote(link["fragment"]), "保存")
        status, body, headers = self.content("docs/business/流程 说明.md")
        self.assertEqual(status, 200)
        self.assertEqual(body, self.flow.read_bytes())
        self.assertIn(headers.get_content_type(), ("text/plain", "text/markdown"))
        self.assertEqual(headers.get("X-Content-Type-Options"), "nosniff")

    def test_content_revision_rejects_changed_markdown_and_evidence_until_catalog_refresh(self):
        for name, path in [("docs/business/流程 说明.md", self.flow), ("src/copy.py", self.source)]:
            with self.subTest(name=name):
                catalog = self.catalog()
                metadata = next(item for item in catalog["documents"] + catalog["sources"] if item["path"] == name)
                route = "/content/" + quote(name, safe="/") + "?sha256=" + metadata["sha256"]
                self.assertEqual(self.get(route)[1], path.read_bytes())
                path.write_bytes(path.read_bytes() + b"\nChanged after catalog read.\n")
                status, body, _ = self.get(route)
                self.assertEqual(status, 409, body)
                self.assertIn("刷新内容", json.loads(body)["error"])
                current = self.catalog()
                fresh = next(item for item in current["documents"] + current["sources"] if item["path"] == name)
                status, body, _ = self.get("/content/" + quote(name, safe="/") + "?sha256=" + fresh["sha256"])
                self.assertEqual(status, 200, body)
                self.assertEqual(body, path.read_bytes())

    def test_content_revision_hashes_original_bom_and_crlf_bytes(self):
        data = b"\xef\xbb\xbf# BOM source\r\n\r\nBody.\r\n"
        self.flow.write_bytes(data)
        metadata = next(item for item in self.catalog()["documents"] if item["path"] == "docs/business/流程 说明.md")
        self.assertEqual(metadata["sha256"], hashlib.sha256(data).hexdigest())
        status, body, _ = self.get("/content/" + quote(metadata["path"], safe="/") + "?sha256=" + metadata["sha256"])
        self.assertEqual(status, 200, body)
        self.assertEqual(body, data)

    def test_batch_returns_current_reachable_markdown_and_can_limit_it_to_tasks(self):
        self.write("unlinked.md", "# Unrelated business\n")
        initial = {doc["path"]: doc for doc in self.catalog()["documents"]}
        name = "docs/business/流程 说明.md"
        changed = b"\xef\xbb\xbf# Changed\r\n"
        self.flow.write_bytes(changed)
        self.task.unlink()
        status, body, _ = self.get("/api/document-texts")
        self.assertEqual(status, 200, body)
        rows = {row["path"]: row for row in json.loads(body)["records"]}
        self.assertEqual(set(rows), set(initial))
        self.assertEqual(rows["docs/changes/copy.md"]["status"], 404)
        self.assertIn("error", rows["docs/changes/copy.md"])
        self.assertNotIn("text", rows["docs/changes/copy.md"])
        self.assertEqual(rows[name]["text"].encode("utf-8"), changed)
        self.assertEqual(rows[name]["sha256"], hashlib.sha256(changed).hexdigest())
        self.assertNotEqual(rows[name]["sha256"], initial[name]["sha256"])
        self.assertNotIn("src/copy.py", rows)
        self.assertNotIn("unlinked.md", rows)
        status, body, _ = self.get("/api/document-texts?scope=tasks")
        self.assertEqual(status, 200)
        task_rows = json.loads(body)["records"]
        self.assertEqual([row["path"] for row in task_rows if "text" in row], ["docs/changes/unlinked.md"])
        metadata = [row for row in task_rows if "error" not in row and "text" not in row]
        self.assertEqual({row["path"] for row in metadata}, {"docs/business/index.md", "docs/business/流程 说明.md"})
        self.assertTrue(all(set(row) == {"path", "sha256"} for row in metadata))
        failed = [row for row in task_rows if "error" in row]
        self.assertEqual([(row["path"], row["status"]) for row in failed], [("docs/changes/copy.md", 404)])
        self.assertEqual(self.get("/api/document-texts?scope=unknown")[0], 400)

    def test_batch_includes_current_task_pair_metadata_and_drops_removed_pairs(self):
        html, model = self.task_pair()
        self.entry.write_text("# Entry\n\n[Task](../../" + html.relative_to(self.project).as_posix() + ")\n",
                              encoding="utf-8")
        initial = self.catalog()["task_pages"][0]

        def metadata():
            status, body, _ = self.get("/api/document-texts")
            self.assertEqual(status, 200, body)
            return [row for row in json.loads(body)["records"] if row.get("kind") == "task-page"]

        expected = {key: initial[key] for key in ("path", "sha256", "model_sha256")}
        self.assertEqual(metadata(), [{"kind": "task-page", **expected}])
        value = json.loads(model.read_bytes())
        value["work"]["title"] = "改名后的任务"
        model.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
        current = metadata()[0]
        self.assertEqual(current["path"], initial["path"])
        self.assertNotEqual(current["model_sha256"], initial["model_sha256"])
        self.assertEqual(self.catalog()["task_pages"][0]["title"], "改名后的任务")
        model.unlink()
        missing = metadata()
        self.assertEqual(len(missing), 1)
        self.assertEqual(missing[0]["status"], 404)
        self.assertIn("model.json", missing[0]["error"])
        self.assertNotIn("sha256", missing[0])

    def test_batch_reports_newly_discovered_task_errors_and_clears_them_after_recovery(self):
        before = self.catalog()
        name = "docs/changes/broken/handbook.html"
        self.write(name, '<!doctype html><meta name="model-sha256" content="missing"><h1>Broken task</h1>')
        self.assertFalse(any("broken" in warning for warning in before["warnings"]))
        for scope in ("all", "tasks"):
            with self.subTest(scope=scope):
                status, body, _ = self.get("/api/document-texts?scope=" + scope)
                self.assertEqual(status, 200, body)
                batch = json.loads(body)
                self.assertEqual(set(batch), {"records", "source_checks", "navigation", "warnings"})
                self.assertTrue(any("broken/model.json" in warning for warning in batch["warnings"]))
                record = next(row for row in batch["records"] if row["path"] == name)
                self.assertEqual(record["status"], 404)
                self.assertIn("error", record)
                self.assertNotIn("sha256", record)
        failed = self.catalog()
        self.assertIn("broken/model.json", failed["task_errors"][name])
        self.assertEqual(failed["task_pages"], [])
        self.write("docs/changes/broken/model.json", '{"work":{"id":"recovered","title":"Recovered"}}')
        recovered = self.catalog()
        self.assertNotIn(name, recovered["task_errors"])
        self.assertEqual(recovered["task_pages"][0]["path"], name)
        status, body, _ = self.get("/api/document-texts")
        self.assertEqual(status, 200, body)
        batch = json.loads(body)
        self.assertFalse(any("broken/model.json" in warning for warning in batch["warnings"]))
        self.assertTrue(any(row["path"] == name for row in batch["records"]))

    def test_linked_task_errors_keep_the_actual_model_failure(self):
        html, model = self.task_pair()
        name = html.relative_to(self.project).as_posix()
        self.entry.write_text(f"# Business\n[Task](../../{name})\n", encoding="utf-8")
        model.write_bytes(b'{invalid json')
        catalog = self.catalog()
        self.assertEqual(catalog["task_pages"], [])
        self.assertIn("不是有效 JSON", catalog["task_errors"][name])
        self.assertTrue(any("不是有效 JSON" in warning for warning in catalog["warnings"]))
        url = "/task-page/" + "0" * 64 + "/" + "0" * 64 + "/" + name
        status, body, _ = self.get(url)
        self.assertEqual(status, 422)
        self.assertIn("不是有效 JSON", json.loads(body)["error"])

    def test_failed_pairs_disable_both_sources_independently_of_link_order(self):
        for failure in ("missing-html", "invalid-model"):
            for model_first in (False, True):
                with self.subTest(failure=failure, model_first=model_first):
                    html, model = self.task_pair()
                    page_name = html.relative_to(self.project).as_posix()
                    model_name = model.relative_to(self.project).as_posix()
                    links = [f"[Task](../../{page_name})", f"[Model](../../{model_name})"]
                    if model_first:
                        links.reverse()
                    ordinary = self.write("data/model.json", '{"note":"ordinary source"}')
                    self.entry.write_text("# Business\n" + "\n".join(links) +
                                          "\n[Ordinary](../../data/model.json)\n", encoding="utf-8")
                    healthy = self.catalog()
                    page = next(page for page in healthy["task_pages"] if page["path"] == page_name)
                    old_model_url = "/content/" + quote(model_name, safe="/") + "?sha256=" + page["model_sha256"]
                    html_bytes, model_bytes = html.read_bytes(), model.read_bytes()
                    if failure == "missing-html":
                        html.unlink()
                    else:
                        model.write_bytes(b'{truncated JSON')
                    failed = self.catalog()
                    self.assertEqual(failed["task_errors"][page_name], failed["task_errors"][model_name])
                    self.assertTrue({page_name, model_name}.isdisjoint(source["path"] for source in failed["sources"]))
                    entry = next(doc for doc in failed["documents"] if doc["path"] == failed["entry"])
                    self.assertTrue(all(not link["exists"] for link in entry["links"] if link["target"] in {page_name, model_name}))
                    self.assertTrue(next(link for link in entry["links"] if link["target"] == "data/model.json")["exists"])
                    self.assertNotIn("data/model.json", failed["task_errors"])
                    status, body, _ = self.get(old_model_url)
                    self.assertEqual(status, 404 if failure == "missing-html" else 422, body)
                    self.assertEqual(json.loads(body)["error"], failed["task_errors"][model_name])
                    self.assertEqual(self.content("data/model.json")[1], ordinary.read_bytes())

                    html.write_bytes(html_bytes)
                    model.write_bytes(model_bytes)
                    restored = self.catalog()
                    self.assertEqual(restored["task_errors"], {})
                    self.assertIn(model_name, {source["path"] for source in restored["sources"]})
                    self.assertEqual(next(page for page in restored["task_pages"] if page["path"] == page_name)["model_path"], model_name)
                    self.assertEqual(self.get(old_model_url)[1], model_bytes)

    def test_task_pair_batch_rechecks_changes_after_the_single_catalog_scan(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_task_batch", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for change in ("modify", "remove"):
            with self.subTest(change=change):
                html, model = self.task_pair()
                reader = module.ReaderProject(self.project, "docs/business/index.md",
                    [html.parent.relative_to(self.project).as_posix()])
                with patch.object(reader, "catalog", wraps=reader.catalog) as scans:
                    batch = reader.document_texts("all")
                    if change == "modify":
                        html.write_bytes(html.read_bytes() + b"<!-- later revision -->")
                    else:
                        model.unlink()
                    records = [row for row in batch["records"] if row.get("kind") == "task-page"]
                    scans.assert_called_once_with()
                self.assertEqual(len(records), 1)
                self.assertIn("error", records[0])
                self.assertNotIn("sha256", records[0])

    def test_parentheses_in_task_and_escaped_source_links_keep_their_full_targets(self):
        task_path = "docs/changes/复制(新).md"
        source_path = "src/规则(旧).ts"
        angle_path = "src/带 空格(新).py"
        self.write(task_path, "# 括号任务\n\n## 实施范围\n\n[返回业务](../business/index.md)\n")
        source = self.write(source_path, "export const state = 'draft';\n")
        angle_source = self.write(angle_path, "state = 'draft'\n")
        self.entry.write_text(self.entry.read_text(encoding="utf-8") +
                              "\n[括号任务](../changes/复制(新).md#实施范围)\n"
                              "[转义来源](../../src/规则\\(旧\\).ts)\n"
                              "[角括号来源](<../../src/带 空格(新).py>)\n", encoding="utf-8")
        catalog = self.catalog()
        documents = {page["path"]: page for page in catalog["documents"]}
        business = documents["docs/business/index.md"]
        task = documents[task_path]
        task_link = next(link for link in business["links"] if link["target"] == task_path)
        self.assertEqual(unquote(task_link["fragment"]), "实施范围")
        self.assertTrue(task_link["exists"])
        self.assertIn(business["path"], {page["path"] for page in task["backlinks"]})
        self.assertIn(source_path, {item["path"] for item in catalog["sources"]})
        status, body, _ = self.content(source_path)
        self.assertEqual(status, 200)
        self.assertEqual(body, source.read_bytes())
        status, body, _ = self.content(angle_path)
        self.assertEqual(status, 200)
        self.assertEqual(body, angle_source.read_bytes())

    def test_explicit_workflow_document_entry_is_readable_without_exposing_private_paths(self):
        self.stop_server()
        entry = self.write(".moluoxixi/knowledge/index.md", """# 项目业务知识

[业务现状](../../docs/business/index.md)
[状态规范](../../.trellis/spec/process.md)
[Git配置](../../.git/config)
[身份文件](../../.ssh/id_rsa)
[环境配置](../../.env)
""")
        specification = self.write(".trellis/spec/process.md", "# 状态规范\n\n草稿可以提交。\n")
        self.write(".git/config", "PRIVATE_GIT_FIXTURE\n")
        self.write(".ssh/id_rsa", "PRIVATE_IDENTITY_FIXTURE\n")
        self.start_server(".moluoxixi/knowledge/index.md")
        catalog = self.catalog()
        self.assertEqual(catalog["entry"], ".moluoxixi/knowledge/index.md")
        documents = {page["path"] for page in catalog["documents"]}
        self.assertIn(".moluoxixi/knowledge/index.md", documents)
        self.assertIn(".trellis/spec/process.md", documents)
        for path, original in ((".moluoxixi/knowledge/index.md", entry),
                               (".trellis/spec/process.md", specification)):
            with self.subTest(path=path):
                status, body, _ = self.content(path)
                self.assertEqual(status, 200)
                self.assertEqual(body, original.read_bytes())
        for path in (".git/config", ".ssh/id_rsa", ".env"):
            with self.subTest(path=path):
                status, body, _ = self.content(path)
                self.assertIn(status, (403, 404))
                self.assertNotIn(b"PRIVATE_GIT_FIXTURE", body)
                self.assertNotIn(b"PRIVATE_IDENTITY_FIXTURE", body)
                self.assertNotIn(b"FIXTURE_ONLY_DO_NOT_RENDER", body)

    def test_refresh_reads_changed_markdown_and_recalculates_relationships(self):
        first = self.catalog()
        before = next(page for page in first["documents"] if page["path"] == "docs/business/index.md")
        self.write("docs/changes/new.md", "# 新任务\n\n新发现的验收范围。\n")
        self.entry.write_text(self.entry.read_text(encoding="utf-8") +
                              "\n[新增任务](../changes/new.md)\n", encoding="utf-8")
        current = self.catalog()
        pages = {page["path"]: page for page in current["documents"]}
        self.assertNotEqual(before["sha256"], pages["docs/business/index.md"]["sha256"])
        self.assertIn("docs/business/index.md", {page["path"] for page in pages["docs/changes/new.md"]["backlinks"]})
        status, body, _ = self.content("docs/business/index.md")
        self.assertEqual(status, 200)
        self.assertEqual(body, self.entry.read_bytes())

    def test_reading_does_not_generate_or_modify_project_files(self):
        before = self.snapshot()
        self.catalog()
        self.content("docs/business/index.md")
        self.content("src/copy.py")
        self.get("/")
        self.catalog()
        self.assertEqual(self.snapshot(), before)

    def test_only_linked_safe_text_sources_can_be_read(self):
        catalog = self.catalog()
        sources = {source["path"] for source in catalog["sources"]}
        self.assertIn("src/copy.py", sources)
        self.assertNotIn("src/never.py", sources)
        self.assertNotIn("src/unrelated.py", sources)
        status, body, headers = self.content("src/copy.py")
        self.assertEqual(status, 200)
        self.assertEqual(body, self.source.read_bytes())
        self.assertEqual(headers.get("X-Content-Type-Options"), "nosniff")
        for path in ("src/never.py", "src/unrelated.py", ".env"):
            with self.subTest(path=path):
                status, body, _ = self.content(path)
                self.assertIn(status, (403, 404))
                self.assertNotIn(b"FIXTURE_ONLY_DO_NOT_RENDER", body)

    def test_authentication_and_token_business_sources_are_readable_when_linked(self):
        originals = {
            "src/auth.ts": "export const authRule = 'same-store owner';\n",
            "src/auth/permission.ts": "export const canEdit = state => state === 'draft';\n",
            "src/token.ts": "export const tokenLabel = '预约号';\n",
            "docs/auth.md": "# 身份与权限\n\n本店原发起人可以编辑草稿。\n",
            "docs/token.md": "# 预约号\n\n预约号用于查找本人的记录。\n",
        }
        for path, content in originals.items():
            self.write(path, content)
        # A business-related name alone does not grant access to an unrelated file.
        self.assertEqual(self.content("src/auth.ts")[0], 404)
        links = "\n".join(f"[业务依据 {index}](../../{path})"
                          for index, path in enumerate(originals))
        self.entry.write_text(self.entry.read_text(encoding="utf-8") + "\n" + links + "\n",
                              encoding="utf-8")
        catalog = self.catalog()
        available = {source["path"] for source in catalog["sources"]} | {
            document["path"] for document in catalog["documents"]
        }
        self.assertTrue(set(originals).issubset(available))
        for path, original in originals.items():
            with self.subTest(path=path):
                status, body, _ = self.content(path)
                self.assertEqual(status, 200)
                self.assertEqual(body.decode("utf-8"), original)

    def test_explicit_credential_stores_stay_private_when_linked(self):
        private_paths = (
            ".codex/auth.json", ".claude/.credentials.json", "credentials.json", "secrets.yaml",
        )
        for path in private_paths:
            self.write(path, "PRIVATE_STORAGE_FIXTURE\n")
        links = "\n".join(f"[凭据存储 {index}](../../{path})"
                          for index, path in enumerate(private_paths))
        self.entry.write_text(self.entry.read_text(encoding="utf-8") + "\n" + links + "\n",
                              encoding="utf-8")
        catalog = self.catalog()
        available = {source["path"] for source in catalog["sources"]} | {
            document["path"] for document in catalog["documents"]
        }
        self.assertTrue(set(private_paths).isdisjoint(available))
        for path in private_paths:
            with self.subTest(path=path):
                status, body, _ = self.content(path)
                self.assertIn(status, (403, 404))
                self.assertNotIn(b"PRIVATE_STORAGE_FIXTURE", body)

    def test_missing_and_hidden_references_are_reported_without_invented_content(self):
        catalog = self.catalog()
        sources = {source["path"] for source in catalog["sources"]}
        self.assertNotIn("src/not-found.py", sources)
        self.assertNotIn(".env", sources)
        warnings = json.dumps(catalog["warnings"], ensure_ascii=False)
        self.assertIn("not-found.py", warnings)
        self.assertNotIn("FIXTURE_ONLY_DO_NOT_RENDER", json.dumps(catalog))
        status, _, _ = self.content("src/not-found.py")
        self.assertIn(status, (403, 404))

    def test_project_and_static_asset_path_traversals_are_rejected(self):
        outside = self.base / "outside.txt"
        outside.write_text("EXTERNAL_FIXTURE_CONTENT", encoding="utf-8")
        for route in (
            "/content/../outside.txt", "/content/%2e%2e/outside.txt",
            "/content/%252e%252e/outside.txt", "/content/%2fetc/passwd",
            "/assets/../scripts/evidence.py", "/assets/%2e%2e/scripts/evidence.py",
            "/assets/%2e%2e/%2e%2e/scripts/evidence.py",
        ):
            with self.subTest(route=route):
                status, body, _ = self.get(route)
                self.assertIn(status, (400, 403, 404))
                self.assertNotIn(b"EXTERNAL_FIXTURE_CONTENT", body)
                self.assertNotIn(b"Record command execution facts", body)

    def test_linked_symlinks_cannot_expose_files_outside_the_project(self):
        outside = self.base / "outside.py"
        outside.write_text("EXTERNAL_LINK_FIXTURE = True\n", encoding="utf-8")
        alias = self.project / "src/linked.py"
        try:
            alias.symlink_to(outside)
        except OSError as error:
            self.skipTest(f"Symbolic links unavailable: {error}")
        self.entry.write_text(self.entry.read_text(encoding="utf-8") +
                              "\n[链接来源](../../src/linked.py)\n", encoding="utf-8")
        catalog = self.catalog()
        self.assertNotIn("src/linked.py", {source["path"] for source in catalog["sources"]})
        status, body, _ = self.content("src/linked.py")
        self.assertIn(status, (403, 404))
        self.assertNotIn(b"EXTERNAL_LINK_FIXTURE", body)

    def test_binary_and_oversized_linked_sources_remain_unavailable(self):
        binary = self.project / "src/binary.txt"
        binary.write_bytes(b"binary\0FIXTURE_CONTENT_MUST_NOT_BE_SERVED")
        large = self.project / "src/large.txt"
        large.write_bytes(b"x" * (3 * 1024 * 1024))
        self.entry.write_text(self.entry.read_text(encoding="utf-8") +
                              "\n[二进制](../../src/binary.txt)\n[过大来源](../../src/large.txt)\n",
                              encoding="utf-8")
        catalog = self.catalog()
        sources = {source["path"] for source in catalog["sources"]}
        self.assertNotIn("src/binary.txt", sources)
        self.assertNotIn("src/large.txt", sources)
        warnings = json.dumps(catalog["warnings"], ensure_ascii=False)
        self.assertIn("binary.txt", warnings)
        self.assertIn("large.txt", warnings)
        for path, expected in (("src/binary.txt", 415), ("src/large.txt", 413)):
            with self.subTest(path=path):
                status, body, _ = self.content(path)
                self.assertEqual(status, expected)
                self.assertNotIn(b"FIXTURE_CONTENT_MUST_NOT_BE_SERVED", body)
                self.assertLess(len(body), 4096)

    def test_oversized_markdown_fails_clearly_and_can_be_replaced(self):
        original = self.entry.read_bytes()
        try:
            self.entry.write_bytes(b"# Large\n" + b"x" * (3 * 1024 * 1024))
            status, body, _ = self.get("/api/catalog")
            self.assertEqual(status, 413)
            self.assertLess(len(body), 4096)
            self.assertNotIn(b"Traceback", body)
        finally:
            self.entry.write_bytes(original)
        self.assertEqual(self.get("/api/catalog")[0], 200)

    def test_text_html_sources_are_not_served_as_executable_html(self):
        source = self.write("src/source.html", "<script>throw new Error('source data only')</script>\n")
        self.entry.write_text(self.entry.read_text(encoding="utf-8") +
                              "\n[HTML依据](../../src/source.html)\n", encoding="utf-8")
        status, body, headers = self.content("src/source.html")
        self.assertEqual(status, 200)
        self.assertEqual(body, source.read_bytes())
        self.assertEqual(headers.get_content_type(), "text/plain")
        self.assertEqual(headers.get("X-Content-Type-Options"), "nosniff")

    def test_write_methods_do_not_modify_the_markdown(self):
        before = self.snapshot()
        request = Request(self.url + "/content/docs/business/index.md",
                          data=b"replace the business document", method="POST")
        try:
            response = self.opener.open(request, timeout=5)
        except HTTPError as error:
            response = error
        with response:
            self.assertIn(response.status, (405, 501))
        self.assertEqual(self.snapshot(), before)

    def test_unknown_routes_fail_and_entry_can_be_reloaded_after_an_error(self):
        self.assertEqual(self.get("/api/not-a-route")[0], 404)
        content = self.entry.read_bytes()
        self.entry.unlink()
        status, body, _ = self.get("/api/catalog")
        self.assertIn(status, (400, 404, 422))
        self.assertNotIn(b"Traceback", body)
        self.entry.write_bytes(content)
        self.assertEqual(self.get("/api/catalog")[0], 200)


class ReaderServerTest(unittest.TestCase):
    def test_embedded_task_failures_notify_the_current_request_without_changing_json_or_sandbox_boundaries(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_embed_failure", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-embed-failure-") as directory:
            project = Path(directory)
            html, model = "tasks/repair/handbook.html", "tasks/repair/model.json"
            folder = (project / html).parent
            folder.mkdir(parents=True)
            page_data = b'<h1>Task</h1><a href="model.json">AI record</a>'
            model_data = b'{"work":{"id":"repair","title":"Repair","revision":1}}'
            (project / html).write_bytes(page_data)
            (project / model).write_bytes(model_data)
            entry = project / "index.md"
            entry_data = f'# Business\n[Task]({quote(html, safe="/")})\n'.encode()
            entry.write_bytes(entry_data)
            reader = module.ReaderProject(project, "index.md", [])
            page = reader.catalog()["task_pages"][0]
            token = "0123456789abcdef" * 2
            base = f"/task-page/{page['sha256']}/{page['model_sha256']}/"
            route = base + quote(html, safe="/")
            embedded = route + "?view=detail&embed=1&embed_request=" + token
            expected = {"type": "requirement-flow:task-page-error", "request": token, "path": html,
                        "sha256": page["sha256"], "model_sha256": page["model_sha256"]}
            with module.create_server(reader, 0) as server:
                thread = threading.Thread(target=server.serve_forever, daemon=True)
                thread.start()
                opener = build_opener(ProxyHandler({}))

                def get(target):
                    try:
                        response = opener.open(f"http://127.0.0.1:{server.server_port}{target}", timeout=5)
                    except HTTPError as error:
                        response = error
                    with response:
                        return response.status, response.read(), response.headers

                def check_notification(status, source, name=html, failure=None):
                    behavior = {"wraps": reader.task_page_content} if failure is None else {"side_effect": failure}
                    with patch.object(reader, "task_page_content", **behavior) as read:
                        actual, data, headers = get(base + quote(name, safe="/") + "?view=detail&embed=1&embed_request=" + token)
                    self.assertEqual(actual, status)
                    read.assert_called_once_with(name, page["sha256"], page["model_sha256"])
                    self.assertTrue(headers["Content-Type"].startswith("text/html"))
                    self.assertEqual(headers["Content-Security-Policy"], module.TASK_PAGE_CSP)
                    text = data.decode()
                    self.assertIn(source, text)
                    message = re.search(r"<script>parent\.postMessage\((.*), '\*'\);</script>", text)
                    self.assertIsNotNone(message, text)
                    self.assertEqual(json.loads(message.group(1)), {**expected, "path": name})
                    self.assertEqual(text.count("</script>"), 1)
                    self.assertNotIn("tasks/</script>", text)
                    if "</script>" in name:
                        self.assertIn(r"\u003c/script\u003e", message.group(1))

                try:
                    status, data, headers = get(embedded)
                    self.assertEqual(status, 200)
                    self.assertEqual(data, page_data + b'<style>.app-head>header{display:none!important}</style>')
                    self.assertEqual(headers["Content-Security-Policy"], module.TASK_PAGE_CSP)
                    (project / model).write_bytes(b'{"work":{"id":"repair","title":"Repair","revision":2}}')
                    check_notification(409, "已更新")
                    for target in (route, base + quote(model, safe="/")):
                        status, data, headers = get(target)
                        self.assertEqual(status, 409)
                        self.assertTrue(headers["Content-Type"].startswith("application/json"))
                        self.assertIn("已更新", json.loads(data)["error"])
                    entry.unlink()
                    check_notification(404, "index.md")
                    status, data, headers = get(route)
                    self.assertEqual(status, 404)
                    self.assertEqual(json.loads(data)["error_stage"], "catalog")
                    self.assertEqual(json.loads(data)["error_source"], "index.md")
                    entry.write_bytes(entry_data)
                    (project / model).unlink()
                    check_notification(404, model)
                    # Exercise hostile URL/error serialization without creating a Windows-invalid filename.
                    hostile_path = "tasks/</script>/handbook.html"
                    hostile_error = module.ReaderError("来源不存在：tasks/</script>/model.json", 404)
                    check_notification(404, "tasks/&lt;/script&gt;/model.json", hostile_path, hostile_error)
                    for query in ("?embed=1", "?embed=1&embed_request=" + quote("</script>")):
                        with patch.object(reader, "task_page_content", side_effect=hostile_error) as read:
                            status, data, headers = get(base + quote(hostile_path, safe="/") + query)
                        read.assert_called_once_with(hostile_path, page["sha256"], page["model_sha256"])
                        self.assertEqual(status, 404)
                        self.assertTrue(headers["Content-Type"].startswith("text/html"))
                        self.assertNotIn(b"<script>", data)
                        self.assertIn(b"tasks/&lt;/script&gt;/model.json", data)
                    status, data, headers = get("/content/missing.txt?embed=1&embed_request=" + token)
                    self.assertEqual(status, 404)
                    self.assertTrue(headers["Content-Type"].startswith("application/json"))
                    self.assertIn("error", json.loads(data))
                    self.assertEqual((project / html).read_bytes(), page_data)
                finally:
                    server.shutdown()
                    thread.join(timeout=2)
                self.assertFalse(thread.is_alive())

    def test_catalog_failures_report_the_entry_in_all_http_reads_and_recover_without_mislabeling_targets(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_catalog_failure_stage", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-catalog-failure-stage-") as directory:
            project = Path(directory)
            entry_name = "docs/business/index.md"
            entry = project / entry_name
            entry.parent.mkdir(parents=True)
            first = b'# Business\n[Rule](rule.md#fast)\n[Receipt](../../receipt.txt)\n'
            entry.write_bytes(first)
            rule = entry.with_name("rule.md")
            rule.write_bytes(b'# Rule\nSeven days\n')
            receipt = project / "receipt.txt"
            receipt.write_bytes(b'Verified receipt R1\n')
            folder = project / "tasks/repair"
            folder.mkdir(parents=True)
            (folder / "handbook.html").write_bytes(b'<h1>Repair</h1>')
            (folder / "model.json").write_bytes(b'{"work":{"id":"repair","title":"Repair","revision":1}}')
            reader = module.ReaderProject(project, entry_name, ["tasks"])
            original = reader.catalog()
            page = original["task_pages"][0]
            receipt_sha = hashlib.sha256(receipt.read_bytes()).hexdigest()
            routes = ["/api/catalog", "/api/document-texts?scope=all", "/api/document-texts?scope=tasks",
                f"/content/receipt.txt?sha256={receipt_sha}",
                f"/content/{page['model_path']}?sha256={page['model_sha256']}",
                *[f"/task-page/{page['sha256']}/{page['model_sha256']}/{name}" for name in (page["path"], page["model_path"])]]
            with module.create_server(reader, 0) as server:
                thread = threading.Thread(target=server.serve_forever, daemon=True)
                thread.start()
                opener = build_opener(ProxyHandler({}))

                def get(route):
                    try:
                        response = opener.open(f"http://127.0.0.1:{server.server_port}{route}", timeout=5)
                    except HTTPError as error:
                        response = error
                    with response:
                        return response.status, response.read()

                try:
                    for state, status in (("missing-entry", 404), ("invalid-entry", 415)):
                        if state == "missing-entry":
                            entry.unlink()
                        else:
                            entry.write_bytes(b'\xff')
                        for route in routes:
                            with self.subTest(state=state, route=route), \
                                    patch.object(module, "text_file", wraps=module.text_file) as reads:
                                actual, data = get(route)
                                body = json.loads(data)
                                self.assertEqual(actual, status)
                                self.assertEqual(body.get("error_stage"), "catalog")
                                self.assertEqual(body.get("error_source"), entry_name)
                                self.assertNotIn("scope_limited", body)
                                self.assertEqual([call.args[1] for call in reads.call_args_list], [entry_name])
                        entry.write_bytes(first)
                        for route in routes:
                            with self.subTest(state="restored-" + state, route=route):
                                self.assertEqual(get(route)[0], 200)
                    second = b'# Business R2\n[Check](rule.md#check)\n[Receipt](../../receipt.txt)\n'
                    entry.write_bytes(second)
                    for route in routes:
                        with self.subTest(state="current-r2", route=route):
                            status, data = get(route)
                            self.assertEqual(status, 200)
                            if route.startswith("/api/"):
                                body = json.loads(data)
                                self.assertNotIn("error_stage", body)
                                self.assertEqual(body["navigation"][1]["label"], "Check")
                                self.assertEqual(body["navigation"][1]["fragment"], "check")
                    # A readable entry with a bad child is a target failure, not a failed catalog.
                    rule.unlink()
                    status, data = get("/content/docs/business/rule.md")
                    self.assertEqual(status, 404)
                    self.assertNotIn("error_stage", json.loads(data))
                    self.assertNotIn("error_source", json.loads(data))
                    receipt.write_bytes(b'Verified receipt R2\n')
                    status, data = get(f"/content/receipt.txt?sha256={receipt_sha}")
                    self.assertEqual(status, 409)
                    self.assertNotIn("error_stage", json.loads(data))
                    self.assertNotIn("error_source", json.loads(data))
                    (folder / "model.json").write_bytes(b'{"work":{"id":"repair","title":"Repair","revision":2}}')
                    status, data = get(routes[-1])
                    self.assertEqual(status, 409)
                    self.assertNotIn("error_stage", json.loads(data))
                    reader.metadata_cache.clear()
                    with patch.object(module.MarkdownMetadata, "__enter__", side_effect=module.ReaderError("Metadata unavailable", 503)):
                        status, data = get("/content/receipt.txt")
                    self.assertEqual(status, 503)
                    self.assertEqual(json.loads(data).get("error_stage"), "catalog")
                    self.assertNotIn("error_source", json.loads(data), "An environment failure must not be attributed to the requested receipt")
                finally:
                    server.shutdown()
                    thread.join(timeout=2)
                self.assertFalse(thread.is_alive())

    def test_protocol_publication_declares_a_cold_pair_even_when_its_page_is_missing(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_publication_pair", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for bom in (False, True):
            for model_first in (False, True):
                with self.subTest(bom=bom, model_first=model_first), \
                        tempfile.TemporaryDirectory(prefix="requirement-flow-publication-pair-") as directory:
                    project = Path(directory)
                    folder = project / "handoff/pickup"
                    folder.mkdir(parents=True)
                    value = {"protocol": {"publication": {"human": "handbook.html", "agent": "model.json"}},
                             "work": {"id": "pickup", "title": "Pickup", "revision": 1}}
                    data = json.dumps(value).encode()
                    if bom:
                        data = b"\xef\xbb\xbf" + data
                    (folder / "model.json").write_bytes(data)
                    html, model = "handoff/pickup/handbook.html", "handoff/pickup/model.json"
                    links = [f"[Task]({html})", f"[Model]({model})"]
                    if model_first:
                        links.reverse()
                    (project / "index.md").write_text("# Business\n" + "\n".join(links), encoding="utf-8")
                    reader = module.ReaderProject(project, "index.md", [])
                    current = reader.catalog()
                    self.assertEqual(current["task_pages"], [])
                    self.assertEqual(current["task_errors"][html], current["task_errors"][model])
                    self.assertIn(html, current["task_errors"][model])
                    self.assertNotIn(model, {source["path"] for source in current["sources"]})
                    self.assertTrue(all(not link["exists"] for link in current["documents"][0]["links"]))
                    with self.assertRaises(module.ReaderError):
                        reader.content(model, hashlib.sha256(data).hexdigest())

    def test_authored_task_view_and_ai_links_identify_cold_broken_pairs_in_either_order(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_authored_pair", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with patch.object(module.subprocess, "Popen", wraps=module.subprocess.Popen) as starts:
            with module.MarkdownMetadata() as metadata, \
                    patch.object(module, "MarkdownMetadata", side_effect=lambda: nullcontext(metadata)), \
                    patch.object(metadata, "read", wraps=metadata.read) as reads:
                for scanned in (False, True):
                    for model_first in (False, True):
                        for model_data in (b'{"work":', b'{"currency":"CNY"}', b'{"work":{}}'):
                            for view in (None, "overview", "detail", "unsupported", "", "overview&view="):
                                with self.subTest(scanned=scanned, model_first=model_first, model_data=model_data, view=view), \
                                        tempfile.TemporaryDirectory(prefix="requirement-flow-authored-pair-") as directory:
                                    project = Path(directory)
                                    folder = project / "docs/changes/pickup"
                                    folder.mkdir(parents=True)
                                    (folder / "handbook.html").write_bytes(b'<h1>Task page without a digest declaration</h1>')
                                    (folder / "model.json").write_bytes(model_data)
                                    html, model = "docs/changes/pickup/handbook.html", "docs/changes/pickup/model.json"
                                    query = "" if view is None else "?view=" + view
                                    links = [f"[Task]({html}{query}#node=pickup)", f"[Model]({model})"]
                                    if model_first:
                                        links.reverse()
                                    (project / "index.md").write_text("# Business\n" + "\n".join(links), encoding="utf-8")
                                    # Only the source-to-metadata parser is shared; every project starts cold.
                                    reader = module.ReaderProject(project, "index.md", None if scanned else [])
                                    self.assertEqual(reader.metadata_cache, {})
                                    self.assertEqual(reader.confirmed_tasks, set())
                                    current = reader.catalog()
                                    link = next(link for link in current["documents"][0]["links"] if link["target"] == html)
                                    if view in ("unsupported", "", "overview&view="):
                                        self.assertEqual(current["task_errors"], {})
                                        self.assertEqual(current["task_pages"], [])
                                        self.assertTrue(all(link["kind"] == "source" and link["exists"]
                                                            for link in current["documents"][0]["links"]))
                                        self.assertEqual(reader.content(model), model_data)
                                        continue
                                    self.assertEqual((link["kind"], link["query"], link["fragment"]),
                                                     ("task-page", query.lstrip("?"), "node=pickup"))
                                    if model_data == b'{"work":{}}':
                                        self.assertEqual(current["task_errors"], {})
                                        self.assertEqual(current["task_pages"][0]["path"], html)
                                        self.assertTrue(link["exists"])
                                    else:
                                        self.assertEqual(current["task_errors"][html], current["task_errors"][model])
                                        self.assertTrue(current["warnings"])
                                        self.assertFalse(link["exists"])
                                        self.assertTrue({html, model}.isdisjoint(source["path"] for source in current["sources"]))
                                        with self.assertRaises(module.ReaderError) as refused:
                                            reader.content(model)
                                        self.assertIn("JSON" if model_data == b'{"work":' else "work", str(refused.exception))
                self.assertEqual(reads.call_count, 72)
                starts.assert_called_once()
            self.assertIsNotNone(metadata.process.poll())
            self.assertTrue(metadata.process.stdin.closed)
            self.assertTrue(metadata.process.stdout.closed)

    def test_global_task_evidence_makes_the_first_catalog_independent_of_document_order(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_global_intent", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for placement in ("same", "split", "late-intent", "two-children"):
            for reverse in (False, True):
                for model_data in (b'{"work":', b'{"currency":"CNY"}', b'{"work":{}}'):
                    with self.subTest(placement=placement, reverse=reverse, model_data=model_data), \
                            tempfile.TemporaryDirectory(prefix="requirement-flow-global-intent-") as directory:
                        project = Path(directory)
                        folder = project / "docs/changes/pickup"
                        folder.mkdir(parents=True)
                        html, model = "docs/changes/pickup/handbook.html", "docs/changes/pickup/model.json"
                        (project / html).write_bytes(b'<h1>Task without a digest declaration</h1>')
                        (project / model).write_bytes(model_data)
                        page = f"[Task]({html}?view=detail)"
                        ai = f"[Model]({model})"
                        if placement == "same":
                            entry, handoff = [page, ai], []
                        elif placement == "two-children":
                            entry, handoff = ["[Owner](owner.md)", "[Handoff](handoff.md)"], [ai]
                            (project / "owner.md").write_text("# Owner\n" + page, encoding="utf-8")
                        else:
                            entry, handoff = [page, "[Handoff](handoff.md)"], [ai]
                            if placement == "late-intent":
                                entry[0] = f"[Task]({html}#node=pickup)"
                                handoff.insert(0, f"[Task]({html}#node=pickup)")
                        if reverse:
                            entry.reverse()
                            handoff.reverse()
                        (project / "index.md").write_text("# Business\n" + "\n".join(entry), encoding="utf-8")
                        (project / "handoff.md").write_text("# Handoff\n" + "\n".join(handoff), encoding="utf-8")
                        reader = module.ReaderProject(project, "index.md")
                        with patch.object(module, "text_file", wraps=module.text_file) as reads, \
                                patch.object(module.json, "loads", wraps=module.json.loads) as parses:
                            first = reader.catalog()
                        self.assertEqual(sum(call.args[1] == model for call in reads.call_args_list), 1)
                        self.assertEqual(sum(call.args[0] == model_data for call in parses.call_args_list), 1)
                        second = reader.catalog()
                        for key in ("documents", "task_pages", "navigation", "task_errors", "sources", "warnings"):
                            self.assertEqual(first[key], second[key])
                        references = [(document, link) for document in first["documents"]
                                      for link in document["links"] if link["target"] == html]
                        self.assertTrue(references)
                        self.assertTrue(all(link["kind"] == "task-page" for _document, link in references))
                        if model_data == b'{"work":{}}':
                            self.assertEqual(first["task_errors"], {})
                            task = first["task_pages"][0]
                            self.assertEqual({row["path"] for row in task["backlinks"]},
                                             {document["path"] for document in first["documents"]
                                              if any(link["target"] in {html, model} and link["exists"]
                                                     for link in document["links"])})
                            if placement != "two-children":
                                navigation = next(row for row in first["navigation"] if row["path"] == html)
                                self.assertEqual(navigation["query"], "" if placement == "late-intent" else "view=detail")
                        else:
                            self.assertEqual(first["task_errors"][html], first["task_errors"][model])
                            self.assertTrue(all(not link["exists"] for _document, link in references))
                            self.assertTrue({html, model}.isdisjoint(source["path"] for source in first["sources"]))
                            with self.assertRaises(module.ReaderError):
                                reader.content(model)

    def test_healthy_task_backlinks_include_exact_model_references_and_deduplicate_each_document(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_task_model_backlinks", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-model-backlinks-") as directory:
            project = Path(directory)
            folder = project / "working"
            folder.mkdir()
            (folder / "handbook.html").write_bytes(b'<h1>Working task</h1>')
            model = folder / "model.json"
            model.write_bytes(b'{"work":{}}')
            (folder / "terms.json").write_bytes(b'{"currency":"CNY"}')
            (project / "ordinary").mkdir()
            (project / "ordinary/model.json").write_bytes(b'{"work":{"id":"WO-23","title":"Pump inspection"}}')
            (project / "index.md").write_text("# Business\n[Task](working/handbook.html?view=detail#node=pickup)\n"
                "[Repair](repair.md)\n[Handoff](handoff.md)\n[Terms](terms.md)\n[Ordinary](ordinary.md)\n", encoding="utf-8")
            (project / "repair.md").write_bytes(b'# Repair\n[AI](working/model.json)\n')
            (project / "handoff.md").write_bytes(b'# Handoff\n[Page](working/handbook.html)\n[AI](working/model.json)\n')
            (project / "terms.md").write_bytes(b'# Terms\n[Terms](working/terms.json)\n')
            (project / "ordinary.md").write_bytes(b'# Ordinary work order\n[Record](ordinary/model.json)\n')
            reader = module.ReaderProject(project, "index.md", [])
            current = reader.catalog()
            page = current["task_pages"][0]
            self.assertEqual({row["path"] for row in page["backlinks"]}, {"index.md", "repair.md", "handoff.md"})
            self.assertEqual(len(page["backlinks"]), 3)
            repair = next(row for row in current["documents"] if row["path"] == "repair.md")["links"][0]
            self.assertEqual((repair["kind"], repair["target"], repair["exists"]), ("source", "working/model.json", True))
            self.assertEqual(reader.task_page_content("working/model.json", page["sha256"], page["model_sha256"]), model.read_bytes())
            model.write_bytes(b'{"work":')
            failed = reader.catalog()
            self.assertEqual(failed["task_pages"], [])
            self.assertIn("working/model.json", failed["task_errors"])
            for source in ("working/terms.json", "ordinary/model.json"):
                self.assertNotIn(source, failed["task_errors"])
                self.assertEqual(reader.content(source), (project / source).read_bytes())

    def test_markdown_scope_errors_preserve_known_failures_and_do_not_guess_unchecked_files(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_scope_errors", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-scope-errors-") as directory:
            project = Path(directory)
            targets = ["missing.md", "invalid.md", "guide.md", "extra.md", "unchecked-missing.md", "unchecked-valid.md", "large.txt"]
            (project / "index.md").write_text("# Business\n" + "\n".join(f"[Source]({name})" for name in targets), encoding="utf-8")
            (project / "invalid.md").write_bytes(b'\xff')
            for name in ("guide.md", "extra.md", "unchecked-valid.md"):
                (project / name).write_bytes(b'# Readable rule\n')
            (project / "large.txt").write_bytes(b'x' * (module.MAX_BYTES + 1))
            reader = module.ReaderProject(project, "index.md", [])
            with patch.object(module, "MAX_DOCUMENTS", 2):
                with patch.object(module, "text_file", wraps=module.text_file) as reads:
                    current = reader.catalog()
                self.assertEqual({row["path"] for row in current["documents"]}, {"index.md", "guide.md"})
                self.assertFalse(any(call.args[1].startswith("unchecked-") for call in reads.call_args_list))
                links = {link["target"]: link for link in current["documents"][0]["links"]}
                for name, status in (("missing.md", 404), ("invalid.md", 415)):
                    self.assertEqual(links[name]["status"], status)
                    self.assertNotIn("scope_limited", links[name])
                self.assertTrue(links["guide.md"]["exists"])
                for name in ("extra.md", "unchecked-missing.md", "unchecked-valid.md"):
                    self.assertEqual(links[name]["status"], 413)
                    self.assertTrue(links[name]["scope_limited"])
                    self.assertFalse(links[name]["exists"])
                    self.assertEqual(current["document_errors"][name],
                                     {key: links[name][key] for key in ("error", "status", "scope_limited")})
                self.assertTrue(links["extra.md"]["error"].startswith("文档读取超过 2 份"))
                for name in ("unchecked-missing.md", "unchecked-valid.md"):
                    self.assertTrue(links[name]["error"].startswith("本次未检查："))
                    self.assertNotIn("不存在", links[name]["error"])
                self.assertEqual(links["large.txt"]["status"], 413)
                self.assertNotIn("scope_limited", links["large.txt"])
                self.assertNotIn("large.txt", current["document_errors"])
                with module.create_server(reader, 0) as server:
                    thread = threading.Thread(target=server.serve_forever, daemon=True)
                    thread.start()
                    opener = build_opener(ProxyHandler({}))
                    try:
                        for name in targets:
                            try:
                                response = opener.open(f"http://127.0.0.1:{server.server_port}/content/{name}", timeout=5)
                            except HTTPError as error:
                                response = error
                            with response:
                                status, data = response.status, response.read()
                            self.assertEqual(status, 200 if name == "guide.md" else links[name]["status"])
                            if name != "guide.md":
                                self.assertEqual(json.loads(data)["error"], links[name]["error"])
                    finally:
                        server.shutdown()
                        thread.join(timeout=2)
                (project / "standalone.md").write_bytes(b'# Standalone scope\n')
                (project / "tasks").mkdir()
                for name in ("a.md", "b.md", "c.md"):
                    (project / "tasks" / name).write_bytes(b'# Task\n')
                unlinked = module.ReaderProject(project, "standalone.md", ["tasks"])
                scoped = unlinked.catalog()
                self.assertEqual(scoped["documents"][0]["links"], [])
                for name in ("tasks/b.md", "tasks/c.md"):
                    self.assertTrue(scoped["document_errors"][name]["scope_limited"])
                    with self.assertRaises(module.ReaderError) as refused:
                        unlinked.content(name)
                    self.assertEqual(refused.exception.status, 413)
                    self.assertEqual(str(refused.exception), scoped["document_errors"][name]["error"])

    def test_unreadable_markdown_targets_do_not_consume_readable_document_capacity(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_readable_capacity", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-readable-capacity-") as directory:
            project = Path(directory)
            (project / "index.md").write_bytes(b'# Business\n[Missing](missing.md)\n[Invalid](invalid.md)\n[Guide](guide.md)\n')
            (project / "invalid.md").write_bytes(b'\xff')
            (project / "guide.md").write_bytes(b'# Guide\nCurrent readable rule\n')
            reader = module.ReaderProject(project, "index.md", [])
            with patch.object(module, "MAX_DOCUMENTS", 2):
                current = reader.catalog()
                self.assertEqual({row["path"] for row in current["documents"]}, {"index.md", "guide.md"})
                self.assertEqual([row["path"] for row in current["navigation"]],
                                 ["index.md", "missing.md", "invalid.md", "guide.md"])
                self.assertFalse(any("文档读取超过" in warning for warning in current["warnings"]))
                self.assertEqual(len(current["warnings"]), 2)
                self.assertTrue(all(warning.startswith("index.md → ") for warning in current["warnings"]))
                links = current["documents"][0]["links"]
                self.assertEqual([link.get("status") for link in links], [404, 415, None])
                self.assertTrue(links[-1]["exists"])
                self.assertEqual(reader.content("guide.md"), (project / "guide.md").read_bytes())
                (project / "extra.md").write_bytes(b'# Extra readable document\n')
                with (project / "index.md").open("ab") as entry:
                    entry.write(b'[Extra](extra.md)\n')
                capped = reader.catalog()
                self.assertEqual({row["path"] for row in capped["documents"]}, {"index.md", "guide.md"})
                self.assertTrue(any("收录上限为 2 份" in warning for warning in capped["warnings"]))
                self.assertEqual(len(capped["warnings"]), 3)
                self.assertFalse(capped["documents"][0]["links"][-1]["exists"])

    def test_symlink_failures_keep_lexical_link_types_without_reading_alias_or_target(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_typed_symlinks", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-typed-symlinks-") as directory:
            project = Path(directory)
            (project / "docs").mkdir()
            (project / "assets").mkdir()
            (project / "index.md").write_bytes(b'# Business\n[Guide](docs/guide.md)\n')
            (project / "docs/guide.md").write_text('# Guide\n[Sign](../assets/sign%20copy.txt#审核%26例)\n'
                '[Rule](../assets/rule.md#条款)\n[Keep](../assets/keep.txt)\n[Escape](../../outside.txt)\n', encoding="utf-8")
            sign, rule = project / "assets/sign copy.txt", project / "assets/rule.md"
            sign.write_bytes(b'Original sign\n')
            rule.write_bytes(b'# Original rule\n')
            (project / "assets/keep.txt").write_bytes(b'Valid attachment\n')
            targets = (project / "assets/ok.txt", project / "assets/ok.md")
            targets[0].write_bytes(b'Unrelated sign\n')
            targets[1].write_bytes(b'# Unrelated rule\n')
            reader = module.ReaderProject(project, "index.md", [])
            reader.catalog()
            sign.unlink()
            rule.unlink()
            try:
                sign.symlink_to("ok.txt")
                rule.symlink_to("ok.md")
            except OSError as error:
                self.skipTest(str(error))
            original_read = Path.read_bytes

            def guarded_read(path):
                self.assertNotIn(path, {sign, rule, *targets}, "A symlink or its unrelated target was read")
                return original_read(path)

            with patch.object(Path, "read_bytes", guarded_read):
                current = reader.catalog()
                for scope in ("all", "tasks"):
                    batch = reader.document_texts(scope)
                    rows = {row["path"]: row for row in batch["records"]}
                    self.assertEqual(rows["assets/rule.md"]["status"], 403)
                    checks = {row["path"]: row for row in batch["source_checks"]}
                    self.assertEqual(checks["assets/sign copy.txt"]["status"], 403)
                    self.assertIn("符号链接", checks["assets/sign copy.txt"]["error"])
            guide = next(row for row in current["documents"] if row["path"] == "docs/guide.md")
            for name, kind, fragment in (("assets/sign copy.txt", "source", "审核&例"),
                                         ("assets/rule.md", "document", "条款")):
                link = next(row for row in guide["links"] if row["target"] == name)
                self.assertEqual((link["kind"], link["fragment"], link["status"], link["exists"]), (kind, fragment, 403, False))
                self.assertIn("符号链接", link["error"])
            escaped = next(row for row in guide["links"] if row["label"] == "Escape")
            self.assertEqual(escaped["kind"], "external")
            self.assertEqual(current["document_errors"]["assets/rule.md"]["status"], 403)

    def test_batch_preserves_current_document_errors_and_never_invents_unreachable_errors(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_md_error_rows", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-md-error-rows-") as directory:
            project = Path(directory)
            entry = project / "index.md"
            entry.write_bytes(b'# Business\n[Old](old.md)\n')
            (project / "old.md").write_bytes(b'# Old\n')
            reader = module.ReaderProject(project, "index.md", [])
            reader.catalog()
            (project / "old.md").unlink()
            entry.write_bytes(b'# Business\n[Missing](missing.md)\n[Invalid](invalid.md)\n[Guide](guide.md)\n[Extra](extra.md)\n[Unknown](later.md)\n')
            (project / "invalid.md").write_bytes(b'\xff')
            (project / "guide.md").write_bytes(b'# Guide\n')
            (project / "extra.md").write_bytes(b'# Extra\n')
            with patch.object(module, "MAX_DOCUMENTS", 2):
                current = reader.catalog()
                for scope in ("all", "tasks"):
                    with patch.object(reader, "catalog", return_value=current) as scans, \
                            patch.object(module, "text_file", wraps=module.text_file) as reads:
                        rows = {row["path"]: row for row in reader.document_texts(scope)["records"]}
                    scans.assert_called_once_with()
                    for name, error in current["document_errors"].items():
                        self.assertEqual(rows[name], {"path": name, **error})
                        self.assertFalse(any(call.args[1] == name for call in reads.call_args_list))
                    self.assertNotIn("old.md", rows)
                    self.assertEqual(rows["missing.md"]["status"], 404)
                    self.assertEqual(rows["invalid.md"]["status"], 415)
                    self.assertTrue(rows["extra.md"]["scope_limited"])
                    self.assertTrue(rows["later.md"]["scope_limited"])

    def test_known_task_missing_parts_take_precedence_over_capacity_in_explicit_and_md_modes(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_quota_missing", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for mode in ("explicit", "markdown"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory(prefix="requirement-flow-quota-missing-") as directory:
                project = Path(directory)

                def pair(name):
                    folder = project / "tasks" / name
                    folder.mkdir(parents=True)
                    (folder / "handbook.html").write_bytes(b'<h1>Task</h1>')
                    (folder / "model.json").write_text(json.dumps({"work": {"id": name, "title": name}}), encoding="utf-8")

                pair("z")
                entry = project / "index.md"
                entry.write_text("# Business\n" + ("[Z](tasks/z/handbook.html)\n" if mode == "markdown" else ""), encoding="utf-8")
                reader = module.ReaderProject(project, "index.md", ["tasks", "tasks/z/handbook.html"] if mode == "explicit" else [])
                with patch.object(module, "MAX_DOCUMENTS", 1):
                    page = reader.catalog()["task_pages"][0]
                    pair("a")
                    if mode == "markdown":
                        entry.write_bytes(b'# Business\n[A](tasks/a/handbook.html)\n[Z](tasks/z/handbook.html)\n[AI](tasks/z/model.json)\n')
                    self.assertEqual(reader.catalog()["task_error_statuses"]["tasks/z/model.json"], 413)
                    (project / "tasks/z/model.json").unlink()
                    with patch.object(module, "text_file", wraps=module.text_file) as reads:
                        missing = reader.catalog()
                    with self.subTest(check="missing status"):
                        self.assertEqual(missing["task_error_statuses"]["tasks/z/model.json"], 404)
                        self.assertIn("tasks/z/model.json", missing["task_errors"]["tasks/z/handbook.html"])
                    with self.subTest(check="no over-quota payload read"):
                        self.assertFalse(any(call.args[1] in {"tasks/z/handbook.html", "tasks/z/model.json"} for call in reads.call_args_list))
                    for name in ("tasks/z/handbook.html", "tasks/z/model.json"):
                        for read in (lambda: reader.content(name),
                                     lambda: reader.task_page_content(name, page["sha256"], page["model_sha256"])):
                            with self.assertRaises(module.ReaderError) as unavailable:
                                read()
                            self.assertEqual(unavailable.exception.status, 404)

    def test_batches_publish_current_entry_navigation_without_reading_targets_again(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_batch_navigation", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-batch-navigation-") as directory:
            project = Path(directory)
            (project / "terms.md").write_bytes(b'# Terms\n## fast\nSeven days\n## slow\nFourteen days\n')
            (project / "hub.md").write_bytes(b'# Hub\n[Terms remain reachable](terms.md#slow)\n')
            folder = project / "docs/changes/task"
            folder.mkdir(parents=True)
            (folder / "handbook.html").write_bytes(b'<h1>Independently collected task</h1>')
            (folder / "model.json").write_bytes(b'{"work":{"id":"task","title":"Task"}}')
            task = "docs/changes/task/handbook.html"
            initial = f"# Business entry\n[Fast rule](terms.md#fast)\n[Hub](hub.md)\n[Fast task]({task}?view=detail&q=first&features=A#node=fast)\n".encode()
            entry = project / "index.md"
            entry.write_bytes(initial)
            reader = module.ReaderProject(project, "index.md")
            original = reader.catalog()
            terms_sha = next(row["sha256"] for row in original["documents"] if row["path"] == "terms.md")
            model_sha = original["task_pages"][0]["model_sha256"]
            for state, content in (("changed", f"# Business entry\n[Slow rule](terms.md#slow)\n[Hub](hub.md)\n[Slow task]({task}?features=B&q=after&view=overview#node=slow)\n".encode()),
                                   ("removed", b'# Business entry\n[Hub](hub.md)\n'), ("restored", initial)):
                with self.subTest(state=state):
                    entry.write_bytes(content)
                    snapshot = reader.catalog()
                    self.assertEqual(next(row["sha256"] for row in snapshot["documents"] if row["path"] == "terms.md"), terms_sha)
                    self.assertEqual(snapshot["task_pages"][0]["model_sha256"], model_sha)
                    if state == "removed":
                        self.assertEqual([row["path"] for row in snapshot["navigation"]], ["index.md", "hub.md"])
                    else:
                        rule = next(row for row in snapshot["navigation"] if row["path"] == "terms.md")
                        page = next(row for row in snapshot["navigation"] if row["path"] == task)
                        self.assertEqual((rule["label"], rule["fragment"]), ("Slow rule", "slow") if state == "changed" else ("Fast rule", "fast"))
                        self.assertEqual((page["label"], page["query"], page["fragment"]),
                            ("Slow task", "features=B&q=after&view=overview", "node=slow") if state == "changed" else
                            ("Fast task", "features=A&q=first&view=detail", "node=fast"))
                    for scope in ("all", "tasks"):
                        with patch.object(reader, "catalog", return_value=snapshot) as scans, \
                                patch.object(module, "text_file", side_effect=AssertionError("Navigation caused an extra file read")):
                            batch = reader.document_texts(scope)
                            self.assertEqual(batch.get("navigation"), snapshot["navigation"])
                            encoded = json.loads(b''.join(module.json_batch({**batch, "records": iter(())})))
                            self.assertEqual(encoded["navigation"], snapshot["navigation"])
                        scans.assert_called_once_with()

    def test_batches_withdraw_navigation_only_when_the_entry_read_fails_during_streaming(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_navigation_race", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-navigation-race-") as directory:
            project = Path(directory)
            entry = project / "index.md"
            first = b'# Business\n[Fast](terms.md#fast)\n[Shared](shared.md)\n'
            second = b'# Business\n[Check](terms.md#check)\n[Shared](shared.md)\n'
            entry.write_bytes(first)
            (project / "terms.md").write_bytes(b'# Terms\nSeven days\n')
            (project / "shared.md").write_bytes(b'# Shared\nStill declared\n')
            reader = module.ReaderProject(project, "index.md", [])
            for state, status in (("changed-after-catalog", 409), ("deleted-after-catalog", 404), ("current-r2", None)):
                with self.subTest(state=state):
                    entry.write_bytes(second if state == "current-r2" else first)
                    snapshot = reader.catalog()
                    declared = [dict(row) for row in snapshot["navigation"]]
                    with patch.object(reader, "catalog", return_value=snapshot):
                        batch = reader.document_texts("all")
                    if state == "changed-after-catalog":
                        entry.write_bytes(second)
                    elif state == "deleted-after-catalog":
                        entry.unlink()
                    with patch.object(module, "text_file", wraps=module.text_file) as reads:
                        encoded = json.loads(b''.join(module.json_batch(batch)))
                    self.assertEqual([call.args[1] for call in reads.call_args_list],
                                     [row["path"] for row in snapshot["documents"]])
                    self.assertEqual(snapshot["navigation"], declared, "A stream must not change its catalog snapshot")
                    current = next(row for row in encoded["records"] if row["path"] == "index.md")
                    if status is not None:
                        self.assertEqual(current["status"], status)
                        self.assertEqual(encoded["navigation"], [])
                    else:
                        self.assertEqual(current["text"].encode(), second)
                        self.assertEqual(encoded["navigation"], declared)
                        self.assertEqual([(row["label"], row["fragment"]) for row in encoded["navigation"]][1:],
                                         [("Check", "check"), ("Shared", "")])

    def test_navigation_retains_entry_declarations_when_known_targets_are_unreadable(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_failed_navigation_targets", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-failed-navigation-targets-") as directory:
            project = Path(directory)
            task = "tasks/repair/handbook.html"
            folder = project / "tasks/repair"
            folder.mkdir(parents=True)
            (folder / "handbook.html").write_bytes(b'<h1>Repair</h1>')
            model = folder / "model.json"
            model.write_bytes(b'{"work":{"id":"repair","title":"Repair"}}')
            rule = project / "terms.md"
            rule.write_bytes(b'# Terms\nSeven days\n')
            (project / "note.txt").write_bytes(b'Ordinary source\n')
            (project / "index.md").write_text(f'# Business\n[Rule](terms.md#fast)\n'
                f'[Task]({task}?view=detail#node=pickup)\n[AI](tasks/repair/model.json)\n'
                '[Note](note.txt)\n[External](https://example.invalid/)\n', encoding="utf-8")
            reader = module.ReaderProject(project, "index.md", [])
            healthy = reader.catalog()
            rule.unlink()
            model.unlink()
            failed = reader.catalog()
            self.assertEqual(failed["navigation"], healthy["navigation"])
            self.assertEqual([row["path"] for row in failed["navigation"]], ["index.md", "terms.md", task])
            self.assertEqual(failed["document_errors"]["terms.md"]["status"], 404)
            self.assertEqual(failed["task_error_statuses"][task], 404)
            for scope in ("all", "tasks"):
                with self.subTest(scope=scope), patch.object(reader, "catalog", return_value=failed):
                    encoded = json.loads(b''.join(module.json_batch(reader.document_texts(scope))))
                self.assertEqual(encoded["navigation"], healthy["navigation"])
                rows = {row["path"]: row for row in encoded["records"]}
                self.assertEqual(rows["terms.md"]["status"], 404)
                self.assertEqual(rows[task]["status"], 404)

    def test_tasks_batches_publish_business_markdown_recovery_as_metadata_without_body_or_extra_reads(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_task_md_recovery", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-task-md-recovery-") as directory:
            project = Path(directory)
            changes = project / "docs/changes"
            changes.mkdir(parents=True)
            task_body = b'# Task\nCurrent task body\n'
            (changes / "job.md").write_bytes(task_body)
            entry = project / "index.md"
            entry.write_bytes(b'# Business\n[Rule](rule.md)\n[Old](old.md)\n')
            rule = project / "rule.md"
            original = b'# Rule\nSeven days\n'
            rule.write_bytes(original)
            (project / "old.md").write_bytes(b'# Old reachable rule\n')
            (project / "not-in-scope.md").write_bytes(b'# Never checked\n')
            reader = module.ReaderProject(project, "index.md")
            reader.catalog()
            entry.write_bytes(b'# Business\n[Rule](rule.md)\n')
            (project / "old.md").unlink()
            original_sha = hashlib.sha256(original).hexdigest()
            for state, data in (("missing", None), ("restored", original), ("changed", b'# Rule R2\nFourteen days\n')):
                with self.subTest(state=state):
                    if data is None:
                        rule.unlink()
                    else:
                        rule.write_bytes(data)
                    with patch.object(reader, "catalog", wraps=reader.catalog) as scans, \
                            patch.object(module, "text_file", wraps=module.text_file) as reads:
                        batch = reader.document_texts("tasks")
                        rows = {row["path"]: row for row in batch["records"]}
                    scans.assert_called_once_with()
                    self.assertEqual(sum(call.args[1] == "rule.md" for call in reads.call_args_list), 1)
                    self.assertFalse(any(call.args[1] in {"old.md", "not-in-scope.md"} for call in reads.call_args_list))
                    self.assertNotIn("old.md", rows)
                    self.assertNotIn("not-in-scope.md", rows)
                    self.assertEqual(rows["docs/changes/job.md"]["text"].encode(), task_body)
                    if state == "missing":
                        self.assertEqual(rows["rule.md"]["status"], 404)
                        self.assertNotIn("sha256", rows["rule.md"])
                    else:
                        self.assertEqual(rows.get("rule.md"), {"path": "rule.md", "sha256": hashlib.sha256(data).hexdigest()})
                        self.assertNotIn("text", rows["rule.md"])
                        self.assertEqual(rows["rule.md"]["sha256"] == original_sha, state == "restored")
                    for name, row in rows.items():
                        if name != "docs/changes/job.md":
                            self.assertNotIn("text", row)
            with self.assertRaises(module.ReaderError) as changed:
                reader.content("rule.md", original_sha)
            self.assertEqual(changed.exception.status, 409)

    def test_source_checks_publish_only_current_checked_ordinary_metadata(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_source_checks", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-source-checks-") as directory:
            project = Path(directory)
            (project / "index.md").write_bytes(b'# Business\n[Guide](guide.md)\n')
            (project / "data").mkdir()
            original = {"fee.csv": b'fee\n12\n', "note.txt": b'Current note\n',
                        "data/model.json": b'{"work":{"id":"WO-23","title":"Inspection"}}',
                        "healthy.txt": b'Healthy attachment\n'}
            for name, data in original.items():
                (project / name).write_bytes(data)
            (project / "unreferenced.txt").write_bytes(b'Not checked\n')
            for name, data in (("task", b'{"work":{"id":"task","title":"Task"}}'), ("broken", b'{"work":')):
                (project / name).mkdir()
                (project / name / "handbook.html").write_bytes(b'<meta name="model-sha256" content="declared"><h1>Task</h1>')
                (project / name / "model.json").write_bytes(data)
            links = list(original) + ['task/handbook.html', 'task/model.json', 'broken/handbook.html', 'broken/model.json']
            (project / "guide.md").write_text("# Guide\n" + "\n".join(f"[Source]({name})" for name in links), encoding="utf-8")
            reader = module.ReaderProject(project, "index.md", [])
            for scope in ("all", "tasks"):
                with patch.object(reader, "catalog", wraps=reader.catalog) as scans, \
                        patch.object(module, "text_file", wraps=module.text_file) as reads:
                    batch = reader.document_texts(scope)
                    list(batch["records"])
                scans.assert_called_once_with()
                checks = {row["path"]: row for row in batch["source_checks"]}
                self.assertEqual(set(checks), set(original))
                for name, data in original.items():
                    self.assertEqual(checks[name], {"path": name, "sha256": hashlib.sha256(data).hexdigest()})
                    self.assertEqual(sum(call.args[1] == name for call in reads.call_args_list), 1)
            for name in ("fee.csv", "note.txt"):
                (project / name).unlink()
            (project / "data/model.json").write_bytes(b'{"work":{"id":"WO-24","title":"New inspection"}}')
            changed = {row["path"]: row for row in reader.document_texts("all")["source_checks"]}
            for name in ("fee.csv", "note.txt"):
                self.assertEqual(changed[name]["status"], 404)
                self.assertIn("不存在", changed[name]["error"])
                self.assertNotIn("sha256", changed[name])
            self.assertNotEqual(changed["data/model.json"]["sha256"], hashlib.sha256(original["data/model.json"]).hexdigest())
            self.assertEqual(changed["healthy.txt"]["sha256"], hashlib.sha256(original["healthy.txt"]).hexdigest())
            for name, data in original.items():
                (project / name).write_bytes(data)
            restored = {row["path"]: row for row in reader.document_texts("all")["source_checks"]}
            self.assertTrue(all(row == {"path": name, "sha256": hashlib.sha256(data).hexdigest()}
                                for name, data in original.items() for row in [restored[name]]))

    def test_batch_rows_keep_structured_status_when_markdown_or_model_changes_after_catalog(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_row_status", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for failure, status in (("changed", 409), ("missing", 404), ("encoding", 415)):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory(prefix="requirement-flow-row-status-") as directory:
                project = Path(directory)
                (project / "index.md").write_bytes(b'# Business\n[Guide](guide.md)\n[Task](task/handbook.html)\n')
                (project / "guide.md").write_bytes(b'# Guide R1\n')
                (project / "task").mkdir()
                (project / "task/handbook.html").write_bytes(b'<h1>Task</h1>')
                (project / "task/model.json").write_bytes(b'{"work":{"id":"task","revision":1}}')

                class ChangedReader(module.ReaderProject):
                    def catalog(self):
                        result = super().catalog()
                        for name, data in (("guide.md", b'# Guide R2\n'),
                                           ("task/model.json", b'{"work":{"id":"task","revision":2}}')):
                            path = self.root / name
                            if failure == "missing":
                                path.unlink()
                            else:
                                path.write_bytes(data if failure == "changed" else b'\xff')
                        return result

                batch = ChangedReader(project, "index.md", []).document_texts("all")
                rows = {row["path"]: row for row in batch["records"]}
                for name in ("guide.md", "task/handbook.html"):
                    self.assertEqual(rows[name].get("status"), status)
                    self.assertIn("error", rows[name])
                self.assertNotIn("error", rows["index.md"])

    def test_confirmed_unlinked_task_retains_scope_status_only_inside_the_current_scan(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_evicted_task", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for inside in (True, False):
            with self.subTest(inside=inside), tempfile.TemporaryDirectory(prefix="requirement-flow-evicted-task-") as directory:
                project = Path(directory)

                def pair(relative):
                    folder = project / relative
                    folder.mkdir(parents=True)
                    (folder / "handbook.html").write_bytes(b'<h1>Task</h1>')
                    (folder / "model.json").write_text(json.dumps({"work": {"id": relative, "title": relative}}), encoding="utf-8")

                pair("docs/changes/a")
                relative = "docs/changes/z" if inside else "working/z"
                pair(relative)
                html, model = relative + "/handbook.html", relative + "/model.json"
                entry = project / "index.md"
                entry.write_text("# Business\n" + ("" if inside else f"[Task]({html})\n"), encoding="utf-8")
                reader = module.ReaderProject(project, "index.md")
                with patch.object(module, "MAX_DOCUMENTS", 2):
                    page = next(row for row in reader.catalog()["task_pages"] if row["path"] == html)
                    pair("docs/changes/00-earlier")
                    entry.write_bytes(b'# Business\n')
                    with patch.object(module, "text_file", wraps=module.text_file) as reads:
                        current = reader.catalog()
                    self.assertFalse(any(call.args[1] in {html, model} for call in reads.call_args_list))
                    expected = 413 if inside else 404
                    with self.subTest(check="current status"):
                        self.assertEqual(current["task_error_statuses"].get(html), 413 if inside else None)
                    with patch.object(reader, "catalog", return_value=current) as scans, \
                            patch.object(module, "text_file", wraps=module.text_file) as batch_reads:
                        batch_rows = list(reader.document_texts("all")["records"])
                    scans.assert_called_once_with()
                    self.assertFalse(any(call.args[1] in {html, model} for call in batch_reads.call_args_list))
                    fault_rows = [row for row in batch_rows if row["path"] == html]
                    if inside:
                        self.assertEqual(len(fault_rows), 1)
                        self.assertEqual(fault_rows[0]["status"], 413)
                        self.assertTrue(fault_rows[0]["scope_limited"])
                        self.assertNotIn("sha256", fault_rows[0])
                    else:
                        self.assertEqual(fault_rows, [])
                    for name in (html, model):
                        with self.subTest(check=name):
                            for read in (lambda: reader.content(name),
                                         lambda: reader.task_page_content(name, page["sha256"], page["model_sha256"])):
                                with self.assertRaises(module.ReaderError) as refused:
                                    read()
                                self.assertEqual(refused.exception.status, expected)
                    if inside:
                        (project / model).unlink()
                        missing = reader.catalog()
                        self.assertEqual(missing["task_error_statuses"][html], 404)
                        self.assertIn(model, missing["task_errors"][html])
                        missing_row = next(row for row in reader.document_texts("all")["records"] if row["path"] == html)
                        self.assertEqual(missing_row["status"], 404)
                        self.assertNotIn("scope_limited", missing_row)
                        unknown = project / "docs/changes/zz-ordinary"
                        unknown.mkdir()
                        (unknown / "model.json").write_bytes(b'{"currency":"CNY"}')
                        entry.write_bytes(b'# Business\n[Quote](docs/changes/zz-ordinary/model.json)\n')
                        ordinary = reader.catalog()
                        self.assertNotIn("docs/changes/zz-ordinary/model.json", ordinary["task_errors"])
                        self.assertEqual(reader.content("docs/changes/zz-ordinary/model.json"), b'{"currency":"CNY"}')

    def test_task_capacity_is_one_warning_and_both_http_routes_keep_413_until_a_slot_is_freed(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_task_capacity_http", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-task-capacity-http-") as directory:
            project = Path(directory)
            changes = project / "docs/changes"
            changes.mkdir(parents=True)
            for number in range(501):
                folder = changes / f"task-{number:03}"
                folder.mkdir()
                (folder / "handbook.html").write_bytes(b'<h1>Task</h1>')
                (folder / "model.json").write_text(json.dumps({"work": {"id": str(number), "title": "Task"}}), encoding="utf-8")
            html, model = "docs/changes/task-500/handbook.html", "docs/changes/task-500/model.json"
            for number in range(150):
                (changes / f"reference-{number:03}.md").write_text("# Business reference\n[Task](task-500/handbook.html)\n", encoding="utf-8")
            (project / "index.md").write_bytes(b'# Business\n')
            reader = module.ReaderProject(project, "index.md")
            current = reader.catalog()
            with self.subTest(check="global warning"):
                self.assertEqual(len(current["warnings"]), 1)
                self.assertIn("请收窄当前入口或任务目录后点击刷新；如需改变启动参数，再重新启动阅读器", current["warnings"][0])
            self.assertEqual(len(current["task_pages"]), 500)
            self.assertEqual(current["task_error_statuses"], {html: 413, model: 413})
            links = [link for document in current["documents"] for link in document["links"] if link["target"] == html]
            self.assertEqual(len(links), 150)
            self.assertTrue(all(not link["exists"] and link["status"] == 413 and link["scope_limited"] for link in links))
            for scope in ("all", "tasks"):
                with self.subTest(scope=scope):
                    self.assertEqual(len(reader.document_texts(scope)["warnings"]), 1)
            raw_html, raw_model = (project / html).read_bytes(), (project / model).read_bytes()
            page_sha, model_sha = hashlib.sha256(raw_html).hexdigest(), hashlib.sha256(raw_model).hexdigest()
            routes = {
                f"/task-page/{page_sha}/{model_sha}/{html}": raw_html,
                f"/task-page/{page_sha}/{model_sha}/{model}": raw_model,
                f"/content/{html}?sha256={page_sha}": raw_html,
                f"/content/{model}?sha256={model_sha}": raw_model,
            }
            with module.create_server(reader, 0) as server:
                thread = threading.Thread(target=server.serve_forever, daemon=True)
                thread.start()
                opener = build_opener(ProxyHandler({}))
                try:
                    for route in routes:
                        with self.subTest(route=route, state="limited"):
                            try:
                                response = opener.open(f"http://127.0.0.1:{server.server_port}{route}", timeout=5)
                            except HTTPError as error:
                                response = error
                            with response:
                                self.assertEqual(response.status, 413)
                                self.assertIn("任务原页超过 500 份", json.loads(response.read())["error"])
                    for name in ("handbook.html", "model.json"):
                        (changes / "task-000" / name).unlink()
                    (changes / "task-000").rmdir()
                    for route, expected in routes.items():
                        with opener.open(f"http://127.0.0.1:{server.server_port}{route}", timeout=5) as response:
                            self.assertEqual((response.status, response.read()), (200, expected))
                finally:
                    server.shutdown()
                    thread.join(timeout=2)
            (project / "linked.md").write_bytes(b'# Linked tasks\n[A](docs/changes/task-001/handbook.html)\n[B](docs/changes/task-500/handbook.html)\n')
            with patch.object(module, "MAX_DOCUMENTS", 1):
                linked = module.ReaderProject(project, "linked.md", []).catalog()
            self.assertEqual(len(linked["task_pages"]), 1)
            self.assertEqual(len(linked["warnings"]), 1)
            self.assertIn("请收窄当前入口或任务目录后点击刷新；如需改变启动参数，再重新启动阅读器", linked["warnings"][0])
            self.assertIn("业务入口或任务目录", linked["task_errors"][html])

    def test_http_and_batch_scope_flags_distinguish_capacity_from_size_and_clear_for_missing_parts(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_http_scope_flags", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-http-scope-flags-") as directory:
            project = Path(directory)
            for name in ("a", "z"):
                folder = project / "tasks" / name
                folder.mkdir(parents=True)
                (folder / "handbook.html").write_bytes(b'<h1>Task</h1>')
                (folder / "model.json").write_text(json.dumps({"work": {"id": name, "title": name}}), encoding="utf-8")
            (project / "guide.md").write_bytes(b'# Guide\n')
            (project / "large.txt").write_bytes(b'x' * (module.MAX_BYTES + 1))
            (project / "index.md").write_bytes(b'# Business\n[Guide](guide.md)\n[Large](large.txt)\n'
                b'[A](tasks/a/handbook.html)\n[Z](tasks/z/handbook.html)\n')
            reader = module.ReaderProject(project, "index.md", ["tasks", "tasks/z/handbook.html"])
            html, model = "tasks/z/handbook.html", "tasks/z/model.json"
            a_html = project / "tasks/a/handbook.html"
            original_html = a_html.read_bytes()
            with patch.object(module, "MAX_DOCUMENTS", 1), module.create_server(reader, 0) as server:
                snapshot = reader.catalog()
                healthy = snapshot["task_pages"][0]
                page_sha = hashlib.sha256((project / html).read_bytes()).hexdigest()
                model_sha = hashlib.sha256((project / model).read_bytes()).hexdigest()
                thread = threading.Thread(target=server.serve_forever, daemon=True)
                thread.start()
                opener = build_opener(ProxyHandler({}))

                def get(route):
                    try:
                        response = opener.open(f"http://127.0.0.1:{server.server_port}{route}", timeout=5)
                    except HTTPError as error:
                        response = error
                    with response:
                        return response.status, json.loads(response.read())

                task_routes = [f"/content/{name}" for name in (html, model)] + [
                    f"/task-page/{page_sha}/{model_sha}/{name}" for name in (html, model)]
                try:
                    for route in ["/content/guide.md", *task_routes]:
                        with self.subTest(state="quota", route=route):
                            status, body = get(route)
                            self.assertEqual(status, 413)
                            self.assertIs(body.get("scope_limited"), True)
                    with self.subTest(state="ordinary-size"):
                        status, body = get("/content/large.txt")
                        self.assertEqual(status, 413)
                        self.assertNotIn("scope_limited", body)
                    with self.subTest(state="registered-quota"):
                        self.assertEqual(snapshot.get("task_scope_limited"), [html, model])
                    # A task can become oversized after this batch's catalog, independently of quota.
                    a_html.write_bytes(b'x' * (module.MAX_BYTES + 1))
                    with patch.object(reader, "catalog", return_value=snapshot):
                        for route in ("/content/tasks/a/handbook.html",
                                      f"/task-page/{healthy['sha256']}/{healthy['model_sha256']}/tasks/a/handbook.html",
                                      f"/task-page/{healthy['sha256']}/{healthy['model_sha256']}/tasks/a/model.json"):
                            with self.subTest(state="task-size-after-catalog", route=route):
                                status, body = get(route)
                                self.assertEqual(status, 413)
                                self.assertNotIn("scope_limited", body)
                        rows = {row["path"]: row for row in reader.document_texts("all")["records"]}
                        self.assertEqual(rows[healthy["path"]]["status"], 413)
                        self.assertNotIn("scope_limited", rows[healthy["path"]])
                        self.assertTrue(rows[html]["scope_limited"])
                    a_html.write_bytes(original_html)
                    (project / model).unlink()
                    for route in task_routes:
                        with self.subTest(state="missing-precedes-quota", route=route):
                            status, body = get(route)
                            self.assertEqual(status, 404)
                            self.assertIn(model, body["error"])
                            self.assertNotIn("scope_limited", body)
                    current = reader.catalog()
                    self.assertEqual(current.get("task_scope_limited"), [])
                    row = next(row for row in reader.document_texts("all")["records"] if row["path"] == html)
                    self.assertEqual(row["status"], 404)
                    self.assertNotIn("scope_limited", row)
                finally:
                    server.shutdown()
                    thread.join(timeout=2)
                self.assertFalse(thread.is_alive())

    def test_pair_failure_statuses_match_links_batch_and_both_http_routes_and_recover(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_pair_failure_statuses", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-pair-failure-statuses-") as directory:
            project = Path(directory)
            html, model = "tasks/repair/handbook.html", "tasks/repair/model.json"
            folder = (project / html).parent
            folder.mkdir(parents=True)
            original = {html: b'<h1>Repair</h1>',
                        model: b'{"work":{"id":"repair","title":"Repair","revision":1}}'}
            for name, data in original.items():
                (project / name).write_bytes(data)
            (project / "index.md").write_text(f'# Business\n[Task]({html})\n[AI]({model})\n', encoding="utf-8")
            reader = module.ReaderProject(project, "index.md", [html])
            page = reader.catalog()["task_pages"][0]
            routes = {f"/content/{name}": data for name, data in original.items()}
            routes.update({f"/task-page/{page['sha256']}/{page['model_sha256']}/{name}": data
                           for name, data in original.items()})
            large = b'x' * (module.MAX_BYTES + 1)
            failures = (("oversized-model", model, large, 413), ("oversized-html", html, large, 413),
                        ("invalid-json", model, b'{"work":', 422),
                        ("non-utf8-model", model, b'\xff', 415), ("non-utf8-html", html, b'\xff', 415),
                        ("missing-model", model, None, 404), ("missing-html", html, None, 404))
            with module.create_server(reader, 0) as server:
                thread = threading.Thread(target=server.serve_forever, daemon=True)
                thread.start()
                opener = build_opener(ProxyHandler({}))

                def get(route):
                    try:
                        response = opener.open(f"http://127.0.0.1:{server.server_port}{route}", timeout=5)
                    except HTTPError as error:
                        response = error
                    with response:
                        return response.status, response.read()

                try:
                    for failure, broken, data, expected in failures:
                        with self.subTest(failure=failure):
                            for name, value in original.items():
                                (project / name).write_bytes(value)
                            if data is None:
                                (project / broken).unlink()
                            else:
                                (project / broken).write_bytes(data)
                            status, data = get("/api/catalog")
                            self.assertEqual(status, 200)
                            current = json.loads(data)
                            self.assertEqual([link["status"] for link in current["documents"][0]["links"]], [expected, expected])
                            self.assertEqual(current["task_error_statuses"], {html: expected, model: expected})
                            self.assertEqual(current["task_errors"][html], current["task_errors"][model])
                            self.assertEqual(current["task_scope_limited"], [])
                            for scope in ("all", "tasks"):
                                status, data = get("/api/document-texts?scope=" + scope)
                                self.assertEqual(status, 200)
                                row = next(row for row in json.loads(data)["records"] if row["path"] == html)
                                self.assertEqual(row["status"], expected)
                                self.assertEqual(row["error"], current["task_errors"][html])
                                self.assertNotIn("scope_limited", row)
                            for route in routes:
                                status, data = get(route)
                                self.assertEqual(status, expected)
                                body = json.loads(data)
                                self.assertEqual(body["error"], current["task_errors"][html])
                                self.assertNotIn("scope_limited", body)
                                self.assertNotIn("error_stage", body)
                            for name, value in original.items():
                                (project / name).write_bytes(value)
                            recovered = reader.catalog()
                            self.assertEqual(recovered["task_error_statuses"], {})
                            self.assertEqual(recovered["task_errors"], {})
                            self.assertEqual(recovered["task_pages"], [page])
                            for route, value in routes.items():
                                self.assertEqual(get(route), (200, value))
                finally:
                    server.shutdown()
                    thread.join(timeout=2)
                self.assertFalse(thread.is_alive())

    def test_task_capacity_status_does_not_change_real_pair_faults_or_ordinary_json(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_task_status_controls", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-task-status-controls-") as directory:
            project = Path(directory)
            for name in ("a", "b"):
                folder = project / "tasks" / name
                folder.mkdir(parents=True)
                (folder / "handbook.html").write_bytes(b'<h1>Task</h1>')
                (folder / "model.json").write_text(json.dumps({"work": {"id": name, "title": name}}), encoding="utf-8")
            (project / "data").mkdir()
            (project / "data/model.json").write_bytes(b'{"currency":"CNY"}')
            (project / "tasks/b/terms.json").write_bytes(b'{"shipping_fee":12}')
            (project / "index.md").write_bytes(b'# Business\n[A](tasks/a/handbook.html)\n[AI](tasks/a/model.json)\n'
                b'[B](tasks/b/handbook.html)\n[Quote](data/model.json)\n[Terms](tasks/b/terms.json)\n')
            reader = module.ReaderProject(project, "index.md", ["tasks"])
            a_html, a_model = project / "tasks/a/handbook.html", project / "tasks/a/model.json"
            html_data, model_data = a_html.read_bytes(), a_model.read_bytes()
            with patch.object(module, "MAX_DOCUMENTS", 1):
                for failure in ("invalid-model", "missing-html", "oversized-model"):
                    with self.subTest(failure=failure):
                        a_html.write_bytes(html_data)
                        a_model.write_bytes(model_data)
                        healthy = reader.catalog()
                        a_page = healthy["task_pages"][0]
                        self.assertEqual(healthy["task_error_statuses"]["tasks/b/handbook.html"], 413)
                        with self.assertRaises(module.ReaderError) as unrelated:
                            reader.task_page_content("tasks/b/terms.json", "0" * 64, "0" * 64)
                        self.assertEqual(unrelated.exception.status, 404)
                        self.assertNotIn("任务原页超过", str(unrelated.exception))
                        if failure == "missing-html":
                            a_html.unlink()
                        else:
                            a_model.write_bytes(b'{broken JSON' if failure == "invalid-model" else b'x' * (module.MAX_BYTES + 1))
                        current = reader.catalog()
                        expected = {"invalid-model": 422, "missing-html": 404, "oversized-model": 413}[failure]
                        self.assertEqual(current["task_error_statuses"]["tasks/a/handbook.html"], expected)
                        self.assertEqual(current["task_error_statuses"]["tasks/a/model.json"], expected)
                        self.assertEqual(current["task_pages"][0]["path"], "tasks/b/handbook.html")
                        for name in ("tasks/a/handbook.html", "tasks/a/model.json"):
                            for read in (lambda: reader.content(name),
                                         lambda: reader.task_page_content(name, a_page["sha256"], a_page["model_sha256"])):
                                with self.assertRaises(module.ReaderError) as unavailable:
                                    read()
                                self.assertEqual(unavailable.exception.status, expected)
                        for name in ("data/model.json", "tasks/b/terms.json"):
                            self.assertNotIn(name, current["task_errors"])
                            self.assertNotIn(name, current["task_error_statuses"])
                            self.assertEqual(reader.content(name), (project / name).read_bytes())

    def test_one_capacity_warning_summarizes_651_tasks_without_hiding_specific_errors(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_capacity_summary", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for mixed in (False, True):
            with self.subTest(mixed=mixed), tempfile.TemporaryDirectory(prefix="requirement-flow-capacity-summary-") as directory:
                project = Path(directory)
                changes = project / "docs/changes"
                changes.mkdir(parents=True)
                for number in range(1, 652):
                    (changes / f"rule-{number:03}.md").write_bytes(b'# Rule\n')
                entry = "# Business\n[First limited](docs/changes/rule-500.md)\n[Last unchecked](docs/changes/rule-651.md)\n"
                if mixed:
                    (changes / "000-invalid.md").write_bytes(b'\xff')
                    (project / "large.txt").write_bytes(b'x' * (module.MAX_BYTES + 1))
                    entry += "[Invalid](docs/changes/000-invalid.md)\n[Missing](missing.txt)\n[Large](large.txt)\n"
                (project / "index.md").write_text(entry, encoding="utf-8")
                reader = module.ReaderProject(project, "index.md")
                current = reader.catalog()
                self.assertEqual(len(current["documents"]), 500)
                limited = {name: error for name, error in current["document_errors"].items() if error.get("scope_limited")}
                self.assertEqual(len(limited), 152)
                self.assertEqual(len(current["warnings"]), 4 if mixed else 1)
                summary = next(warning for warning in current["warnings"] if "152" in warning)
                self.assertIn("500", summary)
                self.assertIn("请收窄当前入口或任务目录后点击刷新；如需改变启动参数，再重新启动阅读器", summary)
                self.assertLess(sum(map(len, current["warnings"])), 600)
                self.assertTrue(limited["docs/changes/rule-500.md"]["error"].startswith("文档读取超过 500 份"))
                self.assertTrue(limited["docs/changes/rule-651.md"]["error"].startswith("本次未检查："))
                for name in ("docs/changes/rule-500.md", "docs/changes/rule-651.md"):
                    link = next(link for link in current["documents"][0]["links"] if link["target"] == name)
                    self.assertEqual(link["error"], limited[name]["error"])
                    with self.assertRaises(module.ReaderError) as refused:
                        reader.content(name)
                    self.assertEqual(refused.exception.status, 413)
                    self.assertEqual(str(refused.exception), limited[name]["error"])
                if mixed:
                    for name in ("000-invalid.md", "missing.txt", "large.txt"):
                        self.assertEqual(sum(name in warning for warning in current["warnings"]), 1)

    def test_unlinked_bad_task_markdown_keeps_one_standalone_warning(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_standalone_warning", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for tasks in (None, ["docs/changes"], ["docs/changes/bad.md"]):
            for linked in (False, True):
                with self.subTest(tasks=tasks, linked=linked), \
                        tempfile.TemporaryDirectory(prefix="requirement-flow-standalone-warning-") as directory:
                    project = Path(directory)
                    changes = project / "docs/changes"
                    changes.mkdir(parents=True)
                    (changes / "bad.md").write_bytes(b'\xff')
                    (project / "index.md").write_text("# Business\n" +
                        ("[Bad task](docs/changes/bad.md)\n" if linked else ""), encoding="utf-8")
                    current = module.ReaderProject(project, "index.md", tasks).catalog()
                    self.assertEqual(len(current["warnings"]), 1)
                    warning = current["warnings"][0]
                    self.assertIn("不是 UTF-8", warning)
                    self.assertEqual(warning.startswith("index.md → "), linked)
                    self.assertEqual([row["path"] for row in current["documents"]], ["index.md"])

    def test_link_normalization_and_failures_are_reused_without_caching_file_reads(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_normalized_links", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-normalized-links-") as directory:
            project = Path(directory)
            (project / "src").mkdir()
            source = project / "src/shared.txt"
            source.write_bytes(b'Current shared source\n')
            hrefs = [f"src/shared.txt#part-{index}" for index in range(721)]
            hrefs += [hrefs[0], ".env", ".env", "missing.md", "missing.md"]
            (project / ".env").write_bytes(b'FIXTURE_ONLY_PRIVATE_CONTENT\n')
            (project / "index.md").write_text("# Business\n" + "\n".join(
                f"[Link {index}]({href})" for index, href in enumerate(hrefs)), encoding="utf-8")
            reader = module.ReaderProject(project, "index.md", [])
            reader.catalog()
            with patch.object(module, "link_target", wraps=module.link_target) as normalize, \
                    patch.object(module, "local_path", wraps=module.local_path) as paths, \
                    patch.object(module, "text_file", wraps=module.text_file) as reads:
                current = reader.catalog()
            self.assertEqual(normalize.call_count, len(set(hrefs)))
            self.assertEqual(sum(call.args[2] == ".env" for call in normalize.call_args_list), 1)
            self.assertEqual(sum(call.args[1] == "missing.md" for call in reads.call_args_list), 1)
            self.assertLessEqual(paths.call_count, 4 * len(hrefs) + 20)
            links = current["documents"][0]["links"]
            private = [link for link in links if link["target"] == ".env"]
            self.assertEqual(len(private), 2)
            self.assertEqual({(link["error"], link["status"]) for link in private},
                             {("不读取隐藏或凭据路径：.env", 403)})
            missing = [link for link in links if link["target"] == "missing.md"]
            self.assertEqual(len(missing), 2)
            self.assertTrue(all(link["kind"] == "document" and link["status"] == 404 for link in missing))
            self.assertNotIn("FIXTURE_ONLY_PRIVATE_CONTENT", json.dumps(current))
            before = next(row for row in current["sources"] if row["path"] == "src/shared.txt")["sha256"]
            source.write_bytes(b'Changed shared source\n')
            with self.assertRaises(module.ReaderError) as changed:
                reader.content("src/shared.txt", before)
            self.assertEqual(changed.exception.status, 409)

    def test_plain_same_named_files_stay_sources_without_positive_task_view_evidence(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_plain_pair_control", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-plain-pair-") as directory:
            project = Path(directory)
            folder = project / "docs/changes/reference"
            folder.mkdir(parents=True)
            html, model = "docs/changes/reference/handbook.html", "docs/changes/reference/model.json"
            (project / html).write_bytes(b'<h1>Ordinary rate reference</h1>')
            (project / model).write_bytes(b'{"currency":"CNY","shipping_fee":12}')
            (project / "index.md").write_text(f"# Business\n[HTML]({html})\n[Handoff](handoff.md)\n", encoding="utf-8")
            (project / "handoff.md").write_text(f"# Handoff\n[JSON]({model})\n", encoding="utf-8")
            reader = module.ReaderProject(project, "index.md")
            current = reader.catalog()
            self.assertEqual((current["task_pages"], current["task_errors"]), ([], {}))
            self.assertEqual({source["path"] for source in current["sources"]}, {html, model})
            for document in current["documents"]:
                self.assertTrue(all(link["exists"] for link in document["links"]))
                self.assertTrue(all(link["kind"] == "source" for link in document["links"]
                                    if link["target"] in {html, model}))
            for name in (html, model):
                self.assertEqual(reader.content(name), (project / name).read_bytes())

    def test_task_filename_candidates_require_positive_identity_or_an_explicit_single_file(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_task_identity", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for mode in ("default", "directory", "single-files"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory(prefix="requirement-flow-task-identity-") as directory:
                project = Path(directory)
                paths = {"docs/changes/pricing/model.json": b'{"currency":"CNY","shipping_fee":12}',
                         "docs/changes/hours/model.json": b'{"work":{"mon":"09:00-18:00","sat":null},"timezone":"Asia/Shanghai"}',
                         "docs/changes/work-order/model.json": b'{"work":{"id":"WO-23","title":"Pump inspection"},"asset":"P7","labour_hours":3}',
                         "docs/changes/reference/handbook.html": b'<h1>Ordinary business reference</h1>'}
                outside = {name.replace("docs/changes/", "references/"): data for name, data in paths.items()}
                for name, data in {**paths, **outside}.items():
                    path = project / name
                    path.parent.mkdir(parents=True)
                    path.write_bytes(data)
                (project / "index.md").write_text("# Business\n" + "\n".join(
                    f"[Reference {index}]({name}#section-{index})"
                    for index, name in enumerate([*paths, *outside])), encoding="utf-8")
                tasks = None if mode == "default" else ["docs/changes"] if mode == "directory" else list(paths)
                reader = module.ReaderProject(project, "index.md", tasks)
                catalog = reader.catalog()
                self.assertEqual(catalog["task_pages"], [])
                links = catalog["documents"][0]["links"]
                self.assertTrue(all(link["exists"] for link in links if link["target"] in outside))
                for name, data in outside.items():
                    self.assertEqual(reader.content(name, hashlib.sha256(data).hexdigest()), data)
                if mode == "single-files":
                    self.assertTrue(all(name in catalog["task_errors"] for name in paths))
                    self.assertTrue(all(not link["exists"] for link in links if link["target"] in paths))
                    for name in paths:
                        with self.assertRaises(module.ReaderError) as unavailable:
                            reader.content(name)
                        self.assertEqual(unavailable.exception.status, 404)
                else:
                    self.assertEqual(catalog["task_errors"], {})
                    self.assertTrue(all(link["kind"] == "source" and link["exists"] for link in links))
                    self.assertEqual({item["path"] for item in catalog["sources"]}, set(paths) | set(outside))
                    for name, data in paths.items():
                        self.assertEqual(reader.content(name, hashlib.sha256(data).hexdigest()), data)

    def test_task_markers_claim_failed_pairs_and_recover_without_filename_guessing(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_task_markers", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-task-markers-") as directory:
            project = Path(directory)
            links = []
            for marker, name, data in (
                    ("declared", "handbook.html", b'<meta name="model-sha256" content="pending"><h1>Task</h1>'),
                    ("schema", "model.json", b'{"work":{"title":"Task model"}}')):
                folder = project / "docs/changes" / marker
                folder.mkdir(parents=True)
                (folder / name).write_bytes(data)
                links.append(f"[{marker}](docs/changes/{marker}/{name})")
            (project / "index.md").write_text("# Business\n" + "\n".join(links), encoding="utf-8")
            reader = module.ReaderProject(project, "index.md", ["docs/changes", "docs/changes/schema/model.json"])
            failed = reader.catalog()
            for folder in ("declared", "schema"):
                html = f"docs/changes/{folder}/handbook.html"
                model = f"docs/changes/{folder}/model.json"
                self.assertEqual(failed["task_errors"][html], failed["task_errors"][model])
            self.assertTrue(all(not link["exists"] for link in failed["documents"][0]["links"]))
            (project / "docs/changes/declared/model.json").write_bytes(b'{"work":{"title":"Restored"}}')
            (project / "docs/changes/schema/handbook.html").write_bytes(b'<h1>Restored task</h1>')
            restored = reader.catalog()
            self.assertEqual(restored["task_errors"], {})
            self.assertEqual(restored["warnings"], [])
            self.assertEqual(len(restored["task_pages"]), 2)
            self.assertTrue(all(link["exists"] for link in restored["documents"][0]["links"]))

    def test_confirmed_undeclared_pairs_keep_their_identity_when_the_model_is_damaged(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_confirmed_pairs", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for mode in ("default", "directory", "markdown"):
            for model_first in (False, True):
                with self.subTest(mode=mode, model_first=model_first), \
                        tempfile.TemporaryDirectory(prefix="requirement-flow-confirmed-pair-") as directory:
                    project = Path(directory)
                    relative = "docs/changes/rates" if mode == "default" else "handoffs/rates"
                    folder = project / relative
                    folder.mkdir(parents=True)
                    html = folder / "handbook.html"
                    html.write_bytes(b'<h1>Rates task without a model declaration</h1>')
                    model = folder / "model.json"
                    healthy = b'{"work":{"id":"rates","revision":1,"title":"Freight price"}}'
                    model.write_bytes(healthy)
                    links = [f"[Task]({relative}/handbook.html)",
                             f"[Model]({relative}/model.json)"]
                    if model_first:
                        links.reverse()
                    (project / "index.md").write_text("# Business\n" + "\n".join(links), encoding="utf-8")
                    tasks = None if mode == "default" else ["handoffs"] if mode == "directory" else []
                    reader = module.ReaderProject(project, "index.md", tasks)
                    page = reader.catalog()["task_pages"][0]
                    for damaged in (b'{"work":', b'{"currency":"CNY"}'):
                        model.write_bytes(damaged)
                        failed = reader.catalog()
                        self.assertEqual(failed["task_pages"], [])
                        self.assertEqual(failed["task_errors"][page["path"]], failed["task_errors"][page["model_path"]])
                        self.assertTrue(failed["warnings"])
                        self.assertTrue(all(not link["exists"] for link in failed["documents"][0]["links"]))
                        self.assertTrue({page["path"], page["model_path"]}.isdisjoint(
                            source["path"] for source in failed["sources"]))
                        for name in (page["path"], page["model_path"]):
                            with self.assertRaises(module.ReaderError):
                                reader.content(name)
                        model.write_bytes(healthy)
                        recovered = reader.catalog()
                        self.assertEqual(recovered["task_errors"], {})
                        self.assertEqual(recovered["task_pages"][0]["path"], page["path"])
                    # Confirmation is session memory, not a persisted relationship file.
                    self.assertLessEqual(len(reader.confirmed_tasks), module.MAX_DOCUMENTS)
                    self.assertEqual(sorted(path.name for path in project.iterdir()),
                                     ["docs", "index.md"] if mode == "default" else ["handoffs", "index.md"])

    def test_task_capacity_checks_explicit_parts_without_claiming_ordinary_candidates(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_capacity_identity", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for mode in ("ordinary", "linked-task", "explicit-task"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory(prefix="requirement-flow-capacity-identity-") as directory:
                project = Path(directory)
                for name in ("a", "b", "c"):
                    folder = project / "docs/changes" / name
                    folder.mkdir(parents=True)
                    data = json.dumps({"work": {"id": name, "title": name}}, sort_keys=True, separators=(",", ":")).encode()
                    (folder / "model.json").write_bytes(data)
                    (folder / "handbook.html").write_text('<meta name="model-sha256" content="' +
                        hashlib.sha256(data).hexdigest() + '">', encoding="utf-8")
                ordinary = project / "docs/changes/zz-pricing/model.json"
                ordinary.parent.mkdir()
                ordinary.write_bytes(b'{"currency":"CNY","shipping_fee":12}')
                target = "docs/changes/zz-pricing/model.json" if mode == "ordinary" else "docs/changes/c/model.json"
                (project / "index.md").write_text("# Business\n[Source](" + target + ")\n", encoding="utf-8")
                tasks = ["docs/changes"] + ([target] if mode == "explicit-task" else [])
                reader = module.ReaderProject(project, "index.md", tasks)
                with patch.object(module, "MAX_DOCUMENTS", 2), \
                        patch.object(module, "text_file", wraps=module.text_file) as reads:
                    catalog = reader.catalog()
                    self.assertEqual(len(catalog["task_pages"]), 2)
                    if mode == "ordinary":
                        self.assertEqual(catalog["task_errors"], {})
                        self.assertTrue(catalog["documents"][0]["links"][0]["exists"])
                        self.assertFalse(any("任务原页超过" in warning for warning in catalog["warnings"]))
                        self.assertEqual(reader.content(target), ordinary.read_bytes())
                        self.assertFalse(any(call.args[1] == "docs/changes/c/model.json" for call in reads.call_args_list))
                    else:
                        self.assertIn("超过 2 份", catalog["task_errors"][target])
                        link = catalog["documents"][0]["links"][0]
                        self.assertFalse(link["exists"])
                        self.assertEqual(link["status"], 413)
                        self.assertNotIn(target, {source["path"] for source in catalog["sources"]})
                        with self.assertRaises(module.ReaderError) as refused:
                            reader.content(target)
                        self.assertIn("超过 2 份", str(refused.exception))
                        self.assertFalse(any(call.args[1] == "docs/changes/zz-pricing/model.json" for call in reads.call_args_list))
                    self.assertTrue(any("未检查其余候选" in warning for warning in catalog["warnings"]))

    def test_healthy_task_models_are_read_and_parsed_once_per_catalog(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_model_io", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-model-io-") as directory:
            project = Path(directory)
            expected = {}
            for index in range(50):
                folder = project / f"docs/changes/task-{index:02}"
                folder.mkdir(parents=True)
                model = {"work": {"id": str(index), "title": "Task " + str(index)}, "description": "x" * 4096}
                data = json.dumps(model, sort_keys=True, separators=(",", ":")).encode()
                path = folder / "model.json"
                path.write_bytes(data)
                expected[path.relative_to(project).as_posix()] = data
                (folder / "handbook.html").write_text('<meta name="model-sha256" content="' +
                    hashlib.sha256(data).hexdigest() + '">', encoding="utf-8")
            (project / "index.md").write_text("# Business\n" + "\n".join(
                f"[Model]({path})" for path in expected), encoding="utf-8")
            reader = module.ReaderProject(project, "index.md")
            with patch.object(module, "text_file", wraps=module.text_file) as reads, \
                    patch.object(module.json, "loads", wraps=module.json.loads) as parses:
                catalog = reader.catalog()
            self.assertEqual(len(catalog["task_pages"]), 50)
            for path, data in expected.items():
                self.assertEqual(sum(call.args[1] == path for call in reads.call_args_list), 1)
                self.assertEqual(sum(call.args[0] == data for call in parses.call_args_list), 1)
            self.assertEqual(sum(len(expected[call.args[1]]) for call in reads.call_args_list
                                 if call.args[1] in expected), sum(map(len, expected.values())))

    def test_retired_pair_identity_does_not_block_a_later_ordinary_source_at_the_same_path(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_retired_pair", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-retired-pair-") as directory:
            project = Path(directory)
            folder = project / "docs/changes/rates"
            folder.mkdir(parents=True)
            html, model = folder / "handbook.html", folder / "model.json"
            html.write_bytes(b'<h1>Rates task</h1>')
            model.write_bytes(b'{"work":{"id":"rates","title":"Rates"}}')
            entry = project / "index.md"
            entry.write_text("# Business\n[Task](docs/changes/rates/handbook.html)\n[Model](docs/changes/rates/model.json)\n", encoding="utf-8")
            reader = module.ReaderProject(project, "index.md")
            self.assertEqual(len(reader.catalog()["task_pages"]), 1)
            audit = folder / "audit.csv"
            audit.write_bytes(b'timestamp,event\n1,archived\n')
            html.unlink()
            model.unlink()
            entry.write_bytes(b'# Business\n')
            retired = reader.catalog()
            self.assertEqual((retired["task_pages"], retired["task_errors"], reader.confirmed_tasks), ([], {}, set()))
            ordinary = b'{"work":{"mon":"09:00-18:00","sat":null},"timezone":"Asia/Shanghai"}'
            model.write_bytes(ordinary)
            entry.write_bytes(b'# Business\n[Hours](docs/changes/rates/model.json)\n')
            current = reader.catalog()
            self.assertEqual(current["task_errors"], {})
            self.assertTrue(current["documents"][0]["links"][0]["exists"])
            self.assertEqual(reader.content("docs/changes/rates/model.json"), ordinary)
            self.assertEqual(audit.read_bytes(), b'timestamp,event\n1,archived\n')

    def test_capacity_does_not_evict_a_still_referenced_failed_identity_on_the_next_refresh(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_live_identity", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-live-identity-") as directory:
            project = Path(directory)

            def pair(index):
                folder = project / f"docs/changes/task-{index:03}"
                folder.mkdir(parents=True)
                (folder / "handbook.html").write_bytes(b'<h1>Task without a declaration</h1>')
                (folder / "model.json").write_text(json.dumps({"work": {"id": str(index), "title": "Task"}}), encoding="utf-8")

            for index in range(500):
                pair(index)
            html = "docs/changes/task-000/handbook.html"
            model = "docs/changes/task-000/model.json"
            (project / "index.md").write_text(f"# Business\n[Task]({html})\n[Model]({model})\n", encoding="utf-8")
            reader = module.ReaderProject(project, "index.md")
            self.assertEqual(len(reader.catalog()["task_pages"]), 500)
            (project / model).write_bytes(b'{"work":')
            pair(500)
            for refresh in (1, 2):
                with self.subTest(refresh=refresh):
                    current = reader.catalog()
                    self.assertEqual(len(current["task_pages"]), 500)
                    self.assertIn("不是有效 JSON", current["task_errors"][model])
                    self.assertEqual(current["task_errors"][html], current["task_errors"][model])
                    self.assertTrue({html, model}.isdisjoint(source["path"] for source in current["sources"]))
                    self.assertTrue(all(not link["exists"] for link in current["documents"][0]["links"]))
            self.assertIn(html, reader.confirmed_tasks)
            self.assertEqual(len(reader.confirmed_tasks), 501)
            with self.assertRaises(module.ReaderError) as refused:
                reader.content(model)
            self.assertIn("不是有效 JSON", str(refused.exception))

    def test_ordinary_json_probes_do_not_canonicalize_or_retain_exception_frames(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_probe_storage", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-probe-storage-") as directory:
            project = Path(directory)
            marker = "large-ordinary-payload-" * 10_000
            folder = project / "ordinary"
            folder.mkdir()
            model = folder / "model.json"
            for html_present in (False, True):
                if html_present:
                    (folder / "handbook.html").write_bytes(b'<h1>Ordinary reference</h1>')
                for content in (json.dumps({"asset": "P7", "description": marker}).encode(), b'{broken JSON'):
                    model.write_bytes(content)
                    with patch.object(module.json, "dumps", wraps=module.json.dumps) as canonicalize:
                        probe = module.handbook_probe(project, "ordinary/handbook.html", {}, set())
                        canonicalize.assert_not_called()
                    self.assertEqual(probe["kind"], "source")
                    self.assertNotIn(marker[:100], json.dumps(probe))
                    self.assertFalse(any(isinstance(value, BaseException) for value in probe.values()))
                    self.assertTrue(set(probe) <= {"kind", "page_exists", "error", "sha256", "declaration", "model_sha256", "model_error"})
            (folder / "handbook.html").write_bytes(b'<meta name="model-sha256" content="declared">')
            model.write_text('{"description":' + json.dumps(marker) + ',"work":', encoding="utf-8")
            probe = module.handbook_probe(project, "ordinary/handbook.html", {}, set())
            self.assertEqual(probe["model_error"][1], 422)
            self.assertFalse(any(isinstance(value, BaseException) for value in probe.values()))
            self.assertNotIn(marker[:100], json.dumps(probe))

    def test_handbook_probes_are_reused_only_inside_one_catalog_scan(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_handbook_probes", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-handbook-probe-") as directory:
            project = Path(directory)
            handbook = project / "manual/handbook.html"
            handbook.parent.mkdir()
            handbook.write_text("<h1>Ordinary handbook</h1>" + "x" * 158_000, encoding="utf-8")
            links = [f"[Section {index}](manual/handbook.html?view=detail&q=case-{index}#node=case-{index})" for index in range(16)]
            (project / "index.md").write_text("# Business\n" + "\n".join(links), encoding="utf-8")
            reader = module.ReaderProject(project, "index.md")
            read, feed = module.text_file, module.ModelFingerprint.feed
            with patch.object(module, "text_file", wraps=read) as reads, \
                    patch.object(module.ModelFingerprint, "feed", autospec=True, side_effect=feed) as parses:
                first = reader.catalog()
                self.assertEqual(sum(call.args[1] == "manual/handbook.html" for call in reads.call_args_list), 1)
                self.assertEqual(parses.call_count, 1)
            doc = first["documents"][0]
            self.assertEqual(len(doc["links"]), 16)
            self.assertTrue(all(link["kind"] == "source" and link["exists"] for link in doc["links"]))
            old_sha = next(source["sha256"] for source in first["sources"] if source["path"] == "manual/handbook.html")

            handbook.write_text("<h1>Updated ordinary handbook</h1>", encoding="utf-8")
            with patch.object(module, "text_file", wraps=read) as reads, \
                    patch.object(module.ModelFingerprint, "feed", autospec=True, side_effect=feed) as parses:
                changed = reader.catalog()
                self.assertEqual(sum(call.args[1] == "manual/handbook.html" for call in reads.call_args_list), 1)
                self.assertEqual(parses.call_count, 1)
            self.assertNotEqual(next(source["sha256"] for source in changed["sources"] if source["path"] == "manual/handbook.html"), old_sha)
            handbook.unlink()
            with patch.object(module, "text_file", wraps=read) as reads:
                missing = reader.catalog()
                self.assertEqual(sum(call.args[1] == "manual/handbook.html" for call in reads.call_args_list), 1)
            self.assertFalse(any(source["path"] == "manual/handbook.html" for source in missing["sources"]))
            self.assertTrue(all(link["target"] == "manual/handbook.html" and link["kind"] == "source"
                                and link["status"] == 404 for link in missing["documents"][0]["links"]))
            for data, status in ((b"x" * (module.MAX_BYTES + 1), 413), (b"\xff", 415)):
                handbook.write_bytes(data)
                with patch.object(module, "text_file", wraps=read) as reads:
                    unreadable = reader.catalog()
                    self.assertEqual(sum(call.args[1] == "manual/handbook.html" for call in reads.call_args_list), 1)
                self.assertEqual([link["fragment"] for link in unreadable["documents"][0]["links"]],
                                 [f"node=case-{index}" for index in range(16)])
                self.assertTrue(all(link["target"] == "manual/handbook.html" and link["kind"] == "source"
                                    and link["status"] == status and not link["exists"]
                                    for link in unreadable["documents"][0]["links"]))

            handbook.write_text('<meta name="model-sha256" content="declared task"><h1>Task</h1>', encoding="utf-8")
            with patch.object(module.ModelFingerprint, "feed", autospec=True, side_effect=feed) as parses, \
                    patch.object(reader, "task_page", wraps=reader.task_page) as pairs:
                declared = reader.catalog()
                self.assertEqual(parses.call_count, 1)
                pairs.assert_called_once()
                self.assertEqual(pairs.call_args.args[0], "manual/handbook.html")
            declared_links = declared["documents"][0]["links"]
            self.assertTrue(all(link["kind"] == "task-page" and not link["exists"] for link in declared_links))
            self.assertEqual([link["query"] for link in declared_links], [f"q=case-{index}&view=detail" for index in range(16)])
            self.assertEqual([link["fragment"] for link in declared_links], [f"node=case-{index}" for index in range(16)])
            self.assertEqual(declared["task_errors"]["manual/handbook.html"], declared["task_errors"]["manual/model.json"])

    def test_declared_tasks_and_explicit_pair_inputs_keep_errors_when_a_file_is_removed(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_declared_tasks", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for mode in ("markdown", "explicit-model", "explicit-html"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory(prefix="requirement-flow-declared-task-") as directory:
                project = Path(directory)
                relative = ".requirements/active/copper" if mode == "markdown" else "handoffs/elm"
                pair = project / relative
                pair.mkdir(parents=True)
                model = pair / "model.json"
                model_data = json.dumps({"work": {"id": "pair", "title": "Task", "revision": 1}},
                                        sort_keys=True, separators=(",", ":")).encode()
                model.write_bytes(model_data)
                html = pair / "handbook.html"
                html_data = ('<meta name="model-sha256" content="' + hashlib.sha256(model_data).hexdigest() +
                             '"><h1>Task</h1>').encode()
                html.write_bytes(html_data)
                plain = project / "manual/handbook.html"
                plain.parent.mkdir()
                plain.write_bytes(b'<!-- <meta name="model-sha256" content="example"> --><h1>Plain handbook</h1>')
                entry = project / "docs/business/index.md"
                entry.parent.mkdir(parents=True)
                task_link = f"[Task](../../{relative}/handbook.html?view=detail#node=recv)\n" if mode == "markdown" else ""
                entry.write_text("# Business\n[Plain](../../manual/handbook.html)\n" + task_link, encoding="utf-8")
                self.assertFalse((project / "docs/changes").exists())
                tasks = None if mode == "markdown" else [relative + ("/model.json" if mode == "explicit-model" else "/handbook.html")]
                reader = module.ReaderProject(project, tasks=tasks)
                initial = reader.catalog()
                self.assertEqual(len(initial["task_pages"]), 1)
                page = initial["task_pages"][0]
                removed = html if mode == "explicit-html" else model
                removed_data = removed.read_bytes()
                removed.unlink()
                failed = reader.catalog()
                self.assertEqual(failed["task_pages"], [])
                self.assertIn(page["path"], failed["task_errors"])
                missing = removed.relative_to(project).as_posix()
                self.assertIn(missing, failed["task_errors"][page["path"]])
                self.assertTrue(any(missing in warning for warning in failed["warnings"]))
                doc = next(doc for doc in failed["documents"] if doc["path"] == reader.entry)
                plain_link = next(link for link in doc["links"] if link["target"] == "manual/handbook.html")
                self.assertEqual(plain_link["kind"], "source")
                self.assertTrue(plain_link["exists"])
                if mode == "markdown":
                    link = next(link for link in doc["links"] if link["target"] == page["path"])
                    self.assertEqual(link["kind"], "task-page")
                    self.assertFalse(link["exists"])
                    self.assertEqual(link["query"], "view=detail")
                    self.assertEqual(link["fragment"], "node=recv")
                self.assertNotIn(page["path"], {item["path"] for item in failed["sources"]})
                batch = reader.document_texts("all")
                self.assertTrue(any(missing in warning for warning in batch["warnings"]))
                record = next(row for row in batch["records"] if row["path"] == page["path"])
                self.assertEqual(record["status"], 404)
                self.assertIn(missing, record["error"])
                self.assertNotIn("sha256", record)
                with self.assertRaises(module.ReaderError) as unavailable:
                    reader.task_page_content(page["path"], page["sha256"], page["model_sha256"])
                self.assertEqual(unavailable.exception.status, 404)
                self.assertIn(missing, str(unavailable.exception))

                removed.write_bytes(removed_data)
                recovered = reader.catalog()
                self.assertEqual(recovered["task_errors"], {})
                self.assertEqual(recovered["warnings"], [])
                self.assertEqual(recovered["task_pages"][0]["path"], page["path"])
                batch = reader.document_texts("all")
                self.assertEqual(batch["warnings"], [])
                self.assertTrue(any(row["path"] == page["path"] for row in batch["records"]))

    def test_batch_json_keeps_record_encoding_lazy_and_includes_scan_warnings(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_batch_json", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        consumed = []

        def records():
            for number in range(3):
                consumed.append(number)
                yield {"path": f"rule-{number}.md", "text": "Current source"}

        chunks = module.json_batch({"records": records(), "source_checks": [], "navigation": [], "warnings": ["Missing model.json"]})
        prefix = next(chunks)
        self.assertEqual(prefix, b'{"records":[')
        self.assertEqual(consumed, [])
        first = next(chunks)
        self.assertEqual(consumed, [0])
        result = json.loads(b''.join((prefix, first, *chunks)))
        self.assertEqual(len(result["records"]), 3)
        self.assertEqual(result["warnings"], ["Missing model.json"])

    def test_default_tasks_are_discovered_after_startup_and_existing_sources_stay_fresh(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_default_tasks", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for initially_exists in (False, True):
            with self.subTest(initially_exists=initially_exists), \
                    tempfile.TemporaryDirectory(prefix="requirement-flow-default-tasks-") as directory:
                project = Path(directory)
                (project / "index.md").write_text("# Business\n", encoding="utf-8")
                changes = project / "docs/changes"
                if initially_exists:
                    changes.mkdir(parents=True)
                    (changes / "existing.md").write_text("# Existing task\n", encoding="utf-8")
                reader = module.ReaderProject(project, "index.md")
                initial = reader.catalog()
                self.assertEqual(len(initial["documents"]), 2 if initially_exists else 1)
                self.assertEqual(initial["task_pages"], [])

                changes.mkdir(parents=True, exist_ok=True)
                markdown = changes / "new.md"
                markdown.write_text("# New task R1\n", encoding="utf-8")
                pair = changes / "pair"
                pair.mkdir()

                def write_pair(revision):
                    data = json.dumps({"work": {"id": "pair", "title": "Task pair", "revision": revision}},
                                      ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
                    (pair / "model.json").write_bytes(data)
                    (pair / "handbook.html").write_text('<meta name="model-sha256" content="' +
                        hashlib.sha256(data).hexdigest() + '"><h1>Task pair</h1>', encoding="utf-8")

                write_pair(1)
                added = reader.catalog()
                doc = next(doc for doc in added["documents"] if doc["path"] == "docs/changes/new.md")
                self.assertEqual(doc["kind"], "task")
                self.assertEqual(added["task_pages"][0]["revision"], 1)
                page = added["task_pages"][0]
                markdown.write_text("# New task R2\n", encoding="utf-8")
                write_pair(2)
                updated = reader.catalog()
                self.assertEqual(next(doc for doc in updated["documents"] if doc["path"] == "docs/changes/new.md")["title"], "New task R2")
                self.assertEqual(updated["task_pages"][0]["revision"], 2)
                with self.assertRaises(module.ReaderError) as stale:
                    reader.content(doc["path"], doc["sha256"])
                self.assertEqual(stale.exception.status, 409)
                with self.assertRaises(module.ReaderError) as old_pair:
                    reader.task_page_content(page["path"], page["sha256"], page["model_sha256"])
                self.assertEqual(old_pair.exception.status, 409)

                markdown.unlink()
                (pair / "model.json").unlink()
                removed = reader.catalog()
                self.assertNotIn(doc["path"], {item["path"] for item in removed["documents"]})
                self.assertEqual(removed["task_pages"], [])
                with self.assertRaises(module.ReaderError) as gone:
                    reader.task_page_content(page["path"], page["sha256"], page["model_sha256"])
                self.assertEqual(gone.exception.status, 404)
                with self.assertRaises(module.ReaderError) as missing:
                    reader.content(doc["path"])
                self.assertEqual(missing.exception.status, 404)

    def test_explicit_task_paths_keep_missing_and_type_diagnostics(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_explicit_tasks", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-explicit-tasks-") as directory:
            project = Path(directory)
            (project / "index.md").write_text("# Business\n", encoding="utf-8")
            with self.assertRaises(module.ReaderError) as missing:
                module.ReaderProject(project, "index.md", ["docs/changes"])
            self.assertEqual(missing.exception.status, 404)
            (project / "unsupported.txt").write_text("Not a task input", encoding="utf-8")
            with self.assertRaisesRegex(module.ReaderError, "任务文件必须"):
                module.ReaderProject(project, "index.md", ["unsupported.txt"])
            changes = project / "docs/changes"
            changes.mkdir(parents=True)
            reader = module.ReaderProject(project, "index.md", ["docs/changes"])
            reader.catalog()
            changes.rmdir()
            self.assertTrue(any("任务入口不存在" in warning for warning in reader.catalog()["warnings"]))
            changes.write_text("Not a task directory", encoding="utf-8")
            self.assertTrue(any("任务文件必须" in warning for warning in reader.catalog()["warnings"]))

    def test_default_task_probe_rejects_a_later_symlink_without_exposing_it(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_task_symlink", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-default-task-link-") as directory:
            project = Path(directory) / "project"
            project.mkdir()
            (project / "index.md").write_text("# Business\n", encoding="utf-8")
            reader = module.ReaderProject(project, "index.md")
            reader.catalog()
            outside = Path(directory) / "outside"
            outside.mkdir()
            (outside / "private.md").write_text("# PRIVATE_OUTSIDE\n", encoding="utf-8")
            changes = project / "docs/changes"
            changes.parent.mkdir()
            try:
                changes.symlink_to(outside, target_is_directory=True)
            except OSError as error:
                self.skipTest("Symlinks unavailable: " + str(error))
            catalog = reader.catalog()
            self.assertEqual([doc["path"] for doc in catalog["documents"]], ["index.md"])
            self.assertTrue(any("符号链接" in warning for warning in catalog["warnings"]))
            self.assertNotIn("PRIVATE_OUTSIDE", json.dumps(catalog))

    def test_catalog_reuses_one_marked_worker_and_follows_only_visible_sources(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_metadata", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-marked-metadata-") as directory:
            project = Path(directory)
            for name in ("hidden", "code", "nested", "escaped", "first", "second", "independent", "with space"):
                (project / (name + ".md")).write_text("# " + name + "\n", encoding="utf-8")
            (project / "peer.md").write_text("# Peer\n[Independent](independent.md)\n", encoding="utf-8")
            tasks = project / "tasks"
            tasks.mkdir()
            (tasks / "explicit.md").write_text("# Explicit task\n", encoding="utf-8")
            entry = project / "index.md"
            entry.write_text(r"""<!--
# Old heading
[Hidden](hidden.md)
[Independent](independent.md)
[Explicit](tasks/explicit.md)
-->

    [Code example](code.md)

# **Current business**

[Nested [label]](nested.md)
[Escaped \[label\]](escaped.md)
[First][Shared   rule]
[Space](<with space.md>)
[Peer](peer.md)

[shared rule]: first.md
[SHARED RULE]: second.md
""", encoding="utf-8")
            processes = []
            launch = subprocess.Popen

            def start(*args, **kwargs):
                process = launch(*args, **kwargs)
                processes.append(process)
                return process

            with patch.object(module.subprocess, "Popen", side_effect=start) as calls:
                catalog = module.ReaderProject(project, "index.md", ["tasks"]).catalog()
            calls.assert_called_once()
            self.assertIsNotNone(processes[0].poll())
            documents = {doc["path"]: doc for doc in catalog["documents"]}
            self.assertEqual(documents["index.md"]["title"], "Current business")
            self.assertEqual([(link["label"], link["target"]) for link in documents["index.md"]["links"]], [
                ("Nested [label]", "nested.md"), ("Escaped [label]", "escaped.md"),
                ("First", "first.md"), ("Space", "with space.md"), ("Peer", "peer.md"),
            ])
            self.assertFalse({"hidden.md", "code.md", "second.md"} & documents.keys())
            self.assertIn("independent.md", documents)
            self.assertEqual(documents["tasks/explicit.md"]["kind"], "task")

            entry.unlink()
            with patch.object(module.subprocess, "Popen", side_effect=start) as missing_entry:
                with self.assertRaises(module.ReaderError):
                    reader = module.ReaderProject(project, "peer.md")
                    reader.entry = "index.md"
                    reader.catalog()
            missing_entry.assert_not_called()
            self.assertIsNotNone(processes[-1].poll())

    def test_metadata_cache_reuses_only_current_bytes_and_never_reuses_the_allowlist(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_metadata_cache", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-metadata-cache-") as directory:
            project = Path(directory)
            entry = project / "index.md"
            entry.write_text("# Entry\n[Rule](rule.md)\n[Peer](peer.md)\n", encoding="utf-8")
            rule = project / "rule.md"
            rule.write_text("# Rule R1\n\nBODY_ONLY_VALUE\n", encoding="utf-8")
            (project / "peer.md").write_text("# Peer\n", encoding="utf-8")
            reader = module.ReaderProject(project, "index.md")
            parse = module.MarkdownMetadata.read
            with patch.object(module.MarkdownMetadata, "read", autospec=True, side_effect=parse) as parses, \
                    patch.object(module.subprocess, "Popen", wraps=subprocess.Popen) as processes:
                original = reader.catalog()
                self.assertEqual(parses.call_count, 3)
                self.assertEqual(processes.call_count, 1)
                before = next(doc for doc in original["documents"] if doc["path"] == "rule.md")
                # A caller mutating its catalog must not mutate cached parser metadata.
                original["documents"][0]["links"][0].update(target="wrong.md", label="wrong")
                parses.reset_mock()
                processes.reset_mock()
                current = reader.catalog()
                self.assertEqual(current["navigation"][1]["path"], "rule.md")
                self.assertEqual(reader.content("rule.md", before["sha256"]), rule.read_bytes())
                self.assertEqual(len(list(reader.document_texts("all")["records"])), 3)
                parses.assert_not_called()
                processes.assert_not_called()
                self.assertNotIn("BODY_ONLY_VALUE", repr(reader.metadata_cache))

                rule.write_text("# Rule R2\n\nBODY_ONLY_VALUE\n", encoding="utf-8")
                changed = reader.catalog()
                self.assertEqual(parses.call_count, 1)
                self.assertEqual(processes.call_count, 1)
                self.assertEqual(next(doc for doc in changed["documents"] if doc["path"] == "rule.md")["title"], "Rule R2")
                with self.assertRaises(module.ReaderError) as stale:
                    reader.content("rule.md", before["sha256"])
                self.assertEqual(stale.exception.status, 409)

                parses.reset_mock()
                processes.reset_mock()
                with patch.object(module, "CREDENTIAL_FILES", module.CREDENTIAL_FILES | {"rule.md"}):
                    private = reader.catalog()
                    self.assertNotIn("rule.md", {doc["path"] for doc in private["documents"]})
                    with self.assertRaises(module.ReaderError) as blocked:
                        reader.content("rule.md")
                    self.assertEqual(blocked.exception.status, 403)
                parses.assert_not_called()
                processes.assert_not_called()

                entry.write_text("# Entry changed\n[Rule](rule.md)\n", encoding="utf-8")
                reduced = reader.catalog()
                self.assertEqual(parses.call_count, 1)
                self.assertNotIn("peer.md", {doc["path"] for doc in reduced["documents"]})
                with self.assertRaises(module.ReaderError) as unreachable:
                    reader.content("peer.md")
                self.assertEqual(unreachable.exception.status, 404)

                parses.reset_mock()
                processes.reset_mock()
                rule.unlink()
                missing = reader.catalog()
                self.assertNotIn("rule.md", {doc["path"] for doc in missing["documents"]})
                with self.assertRaises(module.ReaderError) as removed:
                    reader.content("rule.md")
                self.assertEqual(removed.exception.status, 404)
                parses.assert_not_called()
                processes.assert_not_called()

    def test_metadata_cache_is_bounded_and_shared_safely_by_parallel_catalogs(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_metadata_parallel", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-metadata-parallel-") as directory:
            project = Path(directory)
            entry = project / "index.md"
            entry.write_text("# Entry\n[Rule](rule.md)\n", encoding="utf-8")
            (project / "rule.md").write_text("# Rule\n", encoding="utf-8")
            reader = module.ReaderProject(project, "index.md")
            parse = module.MarkdownMetadata.read
            with patch.object(module.MarkdownMetadata, "read", autospec=True, side_effect=parse) as parses, \
                    patch.object(module.subprocess, "Popen", wraps=subprocess.Popen) as processes:
                with module.ThreadPoolExecutor(max_workers=4) as pool:
                    catalogs = list(pool.map(lambda _: reader.catalog(), range(4)))
                self.assertEqual(parses.call_count, 2)
                self.assertEqual(processes.call_count, 1)
            self.assertTrue(all({doc["path"] for doc in catalog["documents"]} == {"index.md", "rule.md"}
                                for catalog in catalogs))
            with patch.object(module, "MAX_DOCUMENTS", 2):
                for number in range(4):
                    name = f"new-{number}.md"
                    (project / name).write_text("# New rule\n", encoding="utf-8")
                    entry.write_text(f"# Entry\n[Rule]({name})\n", encoding="utf-8")
                    reader.catalog()
                    self.assertLessEqual(len(reader.metadata_cache), 2)

    def test_metadata_errors_are_generic_and_always_reap_the_worker(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_metadata_errors", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with patch.object(module.subprocess, "Popen", side_effect=FileNotFoundError("PRIVATE_VALUE")):
            with self.assertRaises(module.ReaderError) as missing:
                with module.MarkdownMetadata():
                    self.fail("Missing Node must not start a worker")
        self.assertEqual(missing.exception.status, 503)
        self.assertIn("20.19", str(missing.exception))
        self.assertNotIn("PRIVATE_VALUE", str(missing.exception))
        for response in ('{"error":"PRIVATE_SOURCE"}\n', '{bad json\n', None):
            with self.subTest(response=response):
                process = Mock(stdin=io.StringIO(), stdout=io.StringIO(response or ''))
                process.poll.return_value = None
                process.wait.side_effect = [subprocess.TimeoutExpired("node", 2), 0]
                with patch.object(module.subprocess, "Popen", return_value=process):
                    with self.assertRaises(module.ReaderError) as broken:
                        with module.MarkdownMetadata() as metadata:
                            if response is None:
                                future = Mock()
                                future.result.side_effect = module.FutureTimeout()
                                with patch.object(metadata.io, "submit", return_value=future):
                                    metadata.read("PRIVATE_SOURCE")
                            else:
                                metadata.read("PRIVATE_SOURCE")
                self.assertEqual(broken.exception.status, 503)
                self.assertNotIn("PRIVATE_SOURCE", str(broken.exception))
                process.terminate.assert_called_once()
                process.kill.assert_called_once()
                self.assertTrue(process.stdin.closed)
                self.assertTrue(process.stdout.closed)

    def test_batch_scans_once_and_keeps_readable_peers_if_one_document_disappears(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_batch", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-reader-batch-") as directory:
            project = Path(directory)
            entry = project / "index.md"
            for total in (20, 40):
                with self.subTest(total=total):
                    names = [f"rule-{number}.md" for number in range(1, total)]
                    links = "\n".join(f"[Rule]({name})" for name in names)
                    body = f"# Rule\n[Shared rule]({names[0]})\n[Shared exception]({names[1]})"
                    for name in names:
                        (project / name).write_bytes(body.encode())
                    entry.write_text(links, encoding="utf-8")
                    reader = module.ReaderProject(project, "index.md")
                    with patch.object(reader, "catalog", wraps=reader.catalog) as scans, \
                            patch.object(module, "text_file", wraps=module.text_file) as reads:
                        batch = reader.document_texts("all")
                        (project / names[0]).unlink()
                        (project / names[1]).write_bytes(b"# Changed during response\n")
                        records = {row["path"]: row for row in batch["records"]}
                        scans.assert_called_once_with()
                        self.assertLessEqual(reads.call_count, 3 * total)
                    self.assertEqual(len(records), total)
                    self.assertIn("error", records[names[0]])
                    self.assertIn("刷新", records[names[1]]["error"])
                    self.assertNotIn("text", records[names[1]])
                    self.assertEqual(records[names[-1]]["text"], body)

    def test_task_page_limit_does_not_read_unregistered_pairs(self):
        spec = importlib.util.spec_from_file_location("requirement_flow_reader_task_limit", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="requirement-flow-task-limit-") as directory:
            project = Path(directory)
            (project / "index.md").write_bytes(b"# Entry\n")
            for name in ["a", "b"]:
                folder = project / "tasks" / name
                folder.mkdir(parents=True)
                model = {"work": {"id": name, "title": name, "revision": 1}}
                raw = json.dumps(model, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
                (folder / "model.json").write_bytes(raw)
                (folder / "handbook.html").write_bytes(('<meta name="model-sha256" content="' +
                                                       hashlib.sha256(raw).hexdigest() + '">').encode())
            reader = module.ReaderProject(project, "index.md", ["tasks"])
            with patch.object(module, "MAX_DOCUMENTS", 1), \
                    patch.object(module, "text_file", wraps=module.text_file) as reads:
                catalog = reader.catalog()
                self.assertEqual(reads.call_count, 3)
                self.assertFalse(any(call.args[1].startswith("tasks/b/") for call in reads.call_args_list))
            self.assertEqual(len(catalog["task_pages"]), 1)
            self.assertEqual(catalog["task_pages"][0]["id"], "a")
            self.assertTrue(any("未检查其余候选" in message for message in catalog["warnings"]))

    def test_numeric_loopback_serves_http_without_reverse_dns(self):
        with tempfile.TemporaryDirectory(prefix="requirement-flow-reader-bind-test-") as directory:
            project = Path(directory)
            entry = project / "docs/business/index.md"
            entry.parent.mkdir(parents=True)
            entry.write_bytes("# 本地业务\n".encode("utf-8"))
            spec = importlib.util.spec_from_file_location("requirement_flow_reader_bind", SCRIPT)
            reader_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(reader_module)
            reader = reader_module.ReaderProject(project)
            with patch("socket.getfqdn", side_effect=AssertionError("Numeric loopback needs no DNS")) as lookup:
                with reader_module.create_server(reader) as server:
                    self.assertEqual(server.server_address[0], "127.0.0.1")
                    self.assertGreater(server.server_address[1], 0)
                    self.assertEqual(server.server_port, server.server_address[1])
                    self.assertEqual(server.server_name, "127.0.0.1")
                    worker = threading.Thread(target=server.serve_forever, daemon=True)
                    worker.start()
                    try:
                        opener = build_opener(ProxyHandler({}))
                        with opener.open(f"http://127.0.0.1:{server.server_port}/api/catalog", timeout=5) as response:
                            self.assertEqual(response.status, 200)
                            self.assertEqual(json.load(response)["entry"], "docs/business/index.md")
                    finally:
                        server.shutdown()
                        worker.join(timeout=5)
                    self.assertFalse(worker.is_alive())
                lookup.assert_not_called()


class ReaderExampleTest(unittest.TestCase):
    def test_assembled_existing_examples_have_live_business_task_and_source_links(self):
        with tempfile.TemporaryDirectory(prefix="requirement-flow-reader-example-test-") as directory:
            root = Path(directory)
            project = root / "assembled example"
            prepared = subprocess.run(
                [sys.executable, "-B", str(PREPARE_EXAMPLE), "--output", str(project)],
                cwd=root, capture_output=True, text=True, timeout=30,
            )
            self.assertEqual(prepared.returncode, 0, prepared.stdout + prepared.stderr)
            self.assertTrue(project.is_dir())
            before = {path.relative_to(project).as_posix(): path.read_bytes()
                      for path in project.rglob("*") if path.is_file()}
            spec = importlib.util.spec_from_file_location("requirement_flow_reader_example", SCRIPT)
            reader_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(reader_module)
            reader = reader_module.ReaderProject(
                project, entry="docs/business/index.md",
                tasks=["inventory/docs/copy-decision.md", "library/docs/changes/regular-holds.md"],
            )
            catalog = reader.catalog()
            self.assertEqual(catalog["entry"], "docs/business/index.md")
            self.assertEqual(catalog["warnings"], [])
            documents = {page["path"]: page for page in catalog["documents"]}
            inventory = documents["docs/business/inventory.md"]
            task = documents["inventory/docs/copy-decision.md"]
            self.assertEqual(inventory["kind"], "document")
            self.assertEqual(task["kind"], "task")
            self.assertIn(task["path"], {link["target"] for link in inventory["links"]})
            self.assertIn(inventory["path"], {page["path"] for page in task["backlinks"]})
            self.assertEqual({page["path"] for page in documents.values() if page["kind"] == "task"},
                             {"inventory/docs/copy-decision.md", "library/docs/changes/regular-holds.md"})
            self.assertEqual([link["path"] for link in catalog["navigation"]], [
                "docs/business/index.md", "docs/business/inventory.md", "docs/business/library.md",
                "docs/business/repair.md", "inventory/docs/copy-decision.md",
                "library/docs/changes/regular-holds.md",
            ])
            for path in ("inventory/spec/current.md", "library/handbook.md", "repairclub/desk-policy.md"):
                self.assertEqual(documents[path]["kind"], "document")
                self.assertNotIn(path, {link["path"] for link in catalog["navigation"]})
            for page in documents.values():
                for link in page["links"]:
                    with self.subTest(document=page["path"], target=link["target"]):
                        self.assertTrue(link["exists"], link)
            for item in catalog["documents"] + catalog["sources"]:
                with self.subTest(source=item["path"]):
                    self.assertEqual(reader.content(item["path"]), (project / item["path"]).read_bytes())
            after = {path.relative_to(project).as_posix(): path.read_bytes()
                     for path in project.rglob("*") if path.is_file()}
            self.assertEqual(after, before)
            self.assertFalse(list(project.rglob("*.html")))
            self.assertFalse(list(project.rglob("model.json")))


if __name__ == "__main__":
    unittest.main()
