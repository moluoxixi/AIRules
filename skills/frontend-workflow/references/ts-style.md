# TS 代码风格

## 类型/接口 — 大驼峰

```ts
/**
 * 用户列表展示记录，字段命名直接对齐后端用户接口。
 */
interface UserRecord { }

/**
 * 订单列表查询参数，只包含当前列表筛选和分页需要的字段。
 */
interface OrderQueryParams { }

/**
 * 用户表单模型，字段范围限定为当前表单可编辑项。
 */
interface UserFormModel { }

/**
 * 订单状态枚举，取值必须与后端状态字典保持一致。
 */
type OrderStatus = 'CREATED' | 'APPROVED'
```

## 接口字段 — 小驼峰

```ts
/**
 * 用户列表展示记录，字段直接对齐后端用户接口。
 */
interface UserRecord {
  userId: number
  userName: string
  createdAt: string
}
```

## 常量 — 全大写下划线

```ts
/**
 * 列表默认分页大小，需与后端分页上限保持一致。
 */
export const DEFAULT_PAGE_SIZE = 10

/**
 * 当前业务模块接口前缀，只用于拼接本模块 API 地址。
 */
export const API_PREFIX = '/api/v1'
```

## 普通导出变量 — 小驼峰

```ts
/**
 * 状态筛选下拉选项，来源于后端状态字典。
 */
export const statusOptions = [
  { label: '已创建', value: 'CREATED' },
  { label: '已通过', value: 'APPROVED' },
]

/**
 * 状态文案映射，仅用于前端展示，不反向推导接口状态。
 */
export const statusLabelMap = {
  CREATED: '已创建',
  APPROVED: '已通过',
}

/**
 * 搜索表单配置，字段范围限定为当前列表支持的筛选项。
 */
export const searchConfig = [
  { field: 'keyword', label: '关键词' },
  { field: 'status', label: '状态' },
]
```

## API 函数 — 小驼峰（动词开头）

```ts
/**
 * 查询用户列表，参数必须已对齐后端分页和筛选字段。
 */
export function getUserList() { }

/**
 * 创建用户，入参只包含创建接口允许提交的字段。
 */
export function createUser() { }

/**
 * 更新用户，入参必须包含目标用户标识和允许更新的字段。
 */
export function updateUser() { }

/**
 * 删除用户，调用方必须在进入函数前完成确认和权限校验。
 */
export function deleteUser() { }
```

## ref / computed — 小驼峰

```ts
const loading = ref(false)
const sourceList = ref([])
const pagination = computed(() => ({
  currentPage: 1,
  pageSize: DEFAULT_PAGE_SIZE,
}))
```


