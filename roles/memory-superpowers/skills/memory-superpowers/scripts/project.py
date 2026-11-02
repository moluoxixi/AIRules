# /// script
# requires-python = ">=3.12"
# dependencies = ["basic-memory==1.0.0", "pyyaml==6.0.3"]
# ///
"""uv run project.py init|bm|source --project ROOT [arguments]."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import yaml

UPSTREAMS = {
    'superpowers': ('https://github.com/obra/superpowers.git', '2ce8aa15d05bd57213e6f746f953aafb7ded7a8b'),
    'basic-memory': ('https://github.com/basicmachines-co/basic-memory.git', '01b43f9753f1d8422645e7426e7d55ef3efba179'),
}

def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)

def append_once(file, text):
    old = file.read_text() if file.exists() else ''
    if text.strip() not in old:
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(old + '\n' + text + '\n')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['init', 'bm', 'source'])
    parser.add_argument('--project', required=True)
    parser.add_argument('--host', choices=['codex', 'claude', 'cursor'], default='codex')
    parser.add_argument('--config')
    opts, args = parser.parse_known_args()
    root = Path(opts.project).resolve(strict=True)
    if root == Path.home() or not root.is_dir():
        raise ValueError('Select a project directory, not HOME')
    config = Path(opts.config) if opts.config else root / '.moluoxixi/config.yaml'
    if not config.exists() and not opts.config:
        config = root / '.airules/config.yaml'
    data = yaml.safe_load(config.read_text()) if config.exists() else {}
    settings = (data or {}).get('memory_superpowers', {})
    memory = (root / settings.get('memory_path', 'docs/memory')).resolve()
    if not memory.is_relative_to(root) or memory == root:
        raise ValueError('memory_path must be a directory inside this project')
    state = root / '.airules/memory-superpowers'
    identity = 'airules-' + hashlib.sha256(str(root).encode()).hexdigest()[:16]
    env = dict(os.environ, BASIC_MEMORY_CONFIG_DIR=str(state / 'basic-memory'), BASIC_MEMORY_HOME=str(state / 'unused-default'), BASIC_MEMORY_CLOUD_MODE='false')
    bm = [sys.executable, '-c', 'from basic_memory.cli.main import app; app()']
    if opts.action == 'bm':
        registration = state / 'registration.json'
        if not registration.exists():
            raise ValueError('Run init in this clone first')
        if json.loads(registration.read_text()) != {'identity': identity, 'memory': str(memory)}:
            raise ValueError('Project binding changed; reinitialize this clone before using Memory')
        if '--cloud' in args:
            raise ValueError('This role uses local Memory only')
        # Always pin project, even when caller supplies a different project.
        if any(a == '--project' or a.startswith('--project=') for a in args):
            raise ValueError('Project is bound by this wrapper')
        run(bm + args + ['--project', identity], env=env, cwd=root)
        return
    if opts.action == 'source':
        if len(args) != 3:
            raise ValueError('source requires TASK_DIRECTORY FILE_OR_URL REASON')
        task = (root / args[0]).resolve()
        if not task.is_relative_to(root):
            raise ValueError('Task directory must be inside project')
        file, reason = args[1:]
        if '://' not in file and (Path(file).is_absolute() or not (root / file).resolve().is_relative_to(root)):
            raise ValueError('Source must be repository relative or URL')
        target = task / 'sources.jsonl'
        entries = [json.loads(line) for line in target.read_text().splitlines() if line.strip()] if target.exists() else []
        entries = [e for e in entries if e['file'] != file] + [{'file': file, 'reason': reason}]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(''.join(json.dumps(e, ensure_ascii=False) + '\n' for e in entries))
        return
    # Keep all machine state local; Markdown and source indexes remain shareable.
    append_once(root / '.gitignore', '/.airules/memory-superpowers/')
    state.mkdir(parents=True, exist_ok=True)
    memory.mkdir(parents=True, exist_ok=True)
    registered = state / 'registration.json'
    expected = {'identity': identity, 'memory': str(memory)}
    if registered.exists():
        if json.loads(registered.read_text()) != expected:
            raise ValueError('Memory path changed; migrate the registered project explicitly before reinitializing')
        run(bm + ['project', 'index', identity], env=env, cwd=root)
    else:
        run(bm + ['project', 'add', identity, str(memory), '--local'], env=env, cwd=root)
        registered.write_text(json.dumps(expected))
    for name, (url, commit) in UPSTREAMS.items():
        repo = state / ('upstream-' + name)
        if not repo.exists():
            run(['git', 'clone', '--no-checkout', '--filter=blob:none', url, str(repo)])
        run(['git', '-C', str(repo), 'checkout', '--detach', commit])
        names = ['memory-notes', 'memory-search'] if name == 'basic-memory' else [p.name for p in (repo / 'skills').iterdir() if (p / 'SKILL.md').exists()]
        if name == 'basic-memory':
            names = ['memory-notes', 'memory-metadata-search']
        for skill in names:
            # Native universal project discovery, plus host-specific discovery.
            bases = ['.agents/skills'] + (['.claude/skills'] if opts.host == 'claude' else ['.cursor/skills'] if opts.host == 'cursor' else [])
            for base in bases:
                target = root / base / skill
                global_skill = Path.home() / '.agents/skills' / skill
                namespace_skill = Path.home() / '.agents/skills' / name / skill
                if global_skill.exists() or namespace_skill.exists() or target.exists():
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                target.symlink_to(repo / 'skills' / skill, target_is_directory=True)
                append_once(root / '.gitignore', '/' + str(target.relative_to(root)))
    policy = Path(__file__).resolve().parents[1] / 'references/policy.md'
    target_policy = state / 'policy.md'
    shutil.copyfile(policy, target_policy)
    shutil.copyfile(policy.parent / 'scenarios.md', state / 'scenarios.md')
    append_once(target_policy, 'Active project configuration: `' + str(config) + '`.')
    instruction = '\n<!-- memory-superpowers -->\nRead `.airules/memory-superpowers/policy.md` before working on tasks in this project.\n<!-- /memory-superpowers -->'
    for name in ['AGENTS.md'] + (['CLAUDE.md'] if opts.host == 'claude' else []):
        append_once(root / name, instruction)
    server = {'command': 'uv', 'args': ['run', str(Path(__file__).resolve()), 'bm', '--project', str(root), 'mcp']}
    if opts.config:
        server['args'] += ['--config', str(config.resolve())]
    if opts.host == 'codex':
        target = root / '.codex/config.toml'
        if not target.exists():
            append_once(root / '.gitignore', '/.codex/config.toml')
        old = target.read_text() if target.exists() else ''
        import tomllib
        existing = tomllib.loads(old).get('mcp_servers', {}).get('airules-memory')
        if existing is not None and existing != server:
            raise ValueError('Existing airules-memory MCP differs; preserved, resolve manually')
        if existing is None:
            append_once(target, '[mcp_servers.airules-memory]\ncommand = "uv"\nargs = ' + json.dumps(server['args']))
    else:
        target = root / ('.mcp.json' if opts.host == 'claude' else '.cursor/mcp.json')
        if not target.exists():
            append_once(root / '.gitignore', '/' + str(target.relative_to(root)))
        obj = json.loads(target.read_text()) if target.exists() else {}
        servers = obj.setdefault('mcpServers', {})
        if 'airules-memory' in servers and servers['airules-memory'] != server:
            raise ValueError('Existing airules-memory MCP differs; preserved, resolve manually')
        servers['airules-memory'] = server
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(obj, indent=2) + '\n')
    print(json.dumps({'project': identity, 'memory': str(memory), 'config': str(config), 'host': opts.host}))

if __name__ == '__main__':
    main()
