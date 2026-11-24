"""Exercise the installed lightweight entry, with actual code and signed receipts."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


FLOW = Path(__file__).resolve().parents[1] / "skills/requirement-flow/flow.py"


class LightweightDeliveryTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.base = Path(temporary.name).resolve()
        self.project = self.base / "project"
        self.project.mkdir()
        self.raw(FLOW, "init")
        self.entry = self.project / ".agents/skills/requirement-flow/flow.py"
        self.task_root = self.project / ".requirements/active/work"
        self.model = self.task_root / "model.json"
        self.book = self.task_root / "handbook.html"
        self.revision = self.cli("new", "work", "--light", "--request", "门店员保存记录并能重开回显")['revision']

    def raw(self, entry, *args, code=0):
        timeout = 60 if args[:1] == ("init",) else 30
        result = subprocess.run([sys.executable, "-B", str(entry), "--project", str(self.project), *map(str, args)],
                                cwd=self.project, text=True, capture_output=True, timeout=timeout)
        self.assertEqual(result.returncode, code, result.stderr or result.stdout)
        return result

    def cli(self, *args, code=0):
        return json.loads(self.raw(self.entry, *args, code=code).stdout)

    def write(self, relative, text):
        (self.project / relative).write_text(text, encoding="utf-8")

    def case(self, scenario="AC-save", then="重开能读到保存值"):
        return {"id": scenario, "given": "合法输入", "when": "保存后重新打开", "then": then}

    def story(self, name, *cases):
        return {"title": name, "actor": "门店员", "goal": f"可使用{name}", "basis": "需求原话",
                "examples": list(cases)}

    def patch(self, patch, *, cmd="cards", error=None):
        file = self.base / "cards.json"
        file.write_text(json.dumps(patch, ensure_ascii=False), encoding="utf-8")
        args = ("task", "work", cmd, file, "--rev", self.revision, "--why", "明确场景口径", "--actor", "tester")
        if error:
            before = self.model.read_bytes(), self.book.read_bytes()
            self.assertIn(error, self.raw(self.entry, *args, code=1).stderr)
            self.assertEqual(before, (self.model.read_bytes(), self.book.read_bytes()))
            return None
        result = self.raw(self.entry, *args).stdout
        if cmd == "cards":
            written = json.loads(result)
            self.revision = written["revision"]
            return written["delivery"]
        self.revision = int(result.strip().rsplit("v", 1)[-1])
        return None

    def implement(self, story="S-save", source="save.py:1"):
        result = self.cli("task", "work", "implement", story, "--rev", self.revision, "--actor", "tester",
                          "--output", "登记实际代码和回读路径", "--evidence", source)
        self.revision = result["revision"]
        self.assertEqual((result["story"], result["kind"]), (story, "开发"))
        return result["delivery"]

    def check(self, *, ready=False):
        before = self.model.read_bytes(), self.book.read_bytes()
        report = self.cli("task", "work", "delivery-check", "--actor", "tester", code=0 if ready else 1)
        self.assertEqual(report["ready_to_deliver"], ready)
        self.assertEqual(before, (self.model.read_bytes(), self.book.read_bytes()))
        return report

    def verify(self, scenario="AC-save", script="test_save.py", code=0):
        result = self.cli("task", "work", "verify-run", scenario, "--rev", self.revision, "--actor", "tester",
                          "--environment", "本机", "--", sys.executable, "-B", script, code=code)
        self.revision = result["revision"]
        return result

    def code_fixture(self, name, value):
        self.write(name + ".py", f"RESULT = {value!r}\n")
        self.write("test_" + name + ".py", f"from {name} import RESULT\nassert RESULT == {value!r}\nprint('assertion passed')\n")

    def test_default_path_needs_no_claim_or_verification_finish(self):
        self.assertEqual(json.loads(self.model.read_bytes())["work"]["actions"], {})
        self.assertEqual(self.check()["check_suggestions"][0]["next_step"], "define_stories")
        self.code_fixture("save", "保存值")
        blocked = self.patch({"stories": {"S-save": self.story("保存", self.case())},
                              "code_paths": {"AC-save": ["save.py", "test_save.py"]}})
        self.assertEqual(blocked["check_suggestions"][0]["next_step"], "resolve_prerequisites")
        attempt = self.raw(self.entry, "task", "work", "verify-run", "AC-save", "--rev", self.revision,
                           "--environment", "本机", "--", sys.executable, "-B", "test_save.py", code=1)
        self.assertIn("前置条件", attempt.stderr)
        self.assertEqual(self.implement()["check_suggestions"][0]["next_step"], "collect_evidence")
        receipt = self.verify()
        self.assertTrue(receipt["passed"])
        self.assertEqual(self.check(ready=True)["acceptance"], {"passed": 1, "total": 1})
        work = json.loads(self.model.read_bytes())["work"]
        self.assertEqual([event["kind"] for event in work["events"]], ["plan", "finish", "evidence", "finish"])
        self.assertEqual(work["events"][-1]["receipts"], {"AC-save": receipt["id"]})
        archive = self.cli("archive", "work")
        self.assertEqual(archive["state"], "complete")
        self.assertFalse(self.model.exists())
        self.assertIn("归档", self.raw(self.entry, "task", "work", "delivery-check", code=1).stderr)

    def test_only_affected_card_needs_reverification_and_old_release_is_not_reused(self):
        self.code_fixture("save", "保存值")
        self.code_fixture("search", "搜索值")
        self.patch({"stories": {"S-save": self.story("保存", self.case()),
                                "S-search": self.story("搜索", self.case("AC-search"))},
                    "code_paths": {"AC-save": ["save.py", "test_save.py"],
                                   "AC-search": ["search.py", "test_search.py"]}})
        self.implement()
        self.implement("S-search", "search.py:1")
        search = self.verify("AC-search", "test_search.py")
        self.verify()
        self.assertEqual(self.check(ready=True)["acceptance"]["passed"], 2)
        self.write("save.py", "RESULT = '保存值'  # code updated before any registration\n")
        changed = self.check()
        self.assertEqual(changed["acceptance"], {"passed": 1, "total": 2})
        self.assertEqual(changed["verified_stories"], ["S-search"])
        self.assertEqual(changed["check_suggestions"][0]["next_step"], "reverify")
        self.assertEqual(self.implement(), self.check())
        self.assertEqual(self.verify()["scenario"], "AC-save")
        self.check(ready=True)
        scenarios = self.cli("task", "work", "context")["scenarios"]
        self.assertIn(search["id"], [p["id"] for row in scenarios if row["id"] == "AC-search" for p in row["receipts"]])

    def test_plan_enforces_method_environment_and_rejects_sensitive_or_untrusted_execution(self):
        self.code_fixture("save", "值")
        check = {"level": "真实环境", "environment": "验收真机", "expected": "重开显示实测值", "steps": ["保存", "关闭重开"]}
        card = self.story("保存", self.case())
        self.patch({"stories": {"S-save": card}, "checks": {"AC-bad": check}}, error="须引用本期场景")
        unsafe = {"level": "自动化", "environment": "本机", "expected": "有断言", "argv": ["test", "--token=not-a-real-secret"]}
        self.patch({"stories": {"S-save": card}, "checks": {"AC-save": unsafe}}, error="敏感命令参数")
        self.patch({"stories": {"S-save": card}, "checks": {"AC-save": check}, "code_paths": {"AC-save": ["save.py"]}})
        self.implement()
        self.assertEqual(self.check()["check_suggestions"][0]["check"], check)
        run = ("task", "work", "verify-run", "AC-save", "--rev", self.revision, "--environment", "本机", "--",
               sys.executable, "-B", "test_save.py")
        self.assertIn("采证方式", self.raw(self.entry, *run, code=1).stderr)
        observe = ("task", "work", "verify-observe", "AC-save", "--rev", self.revision, "--level", "真实环境",
                   "--artifact", "trace.txt", "--actual", "关闭重开仍显示实测值")
        self.write("trace.txt", "合成实测附件：重开后显示预期值\n")
        self.assertIn("采证环境", self.raw(self.entry, *observe, "--environment", "本机", code=1).stderr)
        # Fixtures exercise the real-environment admission rule; not a claim of a live deployment.
        self.revision = self.cli(*observe, "--environment", "验收真机")["revision"]
        self.check(ready=True)
        self.patch({"checks": {"AC-save": {**check, "steps": ["保存", "冷启动后重开"]}}})
        self.assertEqual(self.check()["check_suggestions"][0]["next_step"], "reverify")

    def test_removing_a_story_scenario_requires_the_business_decision_and_reversal_reopens(self):
        self.code_fixture("save", "值")
        keep, drop = self.case(), self.case("AC-later", "延后行为也按原约定")
        real = {"level": "真实环境", "environment": "真机", "expected": "实测回读", "steps": ["重开"]}
        self.patch({"stories": {"S-save": self.story("保存", keep, drop)}, "checks": {"AC-later": real},
                    "code_paths": {key: ["save.py", "test_save.py"] for key in ("AC-save", "AC-later")}})
        only_keep = self.story("保存", keep)
        self.patch({"stories": {"S-save": only_keep}}, error="已确认的范围决定")
        decision = {"title": "次要场景延期？", "why": "保留本期口径", "owner": "业务", "stories": ["S-save"],
                    "options": {"later": {"label": "延期", "consequence": "移出本期"},
                                "now": {"label": "本期", "consequence": "必须验收"}}}
        self.patch({"decisions": {"D-scope": decision}}, cmd="plan")

        def decide(choice):
            result = self.raw(self.entry, "task", "work", "decision", "D-scope", choice, "--why", "业务确认",
                              "--actor", "业务", "--rev", self.revision)
            self.revision = int(result.stdout.strip().rsplit("v", 1)[-1])

        decide("later")
        self.patch({"stories": {"S-save": only_keep}, "retire_scenarios": {"AC-later": {"decision": "D-scope", "is": "later"}}})
        self.implement()
        self.verify()
        self.assertEqual(self.check(ready=True)["acceptance"], {"passed": 1, "total": 1})
        decide("now")
        self.assertEqual(self.check()["check_suggestions"][0]["next_step"], "resolve_scope")
        self.patch({"stories": {"S-save": self.story("保存", keep, drop)}})
        suggestions = {s["scenario"]: s for s in self.check()["check_suggestions"]}
        self.assertEqual(suggestions["AC-later"]["check"], real)
        self.implement()
        attempt = self.raw(self.entry, "task", "work", "verify-run", "AC-later", "--rev", self.revision,
                           "--environment", "本机", "--", sys.executable, "-B", "test_save.py", code=1)
        self.assertIn("采证方式", attempt.stderr)

    def test_changing_then_restoring_code_during_the_command_cannot_pass(self):
        self.write("save.py", "RESULT = 2\n")
        self.write("test_save.py", """from pathlib import Path
import os
source = Path('save.py')
before = source.read_bytes()
info = source.stat()
source.write_text('RESULT = 3\\n')
try:
    assert source.read_text() == 'RESULT = 3\\n'
    print('assertion passed on different code')
finally:
    source.write_bytes(before)
    os.utime(source, ns=(info.st_atime_ns, info.st_mtime_ns + 2_000_000_000))
""")
        self.patch({"stories": {"S-save": self.story("保存", self.case())},
                    "code_paths": {"AC-save": ["save.py", "test_save.py"]}})
        self.implement()
        receipt = self.verify(code=1)
        self.assertFalse(receipt["passed"])
        self.assertEqual((self.project / "save.py").read_text(), "RESULT = 2\n")
        self.assertEqual(self.check()["check_suggestions"][0]["next_step"], "reverify")
        self.assertEqual(json.loads(self.model.read_bytes())["work"]["events"][-1]["kind"], "evidence")

    def test_record_only_updates_do_not_reset_repeated_failure_or_invalidate_other_cases(self):
        self.code_fixture("save", "值")
        self.write("fail.py", "assert False, 'the failure remains'\n")
        self.patch({"stories": {"S-save": self.story("保存", self.case(), self.case("AC-error"))},
                    "code_paths": {"AC-save": ["save.py", "test_save.py"], "AC-error": ["save.py", "fail.py"]}})
        self.implement()
        self.verify()
        for _ in range(2):
            self.verify("AC-error", "fail.py", code=1)
        self.assertEqual(self.check()["check_suggestions"][0]["next_step"], "independent_review")
        feedback = self.implement(source="save.py:1\nfail.py:1")
        self.assertEqual(feedback["acceptance"], {"passed": 1, "total": 2})
        self.assertEqual(feedback["check_suggestions"][0]["next_step"], "independent_review")
        attempt = self.raw(self.entry, "task", "work", "verify-run", "AC-error", "--rev", self.revision,
                           "--environment", "本机", "--", sys.executable, "-B", "fail.py", code=1)
        self.assertIn("独立诊断", attempt.stderr)


if __name__ == "__main__":
    unittest.main()
