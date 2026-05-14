# 覆盖率与风险

## 基线

优先使用项目覆盖率阈值。若项目没有定义，可参考 80% statements、branches、functions 和 lines。

新增或修改逻辑可尽量达到 90%+ 有意义覆盖。

## 高风险逻辑

以下逻辑通常需要覆盖成功、失败、边界和异常路径：
- authentication 和 authorization；
- payment；
- deletion；
- data migration；
- security boundaries；
- core business rules；
- irreversible user actions；
- complex async coordination。

## 无效通过方式

不要通过以下方式让报告变绿：
- 降低阈值；
- 排除关键文件；
- 删除断言；
- 对大块输出做 snapshot 但没有行为断言；
- mock 掉被测单元；
- 把错误转换成成功路径；
- 删除失败行为对应的测试。

如果无法收集 coverage，报告缺失工具或配置，并说明风险。
