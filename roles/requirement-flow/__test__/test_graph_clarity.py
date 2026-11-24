"""Graph captions and scope metadata describe facts, not intended implementation."""
import json
from pathlib import Path
import re
import sys
import tempfile
import unittest

SKILL = Path(__file__).resolve().parents[1] / "skills/requirement-flow"
sys.path.insert(0, str(SKILL))
from runtime import graph_view, sync


class GraphClarityTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.addCleanup(sync.bind_workspace, sync.TASK_DIR)
        self.task = Path(self.temp.name) / ".requirements/active/clarity"
        sync.initialize_task(self.task, "仅测试的信息优化", key="clarity")
        sync.bind_workspace(self.task)
        self.write(lambda work: sync.progress(work, "finish", "A-intake", "测试", output="范围已明确", evidence="测试输入"))
        stories = {key: {"title": key, "goal": "用户可看到保存结果", "actor": "操作员",
                         "flow": ["用户选择条目", "业务期望回读结果"],
                         "examples": [{"id": "SC-" + key, "given": "已选择", "when": "保存", "then": "结果可回读"}]}
                   for key in ("S-one", "S-two", "S-reference")}
        base = {"stories": ["S-one", "S-two"], "read_stories": ["S-one", "S-two", "S-reference"],
                "contracts": ["C-shared"], "decisions": [], "depends_on": [], "done": "写入结果可回读"}
        self.work = self.write(lambda work: sync.apply_plan(work, {
            "stories": stories,
            "contracts": {"C-shared": {"title": "共享接口", "state": "confirmed", "status": "已核对",
                                       "operation": "POST /test", "fields": [], "source": "测试接口"}},
            "actions": {"A-shared": {**base, "title": "实现保存", "kind": "开发"},
                        "V-shared": {**base, "title": "验证保存", "kind": "验证", "depends_on": [{"id": "A-shared"}],
                                     "covers": ["SC-S-one", "SC-S-two"]}}
        }, "测试", "登记共享动作与参考输入"))

    def write(self, operation):
        return sync.commit(sync.load()["work"]["revision"], operation)["work"]

    def graph(self, work=None, states=None):
        work = work or self.work
        return graph_view.make_graph(work, states or sync.evaluate(work), [])

    def development(self, graph):
        return next(node for node in graph["nodes"] if node["id"] == "A-shared")

    def test_reference_and_shared_metadata_do_not_expand_acceptance_cards(self):
        graph = self.graph()
        feature = graph["features"]["S-one"]
        self.assertEqual(feature["reference_stories"], ["S-reference"])
        self.assertNotIn("S-reference", feature["nodes"])
        self.assertNotIn("S-two", feature["nodes"])
        self.assertEqual(feature["shared_actions"]["A-shared"], ["S-two"])
        self.assertEqual(feature["shared_actions"]["V-shared"], ["S-two"])
        self.assertEqual(feature["shared_contracts"]["C-shared"], ["S-two"])
        self.assertEqual(self.development(graph)["users"], ["S-one", "S-two"])
        self.assertEqual(self.development(graph)["reference_stories"], ["S-reference"])

    def test_unimplemented_caption_is_completion_condition_not_business_flow(self):
        node = self.development(self.graph())
        self.assertEqual(node["caption"], "完成条件 · 写入结果可回读")
        self.assertEqual(node["caption_kind"], "condition")
        story = next(node for node in self.graph()["nodes"] if node["id"] == "S-one")
        self.assertEqual(story["caption"], "用户可看到保存结果")

    def finish(self):
        self.work = self.write(lambda work: sync.progress(work, "finish", "A-shared", "测试", output="已接入写入服务并保留选择", evidence="src/save.js:1"))
        return sync.evaluate(self.work)

    def test_valid_legacy_finish_output_is_actual_caption(self):
        states = self.finish()
        node = self.development(self.graph(states=states))
        self.assertEqual(node["caption"], "实际产出 · 已接入写入服务并保留选择")
        self.assertEqual(node["caption_kind"], "actual")

    def test_structured_summary_and_offline_export_use_the_same_model(self):
        states = self.finish()
        proof = next(event for event in self.work["events"] if event["id"] == states["A-shared"]["proof"])
        proof["implementation"] = {"summary": "实现可恢复的写入", "steps": [{"title": "写入", "detail": "调用服务", "source": "src/save.js:1"}],
                                   "branches": [{"condition": "超时", "behavior": "保留选择"}]}
        self.assertEqual(self.development(self.graph(states=states))["caption"], "实际产出 · 实现可恢复的写入")
        model = sync.load()
        model["work"] = self.work
        page = graph_view.render(model, states, {}, "", "test", SKILL / "runtime/layout.html", queue=sync.dispatch(self.work, for_map=True))
        payload = json.loads(re.search(r'<script type="application/json" id="data">(.+?)</script>', page).group(1))
        self.assertEqual(payload["model"]["work"]["events"][-1]["implementation"], proof["implementation"])
        self.assertEqual(payload["graph"]["features"]["S-one"]["reference_stories"], ["S-reference"])
        self.assertEqual(payload["csrf"], "")

    def test_knowledge_warning_changes_refresh_version_without_changing_legacy_empty_hash(self):
        original = graph_view.lesson_version({})
        self.assertEqual(original, graph_view.lesson_version({"knowledge_warnings": []}))
        self.assertNotEqual(original, graph_view.lesson_version({"knowledge_warnings": ["账本不可读"]}))

    def test_stale_finish_is_labelled_historical_not_current_implementation(self):
        self.finish()
        self.work["stories"]["S-reference"]["goal"] = "参考输入已经变化"
        states = sync.evaluate(self.work)
        self.assertEqual(states["A-shared"]["state"], "stale")
        node = self.development(self.graph(states=states))
        self.assertEqual(node["caption_kind"], "historical")
        self.assertEqual(node["caption"], "历史产出（需复核）· 已接入写入服务并保留选择")


if __name__ == "__main__":
    unittest.main()
