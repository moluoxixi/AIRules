declare module '*skills/init-project/scripts/templates.mjs' {
  export function listTemplateFiles(relativeRoot: string, options?: { additions?: boolean }): string[]
  export function readAddition(relativePath: string): string
  export function readTemplateFile(relativePath: string): string
  export function readTemplateOrAddition(relativePath: string): string
  export function verifyTemplateSource(): unknown
}

declare module '*skills/init-project/scripts/plan.mjs' {
  interface PlanEntry {
    content: import('node:buffer').Buffer | string
  }

  export function buildPlan(
    platforms: string[],
    pythonCommand: string,
    withStatusline?: boolean,
    packages?: unknown[],
    workflow?: unknown,
    projectType?: string,
    options?: Record<string, unknown>,
  ): Map<string, PlanEntry>

  export function localizeProjectRuntime(relativePath: string, content: string): string
}
