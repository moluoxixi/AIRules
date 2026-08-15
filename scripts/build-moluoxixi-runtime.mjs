import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const roleRoot = path.join(repoRoot, 'roles', 'moluoxixi')
const packagesRoot = path.join(roleRoot, 'packages')

await build({
  entryPoints: [path.join(packagesRoot, 'cli', 'src', 'airules-runtime-entry.ts')],
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
    '@moluoxixi/airules-moluoxixi-core/channel': path.join(
      packagesRoot,
      'core',
      'src',
      'channel',
      'index.ts',
    ),
    '@moluoxixi/airules-moluoxixi-core/mem': path.join(
      packagesRoot,
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
