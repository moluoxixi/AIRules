import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface PackageManifest {
  scripts?: Record<string, string>;
}

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
) as PackageManifest;
const publishScript = manifest.scripts?.["test:publish"] ?? "";

const requiredPackageTests = [
  "test/publish-suite.test.ts",
  "test/release-preflight.test.ts",
  "test/commands/channel-claude-adapter.test.ts",
  "test/commands/channel-codex-adapter.test.ts",
  "test/commands/channel-context-trust.test.ts",
  "test/commands/channel-events-seq.test.ts",
  "test/commands/channel-guard.test.ts",
  "test/commands/channel-name-safety.test.ts",
  "test/commands/channel-supervisor-idle.test.ts",
  "test/commands/channel-supervisor-path.test.ts",
  "test/commands/channel-wait-warning.test.ts",
  "test/commands/channel-watch.test.ts",
  "test/commands/channel.test.ts",
  "test/commands/init-internals.test.ts",
  "test/commands/mem-helpers.test.ts",
  "test/commands/mem-integration.test.ts",
  "test/commands/update-internals.test.ts",
  "test/commands/upgrade.test.ts",
  "test/configurators/codex.test.ts",
  "test/configurators/index.test.ts",
  "test/configurators/platforms.test.ts",
  "test/configurators/shared.test.ts",
  "test/constants/paths.test.ts",
  "test/registry-invariants.test.ts",
  "test/templates/pi.test.ts",
  "test/templates/snow-write-moluoxixi-context.test.ts",
  "test/types/ai-tools.test.ts",
  "test/utils/managed-removal.test.ts",
];

const excludedRepositoryTests = [
  "dogfood",
  "marketplace",
  ".moluoxixi/scripts",
  "test/migrations/",
  "test/regression.test.ts",
  "test/utils/atomic-write.test.ts",
];

describe("publish test boundary", () => {
  it("pins the package-relevant publish suite", () => {
    for (const testFile of requiredPackageTests) {
      expect(publishScript, `missing ${testFile}`).toContain(testFile);
    }
  });

  it("excludes repository-only, migration-history, and non-portable fixtures", () => {
    for (const testPath of excludedRepositoryTests) {
      expect(publishScript, `unexpected ${testPath}`).not.toContain(testPath);
    }
  });
});
