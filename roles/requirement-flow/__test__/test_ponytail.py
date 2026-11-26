"""Exercise the official-plugin boundary without installing plugins or calling a model."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
SCRIPT = Path(__file__).resolve().parents[1] / "skills/requirement-flow/scripts/ponytail.py"
SPEC = importlib.util.spec_from_file_location("rf_ponytail", SCRIPT)
ponytail = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ponytail)

# A small implementation of the three upstream APIs is the integration fixture.
# It lets these tests observe real Node config writes without touching user settings.
CONFIG = """const fs=require('fs'), path=require('path');
const p=path.join(process.env.XDG_CONFIG_HOME, 'ponytail/config.json');
function read(){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch(_){return {}}}
module.exports={getConfigPath:()=>p,
getDefaultMode:()=>process.env.PONYTAIL_DEFAULT_MODE || read().defaultMode || 'full',
writeDefaultMode:m=>{let c=read();c.defaultMode=m;fs.mkdirSync(path.dirname(p),{recursive:true});
fs.writeFileSync(p,JSON.stringify(c));return m}};
"""
SERVER = """import json,sys,time
if sys.argv[3]=='hang': time.sleep(60)
for line in sys.stdin:
    request=json.loads(line)
    with open(sys.argv[1],'a',encoding='utf-8') as log: log.write(json.dumps(request)+'\\n')
    if request['method']=='initialize':
        print(json.dumps({'method':'notice'}),flush=True)
        print(json.dumps({'id':request['id'],'result':{}}),flush=True)
    elif request['method']=='hooks/list':
        print(json.dumps({'id':request['id'],'result':json.loads(sys.argv[2])}),flush=True)
    elif request['method']!='initialized': raise RuntimeError('Unexpected/model/trust RPC')
"""


class PonytailTest(unittest.TestCase):
    def setUp(self):
        if not shutil.which("node"):
            self.skipTest("Node is required by the official Ponytail configuration API")
        temporary = tempfile.TemporaryDirectory(prefix="rf-ponytail-", dir=os.environ.get("AIRULES_TEST_TMPDIR"))
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.codex_home = self.root / "codex-home"
        self.project = self.root / "project"
        self.project.mkdir()
        self.plugin = {"pluginId": "ponytail@ponytail", "name": "ponytail", "marketplaceName": "ponytail",
                       "version": "5.3.3", "installed": True, "enabled": True,
                       "source": {"source": "git", "url": "https://github.com/DietrichGebert/ponytail.git", "ref": "main"}}
        self.plugin_installed = True
        self.cache = self.codex_home / "plugins/cache/ponytail/ponytail/5.3.3"
        (self.cache / ".codex-plugin").mkdir(parents=True)
        (self.cache / "hooks").mkdir()
        self.manifest = self.cache / ".codex-plugin/plugin.json"
        self.manifest.write_text(json.dumps({"name": "ponytail", "version": "5.3.3",
                                            "repository": "https://github.com/DietrichGebert/ponytail",
                                            "hooks": "hooks/native.json"}), encoding="utf-8")
        (self.cache / "hooks/native.json").write_text(json.dumps({"hooks": {name: [{}] for name in ("SessionStart", "UserPromptSubmit", "SubagentStart")}}), encoding="utf-8")
        (self.cache / "hooks/ponytail-config.js").write_text(CONFIG, encoding="utf-8")
        self.config = self.root / "xdg/ponytail/config.json"
        self.config.parent.mkdir(parents=True)
        self.config.write_text(json.dumps({"defaultMode": "lite", "quietStartup": True, "other": {"keep": 1}}), encoding="utf-8")
        self.session = self.codex_home / "existing-session-mode.json"
        self.session.write_text('{"mode":"ultra"}', encoding="utf-8")
        self.environment = dict(os.environ, XDG_CONFIG_HOME=str(self.root / "xdg"))
        self.environment.pop("PONYTAIL_DEFAULT_MODE", None)
        self.environment.pop("CODEX_HOME", None)
        self.metadata = {"data": [{"cwd": str(self.project), "hooks": [
            {"pluginId": "ponytail@ponytail", "eventName": name, "enabled": True,
             "trustStatus": "trusted", "currentHash": "native-hash-" + name} for name in ("sessionStart", "userPromptSubmit", "subagentStart")], "warnings": [], "errors": []}]}
        self.commands, self.processes = [], []
        self.requests = self.root / "rpc-requests.jsonl"
        self.server_mode = "normal"
        self.list_timeout = False
        self.transport = types.SimpleNamespace(run=self.native, Popen=self.spawn,
                                              PIPE=subprocess.PIPE, DEVNULL=subprocess.DEVNULL,
                                              TimeoutExpired=subprocess.TimeoutExpired)

    def tearDown(self):
        for process in self.processes:
            self.assertIsNotNone(process.poll(), "The helper left its app-server process running")

    def native(self, command, **kwargs):
        self.commands.append((command, dict(kwargs["env"])))
        self.assertEqual(kwargs["env"].get("HOME"), self.environment.get("HOME"))
        self.assertEqual(kwargs["env"].get("CODEX_HOME"), str(self.codex_home))
        if command[0] == "node":
            return subprocess.run(command, **kwargs)
        self.assertEqual(command[0], "codex")
        if command[1:] == ["plugin", "list", "--json", "--marketplace", "ponytail"]:
            if self.list_timeout:
                raise subprocess.TimeoutExpired(command, kwargs["timeout"])
            content = {"installed": [self.plugin] if self.plugin_installed else [], "available": []}
            return subprocess.CompletedProcess(command, 0, json.dumps(content), "")
        if command[1:] == ["plugin", "marketplace", "add", "DietrichGebert/ponytail"]:
            return subprocess.CompletedProcess(command, 0, "", "")
        self.assertEqual(command[1:], ["plugin", "add", "ponytail@ponytail"])
        self.plugin_installed = True
        return subprocess.CompletedProcess(command, 0, "", "")

    def spawn(self, command, **kwargs):
        self.assertEqual(command, ["codex", "app-server", "--stdio"])
        self.assertEqual(kwargs["env"].get("HOME"), self.environment.get("HOME"))
        self.assertEqual(kwargs["env"].get("CODEX_HOME"), str(self.codex_home))
        process = subprocess.Popen([sys.executable, "-u", "-c", SERVER, str(self.requests),
                                    json.dumps(self.metadata), self.server_mode], **kwargs)
        self.processes.append(process)
        return process

    def cli(self, operation="setup", *options, explicit_home=True):
        output = io.StringIO()
        with patch.dict(os.environ, self.environment, clear=True), patch.object(ponytail, "subprocess", self.transport), contextlib.redirect_stdout(output):
            home = ["--codex-home", str(self.codex_home)] if explicit_home else []
            code = ponytail.main([operation, *home, "--cwd", str(self.project), *options])
        return code, json.loads(output.getvalue())

    def test_inherited_relative_codex_home_keeps_same_cache_for_rpc_in_another_cwd(self):
        self.environment["CODEX_HOME"] = os.path.relpath(self.codex_home, Path.cwd())
        code, report = self.cli("doctor", "--default", "lite", explicit_home=False)
        self.assertEqual(code, 0, report)
        self.assertEqual(report["codex_home"], str(self.codex_home))

    def test_setup_reuses_official_plugin_preserves_settings_and_explicit_session_mode(self):
        for _ in range(2):
            code, report = self.cli()
            self.assertEqual(code, 0, report)
            self.assertTrue(report["configuration_ready"])
            self.assertFalse(report["fresh_session_verified"])
            self.assertNotIn("business_pass", report)
        self.assertEqual(json.loads(self.config.read_text()), {"defaultMode": "full", "quietStartup": True, "other": {"keep": 1}})
        self.assertEqual(self.session.read_text(), '{"mode":"ultra"}')
        self.assertFalse(any(command[0:3] == ["codex", "plugin", "add"] for command, _ in self.commands))
        self.assertFalse(any("marketplace" in command and "add" in command for command, _ in self.commands))

    def test_missing_plugin_uses_only_official_native_install_commands(self):
        self.plugin_installed = False
        code, report = self.cli()
        self.assertEqual(code, 0, report)
        actions = [command for command, _ in self.commands if command[:2] == ["codex", "plugin"]]
        self.assertEqual(actions, [
            ["codex", "plugin", "list", "--json", "--marketplace", "ponytail"],
            ["codex", "plugin", "marketplace", "add", "DietrichGebert/ponytail"],
            ["codex", "plugin", "add", "ponytail@ponytail"],
            ["codex", "plugin", "list", "--json", "--marketplace", "ponytail"]])

    def test_doctor_reports_missing_plugin_without_installing(self):
        self.plugin_installed = False
        before = self.config.read_bytes()
        code, report = self.cli("doctor")
        self.assertEqual(code, 1)
        self.assertEqual(report["plugin"]["status"], "missing")
        self.assertEqual(self.config.read_bytes(), before)
        self.assertEqual(len(self.commands), 1)
        self.assertFalse(self.processes)

    def test_nonofficial_source_is_rejected_before_loading_code_or_changing_settings(self):
        self.plugin["source"]["url"] = "https://github.com/someone/ponytail.git"
        before = self.config.read_bytes()
        code, report = self.cli()
        self.assertEqual(code, 1)
        self.assertIn("official", " ".join(report["problems"]))
        self.assertEqual(self.config.read_bytes(), before)
        self.assertEqual(len(self.commands), 1)

    def test_cached_native_manifest_must_match_the_official_plugin(self):
        data = json.loads(self.manifest.read_text())
        data["repository"] = "https://github.com/someone/fork"
        self.manifest.write_text(json.dumps(data), encoding="utf-8")
        code, report = self.cli()
        self.assertEqual(code, 1)
        self.assertIn("manifest", " ".join(report["problems"]))
        self.assertEqual(len(self.commands), 1)

    def test_disabled_official_plugin_is_preserved_and_reported(self):
        self.plugin["enabled"] = False
        before = self.config.read_bytes()
        code, report = self.cli()
        self.assertEqual(code, 1)
        self.assertEqual(report["plugin"]["status"], "installed")
        self.assertFalse(report["plugin"]["enabled"])
        self.assertEqual(self.config.read_bytes(), before)
        self.assertEqual(len(self.commands), 1)

    def test_environment_override_is_not_removed_or_mistaken_for_full(self):
        self.environment["PONYTAIL_DEFAULT_MODE"] = "lite"
        code, report = self.cli()
        self.assertEqual(code, 1)
        self.assertEqual(report["default_mode"]["effective"], "lite")
        self.assertFalse(report["default_mode"]["matches"])
        self.assertEqual(json.loads(self.config.read_text())["defaultMode"], "full")
        self.assertEqual(self.environment["PONYTAIL_DEFAULT_MODE"], "lite")

    def test_doctor_does_not_rewrite_the_shared_default(self):
        before = self.config.read_bytes()
        code, report = self.cli("doctor")
        self.assertEqual(code, 1)
        self.assertEqual(report["default_mode"]["effective"], "lite")
        self.assertEqual(self.config.read_bytes(), before)
        self.assertEqual(report["hooks"]["status"], "trusted")

    def test_invalid_existing_config_is_preserved(self):
        self.config.write_bytes(b'{"keep": unfinished')
        code, report = self.cli()
        self.assertEqual(code, 1)
        self.assertFalse(report["configuration_ready"])
        self.assertEqual(self.config.read_bytes(), b'{"keep": unfinished')

    def test_untrusted_modified_or_disabled_hooks_require_native_review(self):
        for status, enabled in (("untrusted", True), ("modified", True), ("trusted", False)):
            with self.subTest(status=status, enabled=enabled):
                self.metadata["data"][0]["hooks"][0].update(trustStatus=status, enabled=enabled)
                code, report = self.cli()
                self.assertEqual(code, 1)
                self.assertEqual(report["hooks"]["status"], "review_required")
                self.assertIn("/hooks", " ".join(report["problems"]))

    def test_missing_lifecycle_hook_cannot_pass(self):
        self.metadata["data"][0]["hooks"].pop()
        code, report = self.cli()
        self.assertEqual(code, 1)
        self.assertEqual(report["hooks"]["missing_events"], ["subagentStart"])

    def test_native_loading_errors_block_ready_even_with_three_trusted_hooks(self):
        error = {"path": str(self.cache / "hooks/native.json"), "message": "Hook command could not be loaded"}
        self.metadata["data"][0].update(errors=[error], warnings=["Unrelated hook deprecation"])
        code, report = self.cli()
        self.assertEqual(code, 1)
        self.assertFalse(report["configuration_ready"])
        self.assertEqual(report["hooks"]["errors"], [error])
        self.assertEqual(len(report["hooks"]["events"]), 3)
        self.assertIn(error["message"], " ".join(report["problems"]))
        self.metadata["data"][0]["errors"] = []
        code, report = self.cli()
        self.assertEqual(code, 0, report)
        self.assertEqual(report["hooks"]["warnings"], ["Unrelated hook deprecation"])

    def test_metadata_inspection_never_calls_a_model_or_a_trust_write(self):
        code, report = self.cli()
        self.assertEqual(code, 0, report)
        requests = [json.loads(line) for line in self.requests.read_text().splitlines()]
        self.assertEqual([item["method"] for item in requests], ["initialize", "initialized", "hooks/list"])
        self.assertEqual(requests[-1]["params"], {"cwds": [str(self.project)]})
        self.assertEqual(requests[0]["params"]["capabilities"], {"experimentalApi": True, "requestAttestation": False})
        self.assertFalse(report["fresh_session_verified"])

    def test_hanging_app_server_is_stopped_and_reported(self):
        self.server_mode = "hang"
        code, report = self.cli("doctor", "--timeout", "0.1")
        self.assertEqual(code, 1)
        self.assertIn("timed out", " ".join(report["problems"]))
        self.assertFalse(report["fresh_session_verified"])
        self.assertTrue(self.processes)
        self.assertTrue(all(process.poll() is not None for process in self.processes))

    def test_native_command_timeout_does_not_start_app_server(self):
        self.list_timeout = True
        code, report = self.cli()
        self.assertEqual(code, 1)
        self.assertIn("timed out", " ".join(report["problems"]))
        self.assertFalse(self.processes)


if __name__ == "__main__":
    unittest.main()
