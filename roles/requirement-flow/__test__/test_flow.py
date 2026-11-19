"""Exercise the installed project CLI through subprocesses in independent projects."""
import concurrent.futures
import importlib.util
import json
import os
import re
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch


FLOW = Path(__file__).resolve().parents[1] / "skills" / "requirement-flow" / "flow.py"


spec = importlib.util.spec_from_file_location("flow_project_test_module", FLOW)
flow = importlib.util.module_from_spec(spec)
spec.loader.exec_module(flow)


class ProjectFlowTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.project = Path(self.temp.name) / "真实项目"
        self.project.mkdir()
        self.store = self.project / ".requirements"

    def command(self, *args, cwd=None, explicit=True):
        project_arg = ["--project", str(self.project)] if explicit else []
        return subprocess.run([sys.executable, str(FLOW), *project_arg, *map(str,args)],
                              cwd=cwd or self.project.parent, timeout=10, capture_output=True, text=True,
                              env={**os.environ, "PYTHONDONTWRITEBYTECODE":"1"})

    def ok(self, *args, **kwargs):
        result = self.command(*args, **kwargs)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout

    def no(self, *args):
        result = self.command(*args)
        self.assertNotEqual(result.returncode, 0)
        return result.stderr

    def test_create_in_project_and_forward(self):
        self.assertEqual(json.loads(self.ok("list")), {"active":[], "archive":[]})
        self.assertFalse(self.store.exists())
        (self.project / ".git").mkdir()
        nested = self.project / "src" / "components"
        nested.mkdir(parents=True)
        info = json.loads(self.ok("new", "scope-01", "--request", "操作失效时如何返回原门店？",
                                  "--title", "切回门店", explicit=False, cwd=nested))
        self.assertEqual(info["title"], "切回门店")
        path = self.store / "active/scope-01"
        self.assertEqual(set(p.name for p in path.iterdir()), {"model.json", "handbook.html"})
        self.assertEqual(Path(info["handbook"]), (path / "handbook.html").resolve())
        work = json.loads((path / "model.json").read_text())["work"]
        self.assertEqual((work["id"], work["kind"], work["stories"], work["contracts"]),
                         ("scope-01","实际需求",{},{}))
        self.assertEqual(work["raw_request"], "操作失效时如何返回原门店？")
        self.assertEqual(set(work["actions"]), {"A-intake"})
        queue = json.loads(self.ok("task", "scope-01", "next", "--actor", "测试"))
        self.assertEqual(queue["next"]["id"], "A-intake")
        claimed = json.loads(self.ok("task","scope-01","claim","--actor","测试","--rev","1"))
        self.assertEqual(claimed["claimed"], "A-intake")
        self.assertEqual(json.loads(self.ok("task","scope-01","context"))["currently_running"], ["A-intake"])
        self.ok("task", "scope-01", "--check")
        row, = json.loads(self.ok("list", cwd=nested, explicit=False))["active"]
        self.assertEqual((row["id"], row["revision"]), ("scope-01", 2))

    def test_delivery_plan_decision_and_evidence(self):
        self.ok("new", "return", "--request", "加载失败时可以返回门店")
        story = {"title":"失败时返回", "actor":"门店", "goal":"恢复原门店",
                 "examples":[{"id":"SC-return","given":"全国页面出错", "when":"点击返回", "then":"回到原门店"}]}
        decision = {"title":"是否保留门店", "owner":"产品", "why":"返回入口",
                    "stories":["S-return"], "options":{"yes":{"label":"保留","consequence":"按原门店返回"},
                                                      "no":{"label":"全国","consequence":"返回全国"}}}
        def action(kind, title, dependency):
            return {"title":title,"kind":kind,"stories":["S-return"],"read_stories":["S-return"],
                    "decisions":["D-return"],"contracts":[],"depends_on":[{"id":dependency}],"done":title}
        patch_data = {"stories":{"S-return":story}, "decisions":{"D-return":decision},
                      "actions":{"A-fix":action("开发","处理返回","A-intake"),
                                 "A-verify":{**action("验证","核对返回位置","A-fix"),"covers":["SC-return"]}}}
        (self.project.parent / "change.json").write_text(json.dumps(patch_data), encoding="utf-8")
        def task(*args):
            return self.ok("task","return",*args)
        def receipt(mode, key, rev, *extra):
            return task(mode,key,"--rev",str(rev),"--actor","执行人","--output","实际观察",
                        "--evidence","本次验收记录",*extra)
        task("plan","change.json","--rev","1","--why","列出恢复流程")
        receipt("finish","A-intake",2)
        task("decision","D-return","yes","--rev","3","--actor","业务负责人","--why","保持原门店")
        receipt("finish","A-fix",4)
        state = self.project / "return-state.json"
        def run_check(revision):
            checker = ("import json,sys; from pathlib import Path; "
                       "row=json.loads(Path('return-state.json').read_text()); "
                       "print(row['returned']); sys.exit(0 if row['returned']==row['entry'] else 1)")
            return self.command("task","return","verify-run","A-verify","--scenario","SC-return",
                                "--environment","隔离门店状态用例","--actor","执行人","--rev",str(revision),
                                "--",sys.executable,"-c",checker)
        state.write_text(json.dumps({"entry":"store-42","returned":"nationwide"}))
        failed = run_check(5)
        self.assertEqual(failed.returncode,1,failed.stderr)
        self.assertFalse(json.loads(failed.stdout)["passed"])
        verify = ("--level","自动化","--environment","隔离门店状态用例","--expected","恢复原门店")
        receipt("fail","A-verify",6,*verify,"--reopen","A-fix")
        self.assertEqual(json.loads(task("next"))["next"]["id"], "A-fix")
        state.write_text(json.dumps({"entry":"store-42","returned":"store-42"}))
        receipt("finish","A-fix",7)
        passed = run_check(8)
        self.assertEqual(passed.returncode,0,passed.stderr)
        self.assertTrue(json.loads(passed.stdout)["passed"])
        receipt("finish","A-verify",9)
        self.assertEqual(json.loads(task("next"))["state"], "complete")
        self.ok("archive","return")
        self.ok("task","return","--check")

    def test_init_and_migrate_through_project_entry(self):
        # Keep business rules and the user's historical tasks available after migration.
        legacy = self.project / ".moluoxixi/tasks/history/prd.md"
        legacy.parent.mkdir(parents=True)
        legacy.write_text("已存在的业务原话", encoding="utf-8")
        rules = self.project / "AGENTS.md"
        rules.write_text("保留本项目规则\n\n<!-- MOLUOXIXI:START -->\n旧入口\n<!-- MOLUOXIXI:END -->\n",
                         encoding="utf-8")
        info = json.loads(self.ok("init", "--migrate"))
        self.assertTrue(info["migrated"])
        self.assertIn("保留本项目规则", rules.read_text(encoding="utf-8"))
        self.assertEqual(legacy.read_text(encoding="utf-8"), "已存在的业务原话")
        installed = Path(info["skill"]) / "flow.py"
        self.assertTrue(installed.is_file())
        self.assertFalse(json.loads(self.ok("init", "--migrate"))["changed"])
        p = subprocess.run([sys.executable, str(installed), "new", "real", "--request", "从已安装入口接手需求"],
                           cwd=self.project, capture_output=True, text=True, timeout=10)
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertEqual([x["id"] for x in json.loads(self.ok("list"))["active"]], ["real"])

    def test_archive_preserves_bytes_and_reserves_id(self):
        self.ok("new","open","--request","在需求尚未完成时暂停")
        active = self.store / "active/open"
        data = {p.name:p.read_bytes() for p in active.iterdir()}
        self.assertIn("--allow-incomplete", self.no("archive","open"))
        self.assertTrue(active.exists())
        self.ok("archive","open","--allow-incomplete")
        self.assertFalse(active.exists())
        archived = self.store / "archive/open"
        self.assertEqual(data, {p.name:p.read_bytes() for p in archived.iterdir()})
        self.ok("archive","open")
        self.no("new","open","--request","同名需求")
        self.no("task","open","claim","--actor","甲","--rev","1")
        self.no("task","open","--workspace", active, "context")
        self.ok("task","open","context")
        self.ok("task","open","--check")
        rows = json.loads(self.ok("list"))
        self.assertEqual(rows["active"], [])
        self.assertEqual([r["id"] for r in rows["archive"]], ["open"])

    def test_archived_pair_survives_template_upgrade_but_detects_data_changes(self):
        installed = Path(json.loads(self.ok("init"))["skill"]) / "flow.py"
        self.ok("new","snapshot","--request","门店 <script> & 返回")
        self.ok("archive","snapshot","--allow-incomplete")
        archive = self.store / "archive/snapshot"
        html_path = archive / "handbook.html"
        data_path = archive / "model.json"
        original = html_path.read_text(encoding="utf-8")
        data = data_path.read_bytes()
        layout = installed.parent / "runtime/layout.html"
        with layout.open("a", encoding="utf-8") as stream:
            stream.write("\n<!-- 新版页面模板 -->")
        def installed_check():
            return subprocess.run([sys.executable, str(installed),"--project",str(self.project),
                                   "task","snapshot","--check"],text=True,capture_output=True,timeout=10)
        checked = installed_check()
        self.assertEqual(checked.returncode, 0, checked.stderr)
        self.assertIn("v1",checked.stdout)
        self.assertEqual(html_path.read_text(encoding="utf-8"), original)
        self.assertEqual(data_path.read_bytes(), data)
        self.assertEqual(set(p.name for p in archive.iterdir()), {"model.json","handbook.html"})

        model = json.loads(data)
        model["work"]["goal"] = "修改来源记录"
        data_path.write_text(json.dumps(model),encoding="utf-8")
        self.assertNotEqual(installed_check().returncode, 0)
        data_path.write_bytes(data)

        payload_changed = original.replace('"revision":1', '"revision":9', 1)
        self.assertNotEqual(payload_changed,original)
        html_path.write_text(payload_changed,encoding="utf-8")
        self.assertNotEqual(installed_check().returncode, 0)

        meta_changed = re.sub(r'(<meta name="model-sha256" content=")[a-f0-9]{64}',
                              lambda match: match[1] + "0" * 64, original)
        self.assertNotEqual(meta_changed,original)
        html_path.write_text(meta_changed,encoding="utf-8")
        self.assertNotEqual(installed_check().returncode, 0)
        self.assertEqual(html_path.read_text(encoding="utf-8"),meta_changed)

    def test_research_can_finish_and_archive(self):
        self.ok("new", "research", "--outcome", "research", "--request", "确认可用契约")
        self.ok("task","research","finish","A-intake","--actor","研究员","--rev","1",
                "--output","已核对字段","--evidence","项目内既有接口定义")
        item, = json.loads(self.ok("list"))["active"]
        self.assertEqual((item["state"],item["outcome"]), ("complete","research"))
        self.ok("archive","research")

    def test_archive_lock_allows_progress_and_other_archives(self):
        self.ok("new", "live", "--request", "服务打开时可继续推进")
        self.ok("new", "other", "--request", "其他需求可独立归档")
        with flow.project_lock(self.store, "live"):
            self.ok("task", "live", "claim", "--rev","1", "--actor","开发")
            self.assertIn("正在使用", self.no("archive", "live", "--allow-incomplete"))
            self.ok("archive", "other", "--allow-incomplete")
        self.ok("archive","live","--allow-incomplete")
        self.assertFalse(flow.lock_path(self.store, "live").is_relative_to(self.project))

    def test_windows_lock_requests_shared_or_exclusive_byte(self):
        # Exercise the flags and byte range on every host. OS contention is covered above.
        kernel = Mock()
        kernel.LockFileEx.return_value = 1
        kernel.UnlockFileEx.return_value = 1
        crt = Mock()
        crt.get_osfhandle.return_value = 44
        with patch.dict(sys.modules, {"msvcrt":crt}), patch("ctypes.WinDLL",return_value=kernel,create=True):
            with open(Path(self.temp.name) / "lock-test","w+b") as stream:
                for exclusive, immediate, flags in ((False,False,0), (True,False,2), (True,True,3)):
                    with flow.windows_lock(stream, exclusive, immediate):
                        self.assertEqual(kernel.LockFileEx.call_args.args[:5], (44,flags,0,1,0))
                    self.assertEqual(kernel.UnlockFileEx.call_args.args[:4], (44,0,1,0))
                kernel.LockFileEx.return_value = 0
                with patch("ctypes.get_last_error",return_value=33,create=True), self.assertRaises(BlockingIOError):
                    with flow.windows_lock(stream, True, True):
                        self.fail("相互冲突的归档不应取得锁")

    def test_id_and_concurrent_create(self):
        for bad in ("../escape", ".", "/absolute", "a/b", "NuL", "COM1"):
            self.no("new", bad, "--request","不能离开项目数据目录")
        self.ok("new", "全国范围-01", "--request", "中文 ID 需求")
        self.ok("archive", "全国范围-01", "--allow-incomplete")
        contenders = [("new","same","--request",f"并发-{i}") for i in range(2)]
        with concurrent.futures.ThreadPoolExecutor(2) as pool:
            results = list(pool.map(lambda args: self.command(*args), contenders))
        self.assertEqual(sum(r.returncode == 0 for r in results), 1)
        self.assertEqual([r["id"] for r in json.loads(self.ok("list"))["active"]], ["same"])

    def test_task_cannot_redirect_to_other_project(self):
        self.ok("new", "alpha", "--request", "本项目范围")
        self.no("task","alpha","--workspace", self.project.parent,"context")
        self.no("task","alpha","new",self.project.parent / "escape","--request","失效参数")
        outside = self.project.parent / "outside"
        outside.mkdir()
        try:
            (self.store / "active/redirect").symlink_to(outside, target_is_directory=True)
        except OSError as error:
            self.skipTest(f"该环境无法创建测试用符号链接：{error}")
        self.no("new","redirect","--request","不能写入符号链接目标")
        self.no("task","redirect","claim","--rev","1")
        self.assertEqual(list(outside.iterdir()), [])


if __name__ == "__main__":
    unittest.main()
