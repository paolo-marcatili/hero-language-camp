# Hero Language Camp

A family learning game with a shared adventure, combat, equipment and exploration system, plus two courses:

- **Danish:** 60 units spanning 0.–2. klasse, with two units per teaching month. Grade 0 uses spoken instructions, listening and visual answers; reading and spelling develop in grades 1–2. Language, maths and logic are the scope.
- **Eastern Armenian:** 49 authored levels with Italian or English explanations. The later units develop A2/B1 receptive language through sentences and connected passages. Speaking and writing tasks are adult-supported; a game level is not a CEFR assessment.

Start with [the repository review](docs/REPO_REVIEW.md), [the curriculum map](docs/CURRICULUM_MAP.md) and [validation results](docs/VALIDATION.md).

## Run locally

Use Node.js 24+ and npm 10+. The curriculum compiler also needs Python 3 and PyYAML.

```bash
npm ci
python3 -m pip install 'PyYAML>=6.0.2,<7'
npm run dev            # Armenian, http://127.0.0.1:5173
npm run dev:danish     # Danish, http://127.0.0.1:5174
```

Both dev and build commands copy the required media from the canonical content packs. Public content-pack copies are generated, not a second authoring source.

```bash
npm test
npm run verify:local   # curriculum checks, typechecks and the unified site build
```

## Choose a starting point and protect progress

In Settings, **Level and progress** offers direct parent placement and an optional eight-question check. A score of 7/8 unlocks the suggested move; parents can also choose a level directly. The check is an aid to placement, not a proficiency test.

**Save progress** exports the active child's progress for the current course. **Open progress backup** previews a file before restoring it into that profile. Armenian backups work across the Italian and English versions. Danish and Armenian remain separate.

Updates retain stable item IDs. The expanded Danish course maps old levels to suitable new positions once, preserving practice history, coins and equipment. Use the same browser and site origin for automatic recovery; use a backup when moving devices or after clearing browser storage.

## Author curricula

```bash
npm run content:build-danish
npm run content:sync-english   # syncs Armenian modules and activation decisions first
npm run content:check-danish-sync
npm run content:check-english-sync
```

Danish source: `content-packs/da-foundations/curriculum/school-plan.json`, plus the frozen legacy seed. Armenian source: `content-packs/hy-eastern-it/curriculum/levels-*.json`, `activation.json`, and the existing core dictionary. Edit these sources, then regenerate. Do not run the historical phase-specific expansion scripts over the new course.

New Armenian material still needs native-speaker review and recorded audio. Existing recordings are retained. New items use browser speech where available; if playback fails the exercise exposes text for reading or adult support and pauses the combat timer.

See [audio generation](docs/ARMENIAN_AUDIO_GENERATION.md) for the existing optional recording workflow and [documentation guide](docs/README.md) for older material.
