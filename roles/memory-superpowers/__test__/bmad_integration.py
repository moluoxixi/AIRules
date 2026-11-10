# /// script
# requires-python = ">=3.12"
# ///
"""Exercise the real BMAD installer and bindings without creating Git commits.

Run: uv run roles/memory-superpowers/__test__/bmad_integration.py [--keep] [--source-cache PATH]
The first run downloads the pinned upstream. All writes use a temporary project.
This validates installation and input preservation, not an LLM's review quality.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile


SCRIPT = Path(__file__).resolve().parents[1] / 'skills/review-requirements/scripts/bmad.py'
COMMIT = 'bab9082c3e884e0d72c759bcd1a6d90bcc01be84'


def command(args, *, success=True):
    result = subprocess.run(args, capture_output=True, text=True, timeout=240)
    if success:
        assert result.returncode == 0, f'{args}\n{result.stdout}\n{result.stderr}'
    else:
        assert result.returncode != 0, f'Unexpected success: {args}\n{result.stdout}'
    return result


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(root, relative, content):
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')
    return path


def exercise(root, source_cache=None):
    project = root / '中文 project'
    project.mkdir()
    write(project, '.gitignore', '# Existing ignore rules\nnode_modules/\n')
    prd = write(project, '产品资料/订单 需求说明.md', '# 订单需求\n\n提交后可撤回。失败后的处理待产品确认。\n')
    standards = write(project, '团队约定.md', '# 规范\n禁用按钮说明原因及恢复条件。\n')
    prototype = write(project, '原型/订单.html', '<!doctype html><title>订单</title><button disabled>提交</button>')
    owned = [
        prd, standards, prototype,
        write(project, '_bmad/config.toml', '# Existing user installation\n[core]\nproject_name = "user-owned"\n'),
        write(project, 'AGENTS.md', '# Existing project instructions\n'),
        write(project, '.codex/config.toml', '# Existing host config\n'),
    ]
    config = write(project, '.airules/config.yaml', '''memory_superpowers:
  documents:
    standards: [团队约定.md]
    product: [产品资料]
    api: [https://example.invalid/openapi.yaml]
    design: []
    prototype: [原型/订单.html]
''')
    owned.append(config)
    originals = {path: digest(path) for path in owned}
    task = '.airules/tasks/订单 评审'
    index = write(project, f'{task}/sources.jsonl', json.dumps({
        'file': '团队约定.md', 'reason': 'Existing adopted source',
    }, ensure_ascii=False) + '\n')

    def invoke(action, *args, success=True):
        cache_args = ['--source-cache', str(source_cache)] if source_cache else []
        return command(['uv', 'run', str(SCRIPT), action, '--project', str(project),
                        *cache_args, *args], success=success)

    installed = json.loads(invoke('install').stdout)
    runtime = Path(installed['project_root'])
    skill = Path(installed['skill_root'])
    cache = Path(installed['upstream']['cache'])
    assert installed['upstream']['commit'] == COMMIT
    assert installed['source_project'] == str(project)
    assert runtime == project / '.airules/memory-superpowers/bmad/runtime'
    assert skill == runtime / '.agents/skills/bmad-prd'
    for key in ['prd_template', 'validation_checklist_template', 'validation_report_template']:
        template = Path(installed['resolved_workflow'][key])
        assert template.is_absolute() and template.is_file(), key
    for name in ['SKILL.md', 'customize.toml', 'references/headless.md', 'references/validate.md',
                 'assets/prd-template.md', 'assets/prd-validation-checklist.md',
                 'assets/headless-schemas.md', 'assets/validation-report-template.html']:
        assert (skill / name).is_file(), name
    for name in ['resolve_config.py', 'resolve_customization.py', 'config_utils.py', 'memlog.py']:
        assert (runtime / '_bmad/scripts' / name).is_file(), name
    assert command(['git', '-C', str(cache), 'rev-parse', 'HEAD']).stdout.strip() == COMMIT
    assert command(['git', '-C', str(cache), 'status', '--porcelain']).stdout == ''

    prepared = json.loads(invoke('prepare', '--prd', str(prd.relative_to(project)), '--task', task).stdout)
    assert prepared['intent'] == 'validate'
    assert prepared['headless'] is True
    assert prepared['prd'] == str(prd)
    assert prepared['doc_workspace'] == str(project / task)
    assert prepared['sources_index'] == str(index)
    assert prepared['documents']['api'] == ['https://example.invalid/openapi.yaml']
    assert prepared['documents']['prototype'] == ['原型/订单.html']
    assert Path(prepared['workflow']['validation_checklist_template']).is_file()
    assert prepared['resolved_workflow']['validation_checklist_template'] == prepared['workflow']['validation_checklist_template']
    assert prepared['resolved_workflow']['validation_report_template'] == installed['resolved_workflow']['validation_report_template']
    assert not (project / task / 'validation-report.md').exists(), 'Preparation must not invent a review'
    first_entries = index.read_text(encoding='utf-8')
    invoke('install')
    invoke('prepare', '--prd', str(prd.relative_to(project)), '--task', task)
    assert index.read_text(encoding='utf-8') == first_entries
    entries = [json.loads(line) for line in first_entries.splitlines()]
    assert len(entries) == 2
    assert entries[0] == {'file': '团队约定.md', 'reason': 'Existing adopted source'}
    assert entries[1]['file'] == prd.relative_to(project).as_posix()
    assert all(set(entry) == {'file', 'reason'} for entry in entries)
    assert (project / '.gitignore').read_text().count('/.airules/memory-superpowers/') == 1
    assert (project / '.gitignore').read_text().startswith('# Existing ignore rules\nnode_modules/\n')
    assert {path: digest(path) for path in owned} == originals

    custom = write(project, '配置/评审.yaml', 'memory_superpowers:\n  documents:\n    product: [产品资料/订单 需求说明.md]\n')
    override = json.loads(invoke('prepare', '--prd', str(prd.relative_to(project)), '--task', task,
                                 '--config', str(custom)).stdout)
    assert override['documents']['product'] == ['产品资料/订单 需求说明.md']
    assert custom.read_text(encoding='utf-8').startswith('memory_superpowers:')

    scripts = runtime / '_bmad/scripts'
    resolved = json.loads(command(['uv', 'run', str(scripts / 'resolve_config.py'),
                                  '--project-root', str(runtime)]).stdout)
    assert resolved, 'Official configuration resolver returned no settings'
    customization = json.loads(command(['uv', 'run', str(scripts / 'resolve_customization.py'),
                                       '--project-root', str(runtime), '--skill', str(skill),
                                       '--key', 'workflow.validation_report_template']).stdout)
    assert customization['workflow.validation_report_template'], customization
    log_workspace = root / 'runtime script smoke'
    command(['uv', 'run', str(scripts / 'memlog.py'), 'init', '--workspace', str(log_workspace)])
    command(['uv', 'run', str(scripts / 'memlog.py'), 'append', '--workspace', str(log_workspace),
             '--type', 'event', '--text', 'Integration test verified the official logging runtime'])
    assert 'Integration test verified' in (log_workspace / '.memlog.md').read_text()

    # Reuse the pinned clean upstream in another clone without touching its sources.
    second = root / 'second project'
    second.mkdir()
    write(second, '.moluoxixi/config.yaml', 'memory_superpowers:\n  documents:\n    api: [docs/api.yaml]\n')
    write(second, 'requirements.md', '# Existing requirements\n')
    second_binding = json.loads(command([
        'uv', 'run', str(SCRIPT), 'prepare', '--project', str(second),
        '--source-cache', str(cache), '--prd', 'requirements.md', '--task', '.airules/tasks/review',
    ]).stdout)
    assert second_binding['source_project'] == str(second)
    assert second_binding['documents']['api'] == ['docs/api.yaml']
    assert Path(second_binding['project_root']).is_relative_to(second)
    assert command(['git', '-C', str(cache), 'status', '--porcelain']).stdout == ''

    # Reject invalid targets before writing an index or changing the product source.
    for bad_task in ['../outside-review', str(root / 'absolute-outside-review')]:
        invoke('prepare', '--prd', str(prd.relative_to(project)), '--task', bad_task, success=False)
    outside_prd = write(root, 'outside.md', '# Not in the selected project\n')
    invoke('prepare', '--prd', str(outside_prd), '--task', task, success=False)
    invoke('prepare', '--prd', 'missing.md', '--task', task, success=False)
    ignore_before = (project / '.gitignore').read_bytes()
    invoke('prepare', '--prd', '.gitignore', '--task', task, success=False)
    assert (project / '.gitignore').read_bytes() == ignore_before
    ignore_alias = project / 'ignore-as-product.md'
    ignore_alias.hardlink_to(project / '.gitignore')
    invoke('prepare', '--prd', 'ignore-as-product.md', '--task', task, success=False)
    assert ignore_alias.read_bytes() == ignore_before
    local_state_prd = runtime / '_bmad/config.toml'
    invoke('prepare', '--prd', str(local_state_prd.relative_to(project)), '--task', task, success=False)
    fresh = root / 'invalid input project'
    fresh.mkdir()
    command(['uv', 'run', str(SCRIPT), 'prepare', '--project', str(fresh),
             '--prd', 'missing.md', '--task', 'review'], success=False)
    assert list(fresh.iterdir()) == [], 'Invalid input must fail before installation side effects'
    external_dir = root / 'outside-directory'
    external_dir.mkdir()
    (project / 'linked-output').symlink_to(external_dir, target_is_directory=True)
    invoke('prepare', '--prd', str(prd.relative_to(project)), '--task', 'linked-output', success=False)
    conflict = write(project, 'collision/validation-report.md', '# This is the product original\n')
    conflict_before = digest(conflict)
    invoke('prepare', '--prd', 'collision/validation-report.md', '--task', 'collision', success=False)
    assert digest(conflict) == conflict_before
    assert not (project / 'collision/sources.jsonl').exists()
    assert not (root / 'outside-review').exists()
    assert not (root / 'absolute-outside-review').exists()
    assert not list(external_dir.iterdir())
    assert {path: digest(path) for path in owned} == originals

    # A partial/manual runtime change must be reported, never silently repaired over it.
    runtime_config = runtime / '_bmad/config.toml'
    before_config = runtime_config.read_bytes()
    runtime_config.write_bytes(before_config + b'\n# Locally changed runtime sentinel\n')
    altered_config = runtime_config.read_bytes()
    invoke('install', success=False)
    assert runtime_config.read_bytes() == altered_config
    runtime_config.write_bytes(before_config)
    invoke('install')

    dirty_sentinel = cache / f'.integration-untracked-{root.name}'
    assert not dirty_sentinel.exists()
    try:
        dirty_sentinel.write_text('Preserve local cache changes\n')
        rejected = invoke('install', success=False)
        assert 'local changes' in rejected.stderr, rejected.stderr
        assert dirty_sentinel.read_text() == 'Preserve local cache changes\n'
        assert command(['git', '-C', str(cache), 'rev-parse', 'HEAD']).stdout.strip() == COMMIT
    finally:
        dirty_sentinel.unlink(missing_ok=True)
    assert command(['git', '-C', str(cache), 'status', '--porcelain']).stdout == ''

    print(json.dumps({
        'status': 'passed',
        'project': str(project),
        'upstream_commit': COMMIT,
        'checks': ['real pinned installation', 'arbitrary PRD name and source preservation',
                   'repeat installation and index deduplication', 'configured document entrypoints',
                   'official config/customization/memory scripts', 'unsafe and conflicting path rejection',
                   'shared clean upstream with isolated clone configuration',
                   'user BMAD and host configuration preservation', 'changed runtime refusal',
                   'dirty upstream rejection without reset'],
        'llm_review_quality': 'not tested by this script',
    }, ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--keep', action='store_true', help='Keep the temporary project for manual review')
    parser.add_argument('--source-cache', type=Path, help='Reuse a verified clean pinned upstream checkout')
    args = parser.parse_args()
    # TemporaryDirectory also removes read-only Git objects on Windows.
    with tempfile.TemporaryDirectory(prefix='airules-bmad-integration-', delete=not args.keep) as temporary:
        root = Path(temporary).resolve()
        try:
            exercise(root, args.source_cache)
        finally:
            if args.keep:
                print(f'Kept test workspace: {root}')


if __name__ == '__main__':
    main()
