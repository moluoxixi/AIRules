"""Independent scenario checks can finish together without replacing a competing result."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import hmac
import json
from pathlib import Path
import subprocess
import sys
from threading import Barrier, Event
import unittest
from unittest.mock import patch

import test_acceptance

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "skills/requirement-flow"))
from runtime import sync


class ParallelCaptureTest(unittest.TestCase):
    def setUp(self):
        self.case = test_acceptance.AcceptanceTest()
        self.case.setUp()
        self.addCleanup(self.case.doCleanups)
        self.addCleanup(sync.bind_workspace, sync.TASK_DIR)
        sync.bind_workspace(self.case.workdir)
        self.case.plan(actions={"A-retry": self.case.check("AC-retry")})

    def capture(self, action, scenario, revision, actor):
        test = "test_retry" if scenario == "AC-retry" else "test_save"
        return sync.capture("verify-run", action, scenario, revision, actor, "本机 unittest",
                            argv=[sys.executable, "-B", "-m", "unittest", "-v", "save_checks.SaveChecks." + test])

    def together(self, first, second):
        revision = self.case.queue()["revision"]
        signed = Barrier(2, timeout=20)
        collect = sync.evidence.run

        def collect_together(*args, **kwargs):
            receipt = collect(*args, **kwargs)
            signed.wait()  # Both real assertions have completed against the same starting revision.
            return receipt

        with patch.object(sync.evidence, "run", collect_together), ThreadPoolExecutor(2) as pool:
            return [pool.submit(self.capture, *which, revision, actor)
                    for which, actor in ((first, "甲"), (second, "乙"))]

    def stored(self):
        events = (event for event in sync.load()["work"]["events"] if event["kind"] == "evidence")
        return {event["actor"]: event for event in events}

    def test_independent_actions_keep_both_signed_results_and_can_complete(self):
        checks = self.together(("A-save", "AC-save"), ("A-retry", "AC-retry"))
        results = [future.result() for future in checks]
        self.assertTrue(all(result["passed"] for result in results))
        self.assertNotEqual(results[0]["id"], results[1]["id"])
        self.assertEqual(set(self.stored()), {"甲", "乙"})
        self.case.finish("A-save")
        self.case.finish("A-retry")
        self.assertEqual(self.case.queue()["state"], "complete")

    def test_different_cases_of_the_same_action_preserve_each_other(self):
        action = self.case.check("AC-save")
        action["covers"].append("AC-retry")
        self.case.plan(actions={"A-save": action})
        for future in self.together(("A-save", "AC-save"), ("A-save", "AC-retry")):
            self.assertTrue(future.result()["passed"])
        self.case.finish("A-save")
        self.assertEqual({e["scenario"] for e in self.stored().values()}, {"AC-save", "AC-retry"})

    def test_competing_results_for_the_same_action_and_case_keep_only_the_winner(self):
        checks = self.together(("A-save", "AC-save"), ("A-save", "AC-save"))
        winner, = [future.result() for future in checks if future.exception() is None]
        loser, = [future.exception() for future in checks if future.exception() is not None]
        self.assertIsInstance(loser, sync.Conflict)
        stored = self.stored()
        self.assertEqual(list(stored), [winner["actor"]])
        receipt = stored[winner["actor"]]["receipt"]
        self.assertEqual([p.name for p in (self.case.workdir / "evidence").iterdir() if p.is_dir()],
                         [receipt["id"]])
        self.case.finish("A-save")
        self.assertEqual(self.case.statuses()["AC-save"], "passed")

    def test_discarded_competing_failure_exposes_safe_collected_result(self):
        revision = self.case.queue()["revision"]
        signed = Barrier(2, timeout=20)
        recorded = Event()
        collect = sync.evidence.run

        def collect_together(*args, **kwargs):
            receipt = collect(*args, **kwargs)
            signed.wait()
            if kwargs["actor"] == "失败者":
                self.assertTrue(recorded.wait(20))
            return receipt

        def win():
            result = self.capture("A-save", "AC-save", revision, "成功者")
            recorded.set()
            return result

        with patch.object(sync.evidence, "run", collect_together), ThreadPoolExecutor(2) as pool:
            winner = pool.submit(win)
            loser = pool.submit(sync.capture, "verify-run", "A-save", "AC-save", revision, "失败者", "本机 unittest",
                                argv=[sys.executable, "-B", "-c", "raise AssertionError('private-raw-failure-marker')"])
            self.assertTrue(winner.result()["passed"])
            with self.assertRaises(sync.Conflict) as rejected:
                loser.result()
        error = rejected.exception
        self.assertEqual(error.collected_result, {"recorded": False, "action": "A-save", "scenario": "AC-save",
                         "actor": "失败者", "passed": False, "environment": "本机 unittest",
                         "reason": "采集已执行但未登记、重读后核对重采。"})
        self.assertIn("采集已执行但未登记", str(error))
        self.assertNotIn("private-raw-failure-marker", str(error))
        self.assertEqual(list(self.stored()), ["成功者"])
        self.assertEqual(len([p for p in (self.case.workdir / "evidence").iterdir() if p.is_dir()]), 1)

    def test_project_cli_error_retains_the_public_collected_result(self):
        entry = test_acceptance.FLOW
        script = ("import runpy, sys\n"
                  f"sys.path.insert(0, {str(entry.parent / 'runtime')!r})\n"
                  "import sync\n"
                  "def rejected(*args, **kwargs):\n"
                  " raise sync.CollectedConflict('同一场景已更新', action='A-save', scenario='AC-save', "
                  "actor='qa', passed=False, environment='local')\n"
                  "sync.capture = rejected\n"
                  f"sys.argv = {[str(entry), '--project', str(self.case.project), 'task', 'save', 'verify-run', 'A-save', '--scenario', 'AC-save', '--rev', str(self.case.queue()['revision']), '--environment', 'local']!r}\n"
                  f"runpy.run_path({str(entry)!r}, run_name='__main__')\n")
        result = subprocess.run([sys.executable, "-B", "-c", script], cwd=self.case.project,
                                capture_output=True, text=True, timeout=20)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("采集已执行但未登记", result.stderr)
        public = json.loads(result.stderr.splitlines()[-1])["collected_result"]
        self.assertEqual((public["recorded"], public["passed"], public["scenario"]), (False, False, "AC-save"))
        self.assertNotIn("artifact", public)

    def reject_mid_capture_change(self, change):
        revision = self.case.queue()["revision"]
        collect = sync.evidence.run

        def change_after_assertion(*args, **kwargs):
            receipt = collect(*args, **kwargs)
            change()
            return receipt

        with patch.object(sync.evidence, "run", change_after_assertion), self.assertRaises(ValueError):
            self.capture("A-save", "AC-save", revision, "甲")
        self.assertFalse(self.stored())
        self.assertFalse(any(p.is_dir() for p in (self.case.workdir / "evidence").iterdir()))

    def test_changed_case_is_not_rebound_to_revised_acceptance(self):
        story = json.loads((self.case.workdir / "model.json").read_bytes())["work"]["stories"]["S-save"]
        story["examples"][0]["then"] = "重新进入后仍能读取"
        self.reject_mid_capture_change(lambda: self.case.plan(stories={"S-save": story}))

    def test_code_edit_after_assertion_is_rechecked_even_when_model_revision_is_unchanged(self):
        revision = self.case.queue()["revision"]
        collect = sync.evidence.run

        def changed(*args, **kwargs):
            receipt = collect(*args, **kwargs)
            self.assertTrue(receipt["passed"])
            sync.evidence.validate(self.case.workdir, receipt, action="A-save", scenario="AC-save", stamp=receipt["stamp"])
            (self.case.project / "save_checks.py").write_text("raise AssertionError('private-new-code')", encoding="utf-8")
            return receipt

        with patch.object(sync.evidence, "run", changed), self.assertRaises(sync.CollectedConflict) as rejected:
            self.capture("A-save", "AC-save", revision, "甲")
        self.assertEqual(rejected.exception.collected_result,
                         {"recorded": False, "action": "A-save", "scenario": "AC-save", "actor": "甲", "passed": True,
                          "environment": "本机 unittest", "reason": "采集已执行但未登记、重读后核对重采。"})
        self.assertEqual(sync.load()["work"]["revision"], revision)
        self.assertNotIn("private-new-code", str(rejected.exception))
        self.assertFalse(self.stored())
        self.assertFalse(list(self.case.workdir.glob("evidence/*/receipt.json")))

    def test_incomplete_or_untrusted_code_rechecks_never_become_collected_feedback(self):
        modes = ("missing-mode", "version-bool", "short-hash", "entries-bool", "negative-entries", "extra-field",
                 "scope", "mode", "metadata-only", "empty", "io", "same-message", "bad-snapshot",
                 "signature", "attachment", "registered", "old-policy")
        for mode in modes:
            with self.subTest(mode=mode):
                fixture = test_acceptance.AcceptanceTest()
                fixture.setUp()
                self.addCleanup(fixture.doCleanups)
                sync.bind_workspace(fixture.workdir)
                revision = sync.load()["work"]["revision"]
                collect = sync.evidence.run
                snapshot_patch = None

                def changed(*args, **kwargs):
                    nonlocal snapshot_patch
                    receipt = collect(*args, **kwargs)
                    if mode == "registered":
                        def register(w):
                            state = sync.evaluate(w)["A-save"]
                            case = sync.scenario_definitions(w)["AC-save"]
                            w["revision"] += 1
                            sync.append_event(w, "evidence", "甲", action="A-save", scenario="AC-save",
                                              stamp=state["stamp"], scenario_stamp=sync.case_stamp(case, sync.latest_retirements(w, set())),
                                              receipt=receipt, output=receipt["actual"])
                            return True
                        sync.commit(revision, register)
                    path = fixture.workdir / receipt["path"]
                    if mode == "signature":
                        envelope = json.loads(path.read_text())
                        envelope["signature"] = "0" * 64
                        path.write_text(json.dumps(envelope))
                    elif mode == "attachment":
                        (fixture.workdir / receipt["artifact"]["path"]).write_text("corrupt")
                    elif mode in ("io", "same-message", "bad-snapshot"):
                        if mode == "bad-snapshot":
                            snapshot_patch = patch.object(sync.evidence.code_inputs, "snapshot", return_value={"sha256": "0" * 64})
                        else:
                            error = OSError("模拟读取失败") if mode == "io" else ValueError("当前代码、测试或子仓库内容已改变，请重新验收")
                            snapshot_patch = patch.object(sync.evidence.code_inputs, "snapshot", side_effect=error)
                        snapshot_patch.start()
                    elif mode not in ("registered", "empty"):
                        binding = receipt["code_inputs"]
                        if mode == "missing-mode": binding.pop("mode")
                        elif mode == "version-bool": binding["version"] = True
                        elif mode == "short-hash": binding["sha256"] = "bad"
                        elif mode == "entries-bool": binding["entries"] = True
                        elif mode == "negative-entries": binding["entries"] = -1
                        elif mode == "extra-field": binding["unknown"] = True
                        elif mode == "scope": binding["code_paths"] = ["other.py"]
                        elif mode == "mode": binding["mode"] = "git"
                        elif mode == "metadata-only": binding["entries"] += 1
                        elif mode == "old-policy": receipt["summary_policy"] = "runner-summary-v2"
                        # Signed metadata faults are simulations, not a forgery claim.
                        signature = hmac.new(sync.evidence.local_key(sync.evidence.storage(fixture.workdir)),
                                             sync.evidence.canonical(receipt), hashlib.sha256).hexdigest()
                        path.write_bytes(sync.evidence.canonical({"receipt": receipt, "signature": signature}) + b"\n")
                    code = fixture.project / "save_checks.py"
                    if mode == "empty":
                        code.unlink()
                        code.mkdir()
                    elif mode not in ("io", "same-message", "bad-snapshot", "metadata-only"):
                        code.write_text("raise AssertionError('private-new-code')")
                    return receipt

                try:
                    with patch.object(sync.evidence, "run", changed), self.assertRaises((ValueError, OSError)) as rejected:
                        self.capture("A-save", "AC-save", revision, "甲")
                    self.assertFalse(hasattr(rejected.exception, "collected_result"), str(rejected.exception))
                    self.assertEqual(len(list(fixture.workdir.glob("evidence/*/receipt.json"))),
                                     int(mode in ("signature", "attachment", "registered")))
                finally:
                    if snapshot_patch is not None:
                        snapshot_patch.stop()
        sync.bind_workspace(self.case.workdir)

    def test_real_cli_code_race_keeps_only_the_original_success_or_failure(self):
        for failed in (False, True):
            with self.subTest(failed=failed):
                fixture = test_acceptance.AcceptanceTest()
                fixture.setUp()
                self.addCleanup(fixture.doCleanups)
                if failed:
                    (fixture.project / "save_checks.py").write_text(
                        "import unittest\nclass SaveChecks(unittest.TestCase):\n"
                        " def test_save(self): self.fail('private-code-race-output')\n")
                script = (
                    "import runpy,sys\nfrom pathlib import Path\n"
                    f"sys.path.insert(0, {str(test_acceptance.FLOW.parent)!r})\n"
                    "import flow\nsync=flow.engine\nrun=sync.evidence.run\n"
                    "def change(*args,**kwargs):\n"
                    " receipt=run(*args,**kwargs)\n"
                    " sync.evidence.validate(args[0],receipt,action=receipt['action'],scenario=receipt['scenario'],stamp=receipt['stamp'])\n"
                    f" code=Path({str(fixture.project / 'save_checks.py')!r})\n"
                    " code.write_text(code.read_text()+'\\n# private-code-race-output\\n')\n"
                    " return receipt\n"
                    "sync.evidence.run=change\n"
                    f"sys.argv={[str(test_acceptance.FLOW), '--project', str(fixture.project), 'task', 'save', 'verify-run', 'A-save', '--scenario', 'AC-save', '--actor', 'qa', '--environment', 'local', '--rev', str(fixture.queue()['revision']), '--']!r}+[sys.executable,'-B','-m','unittest','save_checks.SaveChecks.test_save']\n"
                    f"runpy.run_path({str(test_acceptance.FLOW)!r},run_name='__main__')\n"
                )
                result = subprocess.run([sys.executable, "-B", "-c", script], cwd=fixture.project,
                                        capture_output=True, text=True, timeout=30)
                self.assertEqual(result.returncode, 1, result.stderr)
                public = json.loads(result.stderr.splitlines()[-1])["collected_result"]
                self.assertEqual((public["recorded"], public["passed"], public["actor"]), (False, not failed, "qa"))
                self.assertEqual(set(public), {"recorded", "action", "scenario", "actor", "passed", "environment", "reason"})
                self.assertNotIn("private-code-race-output", result.stderr + result.stdout)
                self.assertFalse(list(fixture.workdir.glob("evidence/*/receipt.json")))
                work = json.loads((fixture.workdir / "model.json").read_text())["work"]
                self.assertFalse([e for e in work["events"] if e["kind"] == "evidence"])

    def test_expected_input_rejection_reports_only_the_authenticated_collected_outcome(self):
        revision = self.case.queue()["revision"]
        collect = sync.evidence.run
        story = sync.load()["work"]["stories"]["S-save"]
        story["examples"][0]["then"] = "改写后的保存约定"

        def changed(*args, **kwargs):
            receipt = collect(*args, **kwargs)
            self.case.plan(stories={"S-save": story})
            return receipt

        with patch.object(sync.evidence, "run", changed), self.assertRaises(sync.CollectedConflict) as rejected:
            self.capture("A-save", "AC-save", revision, "甲")
        self.assertIs(rejected.exception.collected_result["recorded"], False)
        self.assertIs(rejected.exception.collected_result["passed"], True)
        self.assertFalse(self.stored())
        self.assertFalse(any(p.is_dir() for p in (self.case.workdir / "evidence").iterdir()))

    def test_changed_evidence_acceptance_after_execution_is_a_known_registration_race(self):
        revision = self.case.queue()["revision"]
        collect = sync.evidence.run

        def changed(*args, **kwargs):
            receipt = collect(*args, **kwargs)
            action = self.case.check("AC-save")
            action["accepts"] = ["人工核对"]
            self.case.plan(actions={"A-save": action})
            return receipt

        with patch.object(sync.evidence, "run", changed), self.assertRaises(sync.CollectedConflict) as rejected:
            self.capture("A-save", "AC-save", revision, "甲")
        self.assertIn("证据类型不满足", str(rejected.exception))
        self.assertIs(rejected.exception.collected_result["passed"], True)
        self.assertFalse(self.stored())

    def test_observation_handoff_after_collection_also_reports_the_unrecorded_outcome(self):
        action = self.case.check("AC-save")
        action["accepts"] = ["自动化", "人工核对"]
        self.case.plan(actions={"A-save": action})
        sync.commit(self.case.queue()["revision"], lambda w: sync.progress(w, "start", "A-save", "甲", "观察保存结果"))
        revision = sync.load()["work"]["revision"]
        artifact = self.case.project / "observation.txt"
        artifact.write_text("合成观察附件")
        observe = sync.evidence.observe

        def transferred(*args, **kwargs):
            receipt = observe(*args, **kwargs)
            sync.commit(revision, lambda w: sync.handoff(w, "A-save", "甲", "乙", "观察后交接"))
            return receipt

        with patch.object(sync.evidence, "observe", transferred), self.assertRaises(sync.CollectedConflict) as rejected:
            sync.capture("verify-observe", "A-save", "AC-save", revision, "甲", "本机合成观察",
                         artifact=artifact.name, actual="private-observation-marker", level="人工核对", passed=False)
        self.assertIs(rejected.exception.collected_result["passed"], False)
        self.assertNotIn("private-observation-marker", str(rejected.exception))
        self.assertFalse(self.stored())

    def test_handoff_before_execution_never_claims_that_capture_ran(self):
        sync.commit(self.case.queue()["revision"], lambda w: sync.progress(w, "start", "A-save", "甲", "执行保存检查"))
        sync.commit(sync.load()["work"]["revision"], lambda w: sync.handoff(w, "A-save", "甲", "乙", "先交接"))
        with patch.object(sync.evidence, "run") as run, self.assertRaises(sync.Invalid) as rejected:
            self.capture("A-save", "AC-save", sync.load()["work"]["revision"], "甲")
        run.assert_not_called()
        self.assertFalse(hasattr(rejected.exception, "collected_result"))

    def test_real_cli_handoff_after_execution_keeps_safe_success_and_failure_feedback(self):
        for failed in (False, True):
            with self.subTest(failed=failed):
                fixture = test_acceptance.AcceptanceTest()
                fixture.setUp()
                self.addCleanup(fixture.doCleanups)
                script = (
                    "import runpy,sys\nfrom pathlib import Path\n"
                    f"sys.path.insert(0, {str(test_acceptance.FLOW.parent)!r})\n"
                    "import flow\nsync=flow.engine\n"
                    f"sync.bind_workspace(Path({str(fixture.workdir)!r}))\n"
                    "sync.commit(sync.load()['work']['revision'], lambda w: sync.progress(w,'start','A-save','alice','执行保存检查'))\n"
                    "rev=sync.load()['work']['revision']\nrun=sync.evidence.run\n"
                    "def transfer(*args,**kwargs):\n"
                    " receipt=run(*args,**kwargs)\n"
                    " sync.commit(sync.load()['work']['revision'],lambda w:sync.handoff(w,'A-save','alice','bob','采集后交接'))\n"
                    " return receipt\n"
                    "sync.evidence.run=transfer\n"
                    f"sys.argv={[str(test_acceptance.FLOW), '--project', str(fixture.project), 'task', 'save', 'verify-run', 'A-save', '--scenario', 'AC-save', '--actor', 'alice', '--environment', 'local', '--rev']!r}+[str(rev),'--',sys.executable,'-B','-c',"
                    + repr("raise AssertionError('private-race-output-marker')" if failed else "print('private-race-output-marker')") + "]\n"
                    f"runpy.run_path({str(test_acceptance.FLOW)!r},run_name='__main__')\n"
                )
                result = subprocess.run([sys.executable, "-B", "-c", script], cwd=fixture.project,
                                        capture_output=True, text=True, timeout=30)
                self.assertEqual(result.returncode, 1, result.stderr)
                self.assertIn("采集已执行但未登记", result.stderr)
                public = json.loads(result.stderr.splitlines()[-1])["collected_result"]
                self.assertEqual((public["recorded"], public["passed"], public["actor"]), (False, not failed, "alice"))
                self.assertEqual(set(public), {"recorded", "action", "scenario", "actor", "passed", "environment", "reason"})
                self.assertNotIn("private-race-output-marker", result.stderr + result.stdout)
                work = json.loads((fixture.workdir / "model.json").read_text())["work"]
                self.assertFalse([e for e in work["events"] if e["kind"] == "evidence"])
                self.assertFalse(list((fixture.workdir / "evidence").glob("*/receipt.json")))

    def test_corrupt_or_already_registered_receipts_never_claim_unrecorded_trusted_results(self):
        for mode in ("signature", "attachment", "registered"):
            with self.subTest(mode=mode):
                fixture = test_acceptance.AcceptanceTest()
                fixture.setUp()
                self.addCleanup(fixture.doCleanups)
                sync.bind_workspace(fixture.workdir)
                sync.commit(sync.load()["work"]["revision"], lambda w: sync.progress(w, "start", "A-save", "甲", "执行保存检查"))
                revision = sync.load()["work"]["revision"]
                collect = sync.evidence.run

                def changed(*args, **kwargs):
                    receipt = collect(*args, **kwargs)
                    if mode == "registered":
                        def record_and_transfer(w):
                            state = sync.evaluate(w)["A-save"]
                            case = sync.scenario_definitions(w)["AC-save"]
                            w["revision"] += 1
                            sync.append_event(w, "evidence", "甲", action="A-save", scenario="AC-save",
                                              stamp=state["stamp"], scenario_stamp=sync.case_stamp(case, sync.latest_retirements(w, set())),
                                              receipt=receipt, output=receipt["actual"])
                            return sync.handoff(w, "A-save", "甲", "乙", "已登记后交接")
                        sync.commit(revision, record_and_transfer)
                    else:
                        sync.commit(revision, lambda w: sync.handoff(w, "A-save", "甲", "乙", "交接后核验"))
                        if mode == "signature":
                            path = fixture.workdir / receipt["path"]
                            envelope = json.loads(path.read_text())
                            envelope["signature"] = "0" * 64
                            path.write_text(json.dumps(envelope))
                        else:
                            (fixture.workdir / receipt["artifact"]["path"]).write_text("损坏的附件")
                    return receipt

                with patch.object(sync.evidence, "run", changed), self.assertRaises(ValueError) as rejected:
                    self.capture("A-save", "AC-save", revision, "甲")
                self.assertFalse(hasattr(rejected.exception, "collected_result"), str(rejected.exception))
                self.assertEqual(len(list((fixture.workdir / "evidence").glob("*/receipt.json"))), 1)
        sync.bind_workspace(self.case.workdir)

    def test_commit_io_failure_is_not_a_known_unrecorded_capture_race(self):
        revision = self.case.queue()["revision"]
        with patch.object(sync, "atomic", side_effect=OSError("模拟提交写入失败")), self.assertRaises(OSError) as rejected:
            self.capture("A-save", "AC-save", revision, "甲")
        self.assertFalse(hasattr(rejected.exception, "collected_result"))
