# frontend-superpowers-bridge Schema

這是從 `superpowers-bridge` 派生的前端專用 OpenSpec schema。

純前端專案，或全棧專案中以 UI 欄位、元件、狀態、路由、權限、互動、瀏覽器行為為主要風險的 change，使用本 schema。非前端 change 繼續使用原版 `superpowers-bridge`。

## 新增能力

本 schema 保留 upstream bridge lifecycle：

```text
brainstorm -> proposal -> design -> specs -> tasks -> plan -> apply -> verify -> retrospective
```

並加入前端門禁：

- `design.md` 必須包含 `Layout`、`Fields`、`Components`、`States`、`Frontend Test Matrix`。
- 每個 UI 欄位必須對應來源契約：`API`、`OpenAPI`、`interface code`、`API client`、`store`、`route params`、`permission`、`state`、`persistence`、`static`、`derived`。
- UI 必需欄位缺失時必須標記 `MISSING blocked: <reason>`，並阻止進入實作。
- 每個 UI 單元必須分類為 `existing`、`wrap existing` 或 `new`。
- `plan.md` 必須在 TDD micro-step 中保留前端欄位、元件、狀態與測試矩陣門禁。
- `verify.md` 必須記錄命令、退出碼、desktop/mobile、console/network、截圖或 log 等前端驗證證據。

## 分流

| Change 類型 | Schema |
|---|---|
| 純前端專案功能 | `frontend-superpowers-bridge` |
| 全棧專案但本次主要改 UI/page/component/state/permission/browser behavior | `frontend-superpowers-bridge` |
| Backend/API/CLI/infrastructure/docs-only change | `superpowers-bridge` |
| 小 bug、typo、config 微調、不改合約的測試補寫 | 直接 PR，不開 schema 流程 |

範例：

```bash
/opsx:new user-profile-page --schema frontend-superpowers-bridge
/opsx:new payment-webhook --schema superpowers-bridge
```

## 前端欄位門禁

`design.md` 的 Fields table 是 UI 欄位規劃的唯一來源。

必要欄位：

| Area | Field Name | UI Purpose | Source Type | Source Path / Endpoint | Exists? | Missing Status | Component Decision | Component Path | Display Shape | Permission Control | State Coverage | Test Point |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

規則：

- Source Type 必須是 schema enum 之一。
- Missing Status 必須是 `OK` 或 `MISSING blocked: <reason>`。
- `MISSING blocked:` 代表實作前必須停止。
- 不得用 mock 欄位、猜測預設值、空值 fallback 或「後續補」繼續。

## 元件門禁

新建元件前必須先檢索既有 components、hooks/composables、utilities 和已安裝 UI libraries。

每個 UI 單元必須分類：

- `existing`：直接復用。
- `wrap existing`：為欄位、狀態、權限、async、error、accessibility 或 responsive 要求做薄封裝。
- `new`：只有在既有/封裝都不能滿足契約時新建。

`wrap existing` / `new` 必須記錄 inputs、outputs/events、依賴欄位、覆蓋狀態、accessibility notes 和 reuse scope。

## 測試門禁

前端驗證遵循 `frontend-testing` 紀律：

| Dimension | Required Evidence |
|---|---|
| Page / Route | entry、exit、navigation、refresh、deep link、permission redirect |
| Fields | source、display shape、formatting、empty value、API presence |
| Components | reuse/new decision and state coverage |
| State | loading、empty、error、disabled、success、permission-denied、pending |
| Interaction | click、input、submit、cancel、retry、pagination、filter、sort |
| Responsive | desktop and mobile viewport；dense page 補 tablet |
| Observable Errors | console error、network error、request status、exception message |
| Regression Evidence | unit/component/integration/E2E/browser/visual output |

若專案缺自動化前端測試工具，必須寫 `MISSING blocked: no frontend test runner` 或 `NOT RUN automated: <reason>`。不得把猜測或純手動檢查標成 PASS。

## 維護策略

`superpowers-bridge/` 保持接近 upstream；前端專用規則只放在本派生 schema，方便後續比較與 rebase upstream 更新。
