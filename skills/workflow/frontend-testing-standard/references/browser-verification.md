# Browser Verification

## Runtime Health

When the change affects UI, routing, browser APIs, layout, canvas, 3D, or user interaction, run the app or preview if the project provides a way to do so.

Check:
- page is not blank;
- console has no new errors;
- critical network requests do not fail unexpectedly;
- assets load;
- route entry points render expected content.

## Interaction Checks

Exercise the user path affected by the change:
- buttons;
- forms;
- dialogs and drawers;
- tables and pagination;
- tabs, menus, and filters;
- drag/drop or keyboard controls when present.

## Responsive And Visual Checks

Check representative desktop and mobile viewports. Verify:
- no overlapping text;
- no clipped controls;
- no unintended horizontal overflow;
- fixed-format widgets keep stable dimensions;
- loading, empty, error, and long-content states remain usable.

## Canvas, 3D, And Media

For canvas, WebGL, charts, videos, generated images, or 3D scenes, verify rendered pixels or screenshots. A passing build is not enough to prove visual output exists.

Use Playwright, the in-app browser, or project E2E tooling when available.
