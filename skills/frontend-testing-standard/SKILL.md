---
name: frontend-testing-standard
description: Use when testing, verifying, or reviewing frontend changes involving UI behavior, component tests, hooks/composables, browser rendering, responsiveness, accessibility, E2E flows, build verification, coverage, or frontend delivery quality.
---

# Frontend Testing Standard

## Overview

This skill defines what frontend changes must verify. It does not require fixed command names; commands must be discovered from the project.

Use stricter project, user, or CI rules when present.

## Load References

- What to test: read `references/test-dimensions.md`.
- How to discover commands without hard-coding them: read `references/command-discovery.md`.
- Browser, interaction, responsive, visual, and canvas checks: read `references/browser-verification.md`.
- Accessibility checks: read `references/accessibility.md`.
- Coverage and risk standards: read `references/coverage-and-risk.md`.

## Required Testing Dimensions

At minimum, evaluate:
- static quality;
- type correctness;
- unit logic;
- component behavior;
- page or route integration;
- critical user interactions;
- browser runtime health;
- responsive layout and visual integrity;
- accessibility basics;
- production build or equivalent delivery check;
- coverage when tooling exists or meaningful logic changed.

If a dimension has no project tool or entry point, report it as `MISSING`. If it cannot be run, report `NOT RUN` with the reason.

## Framework And Tool Skills

- Vue tests: use `vue-testing-best-practices`.
- Vitest tests, mocks, fixtures, and coverage: use `vitest`.
- Playwright or browser-driven checks: use `playwright-cli` or available browser tooling.
- UI accessibility or visual quality reviews: use `web-design-guidelines` when available.

## No Fake Passes

Do not lower thresholds, remove assertions, exclude important files, mock away the behavior under test, or replace failing browser checks with static assumptions just to pass.
