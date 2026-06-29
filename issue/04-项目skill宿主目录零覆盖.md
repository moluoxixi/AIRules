# E-01 · "项目 skill 不盲创宿主目录"零覆盖（P2）

## 现状（核验通过 — 仅此一项零覆盖）

原 issue 描述的"Phase 4 fixture 对自我进化约束全部零覆盖"经核验**不成立**——绝大多数约束已被合约测试与一致性脚本覆盖。**唯一确认零覆盖**的是"项目 skill 不盲创宿主目录"这一条。

## 已覆盖项（撤回的反例）

| 约束 | 覆盖方式 | 证据 |
|---|---|---|
| `vendor/` 不作为源资产 | git-ignored 断言 | `__test__/workflow-contract.test.ts:324-329`：调用 `git check-ignore vendor` 验证 `r.status === 0` |
| 全局 skill 必须登记 `constants/skills.ts` | 双向校验 | `scripts/check-rules-consistency.ts:183-197`（反向登记 check #7）+ `:128-132`（正向 check #3）+ `__test__/workflow-contract.test.ts:100-109` fixture |
| superseded memory 不进 active 召回（结构层） | frontmatter 校验 | `__test__/workflow-contract.test.ts:302-315`：强制 `status: (active\|superseded)` 与 `created_at: \d{4}-\d{2}-\d{2}` |

## 真实零覆盖项

**"项目 skill 不盲创宿主目录"** — 核验方式：

- `__test__` 全目录 grep `宿主目录|盲创|host.*dir` 无任何匹配
- `scripts/check-rules-consistency.ts:99-215` 的 8 项检查（FIXED_AGENTS / 加载 skill 引用 / 清单存在 / 旧 agent 名 / overview script / Mermaid 边 / 反向登记 / ADR 登记）均不涉及宿主目录创建

## 为什么这条值得补 fixture

`rules/AGENTS.md` "scope 判定"段（约 line 86）明确写道：

> ①的「写源 skills 目录 + 登记 `constants/skills.ts` + 经 vendor 投影」机制仅在 AIRules 仓库内适用；分发到用户项目时，全局可复用洞见是**上游贡献候选**（交人工决定回流 AIRules），**不在用户仓库内自建「全局」资产**。

这是分发场景下的硬约束：项目 skill 安装到宿主后**不得**在宿主项目根 / `.cursor/` / `.claude/` 等位置主动创建全局 skill 目录。一旦违反，会产生：

- 用户项目内出现未经审核的"全局"资产
- 后续从 AIRules 同步时与本地分叉冲突
- scope 判定流程被绕过

当前仅靠 prose 约束，无客观信号拦截，**与 O-01（回路熔断只在 prose 不在 enforcement）属于同类问题**。

## 修复建议

### 在 `scripts/check-rules-consistency.ts` 增加 check #9

伪代码：

```ts
// Check #9: 项目级 skill 不盲创宿主目录
const projectSkillInstallers = findInstallScripts('skills/**/install*.sh', 'skills/**/SKILL.md')
for (const installer of projectSkillInstallers) {
  const content = readFile(installer)
  if (matchesHostPath(content, [
    /\$HOME\/\.claude\//,
    /\$HOME\/\.cursor\//,
    /~\/\.qoderwork\//,
    /project-root\/\.cursor\//,
  ])) {
    // 项目级 skill 不应创建宿主 / 项目根的全局目录
    fail(`${installer} 含宿主目录创建路径，违反 scope 判定 ②/③ 落点限制`)
  }
}
```

### 或在 `__test__/workflow-contract.test.ts` 加 fixture 测试

```ts
it('项目级 skill 不得在 SKILL.md / 安装脚本中引用宿主全局目录', () => {
  const projectSkills = readProjectSkills()
  const hostPathPatterns = [/~\/\.claude/, /~\/\.cursor/, /~\/\.qoderwork/]
  for (const skill of projectSkills) {
    for (const pattern of hostPathPatterns) {
      assert.doesNotMatch(skill.content, pattern,
        `${skill.path} 含宿主目录引用，违反 scope 判定`)
    }
  }
})
```

### 配套：在 `rules/AGENTS.md` 的"scope 判定"段加文本锚点

便于合约测试断言文本存在（防止 prose 被误删）：

```
- 项目级 skill 不得在安装脚本或 SKILL.md 中引用宿主全局目录（`~/.claude/`、`~/.cursor/`、`~/.qoderwork/` 等）；fixture 校验由 `check-rules-consistency.ts` check #9 兜底。
```

## 影响范围

- `scripts/check-rules-consistency.ts`（新增 check #9）
- `__test__/workflow-contract.test.ts`（可选增加文本锚点断言）
- `rules/AGENTS.md` "scope 判定"段（加可观测锚点）

## 与其他问题的关系

- 与 **O-01** 是同类问题（prose 约束未升级为机制）但范围小、改动局部，可独立先行。
- 不依赖账本或 agent 契约变更，无前置依赖。
