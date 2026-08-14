/** Trusted realpath roots for channel context and agent loading. */

import fs from "node:fs";
import path from "node:path";

import { DIR_NAMES } from "../../constants/paths.js";

const AUTO_TRUST_ENTRIES = ["tasks", "workspace"] as const;

interface ChannelTrustConfig {
  trustedDirs: string[];
  autoTrustSymlinks?: boolean;
}

export function parseChannelTrustSection(content: string): ChannelTrustConfig {
  const trustedDirs: string[] = [];
  let autoTrustSymlinks: boolean | undefined;
  let inChannel = false;
  let inList = false;

  for (const raw of content.split("\n")) {
    const line = raw.replace(/\r$/, "");
    const trimmed = line.trimEnd();
    if (trimmed.trim().startsWith("#")) continue;
    if (/^channel:\s*$/.test(trimmed)) {
      inChannel = true;
      inList = false;
      continue;
    }
    if (!inChannel) continue;
    if (trimmed.trim() !== "" && /^\S/.test(line)) {
      inChannel = false;
      inList = false;
      continue;
    }
    if (trimmed.trim() === "") continue;

    if (inList) {
      const item = trimmed.match(/^ {4}-\s*(.+)$/);
      if (item) {
        const value = stripValue(item[1]);
        if (value) trustedDirs.push(value);
        continue;
      }
      inList = false;
    }
    if (/^ {2}trusted_context_dirs:\s*$/.test(trimmed)) {
      inList = true;
      continue;
    }
    const boolMatch = trimmed.match(
      /^ {2}auto_trust_moluoxixi_symlinks:\s*(.+)$/,
    );
    if (!boolMatch) continue;
    const value = stripValue(boolMatch[1]).toLowerCase();
    if (value === "false") autoTrustSymlinks = false;
    else if (value === "true") autoTrustSymlinks = true;
    else {
      process.stderr.write(
        `[channel] channel.auto_trust_moluoxixi_symlinks: invalid value '${value}', ignoring\n`,
      );
    }
  }

  return { trustedDirs, autoTrustSymlinks };
}

function stripValue(value: string): string {
  return value
    .trim()
    .replace(/\s*#.*$/, "")
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

function loadChannelTrustConfig(cwd: string): ChannelTrustConfig {
  const configPath = path.join(cwd, DIR_NAMES.WORKFLOW, "config.yaml");
  try {
    return parseChannelTrustSection(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return { trustedDirs: [] };
  }
}

export function resolveTrustedRoots(cwd: string): string[] {
  const config = loadChannelTrustConfig(cwd);
  const roots: string[] = [];
  for (const entry of config.trustedDirs) {
    try {
      roots.push(fs.realpathSync(path.resolve(cwd, entry)));
    } catch {
      process.stderr.write(
        `[channel] channel.trusted_context_dirs: entry not found or invalid, skipping: ${entry}\n`,
      );
    }
  }

  if (config.autoTrustSymlinks !== false) {
    for (const entryName of AUTO_TRUST_ENTRIES) {
      const entryPath = path.join(cwd, DIR_NAMES.WORKFLOW, entryName);
      try {
        if (fs.lstatSync(entryPath).isSymbolicLink()) {
          roots.push(fs.realpathSync(entryPath));
        }
      } catch {
        // Missing and broken entries are not trusted.
      }
    }
  }
  return [...new Set(roots)];
}
