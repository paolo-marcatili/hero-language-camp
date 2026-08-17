# Armenian curriculum modules

Authored curriculum extensions live in deterministic JSON modules named
`levels-NN-MM.json`. The module is the source of truth for:

- level configuration and CEFR-informed learning goals;
- staged core vocabulary;
- curated sentence exercises and semantic distractors;
- Story and Study Book chapters;
- exact level monsters and localized monster names.

Run:

```bash
npm run content:sync-curriculum
npm run content:sync-english
npm run content:audit-curriculum-09-16
```

The sync tool preserves existing IDs, audio, media, provenance, and native-review
metadata when it promotes a matching extension record. It never moves a word or
sentence that is already core at an earlier authored level.

To add another tranche, copy the structure of `levels-09-16.json`, use a new
non-overlapping range, and run the same commands. No application source change
should be required.
