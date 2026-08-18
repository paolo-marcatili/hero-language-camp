# Armenian curriculum v2 · Levels 17–24

This tranche extends the authored Armenian course from practical A1 exchanges
into early A2 communication. It is CEFR-informed, not a formal certification.
The sequence follows the application's existing +5 stat-cap progression and
keeps hero levels, monster scaling, and final-monster fallback unchanged.

## Sequence

| Level | Theme | Main communicative goal | Band |
|---:|---|---|---|
| 17 | Shopping and choosing | Ask prices, state quantities, and try an item | A1 |
| 18 | At a café and restaurant | Order food, state a preference, and ask for the bill | A1 |
| 19 | Weather and seasons | Describe current weather and seasonal patterns | A1 |
| 20 | Travel and transport | Buy a ticket and understand departures and arrivals | A1 |
| 21 | Talking about the past | Report completed everyday actions | Early A2 |
| 22 | Plans and the future | Describe plans, appointments, and future travel | Early A2 |
| 23 | Comparisons and descriptions | Compare people, objects, and transport | Early A2 |
| 24 | Messages and everyday problems | Ask for help and communicate useful details | Early A2 |

The module contains 115 vocabulary definitions, 32 curated sentence exercises,
eight chapters, and eight exact monsters. Each sentence has three semantic
Armenian distractors and three distinct Italian and English distractors. The
audit rejects distractors that merely reorder the correct Armenian words.

## Source and materialization

The source of truth is:

```text
content-packs/hy-eastern-it/curriculum/levels-17-24.json
```

`tools/sync-armenian-curriculum.mjs` materializes all discovered modules into the
Italian Armenian pack. `tools/sync-armenian-english-pack.mjs` then derives the
English Armenian pack from the reviewed bilingual fields. Matching dictionary
records retain audio and media; genuinely new records start with `audio: []` and
can later receive generated or human recordings.

## Generic extension contract

`tools/audit-armenian-curriculum.mjs` is range-independent. It verifies that:

- module ranges are contiguous and non-overlapping;
- every module ID matches its filename;
- every non-review level introduces at least eight words and four sentences;
- every staged item materializes at the declared level in both packs;
- Italian and English answers are unique within each level;
- sentence distractors are semantic, unique, and not word-order variants;
- Story chapters and optional exact monsters resolve in both packs;
- all module tags are registered as controlled tags;
- attribute caps remain `5 + level × 5`;
- the configured final monster remains available as fallback.

A future `levels-25-32.json` module can therefore be added without a new
range-specific audit or application-code modification.

## Linguistic review

The content is structurally validated and written as a coherent communicative
sequence. Armenian wording, inflection, pronunciation, and cultural nuance
should still receive native-speaker review before being marked approved.
