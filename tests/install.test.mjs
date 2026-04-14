import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { projectSkillsToHost } from '../scripts/lib/install.mjs';

function setupMockEnvironment() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moluoxixi-test-'));
  const userHome = path.join(tmpDir, 'home');
  const moluoHome = path.join(userHome, '.moluoxixi');
  const claudeHome = path.join(userHome, '.claude');

  // Create base directories
  fs.mkdirSync(moluoHome, { recursive: true });
  fs.mkdirSync(path.join(moluoHome, 'skills', 'skill-a'), { recursive: true });
  fs.mkdirSync(path.join(moluoHome, 'skills', 'skill-b'), { recursive: true });
  
  return { tmpDir, userHome, moluoHome, claudeHome };
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

test('Installation linking - Without .agents', () => {
  const { tmpDir, userHome, moluoHome, claudeHome } = setupMockEnvironment();

  try {
    const claudeSkillsDir = path.join(claudeHome, 'skills');
    projectSkillsToHost(userHome, moluoHome, claudeSkillsDir);

    // Verify ~/.claude/skills exists
    assert.ok(fs.existsSync(claudeSkillsDir), 'Claude skills directory should exist');

    // Verify skill-a links directly to moluoxixi
    const skillA = path.join(claudeSkillsDir, 'skill-a');
    assert.ok(fs.lstatSync(skillA).isSymbolicLink(), 'skill-a should be a symlink');
    
    // It should point to ~/.moluoxixi/skills/skill-a
    const rawLinkPath = fs.readlinkSync(skillA);
    const resolvedLinkTarget = path.resolve(path.dirname(skillA), rawLinkPath);
    const expectedTarget = path.join(moluoHome, 'skills', 'skill-a');
    
    // Compare resolved target values
    assert.strictEqual(
      path.normalize(resolvedLinkTarget),
      path.normalize(expectedTarget),
      'Link should point directly to .moluoxixi/skills/skill-a'
    );

    // Verify .agents/skills does not exist
    const agentsDir = path.join(userHome, '.agents');
    assert.ok(!fs.existsSync(agentsDir), 'agents directory should not exist');
  } finally {
    cleanup(tmpDir);
  }
});

test('Installation linking - With .agents', () => {
  const { tmpDir, userHome, moluoHome, claudeHome } = setupMockEnvironment();

  try {
    // Manually create .agents directory to trigger the alternative logic
    const agentsDir = path.join(userHome, '.agents');
    fs.mkdirSync(agentsDir, { recursive: true });

    const claudeSkillsDir = path.join(claudeHome, 'skills');
    projectSkillsToHost(userHome, moluoHome, claudeSkillsDir);

    // Verify ~/.claude/skills exists
    assert.ok(fs.existsSync(claudeSkillsDir), 'Claude skills directory should exist');

    // Verify ~/.agents/skills/skill-a exists
    const agentSkillA = path.join(agentsDir, 'skills', 'skill-a');
    assert.ok(fs.lstatSync(agentSkillA).isSymbolicLink(), 'agent skill-a should be a symlink');

    // Verify .agents link points to moluoxixi
    const agentRawLink = fs.readlinkSync(agentSkillA);
    const agentResolvedTarget = path.resolve(path.dirname(agentSkillA), agentRawLink);
    assert.strictEqual(
      path.normalize(agentResolvedTarget),
      path.normalize(path.join(moluoHome, 'skills', 'skill-a')),
      'Agent link should point directly to .moluoxixi/skills/skill-a'
    );

    // Verify Claude link points to .agents
    const skillA = path.join(claudeSkillsDir, 'skill-a');
    assert.ok(fs.lstatSync(skillA).isSymbolicLink(), 'Claude skill-a should be a symlink');
    
    const claudeRawLink = fs.readlinkSync(skillA);
    const claudeResolvedTarget = path.resolve(path.dirname(skillA), claudeRawLink);
    assert.strictEqual(
      path.normalize(claudeResolvedTarget),
      path.normalize(agentSkillA),
      'Claude link should point to .agents/skills/skill-a'
    );
  } finally {
    cleanup(tmpDir);
  }
});

test('Installation linking - Pre-existing folder deletion', () => {
  const { tmpDir, userHome, moluoHome, claudeHome } = setupMockEnvironment();

  try {
    const claudeSkillsDir = path.join(claudeHome, 'skills');
    fs.mkdirSync(claudeSkillsDir, { recursive: true });
    
    // Create a real directory that conflicts with the skill name
    const preExistingFolder = path.join(claudeSkillsDir, 'skill-a');
    fs.mkdirSync(preExistingFolder, { recursive: true });
    fs.writeFileSync(path.join(preExistingFolder, 'dummy.txt'), 'hello');
    
    assert.ok(!fs.lstatSync(preExistingFolder).isSymbolicLink(), 'Pre-existing folder should not be a symlink initially');

    projectSkillsToHost(userHome, moluoHome, claudeSkillsDir);

    // Verify it was replaced by a symlink
    assert.ok(fs.lstatSync(preExistingFolder).isSymbolicLink(), 'skill-a should be replaced with a symlink');
  } finally {
    cleanup(tmpDir);
  }
});
