# JS 代码风格

## 变量 — 小驼峰

```js
const loading = ref(false)
const tableData = ref([])
const queryParams = ref({})
```

## 函数 — 小驼峰

```js
// 提交当前筛选条件并刷新列表，不负责修改筛选模型。
function handleSearch() { }

// 同步表格选中项，输入必须来自表格组件的 selection 事件。
function handleSelectionChange() { }

// 创建查询参数初始值，仅包含所有查询场景共享的字段。
function createDefaultParams() { }

// 格式化展示用日期，不承担时区转换或接口字段兼容。
function formatDate(date) { }
```
