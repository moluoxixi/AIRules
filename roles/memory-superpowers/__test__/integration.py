"""Run after init: uv run --with mcp integration.py /absolute/initialized/project.
Checks the real stdio MCP handshake and tool discovery, source deduplication,
and preservation of unrelated rules/MCP config through a repeat init.
"""
import asyncio
import json
from pathlib import Path
import subprocess
import sys
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

script = Path(__file__).resolve().parents[1] / 'skills/memory-superpowers/scripts/project.py'
project = Path(sys.argv[1]).resolve()
command = ['uv', 'run', str(script)]

def run(args):
    return subprocess.run(command + args, check=True, capture_output=True, text=True)

async def main():
    config = project / '.codex/config.toml'
    with config.open('a') as stream:
        stream.write('\n# integration-preservation-sentinel\n')
    agents = project / 'AGENTS.md'
    with agents.open('a') as stream:
        stream.write('\nUser integration sentinel\n')
    run(['init', '--project', str(project), '--host', 'codex'])
    assert 'integration-preservation-sentinel' in config.read_text()
    assert 'User integration sentinel' in agents.read_text()
    assert agents.read_text().count('<!-- memory-superpowers -->') == 1
    for _ in range(2):
        run(['source', '--project', str(project), '.airules/tasks/check', 'AGENTS.md', 'Applicable project instructions'])
    entries = [json.loads(line) for line in (project / '.airules/tasks/check/sources.jsonl').read_text().splitlines()]
    assert entries == [{'file': 'AGENTS.md', 'reason': 'Applicable project instructions'}]
    params = StdioServerParameters(command='uv', args=['run', str(script), 'bm', '--project', str(project), 'mcp'])
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            assert tools.tools
            print('MCP handshake and tool discovery passed:', [t.name for t in tools.tools])
    print('Repeat init, config preservation and source deduplication passed')

asyncio.run(main())
