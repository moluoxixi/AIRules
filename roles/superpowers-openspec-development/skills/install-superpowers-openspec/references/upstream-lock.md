# Superpowers and OpenSpec upstream lock

## Superpowers

- Source: `https://github.com/obra/superpowers`
- Release: `v6.1.1`
- Git commit: `d884ae04edebef577e82ff7c4e143debd0bbec99`
- License: `MIT`
- Projection: all skill directories below upstream `skills/`
- License notice: bundled at `assets/licenses/SUPERPOWERS-LICENSE.txt`

## OpenSpec

- Source: `https://github.com/Fission-AI/OpenSpec`
- Package: `@fission-ai/openspec@1.6.0`
- Git tag: `v1.6.0`
- Git commit: `e1b51d111ab446b54dee2d6159ac245f0339ae52`
- Package integrity: `sha512-7yFTQ3hrrk11mQ2ACClNv2gtAN0o116vCgwoiQKmreoB6ambSnrZh7wf2FNFoSDBXHBi9iiCQ7G16fG71ZNppA==`
- License: `MIT`
- Runtime: Node.js `>=20.19.0`

The role installs OpenSpec in a versioned AIRules tool cache with the bundled dependency lock. npm and OpenSpec execute with isolated home, platform app-data, XDG, npm configuration, and npm cache paths below that tool cache. Enterprise operation disables OpenSpec telemetry by default with `OPENSPEC_TELEMETRY=0` and `DO_NOT_TRACK=1`.

The role initializes a ledger by running the fixed CLI only in an empty staging directory and atomically moving the resulting `openspec/` directory into the project. It never invokes target-side `openspec init` or `openspec update`, never writes global host prompts, and never exposes global CLI configuration commands through its passthrough. Token-owned locks serialize installation, ledger initialization, and project mutations; a lock is recovered only after 30 minutes when its same-host PID is definitively absent.
