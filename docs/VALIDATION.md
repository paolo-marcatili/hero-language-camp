# Validation of the curriculum and cleanup update

Date: 27 September 2026. Source: the attached archive, not a live GitHub checkout.

## Passed

- **13 regression tests** with Node 24. These cover the browser schema, the complete import-review queue, progress migration and its idempotence, possession/history preservation, parent placement, backup compatibility, accepted sentence alternatives, generated order-task chips, every authored level and learning area, sentence/passage reachability, the Danish grade/month map, older monster themes, and local-content upgrades.
- The all-level test generates 12 questions in each of four learning areas for all 158 authored levels across the three packs. It checks usable alternatives, unique visible choices and correct-answer availability. Additional checks exercise all 539 active Armenian sentence/passage records in each base language.
- All three packs pass the editorial content validator **and the same schema validator used by the browser**. Warnings for content still awaiting native review remain visible.
- Danish curriculum validation: 60 units, 25 graphemes, 275 words, 276 structured reading/listening tasks and 1,246 maths/logic tasks. Grade/month metadata, per-unit material, arithmetic consistency and current domains are checked.
- Danish deterministic compilation check; Armenian module, activation and English generation synchronization checks.
- Armenian curriculum audits, English UI/content audit, Italian lint and release asset/content checks.
- YAML parser regression, including bare colon-containing tags such as `tier:core`, staged tags and URLs.
- Syntax parsing of 47 TypeScript/TSX source files. A separate binding check found no unresolved runtime identifiers in the changed shared controller, placement, question/settings components or learning engines. Relative imports of the new entry points resolve.

Three additional offline audio-pipeline tests exercise both real generators with a mocked synthesis endpoint: free dry runs, interruption/resume, changing text/voice/rate, missing MP3s, metadata stability, Danish compilation and retention of Armenian sentence audio through curriculum/English synchronization. An additional isolated compilation check retained all 1,992 Danish generated audio references across the full planned scope. These checks do not call Azure or test acoustic quality.

## Not verified here

`npm ci` was blocked by an HTTP 403 when fetching a dependency from the npm registry. The supplied archive did not include installed React/Vite/TypeScript dependencies. Therefore **a complete TypeScript typecheck, production build, rendered React/browser test and device playback test have not passed in this environment**. Syntax and engine checks are not substitutes for those gates.

On a machine with dependency access, run:

```bash
npm ci
python3 -m pip install 'PyYAML>=6.0.2,<7'
npm run verify:local
```

CI now uses Node 24 and installs the curriculum compiler dependency before that verification command. No CI run, push or deployment was triggered from this workspace.

Before deploying, verify these user flows in the built app:

1. Load an existing Danish child at old level 13: new level 29 appears; coins, equipment and previously recorded reading/maths practice remain after a reload.
2. In Settings, choose a destination, complete the optional check, and move there. Failed checks should not alter progress. Changing profiles should clear the placement/restore preview.
3. Export a backup, restore it into a test profile, and check the preview, course compatibility and per-child isolation.
4. Play a grade-0 listening task using only narration and audible choices. Test muted audio, missing voices, replay and text/adult fallback; a playback failure should not consume the combat clock.
5. Open a new Armenian passage in both Italian and English, use its reading and listening forms, and check that the question and alternatives refer to that passage.
6. Exercise combat, labyrinths, the shop and offline reload in both apps after the shared-controller extraction.

The added language content and pacing still require educational/native-speaker review. These checks verify the implementation and structural consistency, not full linguistic accuracy or CEFR attainment.
