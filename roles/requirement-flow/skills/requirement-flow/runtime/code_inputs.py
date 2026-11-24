"""Content identities for the checkout actually used by a verification.

Git's index selects files; their working-tree bytes, not HEAD/index blobs, are
hashed. Explicit paths also include ignored files. Requirement records and Git
metadata never become inputs to their own receipts.
"""
import errno
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess


EXCLUDED = {".git", ".requirements"}
GENERATED = {"node_modules", "__pycache__", ".venv", "venv", ".pytest_cache", ".mypy_cache", ".ruff_cache"}


class CodeInputContentMismatch(ValueError):
    """A complete current snapshot differs from a valid, same-scope binding."""


def require(value, message):
    if not value:
        raise ValueError(message)


def linked(info):
    return stat.S_ISLNK(info.st_mode) or bool(getattr(info, "st_file_attributes", 0) & 0x400)


def normalize_paths(paths):
    if paths is None:
        return None
    require(isinstance(paths, list) and paths, "code_paths 应为非空的项目相对路径列表")
    normalized = []
    for item in paths:
        require(isinstance(item, str) and item.strip() and "\0" not in item and "\\" not in item,
                "code_paths 必须使用项目相对路径和 / 分隔符")
        path = Path(item)
        require(not path.is_absolute() and ".." not in path.parts and ":" not in item,
                "code_paths 不得指向项目外部")
        require(not any(part.casefold() in EXCLUDED for part in path.parts),
                "code_paths 不能包含 Git 或需求记录")
        normalized.append(path.as_posix())
    return sorted(set(normalized))


def git(repo, *args):
    env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
    result = subprocess.run(["git", "--git-dir=.git", *args], cwd=repo, env=env, capture_output=True)
    require(result.returncode == 0, "无法读取代码检出范围：" + str(repo))
    return result.stdout


def snapshot(project_root, code_paths=None):
    project = Path(project_root).resolve(strict=True)
    require(project.is_dir(), "代码输入项目目录不存在")
    paths = normalize_paths(code_paths)
    records = {}
    files_seen = 0
    repositories = set()

    def excluded(relative, generated=False):
        return any(part.casefold() in EXCLUDED or (generated and part in GENERATED)
                   for part in relative.parts) or (generated and relative.suffix in (".pyc", ".pyo"))

    def record_file(path, name, info):
        nonlocal files_seen
        checksum = hashlib.sha256()
        flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0)
        with os.fdopen(os.open(path, flags), "rb") as stream:
            before = os.fstat(stream.fileno())
            require(stat.S_ISREG(before.st_mode), "代码输入不是普通文件：" + name)
            require((info.st_ino, info.st_dev, info.st_mode, info.st_size, info.st_mtime_ns) ==
                    (before.st_ino, before.st_dev, before.st_mode, before.st_size, before.st_mtime_ns),
                    "打开期间代码文件变化：" + name)
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                checksum.update(block)
            after = os.fstat(stream.fileno())
        require((before.st_size, before.st_mtime_ns, before.st_ino) ==
                (after.st_size, after.st_mtime_ns, after.st_ino), "采集期间代码文件变化：" + name)
        records[(name, "file")] = [bool(info.st_mode & 0o111), before.st_size, checksum.hexdigest()]
        files_seen += 1

    def scan(path, relative, ancestors=(), generated=False):
        if excluded(relative, generated):
            return
        name = relative.as_posix()
        try:
            parent = path.parent.resolve()
        except (OSError, RuntimeError) as exc:
            if isinstance(exc, RuntimeError) or exc.errno == errno.ELOOP:
                raise ValueError("代码输入的父路径形成循环：" + name) from exc
            raise
        require(path == project or parent == project or project in parent.parents,
                "代码输入经过项目外部链接：" + name)
        if path != project:
            require(not excluded(parent.relative_to(project)), "代码输入经过项目管理数据目录：" + name)
        try:
            info = path.lstat()
        except FileNotFoundError:
            records[(name, "missing")] = []
            return
        except OSError as exc:
            # Newer pathlib can leave a loop unresolved in non-strict mode;
            # the real filesystem operation then reports the same cycle.
            if exc.errno == errno.ELOOP:
                raise ValueError("代码输入的父路径形成循环：" + name) from exc
            raise
        if linked(info):
            try:
                target = path.resolve(strict=True)
            except (OSError, RuntimeError) as exc:
                raise ValueError("代码链接目标缺失或循环：" + name) from exc
            require(target == project or project in target.parents, "代码链接指向项目外部：" + name)
            require(not excluded(target.relative_to(project)), "代码链接指向项目管理数据：" + name)
            require(target not in ancestors, "代码链接形成循环：" + name)
            records[(name, "link")] = [os.readlink(path)]
            scan(target, relative, ancestors, generated or paths is None)
        elif stat.S_ISDIR(info.st_mode):
            actual = path.resolve()
            require(actual not in ancestors, "代码目录形成循环：" + name)
            if paths is None and (path / ".git").exists():
                git_files(path, relative)
                return
            records[(name, "directory")] = []
            for child in sorted(path.iterdir()):
                scan(child, relative / child.name, (*ancestors, actual), generated or paths is not None)
        elif stat.S_ISREG(info.st_mode):
            record_file(path, name, info)
        else:
            raise ValueError("代码输入不能是设备、管道或套接字：" + name)

    def git_files(repo, prefix=Path()):
        require(repo.resolve() == project or project in repo.resolve().parents, "子模块经过项目外部链接")
        require(not linked((repo / ".git").lstat()), "Git 入口不能是链接：" + str(repo))
        identity = repo.resolve()
        if identity in repositories:
            return
        repositories.add(identity)
        if prefix.parts:
            records[(prefix.as_posix(), "repository")] = []
        for entry in git(repo, "ls-files", "--stage", "-z").split(b"\0"):
            if not entry:
                continue
            header, raw = entry.split(b"\t", 1)
            mode, _, stage = header.split()
            relative = Path(os.fsdecode(raw))
            if excluded(prefix / relative):
                continue
            require(stage == b"0", "代码输入有未解决的 Git 冲突：" + (prefix / relative).as_posix())
            path = repo / relative
            if mode == b"160000":
                require(path.is_dir() and (path / ".git").exists(),
                        "子模块未检出，无法确认代码版本：" + (prefix / relative).as_posix())
                require(not linked(path.lstat()), "子模块目录不能是链接：" + str(path))
                git_files(path, prefix / relative)
            else:
                scan(path, prefix / relative)
        for raw in git(repo, "ls-files", "--others", "--exclude-standard", "-z").split(b"\0"):
            if raw:
                relative = Path(os.fsdecode(raw))
                scan(repo / relative, prefix / relative, generated=True)
        # Some workspaces keep application repositories as ignored siblings,
        # rather than gitlinks. Their actual sources still affect verification.
        for child in sorted(repo.iterdir()):
            if child.name.startswith(".") or child.name in GENERATED:
                continue
            if child.is_dir() and (child / ".git").exists():
                require(not linked(child.lstat()), "独立子仓库目录不能是链接：" + str(child))
                git_files(child, prefix / child.name)

    if paths is not None:
        mode = "paths"
        for value in paths:
            # Resolve each parent too: a selected file may be inside a symlinked directory.
            selected = project / value
            require(selected.exists() or selected.is_symlink(), "code_paths 指定的代码输入不存在：" + value)
            for parent in (() if selected == project else selected.parents):
                if parent == project:
                    break
                if parent.exists():
                    resolved = parent.resolve(strict=True)
                    require(resolved == project or project in resolved.parents, "code_paths 经过项目外部链接")
            previous_count = files_seen
            scan(selected, Path(value))
            require(files_seen > previous_count, "code_paths 指定范围没有可核验的代码文件：" + value)
    elif (project / ".git").exists():
        mode = "git"
        git_files(project)
    else:
        mode = "directory"
        scan(project, Path("."), generated=True)
    encoded = json.dumps(sorted(records.items()), ensure_ascii=True, separators=(",", ":")).encode("utf-8")
    return {"version": 1, "mode": mode, "code_paths": paths, "sha256": hashlib.sha256(encoded).hexdigest(),
            "entries": len(records)}


def valid_snapshot(value):
    return (isinstance(value, dict) and
            set(value) == {"version", "mode", "code_paths", "sha256", "entries"} and
            type(value["version"]) is int and value["version"] == 1 and
            value["mode"] in ("paths", "git", "directory") and
            type(value["entries"]) is int and value["entries"] >= 0 and
            isinstance(value["sha256"], str) and len(value["sha256"]) == 64 and
            set(value["sha256"]) <= set("0123456789abcdef"))


def verify_current(project_root, binding, code_paths=None, *, cache=None):
    require(isinstance(binding, dict) and binding.get("version") == 1 and
            isinstance(binding.get("sha256"), str), "旧回执未绑定代码输入，请重新验收；原始证据仍可查阅")
    require(valid_snapshot(binding), "代码输入绑定无效，请重新验收；原始证据仍可查阅")
    paths = normalize_paths(code_paths)
    require(binding["code_paths"] == paths, "验证代码范围已改变，请重新验收")
    require((binding["mode"] == "paths") == (paths is not None) and
            (paths is None or binding["entries"] > 0), "代码输入绑定无效，请重新验收")
    key = (str(Path(project_root).resolve()), None if paths is None else tuple(paths))
    if cache is None:
        current = snapshot(project_root, paths)
    else:
        if key not in cache:
            cache[key] = snapshot(project_root, paths)
        current = cache[key]
    require(valid_snapshot(current) and current["code_paths"] == paths and
            (current["mode"] == "paths") == (paths is not None) and
            (paths is None or current["entries"] > 0), "当前代码快照无效，请重新验收")
    if current != binding:
        # Equal content hashes with different metadata cannot establish a code race.
        require(current["sha256"] != binding["sha256"], "代码输入绑定信息不一致，请重新验收")
        raise CodeInputContentMismatch("当前代码、测试或子仓库内容已改变，请重新验收")
    return binding
