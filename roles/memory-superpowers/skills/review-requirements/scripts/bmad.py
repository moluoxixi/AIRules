# /// script
# requires-python = ">=3.12"
# dependencies = ["pyyaml==6.0.3"]
# ///
"""Install pinned BMAD Validate dependencies or bind an existing PRD for review.

uv run bmad.py install --project ROOT
uv run bmad.py prepare --project ROOT --prd docs/product.md --task docs/tasks/review
This prepares inputs; the agent performs the review. It never generates a report.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

import yaml

sys.dont_write_bytecode = True
VERSION = "6.12.4"
COMMIT = "bab9082c3e884e0d72c759bcd1a6d90bcc01be84"
REPOSITORY = "https://github.com/bmad-code-org/BMAD-METHOD.git"
SKILL_SOURCE = Path("src/bmm-skills/plan/bmad-prd")
SCRIPT_NAMES = ("resolve_config.py", "resolve_customization.py", "config_utils.py", "memlog.py")
DOCUMENT_TYPES = ("standards", "product", "api", "design", "prototype")
STATE_PATH = Path(".airules/memory-superpowers")
REPORT_NAMES = {"validation-report.md", "validation-report.html", "sources.jsonl", ".memlog.md"}


def run(command, *, cwd=None):
    """Keep subprocess diagnostics off the JSON success channel."""
    try:
        result = subprocess.run(command, cwd=cwd, text=True, capture_output=True, timeout=120,
                                env=dict(os.environ, PYTHONDONTWRITEBYTECODE="1", GIT_TERMINAL_PROMPT="0"))
    except subprocess.TimeoutExpired:
        raise ValueError(f"{command[0]} timed out after 120 seconds") from None
    if result.returncode:
        detail = (result.stderr or result.stdout).strip()
        raise ValueError(f"{command[0]} failed ({result.returncode}): {detail}")
    return result.stdout


def project_path(root, value, label, *, relative_only=False, allow_root=False):
    supplied = Path(value)
    if ".." in supplied.parts or (relative_only and supplied.is_absolute()):
        raise ValueError(f"{label} must be a project-relative path without '..'")
    resolved = (root / supplied).resolve()
    if not resolved.is_relative_to(root) or (resolved == root and not allow_root):
        raise ValueError(f"{label} must be inside this project")
    return resolved


def owned_path(root, relative):
    """Runtime state cannot be redirected into the user's files by symlinks."""
    path = root
    for part in relative.parts:
        path /= part
        if path.is_symlink():
            raise ValueError(f"Runtime state path is a symlink; preserved: {path}")
        if path.exists() and not path.is_dir():
            raise ValueError(f"Runtime state requires a directory; preserved: {path}")
    return path


def read_settings(root, supplied):
    if supplied:
        config = project_path(root, supplied, "Config")
        if not config.is_file():
            raise ValueError(f"Config does not exist: {config}")
    else:
        config = root / ".moluoxixi/config.yaml"
        if not config.exists():
            config = root / ".airules/config.yaml"
        config = project_path(root, str(config), "Config")
    data = yaml.safe_load(config.read_text(encoding="utf-8")) if config.exists() else {}
    if data is None:
        data = {}
    if not isinstance(data, dict):
        raise ValueError("Project configuration must be a YAML mapping")
    settings = data.get("memory_superpowers", {})
    if not isinstance(settings, dict):
        raise ValueError("memory_superpowers must be a mapping")
    documents = settings.get("documents", {})
    if not isinstance(documents, dict):
        raise ValueError("memory_superpowers.documents must be a mapping")
    result = {}
    for kind in DOCUMENT_TYPES:
        entries = documents.get(kind, [])
        if not isinstance(entries, list) or any(not isinstance(item, str) or not item.strip() for item in entries):
            raise ValueError(f"documents.{kind} must be a list of nonempty paths or URLs")
        for item in entries:
            if item.startswith(("https://", "http://")):
                continue
            project_path(root, item, f"documents.{kind} entry", relative_only=True)
        result[kind] = entries
    return config, result


def read_index(path):
    if path.is_symlink():
        raise ValueError(f"Source index is a symlink; preserved: {path}")
    if not path.exists():
        return []
    entries = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        entry = json.loads(line)
        if (not isinstance(entry, dict) or set(entry) != {"file", "reason"}
                or any(not isinstance(entry[k], str) or not entry[k].strip() for k in ("file", "reason"))):
            raise ValueError(f"Invalid file/reason entry in {path}:{number}")
        entries.append(entry)
    return entries


def bind_inputs(root, args):
    if not args.prd or not args.task:
        raise ValueError("prepare requires --prd and --task")
    prd = project_path(root, args.prd, "PRD", relative_only=True)
    if not prd.is_file():
        raise ValueError(f"PRD does not exist or is not a file: {prd}")
    # Verify source availability before any network or installation side effect.
    if not prd.read_text(encoding="utf-8").strip():
        raise ValueError(f"PRD is empty: {prd}")
    if prd.is_relative_to(root / STATE_PATH):
        raise ValueError("PRD must be outside the local BMAD runtime/cache")
    ignore = root / ".gitignore"
    if ignore.exists() and os.path.samefile(prd, ignore):
        raise ValueError("PRD conflicts with .gitignore, which installation may update")
    task = project_path(root, args.task, "Task directory", relative_only=True)
    if task.exists() and not task.is_dir():
        raise ValueError(f"Task directory is not a directory: {task}")
    state = root / STATE_PATH
    if task.is_relative_to(state):
        raise ValueError("Task directory must be outside the local BMAD runtime/cache")
    if prd.parent == task and (prd.name in REPORT_NAMES or prd.name.startswith("review-") and prd.suffix == ".md"):
        raise ValueError("PRD conflicts with a BMAD report or source-index output path")
    # Check pre-existing output aliases as well as the names chosen by the caller.
    outputs = [task / name for name in REPORT_NAMES]
    if task.is_dir():
        outputs.extend(task.glob("review-*.md"))
    for target in outputs:
        if target.is_symlink():
            raise ValueError(f"Review output is a symlink; preserved: {target}")
        if target.exists() and not target.is_file():
            raise ValueError(f"Review output is not a file: {target}")
        if target.exists() and os.path.samefile(prd, target):
            raise ValueError("PRD conflicts with an existing review output")
    index = task / "sources.jsonl"
    entries = read_index(index)
    rubric = Path(__file__).resolve().parents[1] / "references/review-rubric.md"
    if not rubric.is_file():
        raise ValueError(f"Review rubric is missing: {rubric}")
    return prd, task, index, entries, rubric


def verify_checkout(path):
    if not path.is_dir() or not (path / ".git").exists():
        raise ValueError(f"BMAD cache must be a Git checkout; preserved: {path}")
    actual_root = Path(run(["git", "-C", str(path), "rev-parse", "--show-toplevel"]).strip()).resolve()
    if actual_root != path.resolve():
        raise ValueError(f"BMAD cache is not the repository root: {path}")
    origin = run(["git", "-C", str(path), "remote", "get-url", "origin"]).strip().removesuffix(".git").rstrip("/")
    if origin != REPOSITORY.removesuffix(".git"):
        raise ValueError(f"BMAD cache origin does not match the official repository; preserved: {path}")
    head = run(["git", "-C", str(path), "rev-parse", "HEAD"]).strip()
    if head != COMMIT:
        raise ValueError(f"BMAD cache must be pinned to {COMMIT}; preserved: {path}")
    if run(["git", "-C", str(path), "status", "--porcelain", "--untracked-files=all"]).strip():
        raise ValueError(f"BMAD cache has local changes; preserved: {path}")
    package = json.loads((path / "package.json").read_text(encoding="utf-8"))
    if package.get("name") != "bmad-method" or package.get("version") != VERSION:
        raise ValueError(f"BMAD cache package version is not {VERSION}: {path}")
    return path


def get_checkout(state, source_cache):
    if source_cache:
        return verify_checkout(Path(source_cache).resolve(strict=True))
    cache = state / "upstream-bmad"
    if cache.exists() or cache.is_symlink():
        if cache.is_symlink():
            raise ValueError(f"BMAD cache is a symlink; preserved: {cache}")
        return verify_checkout(cache)
    state.mkdir(parents=True, exist_ok=True)
    temp = Path(tempfile.mkdtemp(prefix=".bmad-download-", dir=state))
    try:
        run(["git", "init", "--quiet", str(temp)])
        run(["git", "-C", str(temp), "remote", "add", "origin", REPOSITORY])
        run(["git", "-C", str(temp), "fetch", "--quiet", "--depth=1", "origin", COMMIT])
        run(["git", "-C", str(temp), "-c", "advice.detachedHead=false", "checkout", "--quiet", "--detach", "FETCH_HEAD"])
        verify_checkout(temp)
        if cache.exists():
            raise ValueError(f"BMAD cache appeared during installation; retry without overwriting: {cache}")
        temp.rename(cache)
    finally:
        if temp.exists():
            shutil.rmtree(temp)
    return cache


def new_file(target, content):
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        with target.open("xb") as handle:
            handle.write(content)
    except FileExistsError:
        if target.is_symlink() or target.read_bytes() != content:
            raise ValueError(f"Existing runtime file differs; preserved: {target}") from None


def install_runtime(root, checkout):
    runtime = owned_path(root, STATE_PATH / "bmad/runtime")
    skill_root = runtime / ".agents/skills/bmad-prd"
    source = checkout / SKILL_SOURCE
    files = [(skill_root / path.relative_to(source), path.read_bytes())
             for path in sorted(source.rglob("*")) if path.is_file()]
    for name in SCRIPT_NAMES:
        files.append((runtime / "_bmad/scripts" / name, (checkout / "src/scripts" / name).read_bytes()))
    config = ("[core]\n"
              f"project_name = {json.dumps(root.name, ensure_ascii=False)}\n"
              'communication_language = "Chinese"\n'
              'document_output_language = "Chinese"\n'
              '[modules.bmm]\n'
              f"planning_artifacts = {json.dumps(str(root / 'docs/tasks'), ensure_ascii=False)}\n")
    files.append((runtime / "_bmad/config.toml", config.encode("utf-8")))
    # Preflight all files so conflicts are reported before modifying the runtime.
    for target, content in files:
        owned_path(root, target.parent.relative_to(root))
        if target.is_symlink() or target.exists() and (not target.is_file() or target.read_bytes() != content):
            raise ValueError(f"Existing runtime file differs; preserved: {target}")
    for target, content in files:
        if not target.exists():
            new_file(target, content)
    config_result = json.loads(run([sys.executable, str(runtime / "_bmad/scripts/resolve_config.py"),
                                    "--project-root", str(runtime)]))
    customization = json.loads(run([sys.executable, str(runtime / "_bmad/scripts/resolve_customization.py"),
                                    "--skill", str(skill_root), "--project-root", str(runtime), "--key", "workflow"]))
    for name in ("validation_checklist_template", "validation_report_template"):
        value = customization["workflow"][name]
        if not (skill_root / value).is_file():
            raise ValueError(f"Upstream validation resource is missing: {value}")
    return runtime, skill_root, {"config": config_result, "customization": customization}


def write_index(path, entries, prd, root):
    # Keep original order; an explicit PRD entry replaces its old reason only.
    unique = {entry["file"]: entry for entry in entries}
    relative = prd.relative_to(root).as_posix()
    unique[relative] = {"file": relative, "reason": "本次研发需求评审的产品原件"}
    content = "".join(json.dumps(entry, ensure_ascii=False) + "\n" for entry in unique.values())
    if path.exists() and path.read_text(encoding="utf-8") == content:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temp = tempfile.mkstemp(prefix=".sources-", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(content)
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def ignore_state(root):
    target = root / ".gitignore"
    if target.is_symlink():
        raise ValueError("Project .gitignore is a symlink; preserved")
    old = target.read_text(encoding="utf-8") if target.exists() else ""
    entry = "/.airules/memory-superpowers/"
    if entry not in old.splitlines():
        with target.open("a", encoding="utf-8") as handle:
            handle.write(("\n" if old and not old.endswith("\n") else "") + entry + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("install", "prepare"))
    parser.add_argument("--project", required=True)
    parser.add_argument("--config")
    parser.add_argument("--prd")
    parser.add_argument("--task")
    parser.add_argument("--source-cache", help="Reuse a clean official Git checkout at the pinned commit")
    args = parser.parse_args()
    root = Path(args.project).resolve(strict=True)
    if not root.is_dir() or root == Path.home():
        raise ValueError("Select a project directory, not HOME")
    if args.action == "install" and (args.prd or args.task):
        raise ValueError("--prd and --task apply to prepare only")
    config, documents = read_settings(root, args.config)
    inputs = bind_inputs(root, args) if args.action == "prepare" else None
    state = owned_path(root, STATE_PATH)
    # Validate runtime containment before network too.
    owned_path(root, STATE_PATH / "bmad/runtime")
    checkout = get_checkout(state, args.source_cache)
    runtime, skill_root, checks = install_runtime(root, checkout)
    ignore_state(root)
    resolved_workflow = dict(checks["customization"]["workflow"])
    for name in ("prd_template", "validation_checklist_template", "validation_report_template"):
        resolved_workflow[name] = str((skill_root / resolved_workflow[name]).resolve())
    result = {
        "source_project": str(root), "project_root": str(runtime), "skill_root": str(skill_root),
        "upstream": {"repository": REPOSITORY, "version": VERSION, "commit": COMMIT, "cache": str(checkout)},
        "config": str(config), "documents": documents, "runtime_checks": checks,
        "resolved_workflow": resolved_workflow,
        "supported_intents": ["validate"],
    }
    if inputs:
        prd, task, index, entries, rubric = inputs
        write_index(index, entries, prd, root)
        result["resolved_workflow"]["validation_checklist_template"] = str(rubric)
        result.update({"intent": "validate", "headless": True, "prd": str(prd),
                       "doc_workspace": str(task), "sources_index": str(index),
                       "workflow": {"validation_checklist_template": str(rubric)}})
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, yaml.YAMLError, KeyError) as error:
        print(f"BMAD setup failed: {error}", file=sys.stderr)
        sys.exit(1)
