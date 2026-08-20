/**
 * Canonical task.json shape — single source of truth shared by all TS
 * writers. The canonical types and factory now live in the
 * `@mindfoldhq/moluoxixi-core` task API; this module re-exports them under
 * the legacy `TaskJson` / `emptyTaskJson` names for CLI call sites.
 *
 * New code should prefer `MoluoxixiTaskRecord` / `emptyTaskRecord` from
 * `@mindfoldhq/moluoxixi-core/task` directly.
 */

import {
  emptyTaskRecord,
  type MoluoxixiTaskRecord,
} from "@mindfoldhq/moluoxixi-core/task";

export type TaskJson = MoluoxixiTaskRecord;

export const emptyTaskJson = emptyTaskRecord;
