#!/usr/bin/env python3
"""Set up the official Ponytail Codex plugin, or inspect its native configuration."""
import argparse
import json
import os
from pathlib import Path
import queue
import re
import subprocess
import sys
import threading
import time

sys.dont_write_bytecode = True

PLUGIN_ID = "ponytail@ponytail"
OFFICIAL_REPOSITORY = "https://github.com/DietrichGebert/ponytail"
EVENTS = ("SessionStart", "UserPromptSubmit", "SubagentStart")
NATIVE_EVENTS = ("sessionStart", "userPromptSubmit", "subagentStart")
MODES = ("off", "lite", "full", "ultra")
CONFIG_CALL = """const c = require(process.argv[1]);
if (process.argv[2] === 'write' && c.writeDefaultMode(process.argv[3]) !== process.argv[3])
  throw new Error('Official default-mode setter rejected the requested mode');
const path = c.getConfigPath(), override = c.normalizeMode(process.env.PONYTAIL_DEFAULT_MODE);
let configured = null;
try {
  configured = c.normalizeMode(JSON.parse(require('fs').readFileSync(path, 'utf8').replace(/^\\uFEFF/, '')).defaultMode);
} catch (_) {}
console.log(JSON.stringify({effective: c.getDefaultMode(), path,
  source: override ? 'environment' : configured ? 'config_file' : 'builtin_default',
  environmentOverride: override,
  environmentIgnored: process.env.PONYTAIL_DEFAULT_MODE !== undefined && override === null}));
"""


def require(condition, message):
    if not condition:
        raise ValueError(message)


def native(command, environment, timeout):
    completed = subprocess.run(command, env=environment, capture_output=True,
                               text=True, encoding="utf-8", timeout=timeout, check=False)
    require(completed.returncode == 0,
            "Native command failed: " + " ".join(command) + ": " + completed.stderr.strip())
    return completed.stdout


def official_url(value):
    return isinstance(value, str) and value.rstrip("/").removesuffix(".git").casefold() == OFFICIAL_REPOSITORY.casefold()


def installed_plugin(environment, timeout):
    data = json.loads(native(["codex", "plugin", "list", "--json", "--marketplace", "ponytail"], environment, timeout))
    require(isinstance(data, dict), "Native plugin list is not an object")
    rows = data.get("installed")
    require(isinstance(rows, list) and all(isinstance(row, dict) for row in rows), "Native plugin list did not return an installed-plugin list")
    candidates = [row for row in rows if row.get("pluginId") == PLUGIN_ID
                  or row.get("name") == "ponytail" and row.get("marketplaceName") == "ponytail"]
    require(len(candidates) <= 1, "Multiple Ponytail installations require native review")
    if not candidates:
        return None
    plugin = candidates[0]
    source = plugin.get("source", {})
    require(plugin.get("pluginId") == PLUGIN_ID and plugin.get("name") == "ponytail"
            and plugin.get("marketplaceName") == "ponytail"
            and isinstance(source, dict) and source.get("source") == "git" and official_url(source.get("url")),
            "Ponytail installation is not from the official DietrichGebert/ponytail repository; preserved without changes")
    require(plugin.get("installed") is True, "Native Ponytail entry is not installed")
    return plugin


def plugin_root(codex_home, plugin):
    version = plugin.get("version")
    require(isinstance(version, str) and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9.+_-]*", version), "Invalid native plugin version")
    root = codex_home / "plugins/cache/ponytail/ponytail" / version
    manifest = json.loads((root / ".codex-plugin/plugin.json").read_text(encoding="utf-8"))
    require(isinstance(manifest, dict) and manifest.get("name") == "ponytail" and manifest.get("version") == version
            and official_url(manifest.get("repository")), "Cached native manifest does not match the official installed plugin")
    hooks = manifest.get("hooks")
    require(isinstance(hooks, str), "Native plugin manifest has no hooks entry")
    hook_path = (root / hooks).resolve()
    require(hook_path.is_relative_to(root.resolve()), "Native hook manifest leaves the plugin directory")
    definitions = json.loads(hook_path.read_text(encoding="utf-8")).get("hooks", {})
    require(all(definitions.get(event) for event in EVENTS), "Official plugin cache is missing required lifecycle hook definitions")
    require((root / "hooks/ponytail-config.js").is_file(), "Official configuration module is missing")
    return root


def default_mode(root, operation, expected, environment, timeout):
    module = str(root / "hooks/ponytail-config.js")
    current = json.loads(native(["node", "-e", CONFIG_CALL, module, "read", expected], environment, timeout))
    if operation == "setup":
        config = Path(current["path"])
        if config.exists():
            previous = json.loads(config.read_text(encoding="utf-8-sig"))
            require(isinstance(previous, dict), "Existing Ponytail configuration is not an object; preserved without changes")
        current = json.loads(native(["node", "-e", CONFIG_CALL, module, "write", expected], environment, timeout))
    return {"expected": expected, "effective": current["effective"], "config_path": current["path"],
            "source": current["source"], "environment_override": current["environmentOverride"],
            "environment_ignored": current["environmentIgnored"], "matches": current["effective"] == expected}


def native_hooks(environment, cwd, timeout):
    """Read two app-server RPC responses; never create a thread or invoke a model."""
    process = subprocess.Popen(["codex", "app-server", "--stdio"], env=environment, cwd=cwd,
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                               text=True, encoding="utf-8", bufsize=1)
    messages = queue.Queue()

    def read_lines():
        try:
            for line in process.stdout:
                messages.put(line)
        except (OSError, ValueError):
            pass
        finally:
            messages.put(None)

    reader = threading.Thread(target=read_lines, daemon=True)
    reader.start()

    def send(value):
        process.stdin.write(json.dumps(value) + "\n")
        process.stdin.flush()

    def response(request_id):
        deadline = time.monotonic() + timeout
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("Codex app-server hooks inspection timed out")
            try:
                line = messages.get(timeout=remaining)
            except queue.Empty:
                raise TimeoutError("Codex app-server hooks inspection timed out") from None
            require(line is not None, "Codex app-server closed before returning hook metadata")
            message = json.loads(line)
            if message.get("id") != request_id:
                continue
            require("error" not in message, "Native hooks inspection failed: " + json.dumps(message.get("error")))
            require("result" in message, "Native app-server response is missing its result")
            return message["result"]

    try:
        send({"id": 1, "method": "initialize", "params": {
            "clientInfo": {"name": "airules-ponytail-doctor", "title": "Ponytail setup inspection", "version": "1.0"},
            "capabilities": {"experimentalApi": True, "requestAttestation": False}}})
        response(1)
        send({"method": "initialized"})
        send({"id": 2, "method": "hooks/list", "params": {"cwds": [str(cwd)]}})
        return response(2)
    finally:
        try:
            process.stdin.close()
        except OSError:
            pass
        try:
            process.wait(timeout=0.2)
        except subprocess.TimeoutExpired:
            process.terminate()
            try:
                process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=2)
        reader.join(timeout=1)
        process.stdout.close()


def hook_state(metadata, cwd):
    entries = metadata.get("data")
    require(isinstance(entries, list), "Native hooks inspection did not return a data list")
    entries = [entry for entry in entries if Path(entry.get("cwd", "")).resolve() == cwd]
    require(len(entries) == 1 and isinstance(entries[0].get("hooks"), list), "Native hooks inspection did not return the requested directory")
    hooks = [hook for hook in entries[0]["hooks"] if hook.get("pluginId") == PLUGIN_ID]
    missing = [event for event in NATIVE_EVENTS if not any(hook.get("eventName") == event for hook in hooks)]
    errors = entries[0].get("errors", [])
    trusted = bool(hooks) and all(hook.get("trustStatus") in ("trusted", "managed") for hook in hooks)
    active = trusted and not missing and not errors and all(hook.get("enabled") is True for hook in hooks)
    status = "trusted" if active else "disabled" if trusted and not missing and not errors else "review_required"
    return {"status": status, "missing_events": missing,
            "errors": errors, "warnings": entries[0].get("warnings", []),
            "events": [{key: hook.get(key) for key in ("eventName", "enabled", "trustStatus", "currentHash")} for hook in hooks]}


def inspect(args):
    environment = dict(os.environ)
    codex_home = Path(args.codex_home or environment.get("CODEX_HOME") or Path.home() / ".codex").expanduser().resolve()
    # Keep relative inherited homes bound to this invocation, even when the RPC has another cwd.
    environment["CODEX_HOME"] = str(codex_home)
    cwd = Path(args.cwd).expanduser().resolve(strict=True)
    require(cwd.is_dir(), "Hook inspection cwd must be a directory")
    report = {"operation": args.operation, "codex_home": str(codex_home), "cwd": str(cwd),
              "plugin": {"status": "not_checked"}, "default_mode": {"status": "not_checked"},
              "hooks": {"status": "not_checked"}, "configuration_ready": False,
              "fresh_session_verified": False, "problems": []}
    next_steps = []
    try:
        plugin = installed_plugin(environment, args.timeout)
        if plugin is None and args.operation == "setup":
            native(["codex", "plugin", "marketplace", "add", "DietrichGebert/ponytail"], environment, args.timeout)
            native(["codex", "plugin", "add", PLUGIN_ID], environment, args.timeout)
            plugin = installed_plugin(environment, args.timeout)
        if plugin is None:
            report["plugin"] = {"status": "missing"}
            report["problems"].append("Official Ponytail is not installed")
            report["next_step"] = f"Run setup --default {args.default} to install the official plugin."
            return report
        root = plugin_root(codex_home, plugin)
        report["plugin"] = {"status": "installed", "enabled": plugin.get("enabled") is True, "version": plugin["version"],
                            "source": plugin["source"], "root": str(root)}
        if plugin.get("enabled") is not True:
            report["problems"].append("Official Ponytail is disabled")
            report["next_step"] = "Review and enable Ponytail in Codex's native plugin controls, then rerun doctor."
            return report
        mode = default_mode(root, args.operation, args.default, environment, args.timeout)
        report["default_mode"] = mode
        if not mode["matches"]:
            difference = f"Expected {args.default}, but Ponytail resolved {mode['effective']}"
            if mode["environment_override"] is not None:
                report["problems"].append(f"{difference} from PONYTAIL_DEFAULT_MODE")
                next_steps.append(f"Set PONYTAIL_DEFAULT_MODE to {args.default} in the environment that launches Codex, "
                                  f"or unset it and run setup --default {args.default} to use the shared configuration.")
            else:
                source = f"configuration file {mode['config_path']}" if mode["source"] == "config_file" else "Ponytail's built-in default"
                report["problems"].append(f"{difference} from {source}")
                next_steps.append(f"Run setup --default {args.default} to set the shared default, "
                                  f"or doctor --default {mode['effective']} if that mode is intentional.")
        report["hooks"] = hook_state(native_hooks(environment, cwd, args.timeout), cwd)
        if report["hooks"]["errors"]:
            report["problems"].append("Native hook loading failed: " + json.dumps(report["hooks"]["errors"], ensure_ascii=False))
            next_steps.append("Resolve the reported hook loading errors, then rerun doctor with your intended --default.")
        elif report["hooks"]["missing_events"]:
            report["problems"].append("Codex did not list the required Ponytail events: " + ", ".join(report["hooks"]["missing_events"]))
            next_steps.append("Check that native hooks are enabled for this project and the official plugin is loaded. "
                              "Inspect the listed events in /hooks, then rerun doctor with your intended --default.")
        elif report["hooks"]["status"] != "trusted":
            untrusted = [event["eventName"] for event in report["hooks"]["events"]
                         if event["trustStatus"] not in ("trusted", "managed")]
            disabled = [event["eventName"] for event in report["hooks"]["events"] if event["enabled"] is not True]
            if untrusted:
                report["problems"].append("Ponytail lifecycle hooks need Codex's native startup hook review: " + ", ".join(untrusted))
                next_steps.append("Start Codex for this project and choose Review hooks on its startup prompt. "
                                  "Review, trust and enable the Ponytail commands you approve, then rerun doctor with your intended --default. "
                                  "If /hooks in an existing session disagrees with doctor, use the startup review.")
            if disabled:
                report["problems"].append("Ponytail lifecycle hooks are disabled: " + ", ".join(disabled))
                next_steps.append("Use Codex's native /hooks controls for this project to enable the listed Ponytail event commands "
                                  "you approve, then rerun doctor with your intended --default.")
        report["configuration_ready"] = not report["problems"]
    except (OSError, ValueError, TypeError, KeyError, subprocess.TimeoutExpired) as error:
        report["problems"].append(str(error))
        next_steps.append(f"Resolve the reported failure, then rerun {args.operation} in the same environment.")
    report["next_step"] = " ".join(next_steps) or "Open a fresh Codex thread to check actual hook activation."
    return report


def main(argv=None):
    scope = (
        "CODEX_HOME only selects Codex's plugin cache and configuration. Ponytail's shared default is resolved by its official module: "
        "PONYTAIL_DEFAULT_MODE, then XDG_CONFIG_HOME/ponytail/config.json, otherwise ~/.config/ponytail/config.json "
        "(APPDATA/ponytail/config.json on Windows). This tool never changes HOME or an explicit session mode.")
    parser = argparse.ArgumentParser(description=__doc__, epilog=scope)
    commands = parser.add_subparsers(dest="operation", required=True)
    for operation in ("setup", "doctor"):
        command = commands.add_parser(operation, epilog=scope, help="Install/reuse and set the default" if operation == "setup" else "Inspect without installing or changing settings")
        command.add_argument("--codex-home", help="Codex home passed only through the child process CODEX_HOME")
        command.add_argument("--default", choices=MODES, default="full", help="Expected default runtime mode (default: full)")
        command.add_argument("--cwd", default=str(Path.cwd()), help="Directory whose native hook settings should be inspected")
        command.add_argument("--timeout", type=float, default=30, help="Timeout in seconds per native command/RPC (default: 30)")
    args = parser.parse_args(argv)
    if args.timeout <= 0:
        parser.error("--timeout must be greater than zero")
    try:
        report = inspect(args)
    except (OSError, ValueError) as error:
        report = {"configuration_ready": False, "fresh_session_verified": False, "problems": [str(error)]}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["configuration_ready"] else 1


if __name__ == "__main__":
    sys.exit(main())
