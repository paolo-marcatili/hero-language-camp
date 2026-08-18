# Armenian curriculum modules

Authored curriculum extensions live in deterministic JSON modules named
`levels-NN-MM.json`. A module is the source of truth for:

- level configuration and CEFR-informed learning goals;
- staged core vocabulary;
- curated sentence exercises and semantic distractors;
- Story and Study Book chapters;
- optional exact level monsters and localized monster names.

Run:

```bash
npm run content:sync-curriculum
npm run content:sync-english
npm run content:audit-curriculum
```

The synchronizer preserves existing IDs, audio, media, provenance, and review
metadata when it promotes a matching extension record. A new item receives an
empty audio array until human or automated audio is generated, so adding a level
does not require editing application source.

The generic audit discovers every `levels-NN-MM.json` module. It rejects gaps or
overlaps, duplicate content, missing translations, word-order-only distractors,
broken Story mappings, and drift between the Italian and English Armenian packs.
An exact monster is optional: when one is omitted, the pack's configured final
monster fallback keeps gameplay progressing.

Current authored modules:

```text
levels-09-16.json  A1 foundations
levels-17-24.json  strong A1 and early A2
```

To extend the course, add the next contiguous range, for example
`levels-25-32.json`, and run the same commands. No React or Phaser source change
should be required.
