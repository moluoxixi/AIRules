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
from test_install import snapshot

sys.path.insert(0, str(test_code_inputs.SKILL))
import install_project


class UpgradeTransactionTest(unittest.TestCase):
    def fixture(self, kind):
        case = kind()
        case.setUp()
        self.addCleanup(case.doCleanups)
        return case

    def release(self, root):
        source = root / "release/skills/requirement-flow"
        shutil.copytree(test_code_inputs.SKILL.parent, source.parent)
        theme = source / "runtime/theme.css"
        theme.write_bytes(theme.read_bytes() + b"\n/* upgraded theme */\n")
        installer = source / "install_project.py"
        text = installer.read_text(encoding="utf-8")
        installer.write_text(re.sub(r'ROLE_VERSION = "[\d.]+"', 'ROLE_VERSION = "0.9.1"', text), encoding="utf-8")
        return source

    def test_cli_upgrade_renders_against_final_code_and_noop_staging_is_not_code(self):
        case = self.fixture(test_code_inputs.CodeInputsTest)
        case.cli("init")
        case.init_git()
        interrupted_stage = case.project / ".requirements/.install-interrupted"
        interrupted_stage.mkdir()
        staged_asset = interrupted_stage / "new-0"
        staged_asset.write_text("temporary installation bytes", encoding="utf-8")
        self.assertEqual(case.git("check-ignore", str(staged_asset)), str(staged_asset))
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
