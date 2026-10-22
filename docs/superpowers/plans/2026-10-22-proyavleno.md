# ПРОЯВЛЕНО Implementation Plan

> Execution: native implementation with bounded parallel assets/concepts and independent final review, explicitly authorized by the user.

**Goal:** Deliver a polished local Russian landing page for selling websites to specialists.

**Architecture:** Static semantic document, CSS, ES modules. Configuration is centralized; no framework or runtime dependency.

**Tech Stack:** HTML, CSS, JavaScript, Node 22+.

**Spec:** ../specs/2026-10-22-proyavleno-design.md

## Global Constraints
Russian UI; no fabricated achievements/prices/results; concepts labeled; no public publishing; reduced motion and static content available; four requested viewport widths.

## Review Focus
- 360px: long Russian words and controls must fit without overflow.
- Keyboard: menu, tabs, FAQ and form all operable with visible focus.
- Empty/whitespace form: meaningful inline errors and correct focus.
- Clipboard unavailable: editable inquiry remains selectable.
- Reduced motion/background tabs: no continuing decorative loop.

### Task 1: Content, assets and page
- [x] Create index.html, src/config.js, src/styles.css, assets shadow and local fonts.
- [x] Build all sections with real authored copy and no hidden content defaults.
- [x] Inspect 360/390/768/1440 for hierarchy, overflow and assets.

### Task 2: Concepts and interaction
- [x] Implement renderConcept(concept) in src/concepts.js; isolated styles in src/concepts.css, editable strings in config.js.
- [x] Implement src/main.js for tabs (arrow/Home/End), menu, FAQ, form validation/copy, light and process motion.
- [x] Test each interaction, invalid/valid input, keyboard and reduced motion in browser (manual static mode; OS media branch audited).

### Task 3: Delivery
- [x] Add scripts/serve.mjs, scripts/build.mjs, README.md and asset provenance.
- [x] Run source checks and build; inspect page in one batched round and correct material issues.
- [x] Independent final review (ship, four fixes resolved), record QA evidence, open local preview and deliver replacement checklist.
