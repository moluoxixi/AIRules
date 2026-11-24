#!/usr/bin/env python3
"""Install the AIRules requirement-flow project skill and migrate Codex entry points."""
import argparse
from contextlib import contextmanager, ExitStack
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import sys
import tempfile

SOURCE = Path(__file__).resolve().parent
sys.dont_write_bytecode = True
sys.path.insert(0, str(SOURCE))
sys.path.insert(0, str(SOURCE / "runtime"))
from evidence import linked

SKILLS = Path(".agents/skills")
ROLE = "requirement-flow"
ROLE_VERSION = "0.11.1"
SPECIALISTS = ("flow-requirements", "flow-contracts", "flow-implement", "flow-verify", "flow-review")
SKILL = SKILLS / ROLE
MANIFEST = Path(".requirements/installation.json")
IGNORE = Path(".requirements/.gitignore")
ATTRIBUTES = Path(".requirements/.gitattributes")
EVIDENCE_ATTRIBUTES = (b"active/*/evidence/** -text", b"archive/*/evidence/** -text")
LOCAL_PATTERNS = (b".receipt-key", b".receipt-key-*", b".workflow.lock", b".capture-*/", b".install-*/", b".model.json.*", b".handbook.html.*", b".basic-memory/")
ARCHIVE = Path(".requirements/migrations/moluoxixi")
ROOT_FILES = {"SKILL.md", "flow.py", "install_project.py", "references/model.md", "agents/openai.yaml"}
TEXT_SUFFIXES = {".md", ".py", ".html", ".js", ".css", ".json", ".yaml"}
RUNTIME_FILES = {"basic_memory.py", "catalog-landscape.jpg", "catalog-landscape-night.jpg", "catalog.html", "catalog_server.py", "code_inputs.py", "dagre.min.js", "evidence.py", "graph-ink-wash.png", "graph_view.py", "knowledge.py", "lesson_retirement.py",
                 "layout.html", "map.js", "protocol.json", "run_result.py", "source_paths.py", "story_scope.py", "sync.py", "task_locations.py", "theme.css", "theme.js", "tooltip.js"}
LEGACY_SKILLS = {
    "before-dev", "brainstorm", "break-loop", "channel", "check", "continue", "finish-work",
    "knowledge", "meta", "session-insight", "spec-bootstrap", "start", "update-spec",
}
LEGACY_AGENTS = {"check", "implement", "research"}
LEGACY_SKILL_DIRS = (".agents/skills", ".codex/skills")
HOOK_FILES = {"inject-workflow-state.py", "inject-subagent-context.py", "session-start.py"}
# Unmodified Codex config from AIRules' Moluoxixi role. Mixed project settings stay in place.
LEGACY_CONFIG_SHA256 = "47f8e045d9b1b001b0729a1a86a24f9f269d837df70a46c8bf773ac89cbce3b1"
MARK = "REQUIREMENT-FLOW"
BLOCK = """<!-- REQUIREMENT-FLOW:START -->
## 需求全景图

收到新需求，或需要梳理、开发、验证、继续已有需求时，使用项目 skill `.agents/skills/requirement-flow/SKILL.md`。先用项目内的 `flow.py list` 查看已有需求。围绕用户当前授权的功能点推进，把接口、关键处理和验证证据写入该需求。人读页面和 AI 记录均在 `.requirements/` 下。
<!-- REQUIREMENT-FLOW:END -->"""


def require(ok, message):
    if not ok:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def append_git_rules(root, relative, rules):
    current = read_file(safe_path(root, relative)) or b""
    missing = [rule for rule in rules if rule not in current.splitlines()]
    if missing:
        newline = b"\r\n" if b"\r\n" in current else b"\n"
        separator = newline if current and not current.endswith(b"\n") else b""
        return current + separator + newline.join(missing) + newline


def normalized_text(data):
    return data.replace(b"\r\n", b"\n")


def matches_digest(data, expected, *, text):
    if digest(data) == expected:
        return True
    if not text:
        return False
    normalized = normalized_text(data)
    # Older manifests stored the checkout's raw LF or CRLF bytes.
    return digest(normalized) == expected or digest(normalized.replace(b"\n", b"\r\n")) == expected


def safe_path(root, relative):
    path = root
    for part in Path(relative).parts:
        require(part not in ("..", ".", "") and not Path(part).is_absolute(), f"无效安装路径：{relative}")
        path = path / part
        require(not linked(path), f"安装路径不能经过符号链接或目录联接：{path}")
    return path


def read_file(path):
    if not path.exists():
        return None
    require(path.is_file(), f"预期文件：{path}")
    return path.read_bytes()


def owned_name(name):
    path = PurePosixPath(name)
    if len(path.parts) < 2 or path.as_posix() != name:
        return False
    role, relative = path.parts[0], "/".join(path.parts[1:])
    if role in SPECIALISTS:
        return relative == "SKILL.md"
    if role != ROLE:
        return False
    # Accept old runtime names from a previous manifest so an upgrade can retire them.
    return (relative in ROOT_FILES or (len(path.parts) == 3 and path.parts[1] == "runtime"
            and re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9._-]*", path.name)))


def assets():
    names = {name for name in ROOT_FILES if (SOURCE / name).exists()}
    mandatory = {"SKILL.md", "flow.py", "install_project.py"} | {"runtime/" + name for name in RUNTIME_FILES}
    missing = sorted(name for name in mandatory if not safe_path(SOURCE, name).is_file())
    require(not missing, f"发布资源缺失：{missing}")
    names.update(mandatory)
    contents = {f"{ROLE}/{name}": safe_path(SOURCE, name).read_bytes() for name in sorted(names)}
    for skill in SPECIALISTS:
        name = f"{skill}/SKILL.md"
        path = safe_path(SOURCE.parent, name)
        require(path.is_file(), f"缺少专项 skill：{name}。请从完整的 AIRules requirement-flow 角色执行初始化。")
        contents[name] = path.read_bytes()
    return contents


def marked(text, tag):
    begin, end = f"<!-- {tag}:START -->", f"<!-- {tag}:END -->"
    if begin not in text and end not in text:
        return None
    require(text.count(begin) == text.count(end) == 1 and text.index(begin) < text.index(end),
            f"AGENTS.md 内 {tag} 边界不完整或重复")
    return text[text.index(begin):text.index(end) + len(end)]


def identified_command(command, root):
    if not isinstance(command, str):
        return False
    targets = {".codex/hooks/" + name for name in HOOK_FILES}
    targets.add(".moluoxixi/scripts/knowledge-hook.py")
    normalized = command.replace("\\", "/")
    if not any(t in normalized for t in targets):
        require(".moluoxixi/" not in normalized and "--airules-knowledge-hook" not in normalized,
                f"发现未识别的旧 hook，请核对：{command}")
        return False
    try:
        words = shlex.split(normalized)
    except ValueError as exc:
        raise ValueError(f"请核对旧 hook 的命令格式：{command}") from exc
    parsed = [s.removeprefix("./") for s in words]
    require(bool(parsed) and re.fullmatch(r"(?:python(?:3(?:\.\d+)?)?|py)(?:\.exe)?", parsed[0].split("/")[-1], re.I),
            f"发现自定义旧 hook 启动方式，请核对：{command}")
    require(not re.search(r"[;&|<>`$\n]", normalized), f"发现复合旧 hook，请核对：{command}")
    args = parsed[1:]
    if args[:2] == ["-X", "utf8"]:
        args = args[2:]
    require(bool(args) and args[0] in targets, f"发现自定义旧 hook 参数，请核对：{command}")
    if args[0].startswith(".codex/"):
        require(len(args) == 1, f"发现自定义旧 hook 参数，请核对：{command}")
        script = read_file(safe_path(root, args[0]))
        require(script is None or b"moluoxixi" in script.lower(), f"同名 hook 归属不明确：{args[0]}")
    else:
        require("--airules-knowledge-hook" in args and "--platform" in args and "codex" in args,
                f"知识库 hook 归属不明确：{command}")
    return True


def filter_hooks(raw, root):
    data = json.loads(raw)
    require(isinstance(data, dict), ".codex/hooks.json 应为对象")
    events = data.get("hooks", {})
    require(isinstance(events, dict), ".codex/hooks.json 的 hooks 应为对象")
    changed = False
    for event, groups in list(events.items()):
        require(isinstance(groups, list), f"未知的 Codex hooks 结构：{event}")
        remaining = []
        for group in groups:
            require(isinstance(group, dict) and isinstance(group.get("hooks"), list),
                    f"未知的 Codex hook 组：{event}")
            handlers = []
            removed = False
            for hook in group["hooks"]:
                require(isinstance(hook, dict), f"未知的 Codex hook 记录：{event}")
                if hook.get("type", "command") == "command" and identified_command(hook.get("command"), root):
                    removed = changed = True
                else:
                    handlers.append(hook)
            if handlers or not removed:
                remaining.append({**group, "hooks": handlers})
        if remaining or not groups:
            events[event] = remaining
        else:
            del events[event]
    if not changed:
        return raw
    return (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode()


def migration_plan(root, text):
    paths = []
    for relative in entry_points():
        if safe_path(root, relative).exists():
            paths.append(relative)
    for name in sorted(HOOK_FILES):
        relative = Path(".codex/hooks") / name
        script = read_file(safe_path(root, relative))
        if script is not None and b"moluoxixi" in script.lower():
            paths.append(relative)
    hook_path = Path(".codex/hooks.json")
    hooks = read_file(safe_path(root, hook_path))
    filtered = filter_hooks(hooks, root) if hooks else hooks
    changed = {hook_path: filtered} if filtered != hooks else {}
    config = read_file(safe_path(root, ".codex/config.toml"))
    if config:
        active = "\n".join(line for line in config.decode().splitlines() if not line.lstrip().startswith("#"))
        require(not re.search(r"(?i)moluoxixi", active), "Codex config.toml 注册了自定义旧入口，请先核对并保留其他设置")
        if digest(config.replace(b"\r\n", b"\n")) == LEGACY_CONFIG_SHA256:
            paths.append(Path(".codex/config.toml"))
    original = text
    for tag in ("MOLUOXIXI", "MOLUOXIXI KNOWLEDGE", "AIRULES:MOLUOXIXI-ZH-COMPAT"):
        block = marked(text, tag)
        if block:
            text = text.replace(block, "", 1)
    return paths, changed, text, bool(paths or changed or text != original)


def entry_points():
    for directory in LEGACY_SKILL_DIRS:
        for name in sorted(LEGACY_SKILLS):
            yield Path(directory) / f"moluoxixi-{name}"
    for name in sorted(LEGACY_AGENTS):
        yield Path(".codex/agents") / f"moluoxixi-{name}.toml"


@contextmanager
def project_lock(root):
    # Keep a single lock across installer versions, even before .requirements exists.
    key = digest(os.fsencode(str(root)))
    name = Path(tempfile.gettempdir()) / f"airules-requirement-flow-{key}.lock"
    flags = os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0)
    with os.fdopen(os.open(name, flags, 0o600), "r+b") as handle:
        if os.name == "nt":
            import msvcrt
            if not handle.read(1):
                handle.write(b"0")
                handle.flush()
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl
            fcntl.flock(handle, fcntl.LOCK_EX)
        yield


JOURNAL = "journal.json"


def fingerprint(path):
    """Exact bytes, including directory moves; never serialize file contents."""
    require(not linked(path), f"交易路径不能是符号链接：{path}")
    if not path.exists():
        return None
    if path.is_file():
        return "f:" + digest(path.read_bytes())
    require(path.is_dir(), f"交易路径不是普通文件或目录：{path}")
    entries = [(p.relative_to(path).as_posix(), fingerprint(p)) for p in sorted(path.iterdir())]
    return "d:" + digest(json.dumps(entries, ensure_ascii=False).encode())


def journal_bytes(journal):
    return (json.dumps(journal, sort_keys=True, indent=2) + "\n").encode()


def save_journal(stage, journal):
    # Atomic replacement and fsync precede each mutation of project files.
    temporary = safe_path(stage, JOURNAL + ".tmp")
    with temporary.open("wb") as stream:
        stream.write(journal_bytes(journal))
        stream.flush()
        os.fsync(stream.fileno())
    temporary.replace(stage / JOURNAL)
    if os.name != "nt":
        descriptor = os.open(stage, os.O_RDONLY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)


def migration_sources():
    return {p.as_posix() for p in entry_points()} | {
        ".codex/hooks/" + name for name in HOOK_FILES} | {".codex/config.toml"}


def owned_target(name):
    path = PurePosixPath(name)
    if path.as_posix() != name or path.is_absolute() or ".." in path.parts:
        return False
    if path.is_relative_to(SKILLS.as_posix()):
        return owned_name(path.relative_to(SKILLS.as_posix()).as_posix())
    if name in {"AGENTS.md", MANIFEST.as_posix(), IGNORE.as_posix(), ATTRIBUTES.as_posix(), ".codex/hooks.json"}:
        return True
    if path.is_relative_to(ARCHIVE.as_posix()):
        return path.relative_to(ARCHIVE.as_posix()).as_posix() in migration_sources() | {
            "AGENTS.md", ".codex/hooks.json", "migration.json"}
    return (len(path.parts) == 4 and path.parts[:2] == (".requirements", "active")
            and path.parts[2] not in (".", "..") and not path.parts[2].startswith(".")
            and path.name == "handbook.html")


def check_journal(root, stage, journal):
    require(isinstance(journal, dict) and type(journal.get("version")) is int and journal["version"] == 1
            and journal.get("phase") in {"applying", "rolling_back", "rolled_back", "committed"}, "无法识别交易日志")
    require(all(isinstance(journal.get(key), list) for key in ("files", "moves", "directories")), "交易日志结构无效")
    paths, ancestors = set(), {".requirements"}
    def controlled(name, allowed):
        require(isinstance(name, str) and allowed(name), f"非受管交易路径：{name}")
        path = safe_path(root, name)
        require(name not in paths, f"重复交易路径：{name}")
        paths.add(name)
        ancestors.update(p.as_posix() for p in Path(name).parents if p != Path("."))
        return path
    def valid_hash(value, directory=False):
        return value is None or (isinstance(value, str) and re.fullmatch(r"[fd]:[0-9a-f]{64}" if directory else r"f:[0-9a-f]{64}", value))
    expected = {JOURNAL, JOURNAL + ".tmp"}
    for n, operation in enumerate(journal["files"]):
        require(isinstance(operation, dict) and operation.get("state") in {"preparing", "pending", "applied", "restored"},
                "无效文件交易")
        controlled(operation.get("path"), owned_target)
        require(valid_hash(operation.get("pre")) and valid_hash(operation.get("post")), "无效文件哈希")
        if operation["state"] == "preparing":
            require(operation["post"] is not None and journal["phase"] != "committed", "无效准备状态")
        expected.update({f"old-{n}", f"new-{n}"})
    for operation in journal["moves"]:
        require(isinstance(operation, dict) and operation.get("state") in {"pending", "applied", "restored"}, "无效归档交易")
        source = operation.get("source")
        controlled(source, lambda name: name in migration_sources())
        controlled(operation.get("destination"), lambda name: name == (ARCHIVE / source).as_posix())
        require(operation.get("pre") is not None and valid_hash(operation["pre"], directory=True)
                and operation.get("post") == operation["pre"], "无效归档哈希")
    for name in journal["directories"]:
        require(isinstance(name, str) and name in ancestors, f"非受管交易目录：{name}")
        directory = safe_path(root, name)
        require(not directory.exists() or directory.is_dir(), f"交易目录已被修改：{directory}")
    for entry in stage.iterdir():
        require(entry.name in expected and not linked(entry) and entry.is_file(), f"未知交易备份：{entry}")


def registration_state(post):
    return "preparing" if post is not None else "pending"


def is_next_journal(current, proposed):
    """Recognize an identical or single unpublished write of this transaction."""
    if current.keys() != proposed.keys():
        return False
    changed = [key for key in current if current[key] != proposed[key]]
    if not changed:
        return True
    if len(changed) != 1:
        return False
    field, = changed
    phase = current["phase"]
    if field == "phase":
        destination = proposed[field]
        if (phase, destination) == ("applying", "rolling_back"):
            return True
        if (phase, destination) == ("applying", "committed"):
            return all(op["state"] == "applied" for op in current["files"] + current["moves"])
        if (phase, destination) == ("rolling_back", "rolled_back"):
            return (all(op["state"] in {"restored", "preparing"} for op in current["files"])
                    and all(op["state"] == "restored" for op in current["moves"]))
        return False
    if field not in {"files", "moves", "directories"}:
        return False
    before, after = current[field], proposed[field]
    if phase == "applying" and len(after) == len(before) + 1 and after[:-1] == before:
        if field == "directories":
            return True
        state = registration_state(after[-1]["post"]) if field == "files" else "pending"
        return after[-1]["state"] == state
    if field == "directories" or len(before) != len(after):
        return False
    changes = [(old, new) for old, new in zip(before, after) if old != new]
    if len(changes) != 1:
        return False
    old, new = changes[0]
    if {**old, "state": new["state"]} != new:
        return False
    if phase == "rolling_back":
        return old["state"] in {"pending", "applied"} and new["state"] == "restored"
    return phase == "applying" and (old["state"], new["state"]) in {
        ("preparing", "pending"), ("pending", "applied")}


def check_temporary_journal(root, stage, current):
    raw = read_file(safe_path(stage, JOURNAL + ".tmp"))
    if raw is None:
        return
    try:
        proposed = json.loads(raw)
    except ValueError as exc:
        raise ValueError("未知或不完整的交易临时日志") from exc
    check_journal(root, stage, proposed)
    require(raw == journal_bytes(proposed) and is_next_journal(current, proposed),
            "交易临时日志不是本交易的下一次写入")
    # The record may claim a write or rename happened. Verify the actual
    # boundary before removing or overwriting any unpublished journal bytes.
    phase = proposed["phase"]
    for n, op in enumerate(proposed["files"]):
        if current["phase"] == phase and n < len(current["files"]) and current["files"][n] == op:
            continue
        state = file_state(root, stage, op, n, phase)
        if phase == "applying":
            require(state == ("installed" if op["state"] == "applied" else "original"),
                    f"交易临时日志与暂存文件不一致：{op['path']}")
    for n, op in enumerate(proposed["moves"]):
        if current["phase"] == phase and n < len(current["moves"]) and current["moves"][n] == op:
            continue
        installed = move_installed(root, op, phase)
        if phase == "applying":
            require(installed == (op["state"] == "applied"), f"交易临时日志与归档移动不一致：{op['source']}")
    for name in proposed["directories"][len(current["directories"]):]:
        require(not safe_path(root, name).exists(), f"交易临时日志与目录不一致：{name}")


def file_state(root, stage, operation, n, phase):
    target = safe_path(root, operation["path"])
    pre, post = operation["pre"], operation["post"]
    current, old, new = fingerprint(target), fingerprint(stage / f"old-{n}"), fingerprint(stage / f"new-{n}")
    # A registered preparation has not renamed anything. An absent or complete
    # staged file is recoverable; partial/edited bytes are deliberately ambiguous.
    if operation["state"] == "preparing":
        require(current == pre and old is None and new in (None, post), f"准备中的目标或备份已被修改：{target}")
        return "original"
    # Recognize both sides of each rename, also during an interrupted rollback.
    if phase == "committed":
        require(current == post and new is None and (old is None or old == pre), f"已提交目标或备份已被修改：{target}")
        return "installed"
    if phase == "rolled_back" or (phase == "rolling_back" and operation["state"] == "restored"):
        require(current == pre and old is None and new in (None, post), f"已恢复的目标或备份已被修改：{target}")
        return "original"
    if current == pre and old is None and new == post:
        return "original"
    if pre is not None and post is not None and old == pre and current is None and new == post:
        return "gap"
    if old == pre and current == post and new is None:
        return "installed"
    raise ValueError(f"目标已被修改、备份丢失或交易状态不确定：{target}")


def move_installed(root, operation, phase):
    src = safe_path(root, operation["source"])
    dest = safe_path(root, operation["destination"])
    before, after = fingerprint(src), fingerprint(dest)
    restored = phase == "rolled_back" or (phase == "rolling_back" and operation["state"] == "restored")
    require((before == operation["pre"] and after is None and phase != "committed")
            or (before is None and after == operation["pre"] and not restored), f"归档目标已被修改或丢失：{src}")
    return after is not None


def recover_stage(root, stage):
    """Validate the entire transaction before restoring anything; leave ambiguity intact."""
    try:
        require(not linked(stage) and stage.is_dir(), "交易 stage 必须是普通目录")
        raw = read_file(safe_path(stage, JOURNAL))
        if raw is None and not any(stage.iterdir()):
            # Only an empty shell may outlive the last cleanup rename/unlink.
            stage.rmdir()
            return {"stage": stage.name, "action": "cleaned"}
        require(raw is not None, "旧版 stage 没有 journal，需人工恢复（保留全部备份）")
        journal = json.loads(raw)
        check_journal(root, stage, journal)
        check_temporary_journal(root, stage, journal)
        phase = journal["phase"]
        states = [file_state(root, stage, op, n, phase) for n, op in enumerate(journal["files"])]
        moved = [move_installed(root, op, phase) for op in journal["moves"]]
        # Once cleanup may have removed scratch files, the completed rollback is final.
        if phase in ("applying", "rolling_back"):
            journal["phase"] = "rolling_back"
            save_journal(stage, journal)
            for n in reversed(range(len(states))):
                op = journal["files"][n]
                if op["state"] == "preparing":
                    # Nothing to undo. Keep this state so another interruption
                    # can still distinguish an absent new file from missing data.
                    continue
                target = safe_path(root, op["path"])
                if states[n] == "installed" and op["post"] is not None:
                    target.replace(stage / f"new-{n}")
                if (stage / f"old-{n}").exists():
                    (stage / f"old-{n}").replace(target)
                op["state"] = "restored"
                save_journal(stage, journal)
            for op, applied in reversed(list(zip(journal["moves"], moved))):
                if applied:
                    safe_path(root, op["destination"]).rename(safe_path(root, op["source"]))
                op["state"] = "restored"
                save_journal(stage, journal)
            journal["phase"] = "rolled_back"
            save_journal(stage, journal)
        # Keep the journal through directory cleanup too: a second interruption
        # must not leave unowned, empty skill directories blocking installation.
        if phase != "committed":
            for name in reversed(journal["directories"]):
                directory = safe_path(root, name)
                if directory.exists() and not any(directory.iterdir()):
                    directory.rmdir()
        for entry in stage.iterdir():
            if entry.name != JOURNAL:
                entry.unlink()
        (stage / JOURNAL).unlink()
        stage.rmdir()
        if phase != "committed" and ".requirements" in journal["directories"]:
            store = safe_path(root, ".requirements")
            if store.exists() and not any(store.iterdir()):
                store.rmdir()
        return {"stage": stage.name, "action": "committed" if phase == "committed" else "rolled_back"}
    except (OSError, ValueError, TypeError, KeyError) as exc:
        raise ValueError(f"安装交易恢复被拒绝；保留 stage 和备份：{stage}；{exc}") from exc


def recover_pending(root):
    # Callers hold the installation and project/store locks, just like installation.
    store = safe_path(root, ".requirements")
    require(not store.exists() or store.is_dir(), f"预期目录：{store}")
    return [recover_stage(root, stage) for stage in sorted(store.glob(".install-*"))]


def apply(root, files, moves, after_apply=None):
    """A small disk journal extends the installer's existing same-filesystem renames."""
    store = safe_path(root, ".requirements")
    created_store = not store.exists()
    if created_store:
        store.mkdir()
    require(store.is_dir(), f"预期目录：{store}")
    # No TemporaryDirectory finalizer: a failed recovery must retain the only backup.
    stage = Path(tempfile.mkdtemp(prefix=".install-", dir=store))
    journal = {"version": 1, "phase": "applying", "files": [], "moves": [],
               "directories": [".requirements"] if created_store else []}
    try:
        save_journal(stage, journal)
        changed = _apply_files(root, files, moves, after_apply, stage, journal)
    except BaseException:
        recover_stage(root, stage)
        raise
    journal["phase"] = "committed"
    save_journal(stage, journal)
    recover_stage(root, stage)
    return changed


def _apply_files(root, files, moves, after_apply, stage, journal):
    def parent(path):
        if not path.exists():
            parent(path.parent)
            journal["directories"].append(path.relative_to(root).as_posix())
            save_journal(stage, journal)
            path.mkdir()

    def prepare(relative, data):
        name = Path(relative).as_posix()
        require(owned_target(name), f"非受管安装目标：{name}")
        target = safe_path(root, relative)
        old = read_file(target)
        n = len(journal["files"])
        post = "f:" + digest(data) if data is not None else None
        operation = {"path": name, "pre": "f:" + digest(old) if old is not None else None,
                     "post": post, "state": registration_state(post)}
        # Persist ownership, target and digests before creating any staged bytes.
        journal["files"].append(operation)
        save_journal(stage, journal)
        if data is not None:
            staged = stage / f"new-{n}"
            with staged.open("wb") as stream:
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
            if target.is_file():
                os.chmod(staged, target.stat().st_mode & 0o777)
            operation["state"] = "pending"
            save_journal(stage, journal)
        return n

    def replace(n):
        operation = journal["files"][n]
        require(operation["state"] == "pending", "暂存文件尚未准备完成")
        target = safe_path(root, operation["path"])
        require(file_state(root, stage, operation, n, "applying") == "original", f"安装目标已改变：{target}")
        parent(target.parent)
        if target.exists():
            target.replace(stage / f"old-{n}")
        if operation["post"] is not None:
            (stage / f"new-{n}").replace(target)
        operation["state"] = "applied"
        save_journal(stage, journal)

    for relative, data in files.items():
        prepare(relative, data)
    for source, destination in moves:
        src, dest = safe_path(root, source), safe_path(root, destination)
        require(source.as_posix() in migration_sources() and destination == ARCHIVE / source, "非受管旧入口归档")
        require(not dest.exists(), f"旧入口归档路径已存在：{dest}")
        before = fingerprint(src)
        operation = {"source": source.as_posix(), "destination": destination.as_posix(),
                     "pre": before, "post": before, "state": "pending"}
        journal["moves"].append(operation)
        save_journal(stage, journal)
        parent(dest.parent)
        src.rename(dest)
        operation["state"] = "applied"
        save_journal(stage, journal)
    for n in range(len(files)):
        replace(n)
    changed = bool(files or moves)
    if after_apply is not None:
        for relative, data in after_apply():
            replace(prepare(relative, data))
            changed = True
    return changed


def install(project, migrate=False):
    path = Path(project).expanduser()
    require(path.is_dir() and not linked(path), f"目标应是已有的真实项目目录：{path}")
    root = path.resolve()
    from flow import engine, project_lock as store_lock, upgrade
    store = safe_path(root, ".requirements")
    with project_lock(root), store_lock(store, exclusive=True), store_lock(
            store, ".project-viewer", exclusive=True, nonblocking=True), ExitStack() as locks:
        if any(store.glob(".install-*")):
            # A missing manifest routes here instead of upgrade. Protect restored
            # pages with the same task/model locks that upgrade normally holds.
            active = safe_path(root, ".requirements/active")
            require(not active.exists() or active.is_dir(), f"预期目录：{active}")
            for path in sorted(active.iterdir()) if active.exists() else ():
                if path.name.startswith("."):
                    continue
                require(not linked(path) and path.is_dir(), f"需求目录不是普通目录：{path}")
                locks.enter_context(store_lock(store, path.name, exclusive=True, nonblocking=True))
                locks.enter_context(engine.task_lock(workspace=path))
        recovered = recover_pending(root)
        # A missing-manifest interruption can otherwise turn an upgrade into a
        # plain install and omit its derived pages. Route it back through upgrade.
        resume_upgrade = bool(recovered and safe_path(root, MANIFEST).is_file())
        if not resume_upgrade:
            result = install_locked(root, migrate)
    if resume_upgrade:
        result = upgrade(root, migrate)
    result["recovered"] = recovered + result["recovered"]
    return result


def install_locked(root, migrate, *, after_apply=None):
    recovered = recover_pending(root)
    wanted = assets()
    manifest_file = safe_path(root, MANIFEST)
    old_bytes = read_file(manifest_file)
    previous = json.loads(old_bytes) if old_bytes is not None else {}
    if old_bytes is not None:
        require(isinstance(previous, dict) and previous.get("format") in (1, 2, 3)
                and previous.get("role") == "requirement-flow" and isinstance(previous.get("files"), dict),
                f"无法识别安装清单：{MANIFEST}")
        version = previous.get("role_version")
        if previous["format"] == 3 or version is not None:
            require(isinstance(version, str) and re.fullmatch(r"\d+\.\d+\.\d+", version),
                    f"无法识别安装版本：{version}")
            require(tuple(map(int, version.split("."))) <= tuple(map(int, ROLE_VERSION.split("."))),
                    f"项目已安装 {version}，请从该版本或更新的 AIRules 执行升级。")
    tracked = previous.get("files", {})
    if previous.get("format") == 1:
        # The 0.1.0 manifest indexed files relative to the sole requirement-flow skill.
        tracked = {f"{ROLE}/{name}": value for name, value in tracked.items()}
    for skill in (ROLE, *SPECIALISTS):
        if not any(name.startswith(skill + "/") for name in tracked):
            directory = safe_path(root, SKILLS / skill)
            require(not directory.exists(), f"同名项目 skill 已存在且没有受管清单：{directory}")
    files = {}
    for name in sorted(set(tracked) | set(wanted)):
        require(isinstance(name, str) and owned_name(name), f"不支持的受管文件：{name}")
        target = SKILLS / name
        old = read_file(safe_path(root, target))
        text_asset = target.suffix in TEXT_SUFFIXES
        if name in tracked:
            require(old is not None and matches_digest(old, tracked[name], text=text_asset),
                    f"受管文件已被修改或移除：{target}")
        else:
            require(old is None, f"同名文件不受本工具管理：{target}")
        replacement = wanted.get(name)
        if text_asset and old is not None and replacement is not None and normalized_text(old) == normalized_text(replacement):
            continue
        if old != replacement:
            files[target] = replacement

    agents_path = Path("AGENTS.md")
    original = read_file(safe_path(root, agents_path))
    text = (original or b"").decode()
    old_block = marked(text, MARK)
    if previous:
        require(old_block and matches_digest(old_block.encode(), previous.get("agents_block"), text=True),
                "AGENTS.md 的受管块已被修改或移除")
    else:
        require(old_block is None, "AGENTS.md 已有同名受管块且缺少安装清单")
    legacy_root = safe_path(root, ".moluoxixi").is_dir()
    previously_migrated = bool(previous.get("migrated"))
    # Ordinary projects may have arbitrary hook schemas. Only inspect them for migration if
    # a legacy directory, marked instructions, known Codex skill/agent, or old hook is present.
    legacy_hints = any(marked(text, tag) for tag in ("MOLUOXIXI", "MOLUOXIXI KNOWLEDGE", "AIRULES:MOLUOXIXI-ZH-COMPAT"))
    if not legacy_hints:
        legacy_hints = any(safe_path(root, relative).exists() for relative in entry_points())
    hook_bytes = read_file(safe_path(root, ".codex/hooks.json")) or b""
    legacy_hints = legacy_hints or any(marker.encode() in hook_bytes for marker in
                                     (".moluoxixi/", "--airules-knowledge-hook", "inject-workflow-state.py", "inject-subagent-context.py"))
    migration = False
    moves = []
    archive = None
    if (legacy_root and not previously_migrated) or legacy_hints:
        require(migrate, "检测到旧 Moluoxixi 入口。使用 --migrate 归档这些入口并保留旧任务。")
        paths, shared, text, has_changes = migration_plan(root, text)
        migration = bool(has_changes or (legacy_root and not previously_migrated))
        if migration:
            archive = ARCHIVE
            require(not safe_path(root, archive).exists(), f"旧入口归档已存在，请核对：{archive}")
            moves = [(p, archive / p) for p in paths]
            if text != (original or b"").decode():
                files[archive / agents_path] = original
            for target, value in shared.items():
                files[archive / target] = read_file(safe_path(root, target))
                files[target] = value
            files[archive / "migration.json"] = (json.dumps({"moved": [str(p) for p in paths],
                "snapshots": [str(p.relative_to(archive)) for p in files if archive in p.parents]},
                ensure_ascii=False, indent=2) + "\n").encode()
    line_break = "\r\n" if "\r\n" in text else "\n"
    block = BLOCK.replace("\n", line_break)
    updated = (text.replace(old_block, block, 1) if old_block else
               text + ("" if not text or text.endswith(("\n", "\r")) else line_break) + block + line_break)
    if updated.encode() != original:
        files[agents_path] = updated.encode()
    for relative, rules in ((IGNORE, LOCAL_PATTERNS), (ATTRIBUTES, EVIDENCE_ATTRIBUTES)):
        updated_rules = append_git_rules(root, relative, rules)
        if updated_rules is not None:
            files[relative] = updated_rules
    # A pre-versioned installer only accepts 1/2 and must refuse to downgrade this runtime.
    file_hashes = {name: digest(normalized_text(data) if Path(name).suffix in TEXT_SUFFIXES else data)
                   for name, data in wanted.items()}
    manifest = {"format": 3, "role": ROLE, "role_version": ROLE_VERSION, "files": file_hashes,
                "agents_block": digest(normalized_text(block.encode())), "migrated": previously_migrated or migration}
    manifest_bytes = (json.dumps(manifest, sort_keys=True, indent=2) + "\n").encode()
    if old_bytes is None or manifest_bytes != normalized_text(old_bytes):
        files[MANIFEST] = manifest_bytes
    changed = apply(root, files, moves, after_apply) if files or moves or after_apply is not None else False
    return {"project": str(root), "skill": str(root / SKILL), "role_version": ROLE_VERSION, "changed": changed,
            "migrated": migration, "archive": str(root / archive) if archive else None, "recovered": recovered}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", type=Path, required=True)
    parser.add_argument("--migrate", action="store_true")
    args = parser.parse_args()
    try:
        if (args.project / MANIFEST).exists():
            from flow import upgrade
            result = upgrade(args.project.resolve(), args.migrate)
        else:
            result = install(args.project, args.migrate)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (OSError, ValueError, TypeError) as exc:
        parser.exit(1, str(exc) + "\n")
