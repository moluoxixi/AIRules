import { describe, expect, it } from "vitest";
import fs from "node:fs";
import {
  getMoluoxixiTemplatePath,
  getClaudeTemplatePath,
  getOpenCodeTemplatePath,
  getPiTemplatePath,
  getPiSourcePath,
  getMoluoxixiSourcePath,
  readMoluoxixiFile,
  readTemplate,
  readScript,
  readMarkdown,
} from "../../src/templates/extract.js";

// =============================================================================
// getXxxTemplatePath — returns existing directory paths
// =============================================================================

describe("template path functions", () => {
  it("getMoluoxixiTemplatePath returns existing directory", () => {
    const p = getMoluoxixiTemplatePath();
    expect(fs.existsSync(p)).toBe(true);
    expect(fs.statSync(p).isDirectory()).toBe(true);
  });

  it("getClaudeTemplatePath returns existing directory", () => {
    const p = getClaudeTemplatePath();
    expect(fs.existsSync(p)).toBe(true);
    expect(fs.statSync(p).isDirectory()).toBe(true);
  });

  it("getOpenCodeTemplatePath returns existing directory", () => {
    const p = getOpenCodeTemplatePath();
    expect(fs.existsSync(p)).toBe(true);
    expect(fs.statSync(p).isDirectory()).toBe(true);
  });

  it("getPiTemplatePath returns existing directory", () => {
    const p = getPiTemplatePath();
    expect(fs.existsSync(p)).toBe(true);
    expect(fs.statSync(p).isDirectory()).toBe(true);
  });
});

// =============================================================================
// Deprecated aliases return same result
// =============================================================================

describe("deprecated source path aliases", () => {
  it("getMoluoxixiSourcePath equals getMoluoxixiTemplatePath", () => {
    expect(getMoluoxixiSourcePath()).toBe(getMoluoxixiTemplatePath());
  });

  it("getPiSourcePath equals getPiTemplatePath", () => {
    expect(getPiSourcePath()).toBe(getPiTemplatePath());
  });
});

// =============================================================================
// readMoluoxixiFile — reads files from trellis template directory
// =============================================================================

describe("readMoluoxixiFile", () => {
  it("reads workflow.md from trellis templates", () => {
    const content = readMoluoxixiFile("workflow.md");
    expect(typeof content).toBe("string");
    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain("#");
  });

  it("reads a script file", () => {
    const content = readMoluoxixiFile("scripts/task.py");
    expect(typeof content).toBe("string");
    expect(content.length).toBeGreaterThan(0);
  });

  it("throws for nonexistent file", () => {
    expect(() => readMoluoxixiFile("nonexistent.txt")).toThrow();
  });
});

// =============================================================================
// readTemplate — reads from category subdirectories
// =============================================================================

describe("readTemplate", () => {
  it("throws for nonexistent category/file", () => {
    expect(() => readTemplate("scripts", "nonexistent.txt")).toThrow();
  });
});

// =============================================================================
// readScript / readMarkdown helpers
// =============================================================================

describe("readScript", () => {
  it("reads a Python script from scripts/", () => {
    const content = readScript("task.py");
    expect(typeof content).toBe("string");
    expect(content.length).toBeGreaterThan(0);
  });
});

describe("readMarkdown", () => {
  it("reads workflow.md", () => {
    const content = readMarkdown("workflow.md");
    expect(typeof content).toBe("string");
    expect(content).toContain("#");
  });
});
