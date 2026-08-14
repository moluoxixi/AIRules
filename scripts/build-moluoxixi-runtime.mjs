import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(
  repoRoot,
  'roles',
  'moluoxixi',
  'skills',
  'init-project',
  'assets',
  'runtime',
  'source',
)

await build({
  entryPoints: [path.join(sourceRoot, 'packages', 'cli', 'src', 'airules-runtime-entry.ts')],
  outfile: path.join(
    repoRoot,
    'roles',
    'moluoxixi',
    'skills',
    'init-project',
    'assets',
    'runtime',
    'vendor',
    'channel-mem.mjs',
  ),
  alias: {
    '@mindfoldhq/trellis-core/channel': path.join(
      sourceRoot,
      'packages',
      'core',
      'src',
      'channel',
      'index.ts',
    ),
    '@mindfoldhq/trellis-core/mem': path.join(
      sourceRoot,
      'packages',
      'core',
      'src',
      'mem',
      'index.ts',
    ),
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
  legalComments: 'inline',
  logLevel: 'info',
})
