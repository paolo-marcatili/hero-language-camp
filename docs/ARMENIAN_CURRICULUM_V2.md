# Armenian curriculum v2

## Purpose

The hero level remains the single competitive progression number. Authored teaching content is pack-owned. When gameplay reaches a level that has not been authored yet, the learner reviews all staged core material already unlocked, the stat cap continues through the pack progression formula, and the configured fallback monster scales procedurally.

Completing this course may be described as CEFR-informed preparation. It is not a formal CEFR certification because the game does not independently assess every reception, interaction and production descriptor.

## Runtime contract

`levels.yaml` owns:

```yaml
progression:
  stat_cap_start: 5
  stat_cap_per_level: 5
  unauthored_level_mode: review
```

Every authored level must have an exact `number`, the corresponding formula-derived `stat_cap`, and either:

- one or more `tier:core` records tagged with exactly `stage:N`; or
- `review_only: true`.

`enemies.yaml` owns the procedural fallback:

```yaml
fallback:
  enemy_id: star_dragon
  energy_growth_per_level: 0.18
  reward_growth_per_level: 0.12
  scale_growth_per_level: 0.025
  max_scale: 1.45
```

An exact enemy at a level always wins. If none exists, the fallback enemy is scaled. New monster art is optional, so course content can be extended before a bespoke visual is ready.

## Adding a level

1. Add one exact entry to `levels.yaml`.
2. Tag new reviewed core words, letters or sentences with `stage:N` and `tier:core`.
3. Add or reuse a Story chapter through `chapter_id`.
4. Optionally add an exact enemy and visual configuration for level N.
5. Run `npm run content:sync-english` if the English pack derives from the Italian source.
6. Run `npm run content:audit-curriculum-v2` and `npm run verify:local`.

Content without an explicit stage never counts as introduced. `tier:extension` remains a source/reference library and does not inflate parent progress.

## CEFR-informed roadmap

| Levels | Band | Teaching focus |
|---|---|---|
| 0–4 | pre-A1 | alphabet groups, sound-letter mapping, greetings, essential one-word messages |
| 5–8 | early A1 | identity, family, food, possession, requests, classroom language |
| 9–12 | A1 | places, directions, numbers, age, days, time and routines |
| 13–16 | A1 | present-tense patterns, questions, negation, plurals and descriptions |
| 17–20 | strong A1 | short conversations, needs, commands, connected sentences and listening |
| 21–24 | early A2 | shopping, quantities, home, local environment and routine exchanges |
| 25–28 | A2 | plans, comparisons, richer descriptions, past/future reference and short messages |
| 29–32 | A2 consolidation | integrated dialogues, short narratives, reading/listening comprehension and controlled writing |

The roadmap is deliberately not converted into empty runtime levels. A level becomes authored only when its content and quality checks are ready.

## Combat timing

`estimateHeroDamage()` calculates the accuracy/defense base hit and caps that base at Strength. Weakness and timing modifiers are then applied to the base hit with a temporary ceiling of `1.5 × Strength`. This preserves long-term attribute progression while making fast, medium and slow correct answers visibly different. Timeout remains zero monster damage.
