"""Capture and check local verification artifacts, independent of the renderer."""
import codecs
from datetime import datetime, timezone
from functools import lru_cache
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import stat
import subprocess
import tempfile
import unicodedata

try:
    from . import code_inputs, run_result
except ImportError:
    import code_inputs
    import run_result


def require(value, message):
    if not value:
        raise ValueError(message)


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, allow_nan=False,
                      separators=(",", ":")).encode("utf-8")


def checked_text(value, name):
    require(isinstance(value, str) and value.strip(), name + "不能为空")
    return value


def linked(path):
    try:
        info = path.lstat()
    except FileNotFoundError:
        return False
    return stat.S_ISLNK(info.st_mode) or bool(getattr(info, "st_file_attributes", 0) & 0x400)


def directory(path):
    path = Path(path)
    require(not linked(path) and path.is_dir(), f"无效的本地目录：{path}")
    return path.resolve()


def regular(path):
    require(not linked(path) and path.is_file(), f"证据文件缺失或不是普通文件：{path}")
    return path


def storage(workspace, *, create=False):
    root = directory(workspace) / "evidence"
    if create and not linked(root):
        root.mkdir(mode=0o700, exist_ok=True)
    return directory(root)


@lru_cache(maxsize=64)
def git_common_dir(project):
    # Ignore Git variables inherited from the caller's own repository or hooks.
    env = {name: value for name, value in os.environ.items() if not name.startswith("GIT_")}
    result = subprocess.run(["git", "--git-dir=.git", "rev-parse", "--git-common-dir"],
                            cwd=project, env=env, capture_output=True)
    require(result.returncode == 0, f"无法定位本项目共享的 Git 目录：{project}")
    return directory(project / os.fsdecode(result.stdout.rstrip(b"\r\n")))


def shared_key_path(root):
    task = root.parent
    bucket = task.parent
    project = bucket.parent.parent
    if root.name != "evidence" or bucket.name not in ("active", "archive") or bucket.parent.name != ".requirements":
        return None
    # An independently initialized project nested inside a different repository keeps its own evidence.
    marker = project / ".git"
    require(not linked(marker), f"Git 入口不能是符号链接：{marker}")
    if not marker.exists():
        return None
    ident = unicodedata.normalize("NFC", task.name).encode("utf-8")
    return git_common_dir(project) / "airules-requirement-flow-keys" / hashlib.sha256(ident).hexdigest()


def read_key(path):
    flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0)
    with os.fdopen(os.open(regular(path), flags), "rb") as stream:
        key = stream.read(33)
    require(len(key) == 32, "本任务的证据校验密钥不完整")
    return key


def key_at(path, *, create=False, expected=None):
    if create or expected is not None:
        path.parent.mkdir(mode=0o700, exist_ok=True)
    directory(path.parent)
    if not path.exists() and not linked(path):
        require(create or expected is not None, "缺少本任务的证据校验密钥")
        fd, tmp = tempfile.mkstemp(prefix=".receipt-key-", dir=path.parent)
        try:
            with os.fdopen(fd, "wb") as stream:
                stream.write(expected if expected is not None else secrets.token_bytes(32))
                stream.flush()
                os.fsync(stream.fileno())
            try:
                # Publish complete bytes without replacing a concurrent winner's key.
                os.link(tmp, path)
            except FileExistsError:
                pass
        finally:
            os.unlink(tmp)
    key = read_key(path)
    require(expected is None or hmac.compare_digest(key, expected),
            "同一需求已有另一份证据校验密钥，请核对需求来源")
    return key


def import_worktree_key(root, source):
    """Adopt a trusted legacy task key in this repository's private Git metadata."""
    root = directory(root)
    target = shared_key_path(root)
    require(target is not None, "目标应属于已启用需求编排的 Git 工作区")
    expected = read_key(Path(source))
    legacy = root / ".receipt-key"
    if legacy.exists() or linked(legacy):
        require(hmac.compare_digest(expected, read_key(legacy)), "目标工作区的旧密钥与导入来源冲突")
    key_at(target, expected=expected)


def local_key(root, *, create=False):
    legacy = root / ".receipt-key"
    shared = shared_key_path(root)
    target = shared or legacy
    previous = read_key(legacy) if shared and (legacy.exists() or linked(legacy)) else None
    if create and previous is None and not target.exists() and any(root.glob("*/receipt.json")):
        require(target.exists(), "已有回执缺少原始密钥，请先恢复本任务的证据校验密钥")
    return key_at(target, create=create, expected=previous)


def hash_file(path):
    checksum = hashlib.sha256()
    size = 0
    with regular(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            size += len(chunk)
            checksum.update(chunk)
    return size, checksum.hexdigest()


def binding(workspace, action, scenario, stamp, actor, environment):
    output = {key:checked_text(value, key) for key, value in (
        ("action",action), ("scenario",scenario), ("stamp",stamp), ("actor",actor),
        ("environment",environment))}
    model_file = directory(workspace) / "model.json"
    task_id = json.loads(regular(model_file).read_text(encoding="utf-8"))["work"]["id"]
    output.update(task=checked_text(task_id, "需求 ID"), version=1, id=secrets.token_hex(16))
    return output


def publish(root, staged, receipt, filename):
    rid = receipt["id"]
    size, checksum = hash_file(staged / filename)
    receipt.update(path=f"evidence/{rid}/receipt.json",
                   artifact={"path":f"evidence/{rid}/{filename}","size":size,"sha256":checksum},
                   created_at=datetime.now(timezone.utc).isoformat(timespec="seconds"))
    signature = hmac.new(local_key(root, create=True), canonical(receipt), hashlib.sha256).hexdigest()
    (staged / "receipt.json").write_bytes(canonical({"receipt":receipt,"signature":signature}) + b"\n")
    target = root / rid
    require(not target.exists() and not linked(target), "证据编号冲突")
    staged.rename(target)
    return receipt


def stream_excerpt(stream):
    stream.seek(0)
    decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
    for chunk in iter(lambda: stream.read(8192), b""):
        text = decoder.decode(chunk).strip()
        if text:
            return text[:1536]
    return decoder.decode(b"", final=True).strip()


def log_excerpt(path):
    with regular(path).open("rb") as stream:
        return stream_excerpt(stream)


def run(workspace, project_root, argv, *, action, scenario, stamp, actor, environment, code_paths=None,
        share_output=False):
    """Execute the user's argv unchanged and publish only the selected evidence audience."""
    project = directory(project_root)
    require(isinstance(argv, (list,tuple)) and argv and isinstance(argv[0],str) and argv[0].strip()
            and all(isinstance(arg,str) and "\0" not in arg for arg in argv), "命令必须是完整的 argv 数组")
    if os.name == "nt":
        executable = shutil.which(argv[0]) or argv[0]
        require(Path(executable).suffix.lower() not in (".bat",".cmd"), "请直接指定可执行文件，避免隐式命令解释器")
    receipt = binding(workspace, action, scenario, stamp, actor, environment)
    receipt["code_inputs"] = code_inputs.snapshot(project, code_paths)
    root = storage(workspace, create=True)
    # One-way, task-keyed identity allows failure grouping without storing private arguments.
    receipt["command_id"] = hmac.new(local_key(root, create=True), b"argv\0" + canonical(argv), hashlib.sha256).hexdigest()
    with tempfile.TemporaryDirectory(prefix=".capture-", dir=root) as temp:
        staged = Path(temp) / "record"
        staged.mkdir()
        log = staged / "output.log"
        # Raw output never touches the evidence directory until explicitly approved for sharing.
        with tempfile.TemporaryFile() as raw:
            result = subprocess.run(list(argv), cwd=project, shell=False, stdin=subprocess.DEVNULL,
                                    stdout=raw, stderr=subprocess.STDOUT, check=False)
            preview = stream_excerpt(raw)
            tests = run_result.test_summary(raw)
            shared = share_output and run_result.can_share(argv, raw)
            actual = run_result.summary_text(result.returncode, bool(preview), tests)
            if shared:
                raw.seek(0)
                with log.open("wb") as target:
                    shutil.copyfileobj(raw, target)
                if preview:
                    actual += "\n" + preview
            else:
                if share_output:
                    actual += "\n检测到敏感参数或输出，仅保留运行摘要。"
                log.write_text(actual + "\n", encoding="utf-8")
            receipt.update(argv=list(argv) if shared else None, cwd=".", output_shared=shared,
                           has_output=bool(preview), tests=tests, summary_policy=run_result.SUMMARY_POLICY)
        unchanged, change_reason = check_after_capture(project, receipt["code_inputs"], code_paths)
        if not unchanged:
            actual += "\n" + change_reason
        passed = result.returncode == 0 and bool(preview) and not run_result.insufficient_tests(tests) and unchanged
        receipt.update(kind="run", level="自动化", passed=passed, actual=actual,
                       code_inputs_unchanged=unchanged, code_inputs_error=change_reason, exit_code=result.returncode)
        return publish(root, staged, receipt, "output.log")


def check_after_capture(project_root, inputs, code_paths):
    try:
        code_inputs.verify_current(project_root, inputs, code_paths)
    except (OSError, ValueError) as exc:
        return False, "采集期间代码输入发生变化或无法复核：" + str(exc)
    return True, ""


def validate_current_inputs(receipt, project_root, code_paths=None, *, cache=None, workspace=None):
    """Check freshness separately, so historical signed attachments remain readable."""
    if workspace is not None and receipt["kind"] == "run" and receipt["passed"] and "has_output" not in receipt:
        key = ("legacy-test-summary", Path(workspace), receipt["id"], receipt["artifact"]["sha256"])
        if cache is None or key not in cache:
            with artifact_path(workspace, receipt).open("rb") as log:
                issue = run_result.insufficient_tests(run_result.test_summary(log))
            if cache is not None:
                cache[key] = issue
        else:
            issue = cache[key]
        require(not issue, "旧回执需要重新验收：" + issue)
    if (receipt["kind"] == "run" and receipt["passed"] and "has_output" in receipt
            and receipt.get("summary_policy") != run_result.SUMMARY_POLICY):
        require(receipt.get("output_shared") and workspace is not None,
                "摘要采集规则已更新，旧回执原日志未共享或无法复核，请重新采集。")
        key = ("summary-policy", Path(workspace), receipt["id"], receipt["artifact"]["sha256"], run_result.SUMMARY_POLICY)
        if cache is None or key not in cache:
            with artifact_path(workspace, receipt).open("rb") as log:
                issue = run_result.insufficient_tests(run_result.test_summary(log))
            if cache is not None:
                cache[key] = issue
        else:
            issue = cache[key]
        require(not issue, "旧回执需要重新验收：" + issue)
    code_inputs.verify_current(project_root, receipt.get("code_inputs"), code_paths, cache=cache)
    require(receipt.get("code_inputs_unchanged") is True,
            receipt.get("code_inputs_error") or "采集期间代码输入未保持一致，请重新验收")
    return receipt


def observation_source(project, artifact, alias):
    raw = Path(artifact)
    require(".." not in raw.parts, "证据路径不得回溯父目录")
    path = raw if raw.is_absolute() else project / raw
    try:
        relative = path.relative_to(project)
    except ValueError:
        try:
            relative = path.relative_to(alias)
        except ValueError:
            raise ValueError("观察附件须来自指定项目目录") from None
    require(relative.parts and not any(p.casefold() in (".git",".requirements") for p in relative.parts),
            "请选取实际截图或报告，不能将项目管理文件作为新证据")
    current = project
    for part in relative.parts:
        current /= part
        require(not linked(current), "观察附件不能通过符号链接访问")
    return regular(current), relative.as_posix()


def observe(workspace, project_root, artifact, *, action, scenario, stamp, actor, actual, environment, level, passed=True,
            code_paths=None):
    """Archive the observer's actual file and statement. A file does not establish its own meaning."""
    require(level in ("人工核对","真实环境"), "人工观察证据类型无效")
    require(type(passed) is bool, "观察结果必须明确为通过或失败")
    checked_text(actual, "实际观察")
    project = directory(project_root)
    source, relative = observation_source(project, artifact, Path(project_root).absolute())
    workspace_dir = directory(workspace)
    if workspace_dir in source.parents:
        parts = source.relative_to(workspace_dir).parts
        require(parts[0] not in ("evidence","model.json","handbook.html",".workflow.lock"),
                "不能将当前需求的数据或历史回执作为新观察附件")
    receipt = binding(workspace, action, scenario, stamp, actor, environment)
    receipt["code_inputs"] = code_inputs.snapshot(project, code_paths)
    root = storage(workspace, create=True)
    suffix = source.suffix.lower()
    filename = "artifact" + (suffix if re.fullmatch(r"\.[a-z0-9]{1,12}",suffix) else ".bin")
    with tempfile.TemporaryDirectory(prefix=".capture-",dir=root) as temp:
        staged = Path(temp) / "record"
        staged.mkdir()
        flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0)
        with os.fdopen(os.open(source, flags), "rb") as stream, (staged / filename).open("wb") as target:
            before = os.fstat(stream.fileno())
            require(stat.S_ISREG(before.st_mode) and before.st_size > 0, "观察附件必须是非空普通文件")
            shutil.copyfileobj(stream,target)
            after = os.fstat(stream.fileno())
            require(before.st_size == after.st_size and before.st_mtime_ns == after.st_mtime_ns
                    and target.tell() == before.st_size, "采集期间观察附件发生变化")
        unchanged, change_reason = check_after_capture(project, receipt["code_inputs"], code_paths)
        if not unchanged:
            actual += "\n" + change_reason
        receipt.update(kind="observe", level=level, passed=passed and unchanged, actual=actual, exit_code=None, source=relative,
                       code_inputs_unchanged=unchanged, code_inputs_error=change_reason)
        return publish(root, staged, receipt, filename)


def receipt_location(root, receipt):
    require(isinstance(receipt,dict), "缺少结构化证据回执")
    rid = receipt.get("id")
    require(isinstance(rid,str) and re.fullmatch(r"[0-9a-f]{32}",rid), "证据 ID 无效")
    require(receipt.get("path") == f"evidence/{rid}/receipt.json", "证据回执路径无效")
    return directory(root / rid)


def artifact_path(workspace, receipt):
    root = receipt_location(storage(workspace), receipt)
    artifact = receipt.get("artifact")
    require(isinstance(artifact,dict) and isinstance(artifact.get("path"),str), "证据附件信息缺失")
    name = artifact["path"].split("/")[-1]
    expected = r"output\.log" if receipt.get("kind") == "run" else r"artifact\.[a-z0-9]{1,12}"
    require(re.fullmatch(expected,name) and artifact["path"] == f"evidence/{root.name}/{name}", "证据附件路径无效")
    return regular(root / name)


def validate(workspace, receipt, *, action, scenario, stamp):
    """Return the checked receipt; a valid failed observation still has passed=False."""
    try:
        root = storage(workspace)
        location = receipt_location(root,receipt)
        envelope = json.loads(regular(location / "receipt.json").read_text(encoding="utf-8"))
        expected = canonical(receipt)
        require(isinstance(envelope,dict) and canonical(envelope.get("receipt")) == expected,
                "回执内容与采集记录不一致")
        signature = hmac.new(local_key(root), expected, hashlib.sha256).hexdigest()
        require(isinstance(envelope.get("signature"),str) and hmac.compare_digest(signature,envelope["signature"]),
                "证据回执校验码无效")
        task = json.loads(regular(directory(workspace) / "model.json").read_text(encoding="utf-8"))["work"]["id"]
        require((receipt["task"],receipt["action"],receipt["scenario"],receipt["stamp"]) == (task,action,scenario,stamp),
                "证据属于其他需求、动作、场景或已修订的输入")
        file = artifact_path(workspace,receipt)
        size, checksum = hash_file(file)
        artifact = receipt["artifact"]
        require(size == artifact["size"] and checksum == artifact["sha256"], "证据附件大小或 SHA-256 不匹配")
        require(receipt["kind"] in ("run","observe") and type(receipt["passed"]) is bool, "证据结果无效")
        if receipt["kind"] == "run":
            require(type(receipt["exit_code"]) is int, "命令退出码无效")
            if "has_output" in receipt:
                require(type(receipt["has_output"]) is bool and type(receipt.get("output_shared")) is bool,
                        "缺少命令输出采集结果")
                if receipt["output_shared"]:
                    with file.open("rb") as stream:
                        # Historical envelopes are authenticated under their original
                        # policy; current acceptance separately rescans their raw log.
                        if receipt.get("summary_policy") == run_result.SUMMARY_POLICY:
                            require(receipt.get("tests") == run_result.test_summary(stream), "测试摘要与日志不符")
                        require(receipt["has_output"] == bool(stream_excerpt(stream)), "测试摘要与日志不符")
                effective = (receipt["exit_code"] == 0 and receipt["has_output"]
                             and not run_result.insufficient_tests(receipt["tests"]))
            else:
                # Historical signatures were issued under the earlier policy. Keep them readable;
                # current acceptance additionally checks whether any tests actually ran.
                effective = receipt["exit_code"] == 0 and bool(log_excerpt(file))
            if "code_inputs" in receipt:
                require(type(receipt.get("code_inputs_unchanged")) is bool, "缺少代码输入采集结果")
                effective = effective and receipt["code_inputs_unchanged"]
            require(receipt["passed"] == effective, "命令退出码、实际日志与记录的结果不一致")
        else:
            require(size > 0 and receipt["actual"].strip(), "观察附件或观察结果缺失")
        return receipt
    except (OSError, KeyError, TypeError, UnicodeError) as exc:
        raise ValueError("证据回执或附件无法核验：" + str(exc)) from exc


def bind_collected_event(workspace, receipt, stamp):
    """Bind this freshly authenticated, unpublished event to its final ledger position under the task lock."""
    root = storage(workspace)
    location = receipt_location(root, receipt)
    bound = dict(receipt, stamp=stamp)
    signature = hmac.new(local_key(root), canonical(bound), hashlib.sha256).hexdigest()
    fd, temporary = tempfile.mkstemp(dir=location)
    try:
        with os.fdopen(fd, "wb") as staged:
            staged.write(canonical({"receipt": bound, "signature": signature}) + b"\n")
        os.replace(temporary, location / "receipt.json")
    finally:
        Path(temporary).unlink(missing_ok=True)
    receipt.update(stamp=stamp)


def discard(workspace, receipt):
    """Remove this acquisition after a rejected write, keeping any already-referenced proof."""
    validate(workspace,receipt,action=receipt["action"],scenario=receipt["scenario"],stamp=receipt["stamp"])
    model = json.loads(regular(directory(workspace) / "model.json").read_text(encoding="utf-8"))
    if receipt["path"].encode("ascii") in canonical(model):
        return False
    location = receipt_location(storage(workspace),receipt)
    artifact_path(workspace,receipt).unlink()
    (location / "receipt.json").unlink()
    location.rmdir()
    return True
