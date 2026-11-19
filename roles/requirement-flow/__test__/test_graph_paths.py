"""Rendered graphs preserve the dependencies used by the real dispatcher."""
import json
from pathlib import Path
import re
import sys
import tempfile
import unittest

SKILL = Path(__file__).resolve().parents[1] / "skills/requirement-flow"
sys.path.insert(0, str(SKILL))
from runtime import graph_view, sync


def action(contracts, **extra):
    return {"title": "调研接口", "kind": "调研", "stories": ["S-one"], "read_stories": ["S-one"],
            "contracts": contracts, "decisions": [], "depends_on": [], "done": "接口有可复核来源", **extra}


class GraphPathsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.addCleanup(sync.bind_workspace, sync.TASK_DIR)
        self.task = Path(self.temp.name) / ".requirements/active/study"
        sync.initialize_task(self.task, "按前置结论调研接口", key="study", outcome="research")
        sync.bind_workspace(self.task)
        self.write(lambda work: sync.progress(work, "finish", "A-intake", "调研员",
                                              output="已明确调研范围", evidence="用户原话"))

    def write(self, operation):
        return sync.commit(sync.load()["work"]["revision"], operation)["work"]

    def plan(self, actions, **extra):
        stories = {key: {"title": key, "actor": "业务人员", "goal": "核对契约",
                         "examples": [{"id": "SC-" + key, "given": "接口说明", "when": "核对", "then": "字段明确"}]}
                   for key in ("S-one", "S-two")}
        contracts = {key: {"title": key, "state": "confirmed", "status": "已核对", "operation": "GET /" + key,
                           "source": "接口说明", "fields": []} for key in ("C-auth", "C-orders", "C-result")}
        patch = {"stories": stories, "contracts": contracts, "actions": actions, **extra}
        return self.write(lambda work: sync.apply_plan(work, patch, "设计员", "核对图与实际前置"))

    def graph(self):
        page = (self.task / "handbook.html").read_text(encoding="utf-8")
        return json.loads(re.search(r'<script type="application/json" id="data">(.+?)</script>', page).group(1))["graph"]

    def assert_edge(self, graph, source, target, **expected):
        matches = [edge for edge in graph["edges"] if edge["source"] == source and edge["target"] == target
                   and all(edge[key] == value for key, value in expected.items())]
        self.assertTrue(matches, (source, target, expected, graph["edges"]))

    def test_folded_research_keeps_execution_and_conditional_dependencies(self):
        decision = {"title": "是否核对订单", "owner": "业务", "why": "订单依赖身份", "stories": ["S-one"],
                    "options": {"yes": {"label": "需要", "consequence": "先核对身份"},
                                "no": {"label": "无需", "consequence": "独立调研"}}}
        cond = {"decision": "D-order", "is": "yes"}
        work = self.plan({"A-auth": action(["C-auth"], decisions=["D-order"]),
                          "A-orders": action(["C-orders"],
                                             depends_on=[{"id": "A-auth", "when": cond}])},
                         decisions={"D-order": decision})
        graph = self.graph()
        self.assertEqual(graph["aliases"], {"A-auth": "C-auth", "A-orders": "C-orders"})
        self.assert_edge(graph, "C-auth", "C-orders", decision="D-order", choice="yes", mode="possible")
        self.assert_edge(graph, "C-auth", "C-orders", label="是否核对订单 · 需要")
        self.assert_edge(graph, "D-order", "C-auth")
        self.assert_edge(graph, "D-order", "C-orders")
        self.assertEqual(sync.evaluate(work)["A-orders"]["state"], "blocked")
        self.assertEqual(next(n["state"] for n in graph["nodes"] if n["id"] == "C-orders"), "等待前置")
        work = self.write(lambda w: sync.decide(w, "D-order", "yes", "订单必须认证", "业务负责人"))
        self.assert_edge(self.graph(), "C-auth", "C-orders", mode="chosen")
        self.assertEqual(sync.evaluate(work)["A-orders"]["blockers"], [{"kind": "dependency", "id": "A-auth"}])
        work = self.write(lambda w: sync.progress(w, "finish", "A-auth", "调研员", output="认证字段已核对", evidence="身份接口说明"))
        self.assertEqual(sync.evaluate(work)["A-orders"]["state"], "ready")
        self.assertEqual(next(n["state"] for n in self.graph()["nodes"] if n["id"] == "C-orders"), "可调研")
        self.write(lambda w: sync.decide(w, "D-order", "no", "改为独立调研", "业务负责人"))
        self.assert_edge(self.graph(), "C-auth", "C-orders", mode="skipped")

    def test_multiple_researchers_keep_separate_nodes_and_shared_conditional_paths(self):
        decision = {"title": "是否二次复核", "owner": "业务", "why": "选定复核", "stories": ["S-two"],
                    "options": {"yes": {"label": "复核", "consequence": "进行二次复核"},
                                "no": {"label": "无需", "consequence": "保留初查"}}}
        cond = {"decision": "D-review", "is": "yes"}
        work = self.plan({"A-first": action(["C-auth"], closes_contracts=["C-auth"]),
                          "A-second": action(["C-auth"], closes_contracts=["C-auth"],
                                             stories=["S-one", "S-two"], read_stories=["S-one", "S-two"],
                                             depends_on=[{"id": "A-first"}], when=cond)},
                         decisions={"D-review": decision})
        graph = self.graph()
        self.assertNotIn("A-first", graph["aliases"])
        self.assertNotIn("A-second", graph["aliases"])
        self.assert_edge(graph, "A-first", "A-second")
        self.assert_edge(graph, "D-review", "A-second", decision="D-review", choice="yes")
        self.assert_edge(graph, "C-auth", "A-first")
        self.assert_edge(graph, "C-auth", "A-second")
        for story in ("S-one", "S-two"):
            self.assertTrue({"A-first", "A-second", "C-auth", "D-review"}.issubset(graph["features"][story]["nodes"]))
        self.assertEqual(sync.evaluate(work)["A-second"]["state"], "dormant")

    def test_multi_contract_and_separate_closing_contract_remain_visible(self):
        work = self.plan({"A-many": action(["C-auth", "C-orders"], closes_contracts=["C-result"]),
                          "A-close": action([], stories=["S-two"], read_stories=["S-two"],
                                            closes_contracts=["C-result"], depends_on=[{"id": "A-many"}])})
        graph = self.graph()
        self.assertFalse(graph["aliases"])
        for contract in ("C-auth", "C-orders", "C-result"):
            self.assert_edge(graph, contract, "A-many")
        self.assert_edge(graph, "C-result", "A-close")
        self.assert_edge(graph, "A-many", "A-close")
        self.assertEqual(graph_view.contract_users(work)["C-result"], ["S-one", "S-two"])
        self.assertTrue({"A-many", "A-close", "C-auth", "C-orders", "C-result"}.issubset(graph["features"]["S-two"]["nodes"]))


if __name__ == "__main__":
    unittest.main()
