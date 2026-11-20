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
sys.path.insert(0, str(SOURCE / "runtime"))
from evidence import linked

SKILLS = Path(".agents/skills")
ROLE = "requirement-flow"
ROLE_VERSION = "0.10.0"
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


def apply(root, files, moves, after_apply=None):
    """Install assets and derived pages in one reversible, same-filesystem transaction."""
    # Staging is metadata, never a temporary application-code input. Keep it on the
    # project's filesystem without requiring write access to the project's parent.
    with ExitStack() as directory_undo:
        store = safe_path(root, ".requirements")
        if not store.exists():
            store.mkdir()
            directory_undo.callback(store.rmdir)
        require(store.is_dir(), f"预期目录：{store}")
        with tempfile.TemporaryDirectory(prefix=".install-", dir=store) as tmp, ExitStack() as undo:
            changed = _apply_files(root, files, moves, after_apply, Path(tmp), undo)
            undo.pop_all()
        directory_undo.pop_all()
    return changed


def _apply_files(root, files, moves, after_apply, stage, undo):
    """All replacements, including pages rendered from installed assets, share undo."""
    def parent(path):
        if not path.exists():
            parent(path.parent)
            path.mkdir()
            undo.callback(path.rmdir)

    def prepare(relative, data, n):
        target = safe_path(root, relative)
        if data is not None:
            staged = stage / f"new-{n}"
            staged.write_bytes(data)
            if target.is_file():
                os.chmod(staged, target.stat().st_mode & 0o777)

    def replace(relative, data, n):
        target = safe_path(root, relative)
        parent(target.parent)
        if target.exists():
            old = stage / f"old-{n}"
            target.replace(old)
            undo.callback(old.replace, target)
        if data is not None:
            (stage / f"new-{n}").replace(target)
            undo.callback(target.unlink)

    for n, (relative, data) in enumerate(files.items()):
        prepare(relative, data, n)
    for source, destination in moves:
        src, dest = safe_path(root, source), safe_path(root, destination)
        require(not dest.exists(), f"旧入口归档路径已存在：{dest}")
        parent(dest.parent)
        src.rename(dest)
        undo.callback(dest.rename, src)
    for n, (relative, data) in enumerate(files.items()):
        replace(relative, data, n)
    changed = bool(files or moves)
    if after_apply is not None:
        for n, (relative, data) in enumerate(after_apply(), start=len(files)):
            prepare(relative, data, n)
            replace(relative, data, n)
            changed = True
    return changed


def install(project, migrate=False):
    path = Path(project).expanduser()
    require(path.is_dir() and not linked(path), f"目标应是已有的真实项目目录：{path}")
    root = path.resolve()
    with project_lock(root):
        return install_locked(root, migrate)


def install_locked(root, migrate, *, after_apply=None):
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
            "migrated": migration, "archive": str(root / archive) if archive else None}


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
