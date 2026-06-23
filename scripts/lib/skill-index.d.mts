/** 类型声明：与 skill-index.mjs 配对，供 tsc 编译 install.ts 时识别。 */

export declare const SKILL_INDEX_START: string
export declare const SKILL_INDEX_END: string

export interface SkillFrontmatter {
  name?: string
  description?: string
}

export declare function parseSkillFrontmatter(content: string): SkillFrontmatter

export interface RenderSkillIndexOptions {
  readPathHint?: string
}

export declare function renderSkillIndex(skillsDir: string, options?: RenderSkillIndexOptions): string

export declare function upsertSkillIndex(baselineText: string, indexBlock: string): string
