#!/usr/bin/env npx tsx
import type { VendorNode, VendorRepo, VendorsConfig } from './lib/vendors.js'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { vendors as developmentVendors } from '../roles/development/constants/skills.js'
import { vendors as productVendors } from '../roles/product/constants/skills.js'
import { COMMON_ROLE, DEFAULT_ROLE, resolveRolePaths } from './lib/roles.js'

// 编码编排资产最小自洽性检查（低成本、非重型治理）：
// 校验 roles/*/constants/skills.ts、development 可选 agents/*.md、
// 角色 skill 分发清单、AIRules 仓库内 knowledge/架构/**
// 之间的引用存在性与明显漂移。作用域不含历史 plan、README。

const PRODUCT_ROLE = 'product'
const ROLE_VENDOR_CONFIGS: Record<string, VendorsConfig> = {
  [DEFAULT_ROLE]: developmentVendors,
  [PRODUCT_ROLE]: productVendors,
}

// 旧 9-agent 模型的一方 agent 名，不得在架构文档活引用（superseded ADR 横幅与历史正文除外，靠白名单跳过）。
const STALE_AGENT_NAMES = [
  'frontend-planner',
  'backend-planner',
  'frontend-coder',
  'backend-coder',
  'frontend-reviewer',
  'backend-reviewer',
  'architecture-refactor',
]

// 允许活引用旧 agent 名作历史记录的文档：superseded 的 ADR-0002 与记录收敛决策的 ADR-0003
// （其背景章节必须说明被取代的旧 9-agent 集合）。
const HISTORICAL_DOCS = new Set([
  'ADR-0002-skill-agent-layering.md',
  'ADR-0003-five-agent-convergence.md',
])

function isVendorRepo(node: VendorNode): node is VendorRepo {
  return typeof (node as VendorRepo).name === 'string' && Array.isArray((node as VendorRepo).projections)
}

/** 从指定 role 的 vendors 配置里取出 moluoxixi 第一方分发的 skill 目录名。 */
export function firstPartySkillNames(vendorsConfig: VendorsConfig = developmentVendors): string[] {
  const names: string[] = []
  const walk = (nodes: VendorNode[]) => {
    for (const node of nodes) {
      if (isVendorRepo(node)) {
        if (node.name !== 'moluoxixi') {
          continue
        }
        for (const proj of node.projections) {
          if (proj.kind === 'skills') {
            for (const s of proj.skills) {
              names.push(typeof s === 'string' ? s : s.name)
            }
          }
        }
      }
      else {
        for (const category of Object.keys(node)) {
          walk(node[category])
        }
      }
    }
  }
  walk(vendorsConfig)
  return names
}

/** 从一个 agent 文件正文「加载 skill」区列出的反引号 skill 名。 */
function agentSkillRefs(content: string): string[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const startIdx = lines.findIndex(l => /^##\s+加载 skill/.test(l))
  if (startIdx === -1) {
    return []
  }
  const refs: string[] = []
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      break
    }
    const m = lines[i].match(/^-\s*`([^`]+)`/)
    if (m) {
      refs.push(m[1].trim())
    }
  }
  return refs
}

/** 角色 skills 目录下含 SKILL.md 的实际 skill 名。 */
function actualRoleSkillNames(skillsDir: string): string[] {
  if (!existsSync(skillsDir)) {
    return []
  }
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .filter(entry => existsSync(path.join(skillsDir, entry.name, 'SKILL.md')))
    .map(entry => entry.name)
}

/** package.json scripts 键集合。 */
function packageScripts(repoRoot: string): Set<string> {
  const pkgPath = path.join(repoRoot, 'package.json')
  if (!existsSync(pkgPath)) {
    return new Set()
  }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { scripts?: Record<string, string> }
  return new Set(Object.keys(pkg.scripts ?? {}))
}

export interface CheckResult {
  errors: string[]
}

export function checkRulesConsistency(repoRoot: string): CheckResult {
  const errors: string[] = []
  const rolePaths = resolveRolePaths(repoRoot, DEFAULT_ROLE)
  const commonRolePaths = resolveRolePaths(repoRoot, COMMON_ROLE)
  const productRolePaths = resolveRolePaths(repoRoot, PRODUCT_ROLE)
  const agentsDir = rolePaths.agentsDir
  const skillRoots = [commonRolePaths, rolePaths, productRolePaths].filter(paths => existsSync(paths.skillsDir))
  const skillsDirs = skillRoots.map(paths => paths.skillsDir)
  const archDir = path.join(repoRoot, 'knowledge', '架构')
  const rulesPath = path.join(rolePaths.rulesDir, 'AGENTS.md')

  // 1. 每个可选 agent「加载 skill」引用的 skill 必须存在。agents 目录允许为空。
  if (existsSync(agentsDir)) {
    for (const entry of readdirSync(agentsDir)) {
      if (!entry.endsWith('.md')) {
        continue
      }
      const content = readFileSync(path.join(agentsDir, entry), 'utf8')
      for (const skill of agentSkillRefs(content)) {
        if (!skillsDirs.some(skillsDir => existsSync(path.join(skillsDir, skill, 'SKILL.md')))) {
          errors.push(`roles/${DEFAULT_ROLE}/agents/${entry} 引用的 skill 不存在：roles/${COMMON_ROLE}/skills/${skill}/SKILL.md 或 roles/${DEFAULT_ROLE}/skills/${skill}/SKILL.md`)
        }
      }
    }
  }

  // 2. roles/<role>/constants/skills.ts 分发清单中的 skill 目录必须存在。
  for (const [role, vendorsConfig] of Object.entries(ROLE_VENDOR_CONFIGS)) {
    if (!existsSync(resolveRolePaths(repoRoot, role).roleRoot)) {
      continue
    }

    for (const skill of firstPartySkillNames(vendorsConfig)) {
      if (!skillsDirs.some(skillsDir => existsSync(path.join(skillsDir, skill)))) {
        errors.push(`roles/${role}/constants/skills.ts 分发清单中的 skill 目录不存在：roles/*/skills/${skill}/`)
      }
    }
  }

  // 3. development/product 角色 constants/skills.ts 必须与各自 skills 目录一致。
  for (const paths of [rolePaths, productRolePaths].filter(paths => existsSync(paths.roleRoot))) {
    const registryPath = path.join(paths.roleRoot, 'constants', 'skills.ts')
    const actual = new Set(actualRoleSkillNames(paths.skillsDir))
    if (!existsSync(registryPath)) {
      errors.push(`roles/${paths.role}/constants/skills.ts 缺失，无法核对角色 skills 清单`)
      continue
    }

    const registered = new Set(firstPartySkillNames(ROLE_VENDOR_CONFIGS[paths.role] ?? []))
    for (const name of actual) {
      if (!registered.has(name)) {
        errors.push(`roles/${paths.role}/skills/${name}/ 含 SKILL.md 但未登记进 roles/${paths.role}/constants/skills.ts`)
      }
    }
    for (const name of registered) {
      if (!actual.has(name)) {
        errors.push(`roles/${paths.role}/constants/skills.ts 登记的 skill 不存在：roles/${paths.role}/skills/${name}/SKILL.md`)
      }
    }
  }

  // 4. 架构文档不得活引用旧一方 agent 名（superseded ADR 历史正文除外）。
  if (existsSync(archDir)) {
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(full)
        }
        else if (entry.name.endsWith('.md') && !HISTORICAL_DOCS.has(entry.name)) {
          const content = readFileSync(full, 'utf8')
          for (const stale of STALE_AGENT_NAMES) {
            if (content.includes(stale)) {
              errors.push(`${path.relative(repoRoot, full).replace(/\\/g, '/')} 残留旧 agent 名：${stale}`)
            }
          }
        }
      }
    }
    walk(archDir)
  }

  // 5. overview.md 不得引用 package.json 中不存在的 npm script。
  const overviewPath = path.join(archDir, 'overview.md')
  if (existsSync(overviewPath)) {
    const scripts = packageScripts(repoRoot)
    const content = readFileSync(overviewPath, 'utf8')
    // 检测形如 delivery:verify / verify:skills / verify:knowledge-sources / rules:check 的脚本引用 token。
    const referenced = new Set(content.match(/\b[a-z][a-z-]*:[a-z][a-z:-]*\b/g) ?? [])
    for (const token of referenced) {
      // 仅校验看起来像 npm script 名的（含已知前缀），避免误伤普通冒号词。
      if (/^(?:verify|delivery|rules|lint):/.test(token) && !scripts.has(token)) {
        errors.push(`knowledge/架构/overview.md 引用了 package.json 不存在的 npm script：${token}`)
      }
    }
  }

  // 6. development 角色保留空 rules/AGENTS.md 占位，但不分发 always-on 全局规则内容。
  if (!existsSync(rulesPath)) {
    errors.push(`roles/${DEFAULT_ROLE}/rules/AGENTS.md 必须存在为空文件，用作 rules 投影占位`)
  }
  else if (readFileSync(rulesPath, 'utf8').trim().length > 0) {
    errors.push(`roles/${DEFAULT_ROLE}/rules/AGENTS.md 必须保持为空：开发角色不分发 always-on 全局规则内容`)
  }

  // 7. 反向登记：development/product 角色下每个含 SKILL.md 的第一方目录都必须登记进角色 constants/skills.ts
  //    分发清单（防止新增 skill 漏登记而无法被投影/安装）。vendor 投影来源不在此列。
  for (const skillRoot of [rolePaths, productRolePaths].filter(paths => existsSync(paths.skillsDir))) {
    const registered = new Set(firstPartySkillNames(ROLE_VENDOR_CONFIGS[skillRoot.role] ?? []))
    for (const entry of readdirSync(skillRoot.skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue
      }
      if (!existsSync(path.join(skillRoot.skillsDir, entry.name, 'SKILL.md'))) {
        continue
      }
      if (!registered.has(entry.name)) {
        errors.push(`roles/${skillRoot.role}/skills/${entry.name}/ 含 SKILL.md 但未登记进 roles/${skillRoot.role}/constants/skills.ts 分发清单`)
      }
    }
  }

  // 8. 每个 ADR 文件必须登记进 decisions/index.md（防止新增 ADR 漏登记而失联）。
  const decisionsDir = path.join(archDir, 'decisions')
  const indexPath = path.join(decisionsDir, 'index.md')
  if (existsSync(decisionsDir) && existsSync(indexPath)) {
    const indexContent = readFileSync(indexPath, 'utf8')
    for (const entry of readdirSync(decisionsDir)) {
      if (!/^ADR-\d.*\.md$/.test(entry)) {
        continue
      }
      if (!indexContent.includes(entry)) {
        errors.push(`knowledge/架构/decisions/${entry} 未登记进 decisions/index.md`)
      }
    }
  }

  // 9. 项目级 skill 不得在 SKILL.md 或安装脚本中引用宿主全局目录（scope 判定 ②/③ 落点限制：
  //    项目级洞见落项目内 openspec/、knowledge/ 或候选区，全局洞见走上游贡献候选，不在用户仓库内自建「全局」资产）。
  //    这是低成本 tripwire：命中即"引用"（presence），用于提请人工复核是否在自建全局资产，
  //    不臆断写入意图。匹配 ~/.claude、$HOME/.cursor、${HOME}/.qoder、${HOME}/.qoderwork 等 POSIX 宿主目录；
  //    项目本地 openspec/、knowledge/ 不在此列。
  const hostGlobalDir = /(?:~|\$HOME|\$\{HOME\})\/\.(?:claude|cursor|qoder|qoderwork)\b/
  const walkSkillDir = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walkSkillDir(full)
      }
      else if (entry.name === 'SKILL.md' || /\.(?:sh|bash|ps1|py|ts|js|mjs|cjs)$/.test(entry.name)) {
        const content = readFileSync(full, 'utf8')
        if (hostGlobalDir.test(content)) {
          errors.push(`${path.relative(repoRoot, full).replace(/\\/g, '/')} 引用宿主全局目录（~/.claude、$HOME/.cursor、~/.qoder、~/.qoderwork 等），违反 scope 判定 ②/③ 落点限制`)
        }
      }
    }
  }
  for (const skillsDir of skillsDirs) {
    walkSkillDir(skillsDir)
  }

  // 10. 需求落档契约：若重新引入 brainstorming/SKILL.md，必须指向 openspec/changes/，
  //     避免需求分析结论只停留在对话或旧 requirements 目录。
  const brainstormingSkillPath = path.join(rolePaths.skillsDir, 'brainstorming', 'SKILL.md')
  if (existsSync(brainstormingSkillPath)) {
    const content = readFileSync(brainstormingSkillPath, 'utf8')
    if (!content.includes('openspec/changes/')) {
      errors.push(`roles/${DEFAULT_ROLE}/skills/brainstorming/SKILL.md 未声明需求落档路径 openspec/changes/（需求文档必须落盘，不得只在对话中交付）`)
    }
  }

  // 11. 需求路径传递契约：若重新引入 roles/development/agents/planner.md，
  //     输入上下文包必须包含 openspec/changes/ 路径字段。
  const plannerPath = path.join(agentsDir, 'planner.md')
  if (existsSync(plannerPath)) {
    const content = readFileSync(plannerPath, 'utf8')
    if (!content.includes('openspec/changes/')) {
      errors.push(`roles/${DEFAULT_ROLE}/agents/planner.md 输入上下文包未包含需求文档路径（openspec/changes/），planner 必须接收并传递需求文档路径`)
    }
  }

  // 12. writing-plans 参考文件引用：writing-plans/SKILL.md 必须引用前后端参考文件，
  //     防止主入口忘记加载专项规范导致漂移。
  const writingPlansPath = path.join(rolePaths.skillsDir, 'writing-plans', 'SKILL.md')
  if (existsSync(writingPlansPath)) {
    const content = readFileSync(writingPlansPath, 'utf8')
    if (!content.includes('writing-plans/references/frontend-plan.md')) {
      errors.push(`roles/${DEFAULT_ROLE}/skills/writing-plans/SKILL.md 未引用 writing-plans/references/frontend-plan.md（前端专项规范必须从主入口可达）`)
    }
    if (!content.includes('writing-plans/references/backend-plan.md')) {
      errors.push(`roles/${DEFAULT_ROLE}/skills/writing-plans/SKILL.md 未引用 writing-plans/references/backend-plan.md（后端专项规范必须从主入口可达）`)
    }
  }

  return { errors }
}

function main() {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd()
  const { errors } = checkRulesConsistency(repoRoot)
  if (errors.length > 0) {
    for (const e of errors) {
      console.log(`FAIL ${e}`)
    }
    console.log(`────────────────────────────\nFAIL rules:check ${errors.length} 个漂移`)
    process.exit(1)
  }
  console.log('PASS rules:check 编码编排资产自洽')
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isCli) {
  main()
}
