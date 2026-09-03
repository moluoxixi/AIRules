# 双角色知识关系索引设计

## Architecture

知识扩展继续分为三层：

1. 宿主 Hook 在用户消息事件上调用 `knowledge-hook.py`。
2. `common/knowledge.py` 扫描 source、读取关系账本、计算影响和执行确定性校验。
3. `trellis-knowledge` 或 `moluoxixi-knowledge` Skill 读取 source，更新 library、`index.md` 和关系账本。

不把公共引擎复制到各宿主 Hook 目录，也不让 Hook 启动模型执行语义整理。

## Relationship Contract

每个知识根目录使用一份 `relations.json`：

```json
{
  "version": 1,
  "assets": {
    "api:payments:v1:create-payment": {
      "page": "library/payments/apis/create-payment.md",
      "sources": [
        {
          "path": "payments.yaml",
          "selector": "#/paths/~1payments/post",
          "sha256": "<64 lowercase hex>"
        }
      ]
    }
  }
}
```

- `path` 相对 `knowledge/sources/`，必须是规范 POSIX 相对路径。
- `page` 相对知识根目录，必须位于 `library/` 且指向普通文件。
- `selector` 可省略，用于定位 source 内部片段。
- `sha256` 固定整理者最后确认的 source 字节版本。
- asset 到 source 是唯一持久事实；运行时反向派生 source 到 asset。

library 页面保留现有 frontmatter 的人类可读来源说明，但运行时门禁以 `relations.json` 为准。Skill 必须同时更新二者，并在本次测试中验证示例和流程一致；不在 Python 中引入通用 YAML 解析器。

## State And Migration

`.state.json` 升级为版本 2：

```json
{
  "version": 2,
  "processed": {
    "payments.yaml": { "sha256": "...", "size": 123 }
  },
  "assets": {
    "api:payments:v1:create-payment": {
      "page": "library/payments/apis/create-payment.md",
      "sources": [
        { "path": "payments.yaml", "selector": "...", "sha256": "..." }
      ]
    }
  }
}
```

读取器接受版本 1，并把缺失的 `assets` 视为空快照；只有成功 `acknowledge` 才原子写入版本 2。安装器不覆盖项目知识数据。

## Status And Impact Calculation

状态计算使用：

```text
current source snapshot
previous acknowledged source snapshot
current relations.json
previous acknowledged asset relations
```

对每个 added、modified、deleted source，受影响 asset 是当前与上次关系快照中引用该 source 的并集。这样即使 source 或当前关系先被删除，仍可从上次快照定位受影响资产。

`pending` 在原 source diff 基础上还包含关系解析错误和完整性错误。CLI JSON 增加稳定的 `impacted` 与 `relation_errors` 字段；Hook 将其压缩为有界文本。

## Acknowledge Gate

确认前重新读取同一 batch，并校验：

- 关系账本 schema、版本和字段类型有效；
- 所有 page/source 路径安全且存在；
- 所有关系 SHA-256 等于当前 source；
- 本批次新增或修改的每个 source 至少有一个当前 asset 关系；
- 被删除 source 不再出现在当前关系中；
- 扫描器没有不支持或不可读 source。

校验通过后原子更新 `.state.json`。batch ID 必须包含当前 source 与当前关系内容，整理期间任一者变化都使旧 batch 失效。

## Compatibility And Failure Behavior

- 缺少 `relations.json` 在空知识库中合法；一旦有 source 变更需要确认，则未映射 source 构成门禁错误。
- 版本 1 state 不立即重写，不制造无意义 diff；下一次成功确认完成迁移。
- 关系 JSON 无效时 Hook 不阻塞用户消息，但注入错误；CLI `status` 可报告错误，`acknowledge` 必须失败。
- 所有写入继续使用临时文件加 `os.replace`，沿用现有锁。

## Rollback

代码回退后，版本 1 读取器将不认识版本 2 state。实施时需把状态升级集中在单一常量和解析函数中；若必须回滚，可删除 ignored 的 `.state.json` 重新建立扫描基线，不能删除 `sources/`、`library/`、`index.md` 或 `relations.json`。
