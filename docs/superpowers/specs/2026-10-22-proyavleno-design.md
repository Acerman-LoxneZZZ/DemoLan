# ПРОЯВЛЕНО — approved brief translated into implementation

The user expressly delegates all reversible art direction and implementation decisions and asks for a completed local page without additional design approvals.

## Direction
A sculptural editorial sheet: generous mineral paper, near-black Manrope typography, a vermilion square and line language. A large asymmetric headline crosses the hero above an independent, broad shadow plane. Copy and controls sit on stable, clear ground. Cormorant Garamond supplies a quieter voice inside selected concepts. Fonts are local and licensed under SIL OFL.

## Narrative and behavior
Hero → why a professional page matters → four distinct concept compositions → complete work scope → four-stage process with a folding page diagram → FAQ → short inquiry.

One physical light effect: pointer gently translates and changes the shadow contrast while text stays fixed. Mobile gets one short introduction then a still scene. Process geometry develops with scroll; conceptual changes use a short light-like reveal. Reduced motion is static and complete. Visibility and tab state pause active work.

## Architecture
index.html includes initial copy and primary links for fast readable loading. src/config.js exports all editable content and contact/endpoint settings. src/main.js wires semantic markup, menu, form and motion. src/concepts.js and src/concepts.css own distinct mini sites. assets contains the generated shadow, responsive WebP derivatives and local fonts. scripts/serve.mjs and scripts/build.mjs provide dependency-free preview and packaging.

## Form contract
Required name, specialization, contact; optional message. Inline errors linked with aria-describedby, error summary, focus to first invalid field. Default mode never sends. It reveals a prepared editable inquiry with copy action and manual selection fallback. Optional endpoint supports POST JSON after explicit configuration; no secrets in client code. No invented success.

## Validation
One batched visual inspection at 360,390,768,1440. Verify every navigation/action, four concepts, keyboard tabs, mobile menu, form errors/copy, responsive assets, reduced-motion and paused animation. Fix material defects together then confirm affected behavior. Keep honest evidence in docs/QA.md.
