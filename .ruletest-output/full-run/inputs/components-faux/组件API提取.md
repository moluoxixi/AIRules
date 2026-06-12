# 组件 API 提取（测试用源料，唯一组件事实来源）

> 性质：本文件由主流程从真实组件库 `D:\project-new\vue-component\packages\components\src` 预提取，作为第③阶段 components-docs 纯净测试的**唯一组件事实来源**。子代理不得跨盘扫描组件库，只依据本文件 + components-docs skill + RULES_BUNDLE 产出组件契约文档。
> 提取范围：仅自有业务组件（DateRangePicker / EnterNextContainer / PopoverTableSelect）的 props/emits/slots 类型契约；ConfigForm 系列未纳入本次提取。
> 字段语义以源码 JSDoc 注释为准；本文件未包含的运行时行为（如默认值、内部 watch 逻辑、模板插槽实际渲染）一律视为 MISSING，不得臆造。

======================================================================
## 组件: DateRangePicker
源路径: packages/components/src/DateRangePicker/
对 Element Plus DatePicker 的业务层封装：保留透传能力、统一输出格式、支持按配置生成初始时间范围。
======================================================================

### props.ts
```ts
import type { ConfigType, ManipulateType } from 'dayjs'
import type { DatePickerProps } from 'element-plus'

export type DateRangePickerScalar = string | number | Date
export type DateRangePickerModelValue = DateRangePickerScalar | string[] | number[] | Date[]
export type DateRangePickerOutputValue = string | string[]
export type DateRangePickerType = NonNullable<DatePickerProps['type']>
export interface DateRangePickerShortcut {
  text: string
  value: () => Date | Date[]
}
export type DateRangePickerDatetimeUnit = 'hours' | 'minutes' | 'seconds'

export interface DateRangePickerProps {
  /** 日期选择类型，支持 Element Plus DatePicker 的 type。 */
  type?: DatePickerProps['type']
  /** 展示在输入框中的格式。 */
  format?: string
  /** DatePicker 内部绑定格式，也是外部字符串入参的解析格式。 */
  valueFormat?: string
  /** 非范围选择时的占位内容。 */
  placeholder?: string
  /** 范围选择时开始日期的占位内容。 */
  startPlaceholder?: string
  /** 范围选择时结束日期的占位内容。 */
  endPlaceholder?: string
  /** 范围分隔符。 */
  rangeSeparator?: string
  /** 外部绑定值，单日期使用单值，范围使用数组。 */
  modelValue?: DateRangePickerModelValue
  /** 输出格式；数组分别对应开始值和结束值。 */
  outputFormat?: string | string[]
  /** 首次无值时是否自动使用今天作为默认值。 */
  defaultToday?: boolean
  /** 日期范围偏移配置，数字表示从今天向前/向后，数组表示起止偏移。 */
  dateRange?: number[] | number
  /** 日期范围偏移单位。 */
  dateRangeType?: ManipulateType
  /** 日期范围偏移的基准日期。 */
  dateRangeBaseDate?: ConfigType
  /** 最小可选日期。 */
  minDate?: ConfigType
  /** 最大可选日期。 */
  maxDate?: ConfigType
  /** 禁用日期范围，优先级高于 minDate/maxDate。 */
  disabledDateRange?: [ConfigType, ConfigType]
  /** datetime/datetimerange 下需要按边界禁用的时分秒单位。 */
  datetimeDisableTypes?: DateRangePickerDatetimeUnit[]
  /** 是否显示快捷项；true 使用默认快捷项，数组使用自定义快捷项。 */
  shortcuts?: boolean | DateRangePickerShortcut[]
}
```

### emits.ts
```ts
export interface DateRangePickerEmits {
  /** 绑定值更新时触发，单日期返回字符串，范围返回字符串数组。 */
  (event: 'update:modelValue', value: DateRangePickerOutputValue): void
  /** 用户确认选择时触发，返回值形态与 v-model 一致。 */
  (event: 'change', value: DateRangePickerOutputValue): void
}
```

### slots.ts
```ts
/** DateRangePicker 当前没有自定义插槽，保留类型文件用于组件包契约一致性。 */
export interface DateRangePickerSlots {}
```

======================================================================
## 组件: EnterNextContainer
源路径: packages/components/src/EnterNextContainer/
监听容器内输入控件，回车自动聚焦下一个输入控件。
======================================================================

### props.ts
```ts
import type { ComponentInternalInstance, ComponentPublicInstance } from 'vue'

export type EnterNextVirtualRef = ComponentPublicInstance | ComponentInternalInstance | HTMLElement | null

export interface EnterNextContainerProps {
  /** 外部容器引用；未提供时监听组件默认插槽容器。 */
  virtualRef?: EnterNextVirtualRef
  /** 下拉组件没有高亮选项时，是否仍允许回车跳到下一个输入控件。 */
  allowSelectNextInEmpty?: boolean
  /** 挂载后默认聚焦的控件序号，沿用旧组件的一基序号。 */
  focusNum?: number
  /** 是否只在可用控件集合里计算默认聚焦位置。 */
  autoNext?: boolean
}
```

### emits.ts
```ts
export interface EnterNextContainerEmits {
  /** 已经没有下一个输入控件时触发。 */
  (event: 'noNextInput', element: HTMLElement): void
  /** 下拉控件处于展开但未选中状态时触发。 */
  (event: 'noSelectValue', element: HTMLElement): void
}
```

### slots.ts
```ts
/** EnterNextContainer 默认插槽承载需要监听的表单区域。 */
export interface EnterNextContainerSlots {
  default?: () => any
}
```

======================================================================
## 组件: PopoverTableSelect
源路径: packages/components/src/PopoverTableSelect/
输入框 + 弹层表格选择器；含外层组件与 Base 表格两层契约。
======================================================================

### props.ts
```ts
import type { InputInstance, InputProps, PopoverProps } from 'element-plus'
import type { ComponentInternalInstance, ComponentPublicInstance } from 'vue'
import type { ScheduleOptions } from '../../../utils'

export type PopoverTableRow = Record<string, any>
export type PopoverTableVirtualRef = ComponentPublicInstance | ComponentInternalInstance | InputInstance | HTMLElement | null
export type PopoverTablePopType = 'default' | 'input'
export type PopoverTableSuccessiveShowType = 'enter' | 'input'
export type PopoverTableSelectTrigger = 'click' | 'dblclick' | 'none'
export type ThrottleOrDebounceOptions = ScheduleOptions & { promise?: boolean }

export interface PopoverTableColumn {
  /** 行字段名，兼容旧 DraggableTable/vxe-grid 的 field。 */
  field: string
  /** 表头标题，兼容旧列配置 title。 */
  title?: string
  /** 表头标题，兼容常见 table 配置 label。 */
  label?: string
  width?: number | string
  minWidth?: number | string
  align?: 'left' | 'center' | 'right'
  /** 兼容旧组件通过 slots.default 指定单元格插槽。 */
  slots?: { default?: string, header?: string }
  /** 单元格格式化函数。 */
  formatter?: (params: { row: PopoverTableRow, column: PopoverTableColumn, rowIndex: number, columnIndex: number, value: any }) => any
}

export type ColumnType = PopoverTableColumn

/** PopoverTableSelect 外层组件契约。 */
export interface PopoverTableSelectProps {
  debounce?: number
  throttle?: number
  options?: ThrottleOrDebounceOptions
  popType?: PopoverTablePopType
  placeholder?: string
  popoverProps?: Partial<PopoverProps>
  inputProps?: Partial<InputProps>
  inputValue?: string
  virtualRef?: PopoverTableVirtualRef
  successiveShowType?: PopoverTableSuccessiveShowType
  onInput?: (value: string) => void
  enableLoadMore?: boolean
  hasMore?: boolean
  loading?: boolean
}

/** PopoverTableSelectBase 的表格与弹层契约。 */
export interface PopoverTableSelectBaseProps {
  width?: number | string
  placement?: PopoverProps['placement']
  virtualRef: PopoverTableVirtualRef
  popoverProps?: Partial<PopoverProps>
  height?: string | number
  id?: string
  columns?: PopoverTableColumn[]
  data?: PopoverTableRow[]
  selectTrigger?: PopoverTableSelectTrigger
  zIndex?: number
  loading?: boolean
  scrollY?: { enabled: boolean, threshold: number }
}
```

### emits.ts
```ts
export interface PopoverTableCellParams {
  row: PopoverTableRow
  column: PopoverTableColumn
  rowIndex: number
  columnIndex: number
  event: MouseEvent
}

/** PopoverTableSelect 外层组件事件。 */
export interface PopoverTableSelectEmits {
  (event: 'focus'): void
  (event: 'blur'): void
  (event: 'enter', row: PopoverTableRow): void
  (event: 'clear'): void
  (event: 'loadMore'): void
  (event: 'select', row: PopoverTableRow): void
  (event: 'input', value: string): void
}

/** PopoverTableSelectBase 表格事件。 */
export interface PopoverTableSelectBaseEmits {
  (event: 'select', row: PopoverTableRow): void
  (event: 'cellClick', params: PopoverTableCellParams): void
  (event: 'cellDblClick', params: PopoverTableCellParams): void
  (event: 'scrollBoundary', payload: { direction: 'bottom' }): void
  (event: 'enter', row: PopoverTableRow): void
}
```

### slots.ts
```ts
/** PopoverTableSelect 支持 default 插槽和按列声明的动态单元格插槽。 */
export interface PopoverTableSelectSlots {
  default?: () => any
  [name: string]: ((params: any) => any) | undefined
}
```
