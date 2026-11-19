"""Real checkouts and CLI runs must not reuse evidence from different code."""
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SKILL = Path(__file__).resolve().parents[1] / "skills/requirement-flow"
FLOW = SKILL / "flow.py"
sys.path.insert(0, str(SKILL))
from runtime import code_inputs, evidence, sync


class CodeInputsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name).resolve()
        self.project = self.base / "project"
        self.project.mkdir()
        (self.project / "business.py").write_text("def value(): return 'saved'\n", encoding="utf-8")
        (self.project / "check.py").write_text(
            "from business import value\nassert value() == 'saved'\nprint('save assertion passed')\n", encoding="utf-8")
        (self.project / ".gitignore").write_text("cache/\n__pycache__/\n", encoding="utf-8")

    def git(self, *args, project=None):
        return subprocess.check_output(
            ["git", "-c", "user.name=Test", "-c", "user.email=test@example.invalid",
             "-c", "protocol.file.allow=always", "-c", "core.autocrlf=false", "-C", str(project or self.project), *args],
            stderr=subprocess.STDOUT, text=True).strip()

    def init_git(self):
        self.git("init", "-q")
        self.git("config", "core.autocrlf", "false")
        self.git("add", ".")
        self.git("commit", "-qm", "initial code")

    def cli(self, *args, project=None, ok=True):
        root = project or self.project
        result = subprocess.run([sys.executable, "-B", str(FLOW), "--project", str(root), *map(str, args)],
                                cwd=root, capture_output=True, text=True, timeout=30)
        if ok:
            self.assertEqual(result.returncode, 0, result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0, result.stdout)
        return result

    def queue(self, project=None):
        return json.loads(self.cli("task", "save", "next", project=project).stdout)

    def write(self, command, *args, project=None, ok=True):
        return self.cli("task", "save", command, *args, "--actor", "tester", "--rev",
                        self.queue(project)["revision"], project=project, ok=ok)

    def prepare(self, paths=None):
        self.cli("new", "save", "--request", "保存后可以读取")
        action = {"title": "核验保存", "kind": "验证", "stories": ["S-save"], "read_stories": ["S-save"],
                  "contracts": [], "decisions": [], "depends_on": [{"id": "A-intake"}],
                  "done": "断言保存结果", "covers": ["AC-save"], "accepts": ["自动化"]}
        if paths is not None:
            action["code_paths"] = paths
        plan = {"stories": {"S-save": {"title": "保存", "actor": "用户", "goal": "保存结果",
                "examples": [{"id": "AC-save", "given": "有效输入", "when": "保存", "then": "读取到结果"}]}},
                "actions": {"A-check": action}}
        patch = self.base / "plan.json"
        patch.write_text(json.dumps(plan, ensure_ascii=False), encoding="utf-8")
        self.write("plan", patch, "--why", "明确保存验收")
        self.write("finish", "A-intake", "--output", "明确保存场景", "--evidence", "用户原话")

    def collect(self, project=None, argv=None, ok=True):
        return self.cli("task", "save", "verify-run", "A-check", "--scenario", "AC-save",
                        "--actor", "tester", "--environment", "真实本机代码", "--rev", self.queue(project)["revision"],
                        "--", *(argv or [sys.executable, "-B", "check.py"]), project=project, ok=ok)

    def complete(self):
        self.collect()
        self.write("finish", "A-check", "--output", "实际断言通过")
        self.assertEqual(self.queue()["state"], "complete")

    def assert_stale(self, project=None):
        queue = self.queue(project)
        self.assertEqual(queue["scenarios"][0]["status"], "stale")
        self.assertNotEqual(queue["state"], "complete")
        self.cli("archive", "save", project=project, ok=False)

    def test_actual_worktree_bytes_and_file_additions_deletions_invalidate(self):
        self.init_git()
        self.prepare()
        self.complete()
        original = (self.project / "business.py").read_bytes()
        (self.project / "business.py").write_text("def value(): return 'BROKEN'\n")
        actual = subprocess.run([sys.executable, "-B", "check.py"], cwd=self.project, capture_output=True)
        self.assertNotEqual(actual.returncode, 0)
        self.assert_stale()
        (self.project / "business.py").write_bytes(original)
        self.assertEqual(self.queue()["state"], "complete")
        extra = self.project / "new_source.py"
        extra.write_text("value = 'new behavior'\n")
        self.assert_stale()
        extra.unlink()
        (self.project / "business.py").unlink()
        self.assert_stale()
        (self.project / "business.py").write_bytes(original)
        (self.project / "cache").mkdir()
        (self.project / "cache/ignored.log").write_text("runtime output")
        self.assertEqual(self.queue()["state"], "complete")

    def test_receipt_commits_and_identical_worktrees_preserve_proof_but_changed_peer_does_not(self):
        self.init_git()
        self.prepare()
        self.complete()
        self.git("add", ".")
        self.git("commit", "-qm", "record verified evidence only")
        self.assertEqual(self.queue()["state"], "complete")
        peer = self.base / "peer"
        self.git("worktree", "add", "-qb", "peer", str(peer))
        self.assertEqual(self.queue(peer)["state"], "complete")
        (peer / "business.py").write_text("def value(): return 'BROKEN'\n")
        self.git("add", "business.py", project=peer)
        self.git("commit", "-qm", "different peer implementation", project=peer)
        self.assert_stale(peer)
        self.assertEqual(self.queue()["state"], "complete")
        self.git("worktree", "remove", str(peer))

    def test_submodule_actual_checkout_and_dirty_files_are_inputs(self):
        source = self.base / "source"
        source.mkdir()
        (source / "service.py").write_text("value = 1\n")
        self.git("init", "-q", project=source)
        self.git("config", "core.autocrlf", "false", project=source)
        self.git("add", ".", project=source)
        self.git("commit", "-qm", "first", project=source)
        first = self.git("rev-parse", "HEAD", project=source)
        (source / "service.py").write_text("value = 2\n")
        self.git("commit", "-qam", "second", project=source)
        self.init_git()
        self.git("submodule", "add", "-q", str(source), "service")
        self.git("commit", "-qam", "add service")
        self.prepare()
        self.complete()
        child = self.project / "service"
        (child / "service.py").write_text("value = 3\n")
        self.assert_stale()
        self.git("restore", "service.py", project=child)
        self.assertEqual(self.queue()["state"], "complete")
        self.git("checkout", "-q", first, project=child)
        self.assert_stale()

    def test_ignored_independent_child_repository_is_bound_by_its_actual_contents(self):
        with (self.project / ".gitignore").open("a") as ignored:
            ignored.write("app/\n")
        self.init_git()
        child = self.project / "app"
        child.mkdir()
        (child / "service.py").write_text("value = 1\n")
        (child / ".gitignore").write_text("logs/\n")
        self.git("init", "-q", project=child)
        self.git("config", "core.autocrlf", "false", project=child)
        self.git("add", ".", project=child)
        self.git("commit", "-qm", "independent application", project=child)
        self.assertEqual(self.git("status", "--porcelain"), "")
        self.prepare()
        self.complete()
        (child / "logs").mkdir()
        (child / "logs/run.log").write_text("ignored runtime output")
        self.assertEqual(self.queue()["state"], "complete")
        clone = self.base / "same-app"
        self.git("clone", "-q", str(child), str(clone))
        child.rename(self.base / "original-app")
        clone.rename(child)
        self.assertEqual(self.queue()["state"], "complete")
        (child / "service.py").write_text("value = 'BROKEN'\n")
        self.assert_stale()
        self.assertEqual(self.git("status", "--porcelain"), "?? .requirements/")

    def test_cyclic_parent_of_tracked_input_is_stale_instead_of_crashing_the_cli(self):
        source = self.project / "src"
        source.mkdir()
        (source / "tracked.py").write_text("value = 1\n")
        self.init_git()
        self.prepare()
        self.complete()
        (source / "tracked.py").unlink()
        source.rmdir()
        try:
            source.symlink_to("src", target_is_directory=True)
        except OSError as exc:
            self.skipTest("symlinks unavailable: " + str(exc))
        self.assert_stale()
        self.assertIn("循环", self.queue()["scenarios"][0]["reason"])

    def test_explicit_paths_include_ignored_sources_and_ignore_unrelated_changes_without_git(self):
        (self.project / "cache").mkdir()
        (self.project / "cache/source.py").write_text("value = 1\n")
        self.prepare(["business.py", "check.py", "cache/source.py"])
        self.complete()
        (self.project / "notes.md").write_text("unrelated research")
        self.assertEqual(self.queue()["state"], "complete")
        (self.project / "cache/source.py").write_text("value = 2\n")
        self.assert_stale()

    def test_code_change_during_successful_command_is_preserved_as_failed_receipt(self):
        self.prepare(["business.py", "check.py"])
        argv = [sys.executable, "-B", "-c", "from pathlib import Path; Path('business.py').write_text(\"def value(): return 'BROKEN'\\n\"); print('assertion output')"]
        result = json.loads(self.collect(argv=argv, ok=False).stdout)
        self.assertFalse(result["passed"])
        work = self.project / ".requirements/active/save"
        event = next(e for e in reversed(json.loads((work / "model.json").read_bytes())["work"]["events"])
                     if e["kind"] == "evidence")
        receipt = event["receipt"]
        self.assertEqual(receipt["exit_code"], 0)
        self.assertFalse(receipt["code_inputs_unchanged"])
        evidence.validate(work, receipt, action=receipt["action"], scenario=receipt["scenario"], stamp=receipt["stamp"])
        self.assertIn("assertion output", evidence.artifact_path(work, receipt).read_text())
        self.write("finish", "A-check", "--output", "cannot finish changed input", ok=False)

    def test_safe_internal_symlinks_track_content_and_external_or_cyclic_links_are_rejected(self):
        alias = self.project / "alias.py"
        try:
            alias.symlink_to("business.py")
        except OSError as exc:
            self.skipTest("symlinks unavailable: " + str(exc))
        first = code_inputs.snapshot(self.project, ["alias.py"])
        (self.project / "business.py").write_text("def value(): return 'changed'\n")
        with self.assertRaisesRegex(ValueError, "已改变"):
            code_inputs.verify_current(self.project, first, ["alias.py"])
        alias.unlink()
        outside = self.base / "outside.py"
        outside.write_text("private source")
        alias.symlink_to(outside)
        with self.assertRaisesRegex(ValueError, "项目外部"):
            code_inputs.snapshot(self.project, ["alias.py"])
        alias.unlink()
        alias.symlink_to("alias.py")
        with self.assertRaisesRegex(ValueError, "循环"):
            code_inputs.snapshot(self.project, ["alias.py"])
        alias.unlink()
        management = self.project / ".requirements"
        management.mkdir()
        (management / "pretend.py").write_text("not a source input")
        alias.symlink_to(".requirements", target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "管理数据"):
            code_inputs.snapshot(self.project, ["alias.py/pretend.py"])

    def test_missing_and_empty_explicit_ranges_fail_before_running_command(self):
        (self.project / "empty").mkdir()
        for paths in (["misspelled.py"], ["empty"]):
            with self.subTest(paths=paths), self.assertRaisesRegex(ValueError, "不存在|没有可核验"):
                code_inputs.snapshot(self.project, paths)
        self.prepare(["misspelled.py"])
        self.collect(argv=[sys.executable, "-B", "-c", "print('cannot bypass missing input')"], ok=False)
        self.assertNotEqual(self.queue()["state"], "complete")

    def test_explicit_root_skips_dependency_links_but_includes_ignored_project_sources(self):
        self.init_git()
        outside = self.base / "external-dependency"
        outside.mkdir()
        (outside / "package.js").write_text("module.exports = 1")
        dependencies = self.project / "node_modules"
        dependencies.mkdir()
        try:
            (dependencies / "package").symlink_to(outside, target_is_directory=True)
        except OSError as exc:
            self.skipTest("symlinks unavailable: " + str(exc))
        (self.project / "cache").mkdir()
        source = self.project / "cache/source.py"
        source.write_text("value = 1")
        first = code_inputs.snapshot(self.project, ["."])
        source.write_text("value = 2")
        with self.assertRaisesRegex(ValueError, "已改变"):
            code_inputs.verify_current(self.project, first, ["."])

    def test_request_scoped_cache_never_skips_receipt_or_new_request_freshness_checks(self):
        paths = ["business.py"]
        first = code_inputs.snapshot(self.project, paths)
        cache = {}
        code_inputs.verify_current(self.project, first, paths, cache=cache)
        self.assertEqual(len(cache), 1)
        with self.assertRaisesRegex(ValueError, "旧回执"):
            code_inputs.verify_current(self.project, None, paths, cache=cache)
        with self.assertRaisesRegex(ValueError, "已改变"):
            code_inputs.verify_current(self.project, {**first, "sha256": "different"}, paths, cache=cache)
        (self.project / "business.py").write_text("def value(): return 'changed'\n")
        with self.assertRaisesRegex(ValueError, "已改变"):
            code_inputs.verify_current(self.project, first, paths, cache={})

    def test_render_hashes_one_scope_once_and_rechecks_code_on_the_next_render(self):
        self.prepare(["business.py", "check.py"])
        self.complete()
        decisions = {"D-" + str(i): {"title": "后续选项 " + str(i), "owner": "产品负责人",
                     "why": "评估独立的后续范围", "stories": ["S-save"], "options": {
                         "left": {"label": "左", "consequence": "后续方向一"},
                         "right": {"label": "右", "consequence": "后续方向二"}}} for i in range(10)}
        plan = self.base / "decisions.json"
        plan.write_text(json.dumps({"decisions": decisions}, ensure_ascii=False), encoding="utf-8")
        self.write("plan", plan, "--why", "比较后续业务选项")
        work = self.project / ".requirements/active/save"
        model = json.loads((work / "model.json").read_bytes())

        def draw():
            page = sync.render(model, workspace=work)
            return json.loads(re.search(r'<script type="application/json" id="data">(.+?)</script>', page).group(1))

        with patch.object(code_inputs, "snapshot", wraps=code_inputs.snapshot) as snapshots:
            current = draw()
            self.assertEqual(snapshots.call_count, 1)
            self.assertEqual(current["queue"]["scenarios"][0]["status"], "passed")
            (self.project / "business.py").write_text("def value(): return 'BROKEN'\n")
            changed = draw()
            self.assertEqual(snapshots.call_count, 2)
            self.assertEqual(changed["queue"]["scenarios"][0]["status"], "stale")

    def test_legacy_signed_artifact_remains_readable_but_cannot_prove_current_code(self):
        self.prepare()
        work = self.project / ".requirements/active/save"
        root = evidence.storage(work, create=True)
        with tempfile.TemporaryDirectory(dir=root) as folder:
            staged = Path(folder) / "record"
            staged.mkdir()
            (staged / "output.log").write_text("historical assertion passed\n")
            receipt = evidence.binding(work, "A-check", "AC-save", "legacy-stamp", "tester", "old code")
            receipt.update(kind="run", level="自动化", passed=True, actual="historical success", exit_code=0,
                           argv=[sys.executable, "-B", "check.py"], cwd=str(self.project))
            receipt = evidence.publish(root, staged, receipt, "output.log")
        self.assertTrue(evidence.validate(work, receipt, action="A-check", scenario="AC-save", stamp="legacy-stamp")["passed"])
        with self.assertRaisesRegex(ValueError, "旧回执"):
            evidence.validate_current_inputs(receipt, self.project)
        self.assertIn("historical", evidence.artifact_path(work, receipt).read_text())


if __name__ == "__main__":
    unittest.main()
