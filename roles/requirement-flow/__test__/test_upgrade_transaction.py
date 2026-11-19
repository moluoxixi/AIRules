"""Upgrade pages describe final installed inputs; failed renders undo the whole upgrade."""
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import unittest
from unittest.mock import patch

import test_code_inputs
import test_flow
import test_knowledge_flow
from test_install import snapshot

sys.path.insert(0, str(test_code_inputs.SKILL))
import install_project


class UpgradeTransactionTest(unittest.TestCase):
    def fixture(self, kind):
        case = kind()
        case.setUp()
        self.addCleanup(case.doCleanups)
        return case

    def release(self, root, version=None):
        source = root / "release/skills/requirement-flow"
        shutil.copytree(test_code_inputs.SKILL.parent, source.parent)
        theme = source / "runtime/theme.css"
        theme.write_bytes(theme.read_bytes() + b"\n/* upgraded theme */\n")
        installer = source / "install_project.py"
        text = installer.read_text(encoding="utf-8")
        if version is None:
            major, minor, patch_version = map(int, install_project.ROLE_VERSION.split("."))
            version = f"{major}.{minor}.{patch_version + 1}"
        installer.write_text(re.sub(r'ROLE_VERSION = "[\d.]+"', f'ROLE_VERSION = "{version}"', text), encoding="utf-8")
        return source

    def test_upgraded_project_copy_keeps_pages_portable_and_live_packets_local(self):
        for paths in (None, ["business.py", "check.py"]):
            with self.subTest(code_paths=paths):
                case = self.fixture(test_code_inputs.CodeInputsTest)
                previous = self.release(case.base, version="0.9.0")
                installed = case.project / ".agents/skills/requirement-flow/flow.py"

                def run(root, *args, flow=None):
                    script = flow or root / ".agents/skills/requirement-flow/flow.py"
                    result = subprocess.run([sys.executable, "-B", str(script), "--project", str(root), *map(str,args)],
                                            cwd=root, capture_output=True, text=True, timeout=30)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    return result.stdout

                run(case.project, "init", flow=previous / "flow.py")
                with patch.object(test_code_inputs, "FLOW", installed):
                    case.prepare(paths)
                    case.collect()
                task = case.project / ".requirements/active/save"
                protected = {p.relative_to(task):p.read_bytes() for p in [task / "model.json", *(task / "evidence").rglob("*")]
                             if p.is_file()}
                run(case.project, "upgrade", flow=test_code_inputs.FLOW)
                manifest = json.loads((case.project / ".requirements/installation.json").read_bytes())
                self.assertEqual(manifest["role_version"], install_project.ROLE_VERSION)
                page = (task / "handbook.html").read_bytes()
                payload = json.loads(re.search(rb'<script type="application/json" id="data">(.+?)</script>', page).group(1))
                self.assertEqual(payload["queue"]["next"]["code_paths"], paths)
                self.assertEqual({name:(task / name).read_bytes() for name in protected}, protected)

                peer = case.base / "copied-project"
                shutil.copytree(case.project, peer)
                copied_task = peer / ".requirements/active/save"
                # No sync/render is allowed between the copy and this exact-byte check.
                run(peer, "task", "save", "--check")
                self.assertNotIn("verification_project_root", payload["queue"]["next"])
                self.assertEqual((copied_task / "handbook.html").read_bytes(), page)
                self.assertEqual({name:(copied_task / name).read_bytes() for name in protected}, protected)
                queue = json.loads(run(peer, "task", "save", "next"))
                self.assertEqual(queue["next"]["code_paths"], paths)
                self.assertEqual(queue["next"]["verification_project_root"], str(peer))
                claimed = json.loads(run(peer, "task", "save", "claim", "--actor", "tester", "--rev", queue["revision"]))
                self.assertEqual(claimed["claimed"], "A-check")
                self.assertEqual(claimed["next"]["code_paths"], paths)
                self.assertEqual(claimed["next"]["verification_project_root"], str(peer))
                run(peer, "task", "save", "--check")

    def test_stale_missing_attachment_page_remains_identical_after_copy(self):
        case = self.fixture(test_code_inputs.CodeInputsTest)
        case.cli("init")
        installed = case.project / ".agents/skills/requirement-flow/flow.py"
        with patch.object(test_code_inputs, "FLOW", installed):
            case.prepare(["business.py", "check.py"])
            case.complete()
            task = case.project / ".requirements/active/save"
            model = (task / "model.json").read_bytes()
            event = next(e for e in json.loads(model)["work"]["events"] if e["kind"] == "evidence")
            (task / event["receipt"]["artifact"]["path"]).unlink()
            case.cli("task", "save")
            before = case.queue()
            self.assertEqual(before["scenarios"][0]["status"], "stale")
            self.assertNotIn(str(case.project), before["scenarios"][0]["reason"])
            self.assertIn(str(Path(".requirements/active/save/evidence")), before["scenarios"][0]["reason"])
            page = (task / "handbook.html").read_bytes()
            peer = case.base / "copied-project"
            shutil.copytree(case.project, peer)
        with patch.object(test_code_inputs, "FLOW", peer / ".agents/skills/requirement-flow/flow.py"):
            case.cli("task", "save", "--check", project=peer)
            after = case.queue(peer)
        self.assertEqual(after["scenarios"], before["scenarios"])
        self.assertEqual((peer / ".requirements/active/save/handbook.html").read_bytes(), page)
        self.assertEqual((peer / ".requirements/active/save/model.json").read_bytes(), model)
        self.assertEqual((task / "model.json").read_bytes(), model)

    def test_dynamic_diagnostics_handle_windows_raw_and_oserror_paths(self):
        project = r"C:\Users\tester\项目"
        filename = project + r"\.requirements\active\save\evidence\output.log"
        for error in (ValueError("证据文件不存在：" + filename), FileNotFoundError(2, "missing file", filename)):
            with self.subTest(error_type=type(error).__name__):
                original = str(error)
                message = test_code_inputs.sync.local_diagnostic(error, project)
                self.assertNotIn("C:", message)
                self.assertIn(".requirements", message)
                self.assertIn("output.log", message)
                self.assertEqual(str(error), original)
        for root in (project, "/tmp/project"):
            for error in (ValueError("无法定位 Git 目录：" + root), FileNotFoundError(2, "missing directory", root)):
                message = test_code_inputs.sync.local_diagnostic(error, root)
                self.assertNotIn(root, message)
                self.assertNotIn(repr(root)[1:-1], message)
                self.assertIn(".", message)
            outside = ValueError("outside: " + root + "-neighbor/missing")
            self.assertEqual(test_code_inputs.sync.local_diagnostic(outside, root), str(outside))

    def test_broken_git_directory_diagnostic_remains_identical_after_copy(self):
        case = self.fixture(test_code_inputs.CodeInputsTest)
        case.cli("init")
        case.init_git()
        installed = case.project / ".agents/skills/requirement-flow/flow.py"
        with patch.object(test_code_inputs, "FLOW", installed):
            case.prepare(["business.py", "check.py"])
            case.complete()
            task = case.project / ".requirements/active/save"
            model = (task / "model.json").read_bytes()
            (case.project / ".git").rename(case.project / ".requirements/original-git")
            (case.project / ".git").write_text("gitdir: missing-git\n", encoding="utf-8")
            case.cli("task", "save")
            before = case.queue()
            self.assertEqual(before["scenarios"][0]["status"], "stale")
            self.assertIn("无法定位本项目共享的 Git 目录：.", before["scenarios"][0]["reason"])
            peer = case.base / "copied-project"
            shutil.copytree(case.project, peer)
        with patch.object(test_code_inputs, "FLOW", peer / ".agents/skills/requirement-flow/flow.py"):
            case.cli("task", "save", "--check", project=peer)
            self.assertEqual(case.queue(peer)["scenarios"], before["scenarios"])
        self.assertEqual((peer / ".requirements/active/save/handbook.html").read_bytes(), (task / "handbook.html").read_bytes())
        self.assertEqual((peer / ".requirements/active/save/model.json").read_bytes(), model)

    def test_signed_collection_error_keeps_original_text_after_code_restore_and_copy(self):
        case = self.fixture(test_code_inputs.CodeInputsTest)
        case.cli("init")
        with (case.project / ".gitignore").open("a", encoding="utf-8") as ignored:
            ignored.write("app/\n")
        case.init_git()
        child = case.project / "app"
        child.mkdir()
        (child / "code.py").write_text("value = 1\n", encoding="utf-8")
        case.git("init", "-q", project=child)
        case.git("add", ".", project=child)
        case.git("commit", "-qm", "child code", project=child)
        installed = case.project / ".agents/skills/requirement-flow/flow.py"
        with patch.object(test_code_inputs, "FLOW", installed):
            case.prepare()
            command = [sys.executable, "-B", "-c",
                       "from pathlib import Path; Path('app/.git').rename('.requirements/app-git'); "
                       "Path('app/.git').write_text('gitdir: missing-git\\n'); print('assertion output')"]
            case.collect(argv=command, ok=False)
            task = case.project / ".requirements/active/save"
            model = (task / "model.json").read_bytes()
            protected = {path.relative_to(task):path.read_bytes() for path in (task / "evidence").rglob("*") if path.is_file()}
            event = next(e for e in json.loads(model)["work"]["events"] if e["kind"] == "evidence")
            original_error = event["receipt"]["code_inputs_error"]
            self.assertFalse(event["receipt"]["code_inputs_unchanged"])
            self.assertIn(str(child), original_error)
            (child / ".git").unlink()
            (case.project / ".requirements/app-git").rename(child / ".git")
            case.cli("task", "save")
            before = case.queue()
            self.assertEqual(before["scenarios"][0]["status"], "stale")
            peer = case.base / "copied-project"
            shutil.copytree(case.project, peer)
        with patch.object(test_code_inputs, "FLOW", peer / ".agents/skills/requirement-flow/flow.py"):
            case.cli("task", "save", "--check", project=peer)
            self.assertEqual(case.queue(peer)["scenarios"], before["scenarios"])
        self.assertEqual(before["scenarios"][0]["reason"], original_error)
        copied_task = peer / ".requirements/active/save"
        self.assertEqual((copied_task / "handbook.html").read_bytes(), (task / "handbook.html").read_bytes())
        self.assertEqual((copied_task / "model.json").read_bytes(), model)
        self.assertEqual((task / "model.json").read_bytes(), model)
        for folder in (task, copied_task):
            self.assertEqual({path:(folder / path).read_bytes() for path in protected}, protected)

    def test_corrupt_retirement_diagnostic_remains_portable_and_preserves_records(self):
        case = self.fixture(test_code_inputs.CodeInputsTest)
        project = test_knowledge_flow.Project(case.project)
        project.prepare_review()
        project.review()
        source, lesson = test_knowledge_flow.SOURCE, test_knowledge_flow.LESSON
        retirement = project.root / '.requirements/knowledge/retired' / source / lesson / '1.json'
        retirement.parent.mkdir(parents=True)
        retirement.write_text('{}', encoding='utf-8')
        task = project.root / '.requirements/active' / source
        model = (task / 'model.json').read_bytes()
        project.cli('task', source)
        before = project.next(source)['lesson_cards']
        self.assertEqual(before[0]['state'], 'stale')
        self.assertNotIn(str(project.root), before[0]['issues'][0])
        page = (task / 'handbook.html').read_bytes()
        peer = case.base / 'copied-project'
        shutil.copytree(project.root, peer)
        copied = test_knowledge_flow.Project(peer, installed=True)
        copied.cli('task', source, '--check')
        self.assertEqual(copied.next(source)['lesson_cards'], before)
        self.assertEqual((peer / '.requirements/active' / source / 'handbook.html').read_bytes(), page)
        self.assertEqual((peer / '.requirements/active' / source / 'model.json').read_bytes(), model)
        self.assertEqual((task / 'model.json').read_bytes(), model)
        self.assertEqual(retirement.read_text(encoding='utf-8'), '{}')

    def test_portable_map_ignores_local_memory_index_but_live_dispatch_and_context_use_it(self):
        case = self.fixture(test_code_inputs.CodeInputsTest)
        case.prepare()
        task = case.project / ".requirements/active/save"
        engine = test_code_inputs.sync
        model = engine.load(task / "model.json")
        with patch.object(engine.knowledge, "memory_hits", side_effect=AssertionError("local index is not portable")):
            engine.render(model, workspace=task)
            engine.dispatch(model["work"], workspace=task, for_map=True)
        with patch.object(engine.knowledge, "memory_hits", return_value={}) as hits:
            engine.dispatch(model["work"], workspace=task)
            self.assertTrue(hits.called)
            hits.reset_mock()
            engine.context(model, workspace=task)
            self.assertTrue(hits.called)

    def test_cli_upgrade_renders_against_final_code_and_noop_staging_is_not_code(self):
        case = self.fixture(test_code_inputs.CodeInputsTest)
        case.cli("init")
        case.init_git()
        interrupted_stage = case.project / ".requirements/.install-interrupted"
        interrupted_stage.mkdir()
        staged_asset = interrupted_stage / "new-0"
        staged_asset.write_text("temporary installation bytes", encoding="utf-8")
        staged_path = staged_asset.relative_to(case.project).as_posix().encode("utf-8") + b"\0"
        ignored = subprocess.run(["git", "-C", str(case.project), "check-ignore", "-z", "--stdin"],
                                 input=staged_path, capture_output=True, timeout=10)
        self.assertEqual(ignored.returncode, 0, ignored.stderr)
        self.assertEqual(ignored.stdout, staged_path)
        shutil.rmtree(interrupted_stage)
        case.prepare()
        case.complete()
        model = case.project / ".requirements/active/save/model.json"
        original_model = model.read_bytes()
        case.cli("upgrade")
        self.assertEqual(case.queue()["state"], "complete")
        source = self.release(case.base)
        result = subprocess.run([sys.executable, "-B", str(source / "flow.py"), "--project", str(case.project), "upgrade"],
                                capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stderr)
        page = (model.parent / "handbook.html").read_text(encoding="utf-8")
        payload = json.loads(re.search(r'<script type="application/json" id="data">(.+?)</script>', page).group(1))
        live = case.queue()
        self.assertEqual(live["scenarios"][0]["status"], "stale")
        self.assertEqual(payload["queue"]["scenarios"], live["scenarios"])
        self.assertEqual(model.read_bytes(), original_model)
        self.assertIn("upgraded theme", page)
        self.assertFalse(list((case.project / ".requirements").glob(".install-*")))

    def test_late_page_render_failure_restores_assets_pages_and_directory_set(self):
        case = self.fixture(test_flow.ProjectFlowTest)
        case.ok("init")
        for key in ("a", "b"):
            case.ok("new", key, "--request", "保留原始需求")
            case.ok("task", key)
            (case.store / "active" / key / "handbook.html").write_bytes(b"prior handbook")
        original = snapshot(case.project)
        source = self.release(case.project.parent)
        flow = test_flow.flow
        render = flow.engine.render
        calls = []

        def fail_second(model, **kwargs):
            calls.append(model["work"]["id"])
            self.assertEqual((case.project / ".agents/skills/requirement-flow/runtime/theme.css").read_bytes(),
                             (source / "runtime/theme.css").read_bytes())
            if len(calls) == 2:
                self.assertNotEqual((case.store / "active/a/handbook.html").read_bytes(), b"prior handbook")
                raise OSError("second handbook could not be rendered")
            return render(model, **kwargs)

        with patch.object(install_project, "SOURCE", source), patch.object(flow.engine, "render", side_effect=fail_second):
            with self.assertRaisesRegex(OSError, "second handbook"):
                flow.upgrade(case.project)
        self.assertEqual(calls, ["a", "b"])
        self.assertEqual(snapshot(case.project), original)
        self.assertFalse(list(case.store.glob(".install-*")))

    def test_failed_initial_install_removes_new_metadata_parent(self):
        case = self.fixture(test_flow.ProjectFlowTest)
        original = snapshot(case.project)

        def fail_after_assets():
            raise OSError("derived output failed")

        with self.assertRaisesRegex(OSError, "derived output"):
            install_project.install_locked(case.project, False, after_apply=fail_after_assets)
        self.assertEqual(snapshot(case.project), original)
        self.assertFalse(case.store.exists())


if __name__ == "__main__":
    unittest.main()
