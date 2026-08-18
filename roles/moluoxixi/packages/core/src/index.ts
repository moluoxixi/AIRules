// Root barrel — re-exports the channel and task public APIs so callers
// can `import { ... } from "@moluoxixi/airules-moluoxixi-core"`. Sub-path
// imports (`@moluoxixi/airules-moluoxixi-core/channel`, `/task`) remain the
// recommended form for tree-shake-friendly consumption.

export * from "./channel/index.js";
export * from "./task/index.js";
