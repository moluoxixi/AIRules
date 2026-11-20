"""Filesystem locations of requirement records and their local locks."""
import hashlib
import os
from pathlib import Path
import sys
import tempfile
import unicodedata

if __package__:
    from .evidence import linked
else:
    from evidence import linked


def lock_path(store, key=None):
    uid = str(os.getuid()) if hasattr(os, "getuid") else "user"
    directory = Path(tempfile.gettempdir()) / f"requirement-flow-locks-{uid}"
    if linked(directory):
        raise ValueError(f"锁目录不能使用符号链接：{directory}")
    directory.mkdir(mode=0o700, exist_ok=True)
    resource = str(store.resolve()) + "\0" + (key or "")
    if sys.platform in ("darwin", "win32"):
        resource = resource.casefold()
    path = directory / (hashlib.sha256(resource.encode("utf-8")).hexdigest() + ".lock")
    if linked(path):
        raise ValueError(f"锁文件不能使用符号链接：{path}")
    return path


def model_lock_path(workspace):
    store = workspace.parent.parent
    if store.name == ".requirements" and workspace.parent.name in ("active", "archive"):
        return lock_path(store, "@model/" + unicodedata.normalize("NFC", workspace.name))
    return lock_path(workspace, "@model")


def legacy_lock_only(folder):
    # Git leaves this ignored file behind when it moves the tracked model to the other bucket.
    if linked(folder) or not folder.is_dir() or (folder / "model.json").exists():
        return False
    lock = folder / ".workflow.lock"
    return not linked(lock) and lock.is_file() and all(entry == lock for entry in folder.iterdir())


def remove_legacy_lock_directory(folder):
    if legacy_lock_only(folder):
        (folder / ".workflow.lock").unlink()
        folder.rmdir()
