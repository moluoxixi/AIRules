<!-- Source: frontend-superpowers-bridge/templates/adopters/CLAUDE.md.fragment.zh-TW.md -->
<!-- 把這一節貼進你專案的 CLAUDE.md,讓 Claude 知道如何分流前端工作。 -->

## 前端變更工作流(Claude Code 啟動先讀)

本 repo 前端 change 使用 `frontend-superpowers-bridge`，非前端 change 使用 `superpowers-bridge`。

### 入口分流

| 你看到的觸發 | 應該怎麼做 |
|---|---|
| 使用者開 frontend/page/component/UI-state 設計討論 | 先 verbal `superpowers:brainstorming`,**不**寫到 `docs/superpowers/specs/`;對話收斂後用 `--schema frontend-superpowers-bridge` 升級到 `/opsx:propose` |
| 使用者對前端工作直接呼叫 `/opsx:new` / `/opsx:ff` / `/opsx:propose` | 使用 `frontend-superpowers-bridge`;artifact instruction 會在每步注入 |
| 使用者對非前端工作直接呼叫 `/opsx:new` / `/opsx:ff` / `/opsx:propose` | 除非使用者指定其他 schema，否則使用 `superpowers-bridge` |
| 使用者明確說 bug fix / typo / config 微調 / 文件更新 | 直接 PR,**不**建 change(見下方 skip 規則) |
| 已經在某個 change 中 | `/opsx:continue` 或 `/opsx:apply` / `/opsx:verify` / `/opsx:archive` 推進 |

### Schema 選擇

| 情境 | Schema |
|---|---|
| 純前端專案功能 | `frontend-superpowers-bridge` |
| 全棧 change 但重點是 UI/page/component/state/route/permission/browser behavior | `frontend-superpowers-bridge` |
| Backend/API/CLI/infrastructure/docs-only change | `superpowers-bridge` |
| 不改合約的 bug fix / typo / config 值微調 | 直接 PR |

### 前端門禁

前端實作前，`design.md` 必須包含 `Layout`、`Fields`、`Components`、`States`、`Frontend Test Matrix`。

任何 UI 必需欄位若無法在 API/OpenAPI/interface code/API client/store/route params/permission/state/persistence/static/derived 契約中證明存在、語義明確且權限可證，必須標記 `MISSING blocked: <reason>` 並停止 coding。

每個 UI 單元必須分類為 `existing`、`wrap existing` 或 `new`。

### ECC Execution Agents

`frontend-superpowers-bridge` 的 apply/review 階段，在 agents 可用時使用已投影的 ECC agents：

| Agent | 用途 |
|---|---|
| `planner` | Implementation planning |
| `tdd-guide` | TDD execution discipline |
| `pr-test-analyzer` | 前端測試矩陣覆蓋分析 |
| `e2e-runner` | Browser/E2E 執行 |
| `code-reviewer` | 通用 code review |
| `typescript-reviewer` | TypeScript contract review |
| `react-reviewer` | React implementation review |
| `vue-reviewer` | Vue implementation review |
| `react-build-resolver` | React build failure 診斷 |
| `build-error-resolver` | Build/type/lint/test failure 診斷 |
| `silent-failure-hunter` | 缺失 assertion 與 swallowed-error review |

### Front-door 反模式(別做)

- 讓 brainstorming 寫到 `docs/superpowers/specs/`
- 讓 writing-plans 寫到 `docs/superpowers/plans/`
- UI 欄位仍有 `MISSING blocked:` 就 coding
- 未檢索既有 components/hooks/utilities/UI libraries 就新建元件
- 沒有命令、退出碼、viewport、console/network、截圖或 log 證據就把前端測試標 PASS
- agents 可用時忽略 ECC execution agents 直接進行 apply/review
