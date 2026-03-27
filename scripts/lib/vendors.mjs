import { readFileSync } from 'node:fs';
import path from 'node:path';

export function normalizePath(value) {
  return value.replace(/\\/g, '/');
}

export function parseJsonc(content) {
  const source = content.replace(/^\uFEFF/, '');
  let withoutComments = '';
  let inString = false;
  let stringQuote = '"';
  let isEscaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (inString) {
      withoutComments += char;
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === stringQuote) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringQuote = char;
      withoutComments += char;
      continue;
    }

    if (char === '/' && nextChar === '/') {
      while (index < source.length && source[index] !== '\n') {
        index += 1;
      }
      if (index < source.length) {
        withoutComments += source[index];
      }
      continue;
    }

    if (char === '/' && nextChar === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        index += 1;
      }
      index += 1;
      continue;
    }

    withoutComments += char;
  }

  const withoutTrailingCommas = withoutComments.replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(withoutTrailingCommas);
}

export function loadVendorManifest(manifestPath) {
  return parseJsonc(readFileSync(manifestPath, 'utf8'));
}

export function getRepoRoot(fromFileUrl) {
  return path.resolve(new URL('../..', fromFileUrl).pathname);
}

export function resolveHomePath(homeDir, relativePath) {
  return normalizePath(path.resolve(homeDir, relativePath));
}
