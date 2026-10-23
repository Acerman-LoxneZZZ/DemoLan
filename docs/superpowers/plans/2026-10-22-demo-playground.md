# Bottom demo playground implementation plan

> **For agentic workers:** implement the independent UI and 3D tasks in parallel, then integrate and review the final result.

**Goal:** Add an interactive before/after comparison, a mood selector that changes fonts as well as colors, and a new 3D sculpture at the bottom of the landing.

**Architecture:** One self-contained demo section after the contact section and before the footer. All theme variables, styles, state and events stay inside this section. Existing content and interactions above it retain their behavior. Static HTML supplies readable content before JavaScript; the comparison uses a native range input. The new native WebGL scene has its own lifecycle and fallback.

**Tech stack:** Existing static HTML/CSS/ES modules and Node build/test scripts. Local licensed Manrope, Cormorant Garamond and Unbounded. No new runtime dependency.

**Spec:** User approved before/after, mood/font switching and a new bottom 3D model, with freedom to experiment in the bottom area. The user explicitly requested pushing the current result before edits.

## Checkpoint and rollback

- [x] Push the unchanged current page to `origin/main`, commit `1a0cee2`.
- [x] Continue on `codex/demo-playground`; preserve main as the pre-change checkpoint.
- [x] Commit and push the completed experiment on that separate branch.

## Scope and contracts

- `src/playground.js` exports `renderPlayground()` and `setupPlayground(motion)`; `playground.css` styles only `.demo-playground` descendants.
- Mood selector changes section-local `data-mood`, color variables and type role; dispatches `moodchange` on the section.
- Shared section variables for 3D: `--orbit-light-rgb` and `--orbit-accent-rgb`, three normalized numbers separated by spaces.
- `src/orbit-scene.js` exports `setupOrbitScene({canvas,host,motion})`; host is `.demo-orbit` inside the demo section. It reads the local mood and listens to `moodchange` on its section.
- Three looks: expressive violet with Unbounded; precise ice blue with Manrope; warm champagne with Cormorant Garamond. All are illustrative demo styling, not new main-page defaults.
- Before/after retains the same illustrative tutor content. Native range supports pointer, keyboard, Home/End. Duplicate comparison layer is hidden from accessibility and has no focusable controls.
- 3D is a new interwoven ring sculpture, not another S ribbon. Stop when hidden/offscreen; respect reduced motion; mobile intro ends. Preserve vertical touch scrolling.

## Tasks

- [x] Build comparison markup, local mood UI, styles, range/reset behavior and meaningful input/state tests.
- [x] Build new ring mesh and bounded interactive WebGL scene with fallback, lifecycle and geometry checks.
- [x] Integrate the section, styles/fonts/modules and build lists without restyling upper sections.
- [x] Run relevant tests, build and one source/quality review; resolve material findings as one batch.
- [x] Update docs with preview link, checkpoint/branch and actual QA limits; restart local preview.

## Review focus

1. Range endpoints and keyboard remain usable when clipping one layer completely.
2. Mood changes affect fonts and lighting locally, including under reduced motion and after a scene stops.
3. Narrow screens and long Cyrillic copy do not escape the preview frame.
4. Pointer/drag never traps touch scrolling or prevents normal page navigation.
5. No UI or font/style change leaks into the existing upper page.

## Verification boundary

The saved browser origin deny for localhost has not been cleared. Do not bypass it. Existing screenshots are prior iterations. Source, unit and geometry checks must not be described as current browser QA.

Completion: assembled by root after subagent quota interruption;58tests pass, static build checked. No fresh browser QA because origin access remains denied. Branch push verified in final handoff. Latest user steering additionally restricts and strengthens hero pointer control and repairs comparison dragging.
