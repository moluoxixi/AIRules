"""HTTP checks for a read-only Markdown reader and its document relationships."""
import importlib.util
import hashlib
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
from urllib.error import HTTPError
from urllib.parse import quote, unquote
from urllib.request import build_opener, ProxyHandler, Request


SCRIPT = Path(__file__).resolve().parents[1] / "skills/requirement-flow/scripts/reader.py"
PREPARE_EXAMPLE = Path(__file__).resolve().parent / "prepare_reader_example.py"


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

    def start_server(self, entry="docs/business/index.md"):
        self.__dict__.pop("url", None)
        self.process = subprocess.Popen(
            [sys.executable, "-u", "-B", str(SCRIPT), "--project", str(self.project),
             "--entry", entry, "--tasks", "docs/changes", "--port", "0"],
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
            self.fail("Reader did not print its local URL: " + "".join(output))
        if not hasattr(self, "url"):
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
        path.write_text(content, encoding="utf-8")
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
            {"path": "docs/business/index.md", "label": "门店库存业务", "fragment": ""},
            {"path": "docs/changes/copy.md", "label": "先看本次变更", "fragment": "实施范围"},
            {"path": "docs/business/流程 说明.md", "label": "再看办理流程", "fragment": "保存"},
            {"path": "docs/business/流程 说明.md", "label": "另一条规则", "fragment": "恢复"},
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
