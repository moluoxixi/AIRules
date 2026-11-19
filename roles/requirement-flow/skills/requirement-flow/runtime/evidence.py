"""Capture and check local verification artifacts, independent of the renderer."""
import codecs
from datetime import datetime, timezone
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
import time


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


def local_key(root, *, create=False):
    path = root / ".receipt-key"
    if create:
        try:
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError:
            pass
        else:
            with os.fdopen(fd, "wb") as stream:
                stream.write(secrets.token_bytes(32))
                stream.flush()
                os.fsync(stream.fileno())
    # Another collector may be creating the same task's first key.
    for _ in range(30):
        key = regular(path).read_bytes()
        if len(key) == 32:
            return key
        if key:
            break
        time.sleep(0.01)
    raise ValueError("本任务的证据校验密钥不完整")


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


def log_excerpt(path):
    decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
    with regular(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(8192), b""):
            text = decoder.decode(chunk).strip()
            if text:
                return text[:1536]
        return decoder.decode(b"", final=True).strip()


def run(workspace, project_root, argv, *, action, scenario, stamp, actor, environment):
    """Run the explicit argv from the project, preserving merged stdout/stderr and exit status."""
    project = directory(project_root)
    require(isinstance(argv, (list,tuple)) and argv and isinstance(argv[0],str) and argv[0].strip()
            and all(isinstance(arg,str) and "\0" not in arg for arg in argv), "命令必须是完整的 argv 数组")
    if os.name == "nt":
        executable = shutil.which(argv[0]) or argv[0]
        require(Path(executable).suffix.lower() not in (".bat",".cmd"), "请直接指定可执行文件，避免隐式命令解释器")
    receipt = binding(workspace, action, scenario, stamp, actor, environment)
    root = storage(workspace, create=True)
    with tempfile.TemporaryDirectory(prefix=".capture-", dir=root) as temp:
        staged = Path(temp) / "record"
        staged.mkdir()
        log = staged / "output.log"
        with log.open("wb") as stream:
            result = subprocess.run(list(argv), cwd=project, shell=False, stdin=subprocess.DEVNULL,
                                    stdout=stream, stderr=subprocess.STDOUT, check=False)
        preview = log_excerpt(log)
        actual = f"命令退出码 {result.returncode}"
        if preview:
            actual += "\n" + preview
        elif result.returncode == 0:
            actual += "，日志为空或仅含空白。请运行会输出断言结果的验证命令。"
        receipt.update(kind="run", level="自动化", passed=result.returncode == 0 and bool(preview), actual=actual,
                       exit_code=result.returncode, argv=list(argv), cwd=str(project))
        return publish(root, staged, receipt, "output.log")


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


def observe(workspace, project_root, artifact, *, action, scenario, stamp, actor, actual, environment, level, passed=True):
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
        receipt.update(kind="observe", level=level, passed=passed, actual=actual, exit_code=None, source=relative)
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
            effective = receipt["exit_code"] == 0 and bool(log_excerpt(file))
            require(receipt["passed"] == effective, "命令退出码、实际日志与记录的结果不一致")
        else:
            require(size > 0 and receipt["actual"].strip(), "观察附件或观察结果缺失")
        return receipt
    except (OSError, KeyError, TypeError, UnicodeError) as exc:
        raise ValueError("证据回执或附件无法核验：" + str(exc)) from exc


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
