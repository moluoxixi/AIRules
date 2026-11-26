#!/usr/bin/env python3
"""Record command execution facts and check their declared inputs; never judge business acceptance."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys

sys.dont_write_bytecode = True

OUTPUT_SUFFIX = ".output.txt"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def encoded(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="microseconds")


def relative(project, value, alias=None):
    path = Path(value)
    require(".." not in path.parts and "\0" not in str(path), "Paths cannot contain '..' or NUL")
    if path.is_absolute():
        for prefix in (project, alias):
            if prefix is None:
                continue
            try:
                path = path.relative_to(prefix)
                break
            except ValueError:
                continue
        else:
            raise ValueError("Path must stay inside the project: " + str(value)) from None
    # An embedded drive-relative component can also reset the path during a Windows walk.
    require(not any(Path(part).anchor for part in path.parts), "Path must be project-relative: " + str(value))
    return path.as_posix()


def local(project, name):
    path = project
    for part in Path(name).parts:
        path /= part
        require(not path.is_symlink(), "Symbolic links are not supported: " + name)
        if path.exists():
            info = path.lstat()
            require(not bool(getattr(info, "st_file_attributes", 0) & 0x400), "Linked paths are not supported: " + name)
    return path


def fingerprint(path):
    checksum = hashlib.sha256()
    require(stat.S_ISREG(path.lstat().st_mode), "Input must be a regular file: " + str(path))
    flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0)
    with os.fdopen(os.open(path, flags), "rb") as stream:
        before = os.fstat(stream.fileno())
        require(stat.S_ISREG(before.st_mode), "Input must be a regular file: " + str(path))
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            checksum.update(chunk)
        after = os.fstat(stream.fileno())
    require(mark(before) == mark(after), "File changed while reading: " + str(path))
    return {"size": before.st_size, "sha256": checksum.hexdigest()}, mark(after)


def mark(info):
    return (info.st_dev, info.st_ino, info.st_mode, info.st_size, info.st_mtime_ns, info.st_ctime_ns)


def snapshot(project, roots, excluded, *, initial=False):
    entries, marks = {}, {}

    def walk(name):
        if name in excluded or ".git" in Path(name).parts:
            return 0
        path = local(project, name)
        try:
            info = path.lstat()
        except FileNotFoundError:
            entries[name] = {"path": name, "kind": "missing"}
            return 0
        require(not path.is_symlink(), "Symbolic links are not supported: " + name)
        marks[name] = mark(info)
        if stat.S_ISDIR(info.st_mode):
            entries[name] = {"path": name, "kind": "directory"}
            return sum(walk(child.relative_to(project).as_posix()) for child in sorted(path.iterdir()))
        require(stat.S_ISREG(info.st_mode), "Input must be a regular file or directory: " + name)
        content, marks[name] = fingerprint(path)
        entries[name] = {"path": name, "kind": "file", "executable": bool(info.st_mode & 0o111), **content}
        return 1

    for name in roots:
        count = walk(name)
        require(not initial or count > 0, "Each input must contain at least one file: " + name)
    files = [entries[name] for name in sorted(entries)]
    return {"roots": roots, "files": files, "sha256": hashlib.sha256(encoded(files)).hexdigest()}, marks


def exclusive(path):
    flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NOFOLLOW", 0)
    return os.fdopen(os.open(path, flags, 0o600), "wb")


def prepare_parent(project, name):
    created = []
    path = project
    for part in Path(name).parent.parts:
        path /= part
        local(project, path.relative_to(project).as_posix())
        if not path.exists():
            path.mkdir()
            created.append(path)
        require(path.is_dir(), "Output parent is not a directory")
    return created


def result(receipt, execution, freshness, problems):
    return {"receipt": receipt, "execution": execution, "freshness": freshness, "problems": problems}


def run(args, project):
    alias = Path(args.project).expanduser().absolute()
    output = relative(project, args.output, alias)
    log_name = output + OUTPUT_SUFFIX
    roots = sorted(set(relative(project, value, alias) for value in args.input))
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    require(command and all("\0" not in item for item in command), "Provide a command after '--'")
    require(output != "." and output not in roots and log_name not in roots, "Evidence output cannot be an input file")
    target, log = local(project, output), local(project, log_name)
    require(not target.exists() and not log.exists(), "Receipt and log must be new files; existing evidence is preserved")
    created_dirs, owned = [], []
    try:
        created_dirs = prepare_parent(project, output)
        with exclusive(target) as record:
            owned.append(target)
            with exclusive(log) as stream:
                owned.append(log)
                before, before_marks = snapshot(project, roots, {output, log_name}, initial=True)
                started = utc_now()
                launch_error = None
                try:
                    process = subprocess.run(command, cwd=project, stdin=subprocess.DEVNULL,
                                             stdout=stream, stderr=subprocess.STDOUT, shell=False, check=False)
                    code = process.returncode
                except OSError as error:
                    code, launch_error = None, str(error)
                finished = utc_now()
            problems = []
            try:
                after, after_marks = snapshot(project, roots, {output, log_name})
                changed = before != after or before_marks != after_marks
            except (OSError, ValueError) as error:
                after, changed = None, True
                problems.append(str(error))
            if changed:
                problems.append("Declared inputs changed during execution; rerun verification")
            if launch_error:
                problems.append(launch_error)
            execution = "succeeded" if code == 0 else "failed"
            freshness = "changed_during_run" if changed else "current"
            log_content, _ = fingerprint(log)
            receipt = {"format": 1, "command": command, "cwd": ".", "started_at": started,
                       "finished_at": finished, "exit_code": code, "execution": execution,
                       "freshness": freshness, "inputs_before": before, "inputs_after": after,
                       "log": {"path": log_name, **log_content}, "problems": problems}
            if launch_error:
                receipt["launch_error"] = launch_error
            record.write(encoded(receipt) + b"\n")
            record.flush()
            os.fsync(record.fileno())
    except BaseException:
        for path in reversed(owned):
            path.unlink(missing_ok=True)
        for path in reversed(created_dirs):
            try:
                path.rmdir()
            except OSError:
                pass
        raise
    return result(output, execution, freshness, problems)


def valid_snapshot(project, value):
    require(isinstance(value, dict) and set(value) == {"roots", "files", "sha256"}, "Invalid input snapshot")
    roots = value["roots"]
    require(isinstance(roots, list) and roots and all(isinstance(root, str) for root in roots), "Missing declared input roots")
    require(roots == sorted(set(relative(project, root) for root in roots)), "Invalid input roots")
    require(isinstance(value["files"], list) and value["files"], "Missing input files")
    require(hashlib.sha256(encoded(value["files"])).hexdigest() == value["sha256"], "Input snapshot digest does not match")
    return roots


def check(args, project):
    output = relative(project, args.receipt, Path(args.project).expanduser().absolute())
    path = local(project, output)
    require(path.is_file(), "Receipt must be a regular file")
    receipt = json.loads(path.read_text(encoding="utf-8"))
    require(isinstance(receipt, dict) and receipt.get("format") == 1, "Unsupported receipt format")
    command = receipt.get("command")
    require(isinstance(command, list) and command and all(isinstance(item, str) for item in command), "Missing command")
    require(receipt.get("cwd") == ".", "Invalid working directory")
    times = [datetime.fromisoformat(receipt[key]) for key in ("started_at", "finished_at")]
    require(all(value.utcoffset() is not None for value in times) and times[1] >= times[0], "Invalid execution timestamps")
    require(receipt.get("freshness") in ("current", "changed_during_run"), "Invalid recorded freshness")
    code = receipt.get("exit_code")
    require(type(code) is int or code is None and isinstance(receipt.get("launch_error"), str), "Invalid execution result")
    execution = "succeeded" if code == 0 else "failed"
    require(receipt.get("execution") == execution, "Execution result is inconsistent")
    roots = valid_snapshot(project, receipt.get("inputs_before"))
    after = receipt.get("inputs_after")
    if after is not None:
        require(valid_snapshot(project, after) == roots, "Input scope changed inside receipt")
    require(receipt["freshness"] != "current" or after == receipt["inputs_before"], "Input history is inconsistent")
    log_spec = receipt.get("log")
    log_name = output + OUTPUT_SUFFIX
    require(isinstance(log_spec, dict) and log_spec.get("path") == log_name, "Log must be the receipt's companion file")
    problems = []
    if receipt["freshness"] == "changed_during_run":
        problems.append("Declared inputs changed during execution; historical execution cannot verify current inputs")
    try:
        content, _ = fingerprint(local(project, log_name))
        if content != {key: log_spec.get(key) for key in ("size", "sha256")}:
            problems.append("Recorded log content has changed")
    except (OSError, ValueError) as error:
        problems.append("Recorded log cannot be checked: " + str(error))
    try:
        current, _ = snapshot(project, roots, {output, log_name})
        if current != receipt["inputs_before"]:
            problems.append("Declared input contents or paths have changed")
    except (OSError, ValueError) as error:
        problems.append("Declared inputs cannot be checked: " + str(error))
    freshness = "changed_during_run" if receipt["freshness"] == "changed_during_run" else "stale" if problems else "current"
    return result(output, execution, freshness, problems)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="operation", required=True)
    capture = sub.add_parser("run", help="Record command execution against explicit inputs")
    capture.add_argument("--project", required=True)
    capture.add_argument("--output", required=True)
    capture.add_argument("--input", action="append", required=True)
    capture.add_argument("command", nargs=argparse.REMAINDER)
    inspect = sub.add_parser("check", help="Check recorded inputs and log without running a command")
    inspect.add_argument("--project", required=True)
    inspect.add_argument("receipt")
    args = parser.parse_args()
    try:
        project = Path(args.project).expanduser().resolve(strict=True)
        require(project.is_dir(), "Project must be a directory")
        answer = run(args, project) if args.operation == "run" else check(args, project)
        print(json.dumps(answer, ensure_ascii=False, indent=2))
        return 0 if answer["execution"] == "succeeded" and answer["freshness"] == "current" else 1
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
