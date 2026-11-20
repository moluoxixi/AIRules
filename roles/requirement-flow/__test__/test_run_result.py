"""Public capture defaults, real discovery and the interpretation of historical signatures."""
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest

import test_acceptance

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "skills/requirement-flow/runtime"))
import evidence
import run_result


class RunResultTest(unittest.TestCase):
    def project(self):
        fixture = test_acceptance.AcceptanceTest()
        self.addCleanup(fixture.doCleanups)
        fixture.setUp()
        return fixture

    def test_real_discovery_requires_at_least_one_executed_test(self):
        for mode in ("empty", "all-skipped", "expected-failures", "mixed"):
            with self.subTest(mode=mode):
                project = self.project()
                target = project.project / "test_device.py"
                cases = ("import unittest\nclass Demo(unittest.TestCase):\n"
                         " @unittest.skip('offline device')\n def test_device(self): pass\n")
                if mode == "expected-failures":
                    cases = ("import unittest\nclass Demo(unittest.TestCase):\n"
                             " @unittest.expectedFailure\n def test_device(self): self.assertEqual(2, 3)\n")
                if mode == "mixed":
                    cases += " def test_save(self): self.assertEqual(sum([2,3]), 5)\n"
                if mode != "empty":
                    target.write_text(cases, encoding="utf-8")
                project.plan(actions={"A-retry": project.check("AC-retry")})
                for action, scenario in (("A-save", "AC-save"), ("A-retry", "AC-retry")):
                    result = project.write("verify-run", action, "--scenario", scenario, "--environment", "local",
                                           "--", sys.executable, "-B", "-m", "unittest", "discover", "-v",
                                           ok=mode == "mixed")
                    self.assertEqual(json.loads(result.stdout)["passed"], mode == "mixed")
                    project.finish(action, ok=mode == "mixed")
                self.assertEqual(project.queue()["state"] == "complete", mode == "mixed")
                project.cli("archive", "save", ok=mode == "mixed")

    def test_unittest_failure_is_not_a_pass_when_the_wrapper_returns_zero(self):
        project = self.project()
        script = project.project / "failure.py"
        script.write_text(
            "import unittest\nclass Demo(unittest.TestCase):\n"
            " def test_save(self): self.assertEqual(2, 3)\n"
            "unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(Demo))\n",
            encoding="utf-8")
        result = project.write("verify-run", "A-save", "--scenario", "AC-save", "--environment", "local",
                               "--", sys.executable, "-B", script.name, ok=False)
        self.assertIn("命令退出码 0", json.loads(result.stdout)["actual"])
        self.assertIn("运行器报告失败", json.loads(result.stdout)["actual"])
        project.finish("A-save", ok=False)

    def test_counts_in_common_runner_summaries(self):
        for output, count, skipped in [
            ("1 skipped in 0.12s", 1, 1),
            ("======= 1 passed, 2 skipped in 0.42s =======", 3, 2),
            ("# tests 3\n# pass 0\n# skipped 2\n# todo 1\n", 3, 3),
            ("Tests: 3 skipped, 3 total\n", 3, 3),
            ("\x1b[32m Tests \x1b[0m 2 passed | 1 skipped (3)\n", 3, 1),
            ("No test files found, exiting with code 0\n", 0, 0),
        ]:
            with self.subTest(output=output):
                summary = run_result.test_summary(io.BytesIO(output.encode()))
                self.assertEqual((summary["total"], summary["skipped"]), (count, skipped))

    def test_private_arguments_and_independent_output_never_enter_published_files(self):
        for option, cli_flag, output, expected_share in [
            ([], "region", "ordinary-output-marker", False),
            (["--share-output"], "--token", "independent-output-marker", False),
            (["--share-output"], "region", "Authorization: Bearer output-only-marker", False),
            (["--share-output"], "region", "checked-public-record", True),
        ]:
            with self.subTest(option=option, cli_flag=cli_flag, expected_share=expected_share):
                project = self.project()
                marker = "fixed-argument-marker"
                script = project.project / "check.py"
                script.write_text(
                    "import sys\nfrom pathlib import Path\n"
                    f"assert sys.argv[1:] == {[cli_flag, marker]!r}\n"
                    "assert Path('report.txt').read_text() == 'received'\n"
                    f"print({output!r}, file=sys.stderr)\n", encoding="utf-8")
                (project.project / "report.txt").write_text("received")
                result = project.write("verify-run", "A-save", "--scenario", "AC-save", "--environment", "local",
                                       *option, "--", sys.executable, "-B", script.name, cli_flag, marker)
                self.assertTrue(json.loads(result.stdout)["passed"])
                project.finish("A-save")
                work = project.workdir
                receipt = next(work.glob("evidence/*/receipt.json"))
                record = json.loads(receipt.read_bytes())["receipt"]
                self.assertIs(record["output_shared"], expected_share)
                self.assertEqual(len(record["command_id"]), 64)
                for path in (work/"model.json", work/"handbook.html", receipt, receipt.parent/"output.log"):
                    data = path.read_bytes()
                    self.assertEqual(output.encode() in data, expected_share, path)
                    if path.name != "output.log":
                        self.assertEqual(marker.encode() in data, expected_share, path)
                if not expected_share:
                    self.assertNotIn(marker, result.stdout)
                    self.assertNotIn(output, result.stdout)

    def test_old_zero_run_signature_remains_readable_but_cannot_verify_current_work(self):
        project = self.project()
        scope = ["save_checks.py"]
        work = project.workdir
        receipt = evidence.binding(work, "A-save", "AC-save", "old", "qa", "local")
        receipt.update(kind="run", level="自动化", passed=True, actual="original record", exit_code=0,
                       code_inputs=evidence.code_inputs.snapshot(project.project, scope),
                       code_inputs_unchanged=True, argv=[sys.executable, "-m", "unittest"], cwd=str(project.project))
        root = evidence.storage(work, create=True)
        with tempfile.TemporaryDirectory(dir=root) as temporary:
            staged = Path(temporary) / "staged"
            staged.mkdir()
            (staged/"output.log").write_text("Ran 0 tests in 0.000s\n\nOK\n")
            evidence.publish(root, staged, receipt, "output.log")
        self.assertEqual(evidence.validate(work, receipt, action="A-save", scenario="AC-save", stamp="old"), receipt)
        with self.assertRaisesRegex(ValueError, "没有实际通过的测试"):
            evidence.validate_current_inputs(receipt, project.project, scope, workspace=work)
