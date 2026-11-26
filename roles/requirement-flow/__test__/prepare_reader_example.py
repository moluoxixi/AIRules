"""Prepare a disposable reader example from the retained, tested project snapshots."""
import argparse
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


HERE = Path(__file__).resolve().parent


def prepare(output):
    output = Path(output).absolute()
    if output.exists() or output.is_symlink():
        raise ValueError('Output must be a new directory; existing files are preserved')
    if not output.parent.is_dir():
        raise ValueError('Create the output parent directory first')
    with tempfile.TemporaryDirectory(prefix='requirement-flow-reader-example-') as directory:
        stage = Path(directory)
        for name in ('simple', 'evolving'):
            shutil.copytree(HERE / 'scenarios' / name / 'project', stage / name / 'project')
        subprocess.run(['git', 'apply', str(HERE / 'scenarios/results/completed.patch')],
                       cwd=stage, check=True, timeout=20)
        demo = stage / 'reader-project'
        demo.mkdir()
        shutil.copytree(stage / 'evolving/project', demo / 'inventory')
        subprocess.run(['git', 'apply', str(HERE / 'scenarios/results/second-projects.patch')],
                       cwd=demo, check=True, timeout=20)
        shutil.copytree(HERE / 'reader-example/docs', demo / 'docs')
        (demo / 'evidence').mkdir()
        shutil.copy2(HERE / 'scenarios/results/second-projects-replay.output.txt',
                     demo / 'evidence/second-projects-replay.output.txt')
        (demo / 'README.md').write_text(
            '# 业务阅读样例\n\n[从业务总览开始](docs/business/index.md)\n', encoding='utf-8')
        shutil.copytree(demo, output)
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    try:
        output = prepare(args.output)
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        print(str(error), file=sys.stderr)
        return 1
    print(output)
    return 0


if __name__ == '__main__':
    sys.exit(main())
