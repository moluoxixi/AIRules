#!/usr/bin/env node
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

// spec-workflow 内容门禁的共享纯函数（零外部依赖）：
// 统计 delta spec 数量。被 spec-validate.mjs 与 spec-archive.mjs 复用。
// 注：proposal/tasks 门禁已移除——proposal 内容由 requirements/<id>.md 承载，
//     tasks 由 .airules/tasks/<id>.md 承载，archive 只检查 delta 是否存在且格式合法。

/** 统计 change 下 specs/<capability>/spec.md 的 delta 文件数。 */
export function countDeltaSpecs(changeDir) {
  const specsDir = path.join(changeDir, 'specs')
  if (!existsSync(specsDir)) {
    return 0
  }
  let count = 0
  for (const cap of readdirSync(specsDir, { withFileTypes: true })) {
    if (cap.isDirectory() && existsSync(path.join(specsDir, cap.name, 'spec.md'))) {
      count++
    }
  }
  return count
}
