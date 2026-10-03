# Repository QA Report

Date: 2026-09-07
Scope: HTML, JavaScript, CSS, shared lesson shells, lesson authentication, local asset references, and representative browser workflows.

## Scope Reviewed

- 4,255 repository files
- 755 HTML pages
- 121 mathematics lesson pages
- 88 science lesson pages
- Shared Grade 6, Grade 7-12, and science lesson engines
- Home page, representative games, computer-science lessons, and Hike Adventure pages

## Confirmed Bugs Fixed

1. Home page Firebase initialization failed because `main.js` called `firebase.firestore()` without loading the Firestore compat SDK. Added the missing SDK reference to `index.html`.
2. `math/games/equationescape.html` requested a nonexistent `style.css` even though its styles are inline. Removed the broken stylesheet reference.
3. Two Hike Adventure pages referenced nonexistent images. Replaced them with existing repository assets:
   - `dead-go-back-to-biker.html`
   - `find-uniform-meeting-room.html`
4. Java lesson index linked to `java-fileio.html`, but the repository file is `java-fileio.htm`. Corrected the link.
5. R packages lesson referenced three missing screenshots. Repointed the images to existing R screenshots.
6. YAML introduction referenced missing `yaml-editor-1.png`. Repointed it to the existing `yaml-editor.png`.
7. Science Light Lab requested a missing `style.css` while providing inline styles. Removed the broken stylesheet reference.
8. Science shared shell exposed mojibake labels such as `ðŸ...` in pages with legacy encoding issues. Replaced generated emoji labels with ASCII-safe labels and added cache-busting to the shared shell references.
9. The whitespace-only Grade 2 science entry could not mount the shared shell because it had no `<body>`. The science shell now creates one when needed.

## Shared Lesson Verification

- Math Grade 6 shell: editor diagnostics clean.
- Math Grade 7-12 shell: editor diagnostics clean.
- Science shell and styles: editor diagnostics clean.
- All 121 math lessons include the auth popup script.
- All 88 science lessons include the shared science shell.
- Firebase progress paths were verified in the shared lesson engines.
- Final-level and video auth guards were browser-tested.

## Browser Smoke Tests

Passed rendering checks for:

- Home page
- Grade 6 Absolute Value
- Grade 8 Compound Probability
- Kindergarten Seasons & Weather
- Grade 8 Acids & Bases
- Java lesson index
- R Packages
- Hike Adventure
- Equation Escape

The home page no longer reports `firebase.firestore is not a function` after the SDK fix.

## Remaining Findings / Environment Notes

- YouTube embeds report Error 153 when opened from local `file://` pages. The lessons provide the intended YouTube fallback and confirmation control.
- `/cookiebanner.js` and some root-relative feedback assets cannot resolve from local `file://` pages. They are deployment-root paths and should resolve when hosted at the configured site root.
- The relative-reference crawl still reports intentional deployment URLs, generated template placeholders, and two Prime Time placeholder image names. These were not changed because they are either runtime-generated or part of the game’s current placeholder design.
- No Node, Bun, Deno, or QuickJS runtime is installed, so JavaScript syntax validation relied on VS Code diagnostics and browser execution.

## Result

The confirmed repository defects found during this QA pass were fixed. Remaining console messages are primarily local-file hosting limitations or intentional deployment/template references rather than confirmed application exceptions.
