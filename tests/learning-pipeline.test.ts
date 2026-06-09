import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it } from 'vitest'

function withTempDir<T>(prefix: string, run: (tmpDir: string) => T): T {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))

  try {
    return run(tmpDir)
  }
  finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

function runVerifyLearningCandidates(...args: string[]) {
  return spawnSync(
    process.execPath,
    [
      path.join(process.cwd(), 'scripts', 'verify-learning-candidates.mjs'),
      ...args,
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  )
}

const validLearningCandidate = `---
kind: learning-capture
status: PENDING_REVIEW
target: docs/AI项目知识/待确认/2026-06-09-render-deploy.md
---
# Render deploy card blocker

## 参考来源
- https://hermes-agent.nousresearch.com/docs/user-guide/features/memory/

## 证据
- User confirmed the deploy stopped at external account verification.

## 候选内容
- Render card verification is an external blocker, not a code defect.

## 应用边界
- Do not update canonical project knowledge before review.
`

const validSkillCandidate = `---
kind: skill-evolution
status: PENDING_REVIEW
target: docs/skill-evolution/inbox/2026-06-09-retrospective-correction.md
---
# retrospective-correction source evidence

## 参考来源
- https://hermes-agent.nousresearch.com/docs/user-guide/features/curator

## 证据
- A correction found the skill should require a separate cause document.

## 候选内容
- Add a post-verification cause document requirement.

## 应用边界
- Propose a patch only; do not mutate SKILL.md without approval.
`

it('learning candidate verifier - 接受带来源的待确认学习候选', () => withTempDir('airules-learning-candidate-valid-', (tmpDir) => {
  const candidatePath = path.join(tmpDir, 'learning.md')
  writeFile(candidatePath, validLearningCandidate)

  const result = runVerifyLearningCandidates(candidatePath)

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /PASS learning candidates are valid/)
}))

it('learning candidate verifier - 接受带来源的 skill 进化候选', () => withTempDir('airules-learning-candidate-skill-', (tmpDir) => {
  const candidatePath = path.join(tmpDir, 'skill.md')
  writeFile(candidatePath, validSkillCandidate)

  const result = runVerifyLearningCandidates(candidatePath)

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /PASS learning candidates are valid/)
}))

it('learning candidate verifier - 拒绝缺少参考来源的候选', () => withTempDir('airules-learning-candidate-no-source-', (tmpDir) => {
  const candidatePath = path.join(tmpDir, 'learning.md')
  writeFile(candidatePath, validLearningCandidate.replace(/- https:\/\/hermes-agent\.nousresearch\.com\/docs\/user-guide\/features\/memory\/\n/, ''))

  const result = runVerifyLearningCandidates(candidatePath)

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /必须包含至少一个 http\/https 来源链接/)
}))

it('learning candidate verifier - 拒绝直接写入正式项目知识', () => withTempDir('airules-learning-candidate-canonical-', (tmpDir) => {
  const candidatePath = path.join(tmpDir, 'learning.md')
  writeFile(candidatePath, validLearningCandidate.replace(
    'docs/AI项目知识/待确认/2026-06-09-render-deploy.md',
    'docs/AI项目知识/项目概览.md',
  ))

  const result = runVerifyLearningCandidates(candidatePath)

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /learning-capture target 必须位于 docs\/AI项目知识\/待确认\//)
}))

it('learning candidate verifier - 拒绝指向 vendor 的 skill 候选', () => withTempDir('airules-learning-candidate-vendor-', (tmpDir) => {
  const candidatePath = path.join(tmpDir, 'skill.md')
  writeFile(candidatePath, validSkillCandidate.replace(
    'docs/skill-evolution/inbox/2026-06-09-retrospective-correction.md',
    'vendor/skills/retrospective-correction/SKILL.md',
  ))

  const result = runVerifyLearningCandidates(candidatePath)

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /不得指向 vendor\//)
}))

it('learning skills - 写明 Hermes 来源与候选边界', () => {
  const learningSkill = fs.readFileSync(path.join(process.cwd(), 'skills', 'learning-capture', 'SKILL.md'), 'utf8')
  const evolutionSkill = fs.readFileSync(path.join(process.cwd(), 'skills', 'skill-evolution', 'SKILL.md'), 'utf8')

  assert.match(learningSkill, /https:\/\/hermes-agent\.nousresearch\.com\/docs\/user-guide\/features\/memory\//)
  assert.match(learningSkill, /docs\/AI项目知识\/待确认\//)
  assert.match(learningSkill, /PENDING_REVIEW/)
  assert.match(evolutionSkill, /https:\/\/hermes-agent\.nousresearch\.com\/docs\/user-guide\/features\/curator/)
  assert.match(evolutionSkill, /docs\/skill-evolution\/inbox\//)
  assert.match(evolutionSkill, /PENDING_REVIEW/)
})
