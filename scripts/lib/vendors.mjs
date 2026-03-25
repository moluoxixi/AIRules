import { readFileSync } from 'node:fs';
import path from 'node:path';

export function normalizePath(value) {
  return value.replace(/\\/g, '/');
}

export function loadVendorManifest(manifestPath) {
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

export function getRepoRoot(fromFileUrl) {
  return path.resolve(new URL('../..', fromFileUrl).pathname);
}

export function resolveHomePath(homeDir, relativePath) {
  return normalizePath(path.resolve(homeDir, relativePath));
}
