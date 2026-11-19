"""Resolve only recorded source locations in the selected live checkout."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest
from urllib.error import HTTPError
from urllib.parse import parse_qs, unquote, urlencode, urlsplit
from urllib.request import Request, urlopen

SKILL = Path(__file__).resolve().parents[1] / "skills/requirement-flow"
sys.path.insert(0, str(SKILL))
from runtime import source_paths, sync


class SourceLocationTest(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.base = Path(temp.name).resolve()
        self.project = self.base / "project"
        self.store = self.project / ".requirements"
        self.store.mkdir(parents=True)

    @staticmethod
    def git(root, *args):
        subprocess.run(["git", "-c", "user.name=Test", "-c", "user.email=test@example.invalid",
                        "-c", "commit.gpgSign=false", "-C", str(root), *map(str, args)],
                       check=True, capture_output=True)

    def test_live_location_uses_cited_position_in_registered_worktree_and_nested_repository(self):
        f = "商品 #%&.ts"
        code = f"pc/{f}"
        old = "prior/stock.ts"
        moved = "docs/stock.ts"
        library = self.base / "library"
        library.mkdir()
        (library / f).write_text("entry\nconst value = 2\n", encoding="utf-8")
        self.git(library, "init", "-q")
        self.git(library, "add", ".")
        self.git(library, "commit", "-qm", "PC source")
        self.git(self.project, "init", "-q")
        self.git(self.project, "-c", "protocol.file.allow=always", "submodule", "add", "-q", library, "pc")
        self.git(self.project, "commit", "-qm", "track PC")
        tree = self.base / "review checkout"
        self.git(self.project, "worktree", "add", "-q", "--detach", tree)
        self.git(tree, "-c", "protocol.file.allow=always", "submodule", "update", "--init", "--quiet")
        self.assertTrue((tree / "pc/.git").is_file())
        (tree / "docs").mkdir()
        (tree / moved).write_text("first\nsecond\n", encoding="utf-8")
        (self.project / "root-only.ts").write_text("other branch", encoding="utf-8")
        (self.store / "source-paths.json").write_text(json.dumps({"version": 1, "directories": {"prior/": "docs/"}}))
        active = self.store / "active/feature"
        sync.initialize_task(active, "核对单接口字段", key="feature")
        model_file = active / "model.json"
        model = json.loads(model_file.read_bytes())
        model["work"]["contracts"]["C-check"] = {"title": "读商品", "operation": "GET /stock", "fields": [],
                "source": old + ":2", "state": "confirmed", "status": "已核对",
                "endpoints": [{"method": "GET", "path": "/stock", "purpose": "查询商品",
                               "source": code + ":2:3\nroot-only.ts:1", "request": [], "response": []}]}
        model_file.write_bytes(sync.encoded(model))
        process = subprocess.Popen([sys.executable, "-B", str(SKILL / "flow.py"), "--project", str(self.project),
                                    "task", "feature", "serve", "--source-root", str(tree)],
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            url = process.stdout.readline().strip()
            self.assertTrue(url.startswith("http://127.0.0.1:"), url or process.stderr.read())
            with urlopen(url, timeout=5) as page:
                live = page.read().decode("utf-8")
            token = json.loads(re.search(r'<script type="application/json" id="data">(.+?)</script>', live)[1])["csrf"]
            header = {"X-Requirement-Flow": token}

            def get(ref, headers):
                with urlopen(Request(url + "source-location?" + urlencode({"ref": ref}), headers=headers), timeout=5) as r:
                    return json.load(r)

            result = get(code + ":2:3", header)
            expected = tree / code
            self.assertEqual((result["path"], result["line"], result["column"]), (str(expected), 2, 3))
            self.assertEqual(result["preview"], {"startLine": 1, "lines": ["entry", "const value = 2"]})
            self.assertEqual(parse_qs(urlsplit(result["editors"]["webstorm"]).query),
                             {"file": [str(expected)], "line": ["2"], "column": ["3"]})
            self.assertEqual(result["editors"]["vscode"].split("://")[0], "vscode")
            self.assertEqual(unquote(urlsplit(result["editors"]["vscode"]).path).lstrip("/"),
                             expected.as_posix().lstrip("/") + ":2:3")
            self.assertEqual(get(old + ":2", header), get(moved + ":2", header))
            for ref, headers, status in ((code + ":1", header, 404), ("root-only.ts:1", header, 404),
                    (code + ":2:3", {}, 403), (code + ":2:3", {**header, "Origin": "http://unrelated.invalid"}, 403)):
                with self.subTest(ref=ref, headers=list(headers)), self.assertRaises(HTTPError) as caught:
                    get(ref, headers)
                self.assertEqual(caught.exception.code, status)
                self.assertNotIn(str(tree).encode(), caught.exception.read())
            snapshot = (active / "handbook.html").read_bytes()
            self.assertNotIn(str(tree).encode(), snapshot)
            self.assertNotIn(token.encode(), snapshot)
        finally:
            process.terminate()
            process.communicate(timeout=10)
        for candidate in (library, tree / "pc", self.base):
            with self.assertRaises(ValueError):
                source_paths.select_source_root(self.project, candidate)

    def test_private_generated_uncited_and_redirected_sources_are_unavailable(self):
        paths = source_paths.SourcePaths(self.store)
        unsafe = [".env", "credentials.json", ".git/config", ".env.local/config.ts", "dist/bundle.js",
                  "src/.key/p.ts", "../outside.ts", "a\\file.ts", "private.pem", ".requirements/.receipt-key"]
        for name in unsafe[:6]:
            p = self.project / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(b"data")
        target = self.base / "outside.ts"
        target.write_bytes(b"outside")
        redirect = self.project / "redirect"
        if os.name == "nt":
            subprocess.run(["cmd.exe", "/d", "/c", "mklink", "/J", str(redirect), str(self.base)], check=True,
                           stdout=subprocess.DEVNULL)
            self.addCleanup(redirect.rmdir)
        else:
            redirect.symlink_to(self.base, target_is_directory=True)
        unsafe.append("redirect/outside.ts")
        work = {"stories": {"S": {"basis": "\n".join(unsafe + ["source.py:6", "source.py:100", "source.py:7:999",
                                                              "source.py:20", "shape.png", "binary.c"])
                                  }}, "contracts": {}, "lessons": [], "events": []}
        (self.project / "source.py").write_text("\n".join(["x" * 550] * 15 + ['password = "should-be-redacted"'] * 6),
                                               encoding="utf-8")
        (self.project / "shape.png").write_bytes(b"\x89PNG")
        (self.project / "binary.c").write_bytes(b"file\0data")
        def resolve(ref):
            return source_paths.source_location(work, paths, self.project, ref)
        for name in unsafe + ["source.py", "source.py:100", "source.py:7:999", str(target)]:
            with self.subTest(name=name):
                self.assertIsNone(resolve(name))
        self.assertEqual(resolve("source.py:6")["preview"], {"startLine": 3, "lines": ["x" * 400] * 7})
        for name in ("source.py:20", "shape.png", "binary.c"):
            self.assertNotIn("preview", resolve(name))
