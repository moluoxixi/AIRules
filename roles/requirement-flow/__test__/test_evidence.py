"""Black-box execution receipts: facts and freshness, never business acceptance."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "skills/requirement-flow/scripts/evidence.py"


class EvidenceTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="requirement-flow-evidence-test-")
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.project = self.root / "真实项目"
        self.project.mkdir()
        self.source = self.project / "src"
        self.source.mkdir()
        (self.source / "main.py").write_text("value = 1\n", encoding="utf-8")
        self.output = self.project / ".requirements/evidence/run.json"

    def cli(self, *arguments):
        return subprocess.run(
            [sys.executable, str(SCRIPT), *map(str, arguments)],
            cwd=self.root, capture_output=True, text=True, timeout=20,
        )

    def run_command(self, code="print('ok')", *, inputs=("src",), output=None, extra=()):
        arguments = ["run", "--project", self.project, "--output", output or self.output]
        for entry in inputs:
            arguments.extend(("--input", entry))
        return self.cli(*arguments, "--", sys.executable, "-c", code, *extra)

    def check(self, receipt=None, *, project=None):
        return self.cli("check", "--project", project or self.project, receipt or self.output)

    def report(self, result):
        self.assertTrue(result.stdout.strip(), result.stderr)
        return json.loads(result.stdout)

    def assert_current_success(self, result):
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)
        report = self.report(result)
        self.assertEqual(report["execution"], "succeeded")
        self.assertEqual(report["freshness"], "current")
        return report

    def assert_stale(self, result):
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn(self.report(result)["freshness"], ("stale", "changed_during_run"))

    def assert_no_acceptance_verdict(self, value):
        if isinstance(value, dict):
            self.assertTrue(set(value).isdisjoint({"passed", "business_pass", "ready_to_deliver"}), value)
            for child in value.values():
                self.assert_no_acceptance_verdict(child)
        elif isinstance(value, list):
            for child in value:
                self.assert_no_acceptance_verdict(child)

    def test_real_execution_preserves_arguments_cwd_and_both_output_streams(self):
        literal = "one argument; echo MUST_REMAIN_LITERAL"
        code = (
            "import os,sys; print(os.path.basename(os.getcwd()),sys.argv[1]); "
            "print('stderr captured',file=sys.stderr)"
        )
        self.assert_current_success(self.run_command(code, extra=(literal,)))
        receipt = json.loads(self.output.read_text(encoding="utf-8"))
        self.assertEqual(receipt["command"][-1], literal)
        self.assertEqual(receipt["exit_code"], 0)
        log = (self.project / receipt["log"]["path"]).read_text(encoding="utf-8")
        self.assertIn("真实项目 " + literal, log)
        self.assertIn("stderr captured", log)
        self.assert_current_success(self.check())

    def test_receipt_and_output_survive_a_normal_git_handoff(self):
        (self.project / ".gitignore").write_text("*.log\n", encoding="utf-8")
        receipt = Path("docs/changes/evidence/run.json")
        self.assert_current_success(self.run_command(output=receipt))
        git = ["git", "-c", "core.autocrlf=false", "-c", f"core.hooksPath={self.root / 'no-hooks'}"]
        subprocess.run([*git, "init", "-q"], cwd=self.project, check=True)
        subprocess.run([*git, "add", "."], cwd=self.project, check=True)
        subprocess.run([*git, "-c", "user.name=Fixture", "-c", "user.email=test@example.invalid",
                        "-c", "commit.gpgsign=false", "commit", "-qm", "handoff"], cwd=self.project, check=True)
        checkout = self.root / "fresh checkout"
        subprocess.run([*git, "clone", "-q", str(self.project), str(checkout)], check=True)
        self.assert_current_success(self.check(receipt, project=checkout))

    def test_print_ok_and_empty_output_only_prove_command_execution(self):
        for index, code in enumerate(("print('ok')", "pass")):
            with self.subTest(code=code):
                output = self.project / f"receipts/{index}.json"
                result = self.run_command(code, output=output)
                self.assert_current_success(result)
                receipt = json.loads(output.read_text(encoding="utf-8"))
                self.assert_no_acceptance_verdict(self.report(result))
                self.assert_no_acceptance_verdict(receipt)
                self.assert_no_acceptance_verdict(self.report(self.check(output)))

    def test_nonzero_exit_remains_a_recorded_execution_failure(self):
        result = self.run_command("import sys; print('expected failure'); sys.exit(7)")
        self.assertNotEqual(result.returncode, 0)
        report = self.report(result)
        self.assertEqual(report["execution"], "failed")
        self.assertEqual(report["freshness"], "current")
        receipt = json.loads(self.output.read_text(encoding="utf-8"))
        self.assertEqual(receipt["exit_code"], 7)
        checked = self.check()
        self.assertNotEqual(checked.returncode, 0)
        self.assertEqual(self.report(checked)["execution"], "failed")

    def test_missing_executable_is_recorded_as_failure(self):
        result = self.cli(
            "run", "--project", self.project, "--output", self.output,
            "--input", "src", "--", self.project / "missing-executable",
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.report(result)["execution"], "failed")
        self.assertTrue(self.output.is_file())
        checked = self.check()
        self.assertNotEqual(checked.returncode, 0)
        self.assertEqual(self.report(checked)["execution"], "failed")

    def test_check_only_inspects_saved_facts_without_reexecuting_the_command(self):
        code = (
            "from pathlib import Path; p=Path('execution-count'); "
            "p.write_text(str(int(p.read_text())+1) if p.exists() else '1')"
        )
        self.assert_current_success(self.run_command(code))
        self.assert_current_success(self.check())
        self.assertEqual((self.project / "execution-count").read_text(), "1")

    def test_uncommitted_content_changes_invalidate_the_receipt(self):
        self.assert_current_success(self.run_command())
        (self.source / "main.py").write_text("value = 2\n", encoding="utf-8")
        self.assert_stale(self.check())

    def test_new_directory_member_invalidates_the_receipt(self):
        self.assert_current_success(self.run_command())
        (self.source / "new.py").write_text("new = True\n", encoding="utf-8")
        self.assert_stale(self.check())

    def test_deleted_directory_member_invalidates_the_receipt(self):
        self.assert_current_success(self.run_command())
        (self.source / "main.py").unlink()
        self.assert_stale(self.check())

    def test_multiple_explicit_inputs_are_all_bound(self):
        configuration = self.project / "settings.json"
        configuration.write_text('{"enabled": true}\n', encoding="utf-8")
        self.assert_current_success(self.run_command(inputs=("src", "settings.json")))
        configuration.write_text('{"enabled": false}\n', encoding="utf-8")
        self.assert_stale(self.check())

    def test_changed_log_invalidates_the_receipt(self):
        self.assert_current_success(self.run_command())
        receipt = json.loads(self.output.read_text(encoding="utf-8"))
        (self.project / receipt["log"]["path"]).write_text("different output\n", encoding="utf-8")
        self.assert_stale(self.check())

    def test_missing_log_invalidates_the_receipt(self):
        self.assert_current_success(self.run_command())
        receipt = json.loads(self.output.read_text(encoding="utf-8"))
        (self.project / receipt["log"]["path"]).unlink()
        self.assert_stale(self.check())

    def test_new_symlink_cannot_reuse_an_old_receipt(self):
        self.assert_current_success(self.run_command())
        original = self.source / "main.py"
        contents = original.read_bytes()
        outside = self.root / "replacement.py"
        outside.write_bytes(contents)
        original.unlink()
        try:
            original.symlink_to(outside)
        except OSError as error:
            self.skipTest(f"Symlinks unavailable: {error}")
        self.assert_stale(self.check())

    def test_command_modifying_its_own_input_cannot_produce_current_evidence(self):
        code = "from pathlib import Path; Path('src/main.py').write_text('value = 3\\n'); print('ok')"
        result = self.run_command(code)
        self.assertNotEqual(result.returncode, 0)
        report = self.report(result)
        self.assertEqual(report["execution"], "succeeded")
        self.assertEqual(report["freshness"], "changed_during_run")
        self.assert_stale(self.check())

    def test_input_changed_then_restored_during_execution_still_requires_rerun(self):
        code = (
            "from pathlib import Path; p=Path('src/main.py'); original=p.read_bytes(); "
            "p.write_bytes(b'temporary content'); p.write_bytes(original); print('ok')"
        )
        result = self.run_command(code)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.report(result)["freshness"], "changed_during_run")
        self.assertEqual((self.source / "main.py").read_text(encoding="utf-8"), "value = 1\n")
        self.assert_stale(self.check())

    def test_declared_inputs_are_required_before_command_execution(self):
        code = "from pathlib import Path; Path('must-not-run').write_text('ran')"
        empty = self.project / "empty"
        empty.mkdir()
        for inputs in ((), ("missing",), ("empty",)):
            with self.subTest(inputs=inputs):
                result = self.run_command(code, inputs=inputs)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse((self.project / "must-not-run").exists())
                self.assertFalse(self.output.exists())

    def test_paths_outside_project_are_rejected_before_execution(self):
        outside = self.root / "outside.txt"
        outside.write_text("outside\n", encoding="utf-8")
        code = "from pathlib import Path; Path('must-not-run').write_text('ran')"
        for inputs, output in (((outside,), self.output), (("src",), self.root / "receipt.json")):
            with self.subTest(inputs=inputs, output=output):
                result = self.run_command(code, inputs=inputs, output=output)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse((self.project / "must-not-run").exists())
                self.assertFalse(output.exists())
        self.assertEqual(outside.read_text(encoding="utf-8"), "outside\n")

    @unittest.skipUnless(sys.platform == "win32", "Windows path syntax")
    def test_partly_anchored_windows_paths_are_rejected_before_execution(self):
        code = "from pathlib import Path; Path('must-not-run').touch()"
        for name in (r"\outside\run.json", "D:outside/run.json", "reports/D:outside/run.json"):
            with self.subTest(path=name):
                result = self.run_command(code, output=name)
                self.assertEqual(result.returncode, 2)
                self.assertIn("project-relative", json.loads(result.stderr)["error"])
                self.assertFalse((self.project / "must-not-run").exists())

    def test_symlink_input_and_output_parent_are_rejected(self):
        alias = self.project / "alias"
        output_alias = self.project / "linked-output"
        destination = self.root / "external-output"
        destination.mkdir()
        try:
            alias.symlink_to(self.source, target_is_directory=True)
            output_alias.symlink_to(destination, target_is_directory=True)
        except OSError as error:
            self.skipTest(f"Symlinks unavailable: {error}")
        code = "from pathlib import Path; Path('must-not-run').write_text('ran')"
        for inputs, output in ((("alias",), self.output), (("src",), output_alias / "receipt.json")):
            with self.subTest(inputs=inputs, output=output):
                result = self.run_command(code, inputs=inputs, output=output)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse((self.project / "must-not-run").exists())
                self.assertFalse(output.exists())

    def test_symlink_inside_a_directory_is_rejected(self):
        target = self.root / "outside.txt"
        target.write_text("outside\n", encoding="utf-8")
        try:
            (self.source / "link.txt").symlink_to(target)
        except OSError as error:
            self.skipTest(f"Symlinks unavailable: {error}")
        result = self.run_command()
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.output.exists())

    def test_existing_receipt_or_companion_log_is_never_overwritten(self):
        code = "from pathlib import Path; Path('must-not-run').write_text('ran')"
        self.output.parent.mkdir(parents=True)
        self.output.write_bytes(b"user owned receipt")
        result = self.run_command(code)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.output.read_bytes(), b"user owned receipt")
        self.assertFalse((self.project / "must-not-run").exists())
        self.output.unlink()
        companion = self.output.with_name(self.output.name + ".output.txt")
        companion.write_bytes(b"user owned log")
        result = self.run_command(code)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(companion.read_bytes(), b"user owned log")
        self.assertFalse(self.output.exists())
        self.assertFalse((self.project / "must-not-run").exists())

    def test_receipt_and_log_are_excluded_when_project_root_is_an_input(self):
        self.assert_current_success(self.run_command(inputs=(".",)))
        self.assert_current_success(self.check())
        (self.source / "main.py").write_text("value = 4\n", encoding="utf-8")
        self.assert_stale(self.check())

    def test_check_rejects_a_receipt_outside_the_declared_project(self):
        self.assert_current_success(self.run_command())
        other = self.root / "different-project"
        other.mkdir()
        self.assertNotEqual(self.check(project=other).returncode, 0)


if __name__ == "__main__":
    unittest.main()
