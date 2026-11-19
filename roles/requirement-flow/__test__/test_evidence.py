"""Black-box local collection, integrity, scoping and archive regressions."""
from concurrent.futures import ThreadPoolExecutor
import copy
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

RUNTIME = Path(__file__).resolve().parents[1] / "skills/requirement-flow/runtime"
sys.path.insert(0, str(RUNTIME))
import evidence


class EvidenceTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.project = Path(self.temp.name) / "真实项目"
        self.workspace = self.workspace_for("display")
        self.bind = dict(action="A-verify", scenario="S-return-error", stamp="input-hash-v1")
        self.who = dict(actor="测试人员", environment="本地隔离测试")

    def workspace_for(self, name):
        workspace = self.project / ".requirements/active" / name
        workspace.mkdir(parents=True)
        (workspace / "model.json").write_text(json.dumps({"work":{"id":name,"events":[]}}),encoding="utf-8")
        return workspace

    def command(self, *argv, workspace=None, bind=None):
        return evidence.run(workspace or self.workspace, self.project, list(argv),
                            **(bind or self.bind), **self.who)

    def check(self, receipt, workspace=None, bind=None):
        return evidence.validate(workspace or self.workspace, receipt, **(bind or self.bind))

    def observe(self, file, **extra):
        opts = {**self.bind, **self.who, "actual":"看到错误提示后，原门店仍可返回。","level":"人工核对", **extra}
        return evidence.observe(self.workspace,self.project,file,**opts)

    def test_real_command_records_argv_cwd_output_and_exit_status(self):
        literal = 'one arg; echo SHOULD_NOT_EXECUTE'
        code = "import os,sys; print(os.path.basename(os.getcwd()),sys.argv[1],flush=True); print('checked',file=sys.stderr)"
        result = self.command(sys.executable, "-c", code, literal)
        self.assertTrue(self.check(result)["passed"])
        self.assertEqual(result["argv"][-1], literal)
        self.assertEqual(result["exit_code"], 0)
        captured = evidence.artifact_path(self.workspace,result).read_bytes()
        self.assertIn(("真实项目 " + literal).encode(), captured)
        self.assertIn(b"checked", captured)
        self.assertEqual(result["artifact"]["sha256"],hashlib.sha256(captured).hexdigest())
        failed = self.command(sys.executable, "-c", "import sys; print('three failed'); sys.exit(3)")
        self.assertEqual(self.check(failed)["passed"], False)
        self.assertEqual(failed["exit_code"],3)
        self.assertIn("three failed",failed["actual"])
        self.assertFalse(failed["path"].startswith("/"))
        with self.assertRaises(ValueError):
            self.command("")
        with self.assertRaises(OSError):
            self.command(str(self.project / "does-not-exist"))

    def test_zero_exit_with_no_assertion_output_is_recorded_as_insufficient(self):
        for output in ("", " \t\n\r", "\u3000" * 3000):
            with self.subTest(bytes=len(output.encode("utf-8"))):
                code = f"import sys; sys.stdout.buffer.write({output.encode('utf-8')!r})"
                result = self.command(sys.executable,"-c",code)
                self.assertFalse(self.check(result)["passed"])
                self.assertEqual(result["exit_code"],0)
                self.assertEqual(result["argv"],[sys.executable,"-c",code])
                self.assertEqual(evidence.artifact_path(self.workspace,result).read_bytes(),output.encode("utf-8"))
                self.assertIn("断言",result["actual"])
        # Whitespace may occupy more than one preview block before the real result.
        checked = self.command(sys.executable,"-c","assert 1 + 1 == 2; print(' ' * 9000 + '1 assertion passed')")
        self.assertTrue(self.check(checked)["passed"])
        self.assertIn("1 assertion passed",checked["actual"])

    def test_text_and_modified_or_fabricated_json_are_insufficient(self):
        result = self.command(sys.executable, "-c", "print('verified')")
        with self.assertRaises(ValueError):
            self.check("所有测试均通过")
        forged = dict(result, actual="伪造成功")
        with self.assertRaises(ValueError):
            self.check(forged)
        manifest = self.workspace / result["path"]
        original = manifest.read_bytes()
        envelope = json.loads(original)
        envelope["receipt"] = forged
        # Matching JSON, artifact and unkeyed digest still do not constitute an issued receipt.
        envelope["signature"] = hashlib.sha256(evidence.canonical(forged)).hexdigest()
        manifest.write_text(json.dumps(envelope),encoding="utf-8")
        with self.assertRaises(ValueError):
            self.check(forged)
        manifest.write_bytes(original)
        attachment = evidence.artifact_path(self.workspace,result)
        attachment.write_bytes(b"changed!")
        with self.assertRaises(ValueError):
            self.check(result)
        attachment.unlink()
        with self.assertRaises(ValueError):
            self.check(result)

    def test_observation_survives_source_removal_and_archive(self):
        observed = self.project / "观察报告.txt"
        observed.write_text("错误页仍可返回原门店",encoding="utf-8")
        data = observed.read_bytes()
        result = self.observe(observed, passed=False)
        self.assertFalse(self.check(result)["passed"])
        self.assertEqual(result["actor"],"测试人员")
        self.assertEqual(result["environment"],"本地隔离测试")
        observed.unlink()
        archived = self.project / ".requirements/archive/display"
        archived.parent.mkdir()
        self.workspace.rename(archived)
        self.check(result, workspace=archived)
        self.assertEqual(evidence.artifact_path(archived,result).read_bytes(), data)

    def test_bindings_do_not_cross_task_action_scenario_or_stamp(self):
        result = self.command(sys.executable, "-c", "print('checked')")
        for key in self.bind:
            with self.subTest(field=key), self.assertRaises(ValueError):
                self.check(result, bind={**self.bind,key:"another"})
        other = self.workspace_for("different")
        self.command(sys.executable, "-c", "print('second task')", workspace=other)
        shutil.copytree((self.workspace / result["path"]).parent,(other / result["path"]).parent)
        with self.assertRaises(ValueError):
            self.check(result,workspace=other)
        with self.assertRaises(ValueError):
            self.check({**result,"path":"../../elsewhere/receipt.json"})
        forged = copy.deepcopy(result)
        forged["artifact"]["path"] = "../../secrets"
        with self.assertRaises(ValueError):
            evidence.artifact_path(self.workspace,forged)

    def test_observations_require_real_file_and_vetted_scope(self):
        observed = self.project / "observation.txt"
        with self.assertRaises(ValueError):
            self.observe("missing.txt")
        observed.touch()
        with self.assertRaises(ValueError):
            self.observe(observed)
        observed.write_text("真实原始报告",encoding="utf-8")
        for key in ("actor","actual","environment"):
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.observe(observed, **{key:"  "})
        with self.assertRaises(ValueError):
            self.observe(observed,level="自动化")
        with self.assertRaises(ValueError):
            self.observe("../seen.txt")
        external = self.project.parent / "outside.txt"
        external.write_text("private",encoding="utf-8")
        with self.assertRaises(ValueError):
            self.observe(external)
        with self.assertRaises(ValueError):
            self.observe(self.workspace / "model.json")

    def test_symlinks_cannot_replace_manual_inputs_or_receipt_files(self):
        source = self.project / "source.txt"
        source.write_text("source",encoding="utf-8")
        alias = self.project / "alias.txt"
        try:
            alias.symlink_to(source)
        except OSError as exc:
            self.skipTest(f"symlink unavailable on this host: {exc}")
        with self.assertRaises(ValueError):
            self.observe(alias)
        result = self.observe(source)
        archived = evidence.artifact_path(self.workspace,result)
        archived.unlink()
        archived.symlink_to(source)
        with self.assertRaises(ValueError):
            self.check(result)

    def test_concurrent_collection_and_conflict_cleanup(self):
        def collect(name):
            return self.command(sys.executable,"-c","print('done')",bind={**self.bind,"scenario":name})
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(collect,["one","two","three","four"]))
        for receipt in results:
            self.check(receipt,bind={**self.bind,"scenario":receipt["scenario"]})
        self.assertTrue(evidence.discard(self.workspace,results[0]))
        self.assertFalse((self.workspace / results[0]["path"]).parent.exists())
        model_path = self.workspace / "model.json"
        model = json.loads(model_path.read_bytes())
        model["work"]["events"].append({"receipt":results[1]})
        model_path.write_text(json.dumps(model),encoding="utf-8")
        self.assertFalse(evidence.discard(self.workspace,results[1]))
        self.check(results[1],bind={**self.bind,"scenario":results[1]["scenario"]})


if __name__ == "__main__":
    unittest.main()
