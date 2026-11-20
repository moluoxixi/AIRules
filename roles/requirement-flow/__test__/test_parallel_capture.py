"""Independent scenario checks can finish together without replacing a competing result."""
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import sys
from threading import Barrier
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
        code = self.case.project / "save_checks.py"
        self.reject_mid_capture_change(lambda: code.write_text("raise AssertionError('new code')", encoding="utf-8"))
