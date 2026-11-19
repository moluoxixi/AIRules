"""Exercise dependency routing and evidence validity against fresh on-disk tasks."""
import sys
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


SKILL = Path(__file__).resolve().parents[1] / "skills" / "requirement-flow"
sys.path.insert(0, str(SKILL))
from runtime import sync


def story(goal, *examples):
    return {"title": goal, "actor": "收货员", "goal": goal, "examples": [
        {"id":key, "given":"已选择到货记录", "when":condition, "then":expected}
        for key, condition, expected in examples]}


NOTE = ("SC-note", "查阅备注", "显示已复核的备注")
WEIGHT = ("SC-weight", "读取称重结果", "显示 2.5 千克")
DISPLAY = ("SC-display", "保存后查看", "重量仍为 2.5 千克")
RETRY = ("SC-retry", "失败后重试保存", "保留原重量并恢复成功")


def action(title, kind, feature, **inputs):
    return {"title": title, "kind": kind, "stories": [feature], "read_stories": [feature],
            "contracts": [], "decisions": [], "depends_on": [], "done": title + "有可复核的结果", **inputs}


class DispatchTest(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.root = Path(folder.name)
        self.addCleanup(sync.bind_workspace, sync.TASK_DIR)
        self.fixture = self.root / "records.json"
        self.fixture.write_text(json.dumps({"note":"已复核","weight":2.5,"retried":False}),encoding="utf-8")
        self.open_task("delivery")
        self.finish("A-intake")

    def open_task(self, outcome):
        directory = self.root / ".requirements/active" / outcome
        sync.initialize_task(directory, "核对到货登记流程", key=outcome, outcome=outcome)
        sync.bind_workspace(directory)

    def work(self):
        return sync.load()["work"]

    def test_failed_model_write_leaves_previous_graph_and_revision_for_retry(self):
        page = sync.BOOK.read_bytes()
        model = sync.MODEL.read_bytes()
        write = sync.atomic

        def fail_model(path, data):
            if path == sync.MODEL:
                raise OSError("cannot replace model")
            write(path, data)

        with patch.object(sync, "atomic", side_effect=fail_model), self.assertRaises(OSError):
            self.plan(goal="确认到货状态")
        self.assertEqual(sync.BOOK.read_bytes(), page)
        self.assertEqual(sync.MODEL.read_bytes(), model)
        self.plan(goal="确认到货状态")
        self.assertEqual(sync.sync(check=True)["work"]["goal"], "确认到货状态")

    def write(self, operation):
        return sync.commit(self.work()["revision"], operation)["work"]

    def plan(self, **patch):
        return self.write(lambda work: sync.apply_plan(work, patch, "设计", "核对收货流程"))

    def finish(self, key, **details):
        return self.write(lambda work: sync.progress(work, "finish", key, "执行者",
                                                      output="已核对产出", evidence="收货流程核对记录", **details))

    def collect(self, key):
        scenario = self.work()["actions"][key]["covers"][0]
        field, expected = {"SC-note":("note","已复核"), "SC-retry":("retried",True),
                           "SC-display":("weight",2.5), "SC-weight":("weight",2.5)}[scenario]
        checker = ("import json,sys; from pathlib import Path; "
                   "row=json.loads(Path('records.json').read_text(encoding='utf-8')); "
                   "observed=row[sys.argv[1]]; print(repr(observed)); "
                   "sys.exit(0 if observed==json.loads(sys.argv[2]) else 1)")
        return sync.capture("verify-run", key, scenario, self.work()["revision"], "执行者", "临时收货项目",
                            argv=[sys.executable,"-c",checker,field,json.dumps(expected)])

    def verify(self, key):
        result = self.collect(key)
        self.assertTrue(result["passed"], result)
        self.assertTrue((sync.TASK_DIR / result["artifact"]["path"]).is_file())
        return self.finish(key)

    def test_decisions_select_the_path_and_missing_fields_block_only_their_consumers(self):
        manual = {"decision": "D-source", "is": "manual"}
        sensor = {"decision": "D-source", "is": "sensor"}
        contract = {"title": "读秤", "operation": "GET /scale", "state": "open",
                    "status": "待核实", "source": "现场设备文档", "fields": []}
        work = self.plan(
            stories={"S-note": story("登记备注", NOTE), "S-weight": story("记录重量", WEIGHT)},
            contracts={"C-scale": contract},
            decisions={"D-source": {"title": "重量从哪里取得？", "owner": "收货主管",
                                    "why": "决定录入方式", "stories": ["S-weight"], "options": {
                                        "manual": {"label": "手输", "consequence": "员工录入"},
                                        "sensor": {"label": "电子秤", "consequence": "读取秤接口"}}}},
            actions={"A-note": action("核对备注", "验证", "S-note", covers=["SC-note"]),
                     "A-manual": action("输入重量", "开发", "S-weight", when=manual),
                     "A-sensor": action("读取重量", "开发", "S-weight", when=sensor, contracts=["C-scale"]),
                     "A-readback": action("检查显示", "验证", "S-weight", covers=["SC-weight"], depends_on=[
                         {"id": "A-manual", "when": manual}, {"id": "A-sensor", "when": sensor}])})
        self.assertEqual(sync.dispatch(work, story="S-note")["ready"], ["A-note"])
        waiting = sync.dispatch(work, story="S-weight")
        self.assertEqual(waiting["state"], "waiting")
        self.assertEqual([item["id"] for item in waiting["pending_decisions"]], ["D-source"])
        note_proof = sync.evaluate(self.verify("A-note"))["A-note"]["proof"]

        def choose(choice):
            return self.write(lambda w: sync.decide(w, "D-source", choice, "已核对业务口径", "收货主管"))

        self.assertEqual(sync.dispatch(choose("manual"), story="S-weight")["ready"], ["A-manual"])
        self.finish("A-manual")
        work = self.verify("A-readback")
        self.assertEqual(sync.dispatch(work)["state"], "complete")
        work = choose("sensor")
        queue = sync.dispatch(work, story="S-weight")
        self.assertEqual(queue["state"], "waiting")
        self.assertEqual(queue["pending_decisions"], [])
        self.assertIn({"kind": "contract", "id": "C-scale", "title": "读秤", "actions": ["A-sensor"]},
                      queue["technical_blockers"])
        states = sync.evaluate(work)
        self.assertEqual(states["A-manual"]["state"], "skipped")
        self.assertIsNone(states["A-readback"]["proof"])
        self.assertEqual(states["A-note"]["proof"], note_proof)

        field = {"name": "weight", "type": "number", "constraint": "以千克表示", "use": "回显实测重量"}
        work = self.plan(contracts={"C-scale": {**contract, "state": "confirmed", "status": "已确认", "fields": [field]}})
        packet = sync.dispatch(work, story="S-weight")["next"]
        self.assertEqual(packet["id"], "A-sensor")
        self.assertEqual(packet["inputs"]["contracts"]["C-scale"]["fields"], [field])
        self.finish("A-sensor")
        next_packet = sync.dispatch(self.work(), story="S-weight")["next"]
        self.assertEqual(set(next_packet["inputs"]["dependencies"]), {"A-sensor"})
        self.assertTrue(next_packet["inputs"]["dependencies"]["A-sensor"]["proof"]["evidence"])
        self.assertEqual(sync.dispatch(self.verify("A-readback"))["state"], "complete")

    def test_failed_check_reopens_its_producer_and_invalidates_only_dependent_receipts(self):
        upstream = [{"id": "A-save"}]
        self.plan(stories={"S-save": story("保存重量", DISPLAY, RETRY), "S-note": story("查看备注", NOTE)},
                  actions={"A-save": action("保存重量", "开发", "S-save"),
                           "A-display": action("核对显示", "验证", "S-save", covers=["SC-display"], depends_on=upstream),
                           "A-retry": action("核对失败重试", "验证", "S-save", covers=["SC-retry"], depends_on=upstream),
                           "A-note": action("核对备注", "验证", "S-note", covers=["SC-note"])})
        unaffected = sync.evaluate(self.verify("A-note"))["A-note"]["proof"]
        before = self.finish("A-save")
        with self.assertRaisesRegex(sync.Invalid, "不能用推演"):
            self.finish("A-display", level="推演", environment="回归用例", expected="保留重量")
        self.assertEqual(self.work()["revision"], before["revision"])
        work = self.verify("A-display")
        old_receipt = sync.evaluate(work)["A-display"]["proof"]
        self.assertEqual(sync.dispatch(work)["progress"]["verified_stories"], ["S-note"])
        failed = self.collect("A-retry")
        self.assertFalse(failed["passed"])
        work = self.write(lambda w: sync.progress(w, "fail", "A-retry", "执行者", output="重试丢失重量",
                                                  evidence="重试用例运行结果", level="自动化", environment="回归用例",
                                                  expected="保留原值", reopen="A-save"))
        self.assertEqual(sync.dispatch(work, story="S-save")["ready"], ["A-save"])
        states = sync.evaluate(work)
        self.assertEqual(states["A-save"]["state"], "stale")
        self.assertIsNone(states["A-display"]["proof"])
        self.assertEqual(states["A-note"]["proof"], unaffected)
        self.assertIn(old_receipt, [event["id"] for event in work["events"]])
        self.finish("A-save")
        row = json.loads(self.fixture.read_bytes())
        self.fixture.write_text(json.dumps({**row,"retried":True}),encoding="utf-8")
        self.verify("A-retry")
        self.assertEqual(sync.dispatch(self.work(), story="S-save")["ready"], ["A-display"])
        work = self.verify("A-display")
        self.assertNotEqual(sync.evaluate(work)["A-display"]["proof"], old_receipt)
        self.assertEqual(sync.dispatch(work)["state"], "complete")
        self.assertEqual(sync.sync(check=True)["work"]["revision"], work["revision"])

    def test_explicit_research_finishes_with_a_sourced_finding(self):
        self.assertEqual(sync.dispatch(self.work())["state"], "unplanned")
        self.open_task("research")
        with self.assertRaises(sync.Invalid):
            self.write(lambda w: sync.progress(w, "finish", "A-intake", "调研者", output="已研究", evidence=""))
        work = self.finish("A-intake")
        self.assertEqual(sync.dispatch(work)["state"], "complete")
        self.assertTrue(sync.context(sync.load())["effective_outputs"][0]["evidence"])
