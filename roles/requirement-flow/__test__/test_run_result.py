"""Public capture defaults, real discovery and the interpretation of historical signatures."""
import hashlib
import hmac
import io
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import test_acceptance

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "skills/requirement-flow/runtime"))
import evidence
import run_result


NODE_MODULES = Path(__file__).resolve().parents[3] / "node_modules"
VITEST = NODE_MODULES / "vitest/vitest.mjs"


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

    def test_all_recognized_blocks_contribute_and_failures_never_hide(self):
        node_ok = "# tests 2\n# suites 0\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n"
        node_bad = node_ok.replace("# pass 2", "# pass 1").replace("# fail 0", "# fail 1")
        unit_ok = "Ran 2 tests in 0.01s\n\nOK\n"
        unit_bad = "Ran 2 tests in 0.01s\n\nFAILED (failures=1, errors=1)\n"
        js_ok, js_bad = "Tests: 2 passed, 2 total\n", "Tests: 1 failed, 1 passed, 2 total\n"
        pytest_ok, pytest_bad = "2 passed in 0.01s\n", "1 passed, 1 failed in 0.01s\n"
        for first, second in ((node_ok, node_bad), (unit_ok, unit_bad), (js_ok, js_bad),
                              (pytest_ok, pytest_bad), (unit_ok, node_bad), (unit_ok, js_bad),
                              (node_ok, pytest_bad), (js_ok, unit_bad)):
            for output in (first + second, second + first):
                for variant in (output, output.replace("#", "ℹ")):
                    with self.subTest(output=variant):
                        summary = run_result.test_summary(io.BytesIO(variant.encode()))
                        self.assertEqual(summary["total"], 4)
                        self.assertGreater(summary["failed"], 0)
                        self.assertIn("运行器报告失败", run_result.insufficient_tests(summary))

    def test_node_counts_must_be_complete_consistent_and_in_the_same_block(self):
        valid = "# tests 2\n# pass 2\n# fail 0\n# skipped 0\n# todo 0\n"
        for invalid in (valid.replace("# fail 0\n", ""), valid.replace("# pass 2", "# pass 1"),
                        valid.replace("# fail 0", "# fail 0\n# fail 1"),
                        "# tests 2\nother output\n# pass 2\n# fail 0\n# skipped 0\n# todo 0\n",
                        valid.replace("# skipped 0", "ℹ skipped 0")):
            with self.subTest(output=invalid):
                summary = run_result.test_summary(io.BytesIO((invalid + valid).encode()))
                self.assertTrue(summary["invalid"])
                self.assertTrue(run_result.insufficient_tests(summary))
        for output in (valid, valid.replace("#", "ℹ")):
            summary = run_result.test_summary(io.BytesIO(output.encode()))
            self.assertEqual(summary["runner"], "node:test")
            self.assertFalse(run_result.insufficient_tests(summary))
        self.assertIsNone(run_result.test_summary(io.BytesIO(b"Tests are not a runner: 2 failed\npass 4\nfail 0\n")))

    @unittest.skipUnless(shutil.which("node"), "Node is not installed")
    def test_real_node_tap_and_spec_summary_blocks(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "checks.mjs"
            target.write_text("import test from 'node:test'; import assert from 'node:assert/strict';\n"
                              "test('good', () => assert.equal(2, 2));\n"
                              "test('bad', () => assert.equal(2, 3));\n", encoding="utf-8")
            for reporter in ("tap", "spec"):
                with self.subTest(reporter=reporter):
                    result = subprocess.run([shutil.which("node"), "--test", "--test-reporter=" + reporter, str(target)],
                                            capture_output=True, timeout=20)
                    self.assertNotEqual(result.returncode, 0)
                    summary = run_result.test_summary(io.BytesIO(result.stdout + result.stderr))
                    self.assertEqual(summary, {"runner": "node:test", "total": 2, "skipped": 0, "failed": 1})

    def test_single_runner_receipt_fields_remain_compatible(self):
        for output, expected in (
            ("# tests 1\n# pass 1\n# fail 0\n# skipped 0\n# todo 0\n",
             {"runner": "node:test", "total": 1, "skipped": 0, "failed": 0}),
            ("No test files found, exiting with code 0\n", {"runner": "JavaScript", "total": 0, "skipped": 0}),
            ("Tests: 0 total\n", {"runner": "JavaScript", "total": 0, "skipped": 0}),
            ("no tests ran in 0.01s\n", {"runner": "pytest", "total": 0, "skipped": 0}),
            ("Ran 1 test in 0.01s\n\nOK\n", {"runner": "unittest", "total": 1, "skipped": 0,
                                             "expected_failures": 0, "failed": 0}),
        ):
            with self.subTest(output=output):
                self.assertEqual(run_result.test_summary(io.BytesIO(output.encode())), expected)

    def test_early_failure_is_seen_before_more_than_256_kib_of_output(self):
        output = b"Tests: 1 failed, 1 total\n" + b"ordinary diagnostics\n" * 20000 + b"Tests: 1 passed, 1 total\n"
        self.assertEqual(run_result.test_summary(io.BytesIO(output))["failed"], 1)
        truncated = run_result.test_summary(io.BytesIO(b"x" * (300 * 1024) + b"\nTests: 1 passed, 1 total\n"))
        self.assertTrue(truncated["scan_incomplete"])
        self.assertIn("截断", run_result.insufficient_tests(truncated))

    def test_empty_skipped_or_expected_failure_blocks_cannot_hide_behind_a_success(self):
        for empty in ("Ran 0 tests in 0.01s\n\nOK\n", "Ran 1 test in 0.01s\n\nOK (skipped=1)\n",
                      "Ran 1 test in 0.01s\n\nOK (expected failures=1)\n"):
            summary = run_result.test_summary(io.BytesIO((empty + "Tests: 2 passed, 2 total\n").encode()))
            self.assertIn("没有实际通过", run_result.insufficient_tests(summary))

    def test_wrapper_success_cannot_publish_a_mixed_runner_failure(self):
        project = self.project()
        result = project.write("verify-run", "A-save", "--scenario", "AC-save", "--environment", "local",
                               "--", sys.executable, "-B", "-c",
                               "print('Tests: 1 failed, 1 total\\nRan 1 test in 0.01s\\n\\nOK')", ok=False)
        self.assertFalse(json.loads(result.stdout)["passed"])
        project.finish("A-save", ok=False)

    def test_suite_failures_veto_in_either_position_without_inflating_test_totals(self):
        tests = "Tests 2 passed (2)\n"
        for label, counts in (("Test Files", "1 failed | 1 passed (2)"),
                              ("Test Suites:", "1 failed, 1 passed, 2 total")):
            suite = f" {label} {counts}\n"
            for output in (suite + tests, tests + suite, suite + tests + tests,
                           tests + suite + "Test Files 1 passed (1)\n" + tests):
                with self.subTest(label=label, output=output):
                    summary = run_result.test_summary(io.BytesIO(output.encode()))
                    self.assertEqual(summary["total"], output.count(tests) * 2)
                    self.assertGreater(summary.get("failed", 0), 0)
                    self.assertIn("运行器报告失败", run_result.insufficient_tests(summary))
        mixed = ("Test Files 1 failed | 1 passed (2)\n" + tests
                 + "# tests 1\n# pass 1\n# fail 0\n# skipped 0\n# todo 0\n"
                 + "Ran 1 test in 0.01s\n\nOK\nTests: 1 passed, 1 total\n1 passed in 0.01s\n")
        summary = run_result.test_summary(io.BytesIO(mixed.encode()))
        self.assertEqual(summary["total"], 6)
        self.assertEqual(summary["runners"], ["JavaScript", "node:test", "unittest", "pytest"])
        self.assertIn("运行器报告失败", run_result.insufficient_tests(summary))

    def test_passing_suites_require_actual_tests_and_never_count_as_tests(self):
        for suite in ("Test Files 7 passed (7)\n", "Test Suites: 7 passed, 7 total\n"):
            for tests in ("Tests 2 passed (2)\n", "Tests: 2 passed, 2 total\n"):
                for output in (suite + tests, tests + suite):
                    with self.subTest(output=output):
                        summary = run_result.test_summary(io.BytesIO(output.encode()))
                        self.assertEqual((summary["total"], summary["skipped"]), (2, 0))
                        self.assertFalse(run_result.insufficient_tests(summary))
            for tests in ("", "Tests: 0 total\n", "Tests 2 skipped (2)\n"):
                with self.subTest(suite=suite, tests=tests):
                    summary = run_result.test_summary(io.BytesIO((suite + tests).encode()))
                    self.assertIsNotNone(summary)
                    self.assertIn("没有实际通过", run_result.insufficient_tests(summary))

    def test_partial_runner_headers_never_fall_back_to_ordinary_output(self):
        success = "Tests: 1 passed, 1 total\n"
        headers = ("Test Files:", "Test Files 1", "Test Suites: 2", "Tests:", "Tests 2",
                   "Tests", "Ran 2 tests", "Ran 2 tests in", "Ran 2 tests in 0.", "# tests", "ℹ tests 1.",
                   "Tests: -2 passed", "Ran -2 tests", "# tests -1")
        for header in headers:
            for output in (header + "\n", header + "\n" + success, success + header + "\n"):
                with self.subTest(output=output):
                    summary = run_result.test_summary(io.BytesIO(output.encode()))
                    self.assertIsNotNone(summary)
                    self.assertTrue(summary.get("invalid"))
                    self.assertIn("摘要不完整", run_result.insufficient_tests(summary))
        indented = run_result.test_summary(io.BytesIO(b"  Ran 1 test in 0.01s\n\n  OK\n"))
        self.assertFalse(run_result.insufficient_tests(indented))

    def test_pytest_xpass_format_counts_assertions_without_hiding_failures(self):
        # Format simulations only: pytest is not a dependency of this regression suite.
        for output, total in (("1 xpassed in 0.02s\n", 1),
                              ("1 passed, 1 xpassed, 2 warnings in 0.02s\n", 2)):
            summary = run_result.test_summary(io.BytesIO(output.encode()))
            self.assertEqual((summary["runner"], summary["total"]), ("pytest", total))
            self.assertFalse(run_result.insufficient_tests(summary))
        summary = run_result.test_summary(io.BytesIO(b"1 failed, 1 xpassed in 0.02s\n"))
        self.assertIn("运行器报告失败", run_result.insufficient_tests(summary))
        for output in ("1 xfailed in 0.02s\n", "1 xpassed, 1 unknown in 0.02s\n",
                       "Tests: 1 xpassed, 1 passed, 2 total\n"):
            summary = run_result.test_summary(io.BytesIO(output.encode()))
            self.assertTrue(run_result.insufficient_tests(summary))

    def test_count_summary_syntax_cannot_discard_unrecognized_or_conflicting_fields(self):
        for label in ("Tests", "Test Files", "Test Suites:"):
            for counts in ("2 passed | 1 unknown (3)", "2 passed (3)", "1 passed | 1 passed (2)",
                           "2 passed trailing-private-output-marker", "2 passed (2) trailing",
                           "2 passed, 2 total, 3 total", "0 total trailing"):
                with self.subTest(label=label, counts=counts):
                    output = f"{label} {counts}\nTests: 1 passed, 1 total\n"
                    summary = run_result.test_summary(io.BytesIO(output.encode()))
                    self.assertTrue(summary.get("invalid"))
                    self.assertTrue(run_result.insufficient_tests(summary))
                    self.assertNotIn("private-output-marker", json.dumps(summary))
        summary = run_result.test_summary(io.BytesIO(b"1 passed, 2 unknown in 0.01s\nTests: 1 passed, 1 total\n"))
        self.assertTrue(summary.get("invalid"))
        summary = run_result.test_summary(io.BytesIO(b"1 passed, 2 warnings in 0.01s\n"))
        self.assertEqual(summary["total"], 1)
        self.assertFalse(run_result.insufficient_tests(summary))

    def test_unclosed_unittest_headers_are_invalid_and_later_success_cannot_hide_them(self):
        header = "Ran 2 tests in 0.01s\n"
        success = "Ran 1 test in 0.01s\n\nOK\n"
        for output in (header, header + "\n", header + "\n" + success,
                       header + "\ndiagnostic\n" + success, success + header,
                       header + "\nTests: 1 passed, 1 total\nOK\n",
                       header + "\n# tests 1\n# pass 1\n# fail 0\n# skipped 0\n# todo 0\nOK\n",
                       header + "\n1 passed in 0.01s\nOK\n", header + "OK\n" + success,
                       header + "\n\ndiagnostic\nOK\n" + success):
            with self.subTest(output=output):
                summary = run_result.test_summary(io.BytesIO(output.encode()))
                self.assertIsNotNone(summary)
                self.assertTrue(summary.get("invalid"))
                self.assertGreaterEqual(summary["total"], 2)
                self.assertIn("摘要不完整", run_result.insufficient_tests(summary))
        summary = run_result.test_summary(io.BytesIO((header + "\n" + success).encode()))
        self.assertEqual(summary["total"], 3)

    def test_unittest_verdict_syntax_and_counts_must_be_complete(self):
        header = "Ran 3 tests in 0.01s\n\n"
        for verdict in ("OK", "OK (skipped=1, expected failures=1)", "FAILED",
                        "FAILED (failures=1, errors=1, skipped=1)", "FAILED (unexpected successes=1)"):
            with self.subTest(verdict=verdict):
                summary = run_result.test_summary(io.BytesIO((header + verdict + "\n").encode()))
                self.assertEqual(summary["total"], 3)
                self.assertFalse(summary.get("invalid"))
                self.assertEqual(bool(run_result.insufficient_tests(summary)), verdict.startswith("FAILED"))
        for verdict in ("OK (skipped=1, skipped=1)", "OK (skipped=4)", "OK (expected failures=4)",
                        "OK (skipped=2, expected failures=2)", "OK (failures=1)",
                        "OK (unknown=private-output-marker)", "OK (skipped=1, unknown=1)",
                        "OK (skipped=-1)", "OK (skipped=1", "OK (skipped=1) trailing",
                        "FAILED (failures=1, failures=1)", "FAILED (errors=4)"):
            with self.subTest(verdict=verdict):
                summary = run_result.test_summary(io.BytesIO((header + verdict + "\nTests: 1 passed, 1 total\n").encode()))
                self.assertTrue(summary.get("invalid"))
                self.assertTrue(run_result.insufficient_tests(summary))
                self.assertNotIn("private-output-marker", json.dumps(summary))
        for output in ("Ran 1 test in ..s\n\nOK\n", "Ran 1 test in 0.01s\nOK\n"):
            summary = run_result.test_summary(io.BytesIO((output + "Tests: 1 passed, 1 total\n").encode()))
            self.assertTrue(summary.get("invalid"))

    def test_ordinary_diagnostics_are_not_runner_summaries(self):
        output = ("Tests are not a runner: 2 failed\nTest Files live under checks: 1 failed\n"
                  "Test Suites: selection of 2 passed cases\nRan a diagnostic check\nOK\nFAILED (errors=1)\n")
        self.assertIsNone(run_result.test_summary(io.BytesIO(output.encode())))
        summary = run_result.test_summary(io.BytesIO((output + "Tests: 1 passed, 1 total\n").encode()))
        self.assertEqual(summary["total"], 1)
        self.assertFalse(run_result.insufficient_tests(summary))

    def test_suite_veto_and_unclosed_header_survive_bounded_long_log_scan(self):
        class BoundedLog(io.BytesIO):
            def read(self, *args):
                raise AssertionError("summary must scan bounded lines, not read the log body")

            def readline(self, size=-1):
                self_limit = 256 * 1024 + 1
                if not 0 < size <= self_limit:
                    raise AssertionError("unbounded summary scan")
                return super().readline(size)

        body = b"ordinary diagnostics\n" * 20000
        success = b"Tests: 1 passed, 1 total\n"
        for prefix, key in ((b"Test Files 1 failed | 1 passed (2)\nTests 2 passed (2)\n", "failed"),
                            (b"Ran 2 tests in 0.01s\n\n", "invalid")):
            with self.subTest(key=key):
                summary = run_result.test_summary(BoundedLog(prefix + body + success))
                self.assertTrue(summary.get(key))
                self.assertTrue(run_result.insufficient_tests(summary))
        summary = run_result.test_summary(BoundedLog(b"Ran 2 tests in 0.01s\n\n" + b"x" * (300 * 1024) + b"\n" + success))
        self.assertTrue(summary.get("invalid"))
        self.assertTrue(summary["scan_incomplete"])
        self.assertEqual(summary["total"], 3)

    def capture_public_chain(self, project, command, passed, issue=""):
        # Finish the unrelated scenario first, so archive rejection depends on A-save.
        project.plan(actions={"A-retry": project.check("AC-retry")})
        project.write("verify-run", "A-retry", "--scenario", "AC-retry", "--environment", "local",
                      "--", sys.executable, "-B", "-m", "unittest", "save_checks.SaveChecks.test_retry")
        project.finish("A-retry")
        result = project.write("verify-run", "A-save", "--scenario", "AC-save", "--environment", "local",
                               "--", *command, "private-argument-marker", ok=passed)
        public = json.loads(result.stdout)
        self.assertIs(public["passed"], passed)
        receipt = (project.workdir / public["artifact"]["path"]).with_name("receipt.json")
        record = json.loads(receipt.read_bytes())["receipt"]
        self.assertIs(record["passed"], passed)
        self.assertEqual(record["exit_code"], 0)
        self.assertIsNone(record["argv"])
        self.assertIs(record["output_shared"], False)
        self.assertEqual(record["cwd"], ".")
        if not passed:
            self.assertIn(issue, record["actual"])
        project.write("finish", "A-save", "--output", "通过", ok=passed)
        self.assertEqual(project.queue()["state"] == "complete", passed)
        self.assertEqual(project.statuses()["AC-retry"], "passed")
        self.assertEqual(project.statuses()["AC-save"] == "passed", passed)
        project.cli("archive", "save", ok=passed)
        archived = project.project / ".requirements/archive/save"
        self.assertEqual(archived.exists(), passed)
        work = archived if passed else project.workdir
        for path in (work / "model.json", work / "handbook.html", *work.glob("evidence/*/receipt.json"),
                     *work.glob("evidence/*/output.log")):
            data = path.read_bytes()
            for marker in (b"private-argument-marker", b"private-output-marker"):
                self.assertNotIn(marker, data, str(path))
                self.assertNotIn(marker.decode(), result.stdout)
        return record

    @unittest.skipUnless(shutil.which("node") and VITEST.is_file(), "Installed Vitest and Node are required")
    def test_live_vitest_suite_failure_and_normal_pass_through_public_cli(self):
        for mode in ("normal", "failure", "truncated"):
            failing_suite = mode != "normal"
            with self.subTest(mode=mode):
                project = self.project()
                # Resolution-only symlink; native config loading and disabled caches avoid dependency writes.
                (project.project / "node_modules").symlink_to(NODE_MODULES, target_is_directory=True)
                config = project.project / "vitest.config.mjs"
                config.write_text("export default { cacheDir: './.runner-cache', test: { experimental: { fsModuleCache: false } } };\n",
                                  encoding="utf-8")
                (project.project / "pass.test.mjs").write_text(
                    "import { test, expect } from 'vitest';\n"
                    "test('private-output-marker', () => expect(2).toBe(2));\n"
                    "test('second assertion', () => expect(3).toBe(3));\n", encoding="utf-8")
                if failing_suite:
                    (project.project / "broken.test.mjs").write_text("import './missing-private-output-marker.mjs';\n", encoding="utf-8")
                command = [shutil.which("node"), str(VITEST), "run", "--no-cache", "--no-file-parallelism",
                           "--maxWorkers=1", "--configLoader=native", "--config", str(config)]
                wrapper = project.project / "vitest_wrapper.py"
                wrapper.write_text(
                    "import os, re, subprocess, sys\n"
                    "assert sys.argv[1:] == ['private-argument-marker']\n"
                    f"inner = subprocess.run({command!r}, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, "
                    "env={**os.environ, 'NO_COLOR': '1', 'FORCE_COLOR': '0'}, timeout=15)\n"
                    f"assert inner.returncode == {int(failing_suite)}\n"
                    "assert 'Tests  2 passed (2)' in inner.stdout\n"
                    f"assert {'1 failed | 1 passed (2)' if failing_suite else '1 passed (1)'!r} in inner.stdout\n"
                    "# Only transport tail loss is simulated; the runner failure is real.\n"
                    f"if {mode == 'truncated'!r}:\n"
                    " match = re.search(r'Test Files\\s+1', inner.stdout)\n"
                    " assert match\n"
                    " sys.stdout.write(inner.stdout[match.start():match.end()] + '\\n')\n"
                    "else: sys.stdout.write(inner.stdout)\n"
                    "print('private-output-marker')\n", encoding="utf-8")
                record = self.capture_public_chain(project, [sys.executable, "-B", str(wrapper)],
                                                   not failing_suite, "摘要不完整" if mode == "truncated" else "运行器报告失败")
                self.assertEqual(record["tests"]["total"], 0 if mode == "truncated" else 2)
                self.assertFalse((project.project / ".runner-cache").exists())

    def test_live_unittest_with_simulated_missing_verdict_rejects_public_chain(self):
        for interruption in ("header", "diagnostic", "eof"):
            with self.subTest(interruption=interruption):
                project = self.project()
                (project.project / "broken_checks.py").write_text(
                    "import unittest\nclass Broken(unittest.TestCase):\n"
                    " def test_save(self): self.assertEqual(2, 3, 'private-output-marker')\n", encoding="utf-8")
                wrapper = project.project / "unittest_wrapper.py"
                wrapper.write_text(
                    "import subprocess, sys\n"
                    "assert sys.argv[1:] == ['private-argument-marker']\n"
                    "inner = subprocess.run([sys.executable, '-B', '-m', 'unittest', '-v', 'broken_checks'], "
                    "stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=10)\n"
                    "assert inner.returncode == 1 and 'FAILED (failures=1)' in inner.stdout\n"
                    "assert 'private-output-marker' in inner.stdout\n"
                    "# Only verdict loss is simulated; the failure above is real unittest output.\n"
                    "sys.stdout.write(inner.stdout[:inner.stdout.rindex('FAILED (')])\n"
                    f"mode = {interruption!r}\n"
                    "if mode != 'eof':\n"
                    " success = subprocess.run([sys.executable, '-B', '-m', 'unittest', 'save_checks.SaveChecks.test_save'], "
                    "stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=10)\n"
                    " assert success.returncode == 0 and '\\n\\nOK' in success.stdout\n"
                    " if mode == 'diagnostic': print('private-output-marker')\n"
                    " sys.stdout.write(success.stdout[success.stdout.index('Ran '):])\n", encoding="utf-8")
                record = self.capture_public_chain(project, [sys.executable, "-B", str(wrapper)], False, "摘要不完整")
                self.assertTrue(record["tests"]["invalid"])
                self.assertEqual(record["tests"]["total"], 1 if interruption == "eof" else 2)

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

    def legacy_summary_receipt(self, project, output, *, shared=False, failed_suite=False):
        receipt = evidence.run(project.workdir, project.project,
                               [sys.executable, "-B", "-c", "print(" + repr(output) + ")"],
                               action="A-save", scenario="AC-save", stamp="old-policy", actor="qa", environment="local",
                               code_paths=["save_checks.py"], share_output=shared)
        # Simulate a genuine pre-policy envelope, not a change to a live record.
        receipt.pop("summary_policy", None)
        if failed_suite:
            receipt["tests"]["failed"] = 0
            receipt["passed"] = True
        root = evidence.storage(project.workdir)
        signature = hmac.new(evidence.local_key(root), evidence.canonical(receipt), hashlib.sha256).hexdigest()
        (project.workdir / receipt["path"]).write_bytes(evidence.canonical({"receipt": receipt, "signature": signature}) + b"\n")
        return receipt

    def test_current_private_captures_bind_the_summary_policy(self):
        project = self.project()
        receipt = evidence.run(project.workdir, project.project, [sys.executable, "-B", "-c", "print('checked')"],
                               action="A-save", scenario="AC-save", stamp="current", actor="qa", environment="local",
                               code_paths=["save_checks.py"])
        self.assertEqual(receipt.get("summary_policy"), "runner-summary-v3")
        self.assertFalse(receipt["output_shared"])
        evidence.validate(project.workdir, receipt, action="A-save", scenario="AC-save", stamp="current")
        evidence.validate_current_inputs(receipt, project.project, ["save_checks.py"], workspace=project.workdir)

    def test_v2_partial_header_receipts_cannot_verify_under_v3(self):
        for shared in (False, True):
            with self.subTest(shared=shared):
                project = self.project()
                # Simulate v2's known fallback using the native collector/signature;
                # this is not claimed as execution of an old CLI installation.
                with patch.object(evidence.run_result, "SUMMARY_POLICY", "runner-summary-v2"), \
                        patch.object(evidence.run_result, "test_summary", return_value=None):
                    receipt = evidence.run(project.workdir, project.project,
                                           [sys.executable, "-B", "-c", "print('Test Files 1')"],
                                           action="A-save", scenario="AC-save", stamp="v2", actor="qa", environment="local",
                                           code_paths=["save_checks.py"], share_output=shared)
                self.assertTrue(receipt["passed"])
                self.assertIsNone(receipt["tests"])
                original = {p: p.read_bytes() for p in (project.workdir / receipt["path"]).parent.iterdir()}
                evidence.validate(project.workdir, receipt, action="A-save", scenario="AC-save", stamp="v2")
                with self.assertRaisesRegex(ValueError, "摘要不完整" if shared else "规则已更新"):
                    evidence.validate_current_inputs(receipt, project.project, ["save_checks.py"], workspace=project.workdir)
                self.assertEqual(original, {p: p.read_bytes() for p in original})

    def test_old_private_summary_is_readable_but_requires_recollection_for_current_acceptance(self):
        for output in ("Tests: 2 passed, 2 total", "ordinary assertion output"):
            with self.subTest(output=output):
                project = self.project()
                receipt = self.legacy_summary_receipt(project, output)
                original = {p: p.read_bytes() for p in (project.workdir / receipt["path"]).parent.iterdir()}
                evidence.validate(project.workdir, receipt, action="A-save", scenario="AC-save", stamp="old-policy")
                with self.assertRaisesRegex(ValueError, "规则已更新.*重新采集"):
                    evidence.validate_current_inputs(receipt, project.project, ["save_checks.py"], workspace=project.workdir)
                self.assertEqual(original, {p: p.read_bytes() for p in original})

    def test_old_shared_summary_remains_readable_and_is_rechecked_under_current_policy(self):
        for failing in (False, True):
            with self.subTest(failing=failing):
                project = self.project()
                output = ("Test Files 1 failed | 1 passed (2)\n" if failing else "Test Files 1 passed (1)\n") + "Tests 2 passed (2)"
                receipt = self.legacy_summary_receipt(project, output, shared=True, failed_suite=failing)
                original = {p: p.read_bytes() for p in (project.workdir / receipt["path"]).parent.iterdir()}
                evidence.validate(project.workdir, receipt, action="A-save", scenario="AC-save", stamp="old-policy")
                if failing:
                    with self.assertRaisesRegex(ValueError, "运行器报告失败"):
                        evidence.validate_current_inputs(receipt, project.project, ["save_checks.py"], workspace=project.workdir)
                else:
                    evidence.validate_current_inputs(receipt, project.project, ["save_checks.py"], workspace=project.workdir)
                self.assertEqual(original, {p: p.read_bytes() for p in original})

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
