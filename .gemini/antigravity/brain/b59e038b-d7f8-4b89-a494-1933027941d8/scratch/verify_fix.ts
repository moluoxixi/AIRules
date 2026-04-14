import path from 'node:path';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { syncFirstPartyToHome } from '../../../../../scripts/lib/install.js';

const testDir = path.resolve('scratch/test-sync');
rmSync(testDir, { recursive: true, force: true });
mkdirSync(testDir, { recursive: true });

const repoRoot = testDir;
const moluoHome = testDir;

const agentsDir = path.join(repoRoot, 'agents');
mkdirSync(agentsDir);
writeFileSync(path.join(agentsDir, 'test-agent.md'), 'test');
writeFileSync(path.join(repoRoot, 'AGENTS.md'), 'test agents');

console.log('Testing syncFirstPartyToHome when repoRoot === moluoHome');
try {
  syncFirstPartyToHome(repoRoot, moluoHome);
  console.log('SUCCESS: No crash occurred.');
  
  if (existsSync(path.join(repoRoot, 'AGENTS.md'))) {
    console.log('SUCCESS: AGENTS.md still exists.');
  } else {
    console.error('FAILURE: AGENTS.md was deleted!');
  }
} catch (error) {
  console.error('FAILURE: Crash occurred:', error);
}

const otherHome = path.resolve('scratch/test-sync-other');
rmSync(otherHome, { recursive: true, force: true });
mkdirSync(otherHome, { recursive: true });

console.log('\nTesting syncFirstPartyToHome when repoRoot !== moluoHome');
try {
  syncFirstPartyToHome(repoRoot, otherHome);
  console.log('SUCCESS: No crash occurred.');
  
  if (existsSync(path.join(otherHome, 'AGENTS.md'))) {
    console.log('SUCCESS: AGENTS.md was copied to otherHome.');
  } else {
    console.error('FAILURE: AGENTS.md was NOT copied!');
  }
} catch (error) {
  console.error('FAILURE: Crash occurred:', error);
}

rmSync(testDir, { recursive: true, force: true });
rmSync(otherHome, { recursive: true, force: true });
