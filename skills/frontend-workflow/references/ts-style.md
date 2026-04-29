# TS 代码风格

## 类型/接口 — 大驼峰

```ts
interface UserRecord { }
interface OrderQueryParams { }
interface UserFormModel { }
type OrderStatus = 'CREATED' | 'APPROVED'
```

## 接口字段 — 小驼峰

```ts
interface UserRecord {
  userId: number
  userName: string
  createdAt: string
}
```

## 常量 — 全大写下划线

```ts
export const DEFAULT_PAGE_SIZE = 10
export const API_PREFIX = '/api/v1'
```

## 普通导出变量 — 小驼峰

```ts
export const statusOptions = [...]
export const statusLabelMap = { ... }
export const searchConfig = [...]
```

## API 函数 — 小驼峰（动词开头）

```ts
export function getUserList() { }
export function createUser() { }
export function updateUser() { }
export function deleteUser() { }
```

## ref / computed — 小驼峰

```ts
const loading = ref(false)
const sourceList = ref([])
const pagination = computed(() => ({ ... }))
```


