import type { CapabilityDefinition } from './types.js'

export const commonCapability = {
  roleProjections: [
    {
      kind: 'namespace',
      sourceDir: 'skills/common',
      output: 'common',
    },
  ],
} satisfies CapabilityDefinition
