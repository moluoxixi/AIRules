import type { CapabilityDefinition } from './types.js'

export const codingCapability = {
  roleProjections: [
    {
      kind: 'mcp',
      sourceFile: 'mcps/code/mcps.json',
      output: 'mcps/code/mcp.json',
    },
  ],
} satisfies CapabilityDefinition
