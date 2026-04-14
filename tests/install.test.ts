import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { 
  projectSkillsToHost, 
  getDefaultInstallPaths,
  type InstallPaths
} from '../scripts/lib/install.js';

function setupMockEnvironment() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moluoxixi-test-'));
  const userHome = path.join(tmpDir, 'user');
  const moluoHome = path.join(userHome, '.moluoxixi');
  
  fs.mkdirSync(userHome, { recursive: true });
  fs.mkdirSync(moluoHome, { recursive: true });
  
  // Create some dummy skills in .moluoxixi/skills
  const skillsBase = path.join(moluoHome, 'skills');
  fs.mkdirSync(skillsBase, { recursive: true });
  fs.mkdirSync(path.join(skillsBase, 'skill-a'), { recursive: true });
  fs.mkdirSync(path.join(skillsBase, 'skill-b'), { recursive: true });

  const claudeHome = path.join(userHome, '.claude');
  fs.mkdirSync(claudeHome, { recursive: true });

  return { tmpDir, userHome, moluoHome, claudeHome };
}

function cleanup(tmpDir: string) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

test('Installation linking - Without .agents', () => {
  const { tmpDir, userHome, moluoHome, claudeHome } = setupMockEnvironment();

  try {
    const claudeSkillsDir = path.join(claudeHome, 'skills');
    projectSkillsToHost(userHome, moluoHome, claudeSkillsDir);

    // Verify ~/.claude/skills exists
    assert.ok(fs.existsSync(claudeSkillsDir), 'Claude skills directory should exist');

    // Verify it contains skill-a and skill-b as symlinks
    const skillA = path.join(claudeSkillsDir, 'skill-a');
    assert.ok(fs.lstatSync(skillA).isSymbolicLink(), 'skill-a should be a symlink');
    
    const target = path.resolve(path.dirname(skillA), fs.readlinkSync(skillA));
    assert.strictEqual(
      path.normalize(target),
      path.normalize(path.join(moluoHome, 'skills', 'skill-a'))
    );

    // Verify .agents/skills does not exist
    const agentsDir = path.join(userHome, '.agents');
    assert.ok(!fs.existsSync(agentsDir), 'agents directory should not exist');
  } finally {
    cleanup(tmpDir);
  }
});

test('Installation linking - With .agents chaining only', () => {
  const { tmpDir, userHome, moluoHome, claudeHome } = setupMockEnvironment();

  try {
    const agentsDir = path.join(userHome, '.agents');
    fs.mkdirSync(agentsDir, { recursive: true });

    const claudeSkillsDir = path.join(claudeHome, 'skills');
    projectSkillsToHost(userHome, moluoHome, claudeSkillsDir);

    // Verify .agents links point to moluoxixi
    const agentSkillA = path.join(agentsDir, 'skills', 'skill-a');
    assert.ok(fs.lstatSync(agentSkillA).isSymbolicLink(), 'agent skill-a should be a symlink');
    const agentTarget = path.resolve(path.dirname(agentSkillA), fs.readlinkSync(agentSkillA));
    assert.strictEqual(
      path.normalize(agentTarget),
      path.normalize(path.join(moluoHome, 'skills', 'skill-a'))
    );

    // Verify Claude links point to .agents
    const skillA = path.join(claudeSkillsDir, 'skill-a');
    assert.ok(fs.lstatSync(skillA).isSymbolicLink(), 'Claude skill-a should be a symlink');
    const claudeTarget = path.resolve(path.dirname(skillA), fs.readlinkSync(skillA));
    assert.strictEqual(
      path.normalize(claudeTarget),
      path.normalize(agentSkillA)
    );
  } finally {
    cleanup(tmpDir);
  }
});

test('Installation linking - With .cc-switch chaining only', () => {
  const { tmpDir, userHome, moluoHome, claudeHome } = setupMockEnvironment();

  try {
    const ccSwitchDir = path.join(userHome, '.cc-switch');
    fs.mkdirSync(ccSwitchDir, { recursive: true });

    const claudeSkillsDir = path.join(claudeHome, 'skills');
    projectSkillsToHost(userHome, moluoHome, claudeSkillsDir);

    // Verify .cc-switch links point to moluoxixi
    const ccSwitchSkillA = path.join(ccSwitchDir, 'skills', 'skill-a');
    assert.ok(fs.lstatSync(ccSwitchSkillA).isSymbolicLink(), 'ccSwitch skill-a should be a symlink');
    const ccSwitchTarget = path.resolve(path.dirname(ccSwitchSkillA), fs.readlinkSync(ccSwitchSkillA));
    assert.strictEqual(
      path.normalize(ccSwitchTarget),
      path.normalize(path.join(moluoHome, 'skills', 'skill-a'))
    );

    // Verify Claude links point to .cc-switch
    const skillA = path.join(claudeSkillsDir, 'skill-a');
    assert.ok(fs.lstatSync(skillA).isSymbolicLink(), 'Claude skill-a should be a symlink');
    const claudeTarget = path.resolve(path.dirname(skillA), fs.readlinkSync(skillA));
    assert.strictEqual(
      path.normalize(claudeTarget),
      path.normalize(ccSwitchSkillA)
    );
  } finally {
    cleanup(tmpDir);
  }
});

test('Installation linking - With .cc-switch and .agents chaining', () => {
  const { tmpDir, userHome, moluoHome, claudeHome } = setupMockEnvironment();

  try {
    // Manually create .cc-switch and .agents to trigger the complete chain
    const ccSwitchDir = path.join(userHome, '.cc-switch');
    fs.mkdirSync(ccSwitchDir, { recursive: true });
    
    const agentsDir = path.join(userHome, '.agents');
    fs.mkdirSync(agentsDir, { recursive: true });

    const claudeSkillsDir = path.join(claudeHome, 'skills');
    projectSkillsToHost(userHome, moluoHome, claudeSkillsDir);

    // Verify .cc-switch links point to moluoxixi
    const ccSwitchSkillA = path.join(ccSwitchDir, 'skills', 'skill-a');
    assert.ok(fs.lstatSync(ccSwitchSkillA).isSymbolicLink(), 'ccSwitch skill-a should be a symlink');
    const ccSwitchTarget = path.resolve(path.dirname(ccSwitchSkillA), fs.readlinkSync(ccSwitchSkillA));
    assert.strictEqual(
      path.normalize(ccSwitchTarget),
      path.normalize(path.join(moluoHome, 'skills', 'skill-a'))
    );

    // Verify .agents links point to .cc-switch
    const agentSkillA = path.join(agentsDir, 'skills', 'skill-a');
    assert.ok(fs.lstatSync(agentSkillA).isSymbolicLink(), 'agent skill-a should be a symlink');
    const agentTarget = path.resolve(path.dirname(agentSkillA), fs.readlinkSync(agentSkillA));
    assert.strictEqual(
      path.normalize(agentTarget),
      path.normalize(ccSwitchSkillA)
    );

    // Verify Claude links point to .agents
    const skillA = path.join(claudeSkillsDir, 'skill-a');
    assert.ok(fs.lstatSync(skillA).isSymbolicLink(), 'Claude skill-a should be a symlink');
    const claudeTarget = path.resolve(path.dirname(skillA), fs.readlinkSync(skillA));
    assert.strictEqual(
      path.normalize(claudeTarget),
      path.normalize(agentSkillA)
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
