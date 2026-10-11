# Danish Foundations — Phases C and D

## Delivered scope

This release extends the Phase B application through full introductory 0.-klasse literacy/number work and a beginning-1.-klasse bridge. It does not attempt to cover the non-language/non-mathematics competence areas of børnehaveklasse.

### Levels 0–4 — Phase B foundation

- First 17 graphemes.
- Picture-supported short words.
- Quantities, number symbols, ordering, comparison, addition, and subtraction through 10.

### Levels 5–9 — Phase C, full 0.-klasse language/math path

- Remaining central introductory graphemes: `d`, `g`, `j`, `y`, `æ`, `ø`, `å`, and `c`.
- Short sentences, sentence-to-picture matching, sentence construction, and missing-word tasks.
- High-frequency Danish function words.
- Number line work, number bonds through 10, mixed addition/subtraction, and contextual problems.
- Five additional continuous-story chapters.

### Levels 10–13 — Phase D, beginning 1. klasse

- Longer and two-syllable words.
- Three-sentence mini-stories with literal comprehension questions.
- Missing-letter and sentence-completion activities supporting early writing.
- Numbers 11–20, number bonds, plus/minus through 20, and illustrated story problems.
- Four additional continuous-story chapters.

## Content totals

- 25 graphemes
- 127 words
- 75 reading problems
- 196 mathematics problems
- 14 levels, chapters, and enemies
- 3 labyrinth bands

## Exercise selection

The foundations engine keeps the four shared game domains for compatibility:

| Internal focus | Child-facing Danish domain |
|---|---|
| `vocabulary` | Bogstaver og lyde |
| `comprehension` | Ord, sætninger og læsning |
| `grammar` | Tal og tælling |
| `pronunciation` | Plus, minus og talvenner |

At later levels, reading sessions probabilistically mix earlier word work with sentence and mini-story tasks. Mathematics sessions mix current-stage material with earlier review according to mastery and the shared spaced-review scheduler.

## Parent progress view

The top-bar progress button opens a parent-focused overlay showing:

- introduced/mastered letters;
- introduced/mastered words;
- reading-task progress;
- mathematics-task progress;
- training sessions in the current chapter;
- low-mastery letters and words suggested for review.

The dashboard is descriptive rather than a grade.

## Authoring and validation

Regenerate the data-driven expansion:

```bash
npm run content:build-danish
```

Validate the pack, curriculum invariants, engine, and application:

```bash
npm run check:danish
```

The validator checks chapter/level/enemy linkage, the grapheme sequence, example words, reading domains, mathematics domains and ranges, labyrinth bands, and review metadata.

## Review boundary

The code and content structure are ready for use and testing. New Phase C+D Danish text is deliberately not marked approved. Before a classroom-style release, review:

- letter names and sound examples;
- decodability labels;
- naturalness and age appropriateness of all Danish prompts;
- mini-story comprehension options;
- number-language phrasing;
- neural or human recordings.
