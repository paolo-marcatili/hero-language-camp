# Armenian curriculum v2 · Levels 9–16

This tranche turns levels 9 through 16 into authored teaching levels. It extends
the existing pre-A1 course into a CEFR-informed A1 sequence while keeping hero
levels, attribute caps, monster scaling, and procedural fallback gameplay intact.
Completion is not a formal CEFR certification.

## Sequence

| Level | Theme | Main communicative goal |
|---:|---|---|
| 9 | Countries and languages | Say where you are from and which languages you use |
| 10 | Around town | Ask for places and follow short directions |
| 11 | Days and times | Tell the day/time and describe a short routine |
| 12 | At school | Understand common instructions and classroom objects |
| 13 | Colours and clothes | Describe items and state simple preferences |
| 14 | Body and well-being | Say how you feel and describe simple discomfort |
| 15 | Home and objects | Describe rooms and object locations |
| 16 | Questions and actions | Ask useful questions, negate actions, and connect exchanges |

Every level has:

- a `+5` stat-cap step;
- at least eight newly staged core vocabulary items;
- four manually authored sentence exercises;
- three Armenian semantic distractors per sentence;
- three distinct Italian and English translation distractors;
- a Story/Study Book chapter with objectives, examples, dialogue, notes, mission,
  and continuation hook;
- an exact monster using an existing sprite family plus a distinct pack-defined
  visual variant;
- the existing Star Dragon fallback for future unauthored levels.

## Extension contract

The source of truth is:

```text
content-packs/hy-eastern-it/curriculum/levels-09-16.json
```

`tools/sync-armenian-curriculum.mjs` deterministically materializes that source
into `levels.yaml`, `story.yaml`, `enemies.yaml`, `interface.yaml`, `tags.yaml`,
and the Italian JSONL dictionaries. Existing matching extension records retain
their IDs, audio, images, IPA, and provenance.

The English Armenian pack remains derived. Its generator reads the same module,
uses the reviewed English meanings and distractors, and imports the new English
chapters and monster names.

A future tranche such as `levels-17-24.json` can therefore add content without
editing the React or Phaser applications. Exact monsters override procedural
fallback automatically; a missing exact monster continues to use the configured
fallback enemy.

## Quality rules

The automated audit rejects:

- missing or duplicate level/chapter/enemy IDs;
- a level without enough newly staged core material;
- missing Italian or English translations;
- duplicate answer labels;
- Armenian distractors identical to the answer;
- distractors that only reorder the same Armenian tokens;
- missing English-pack equivalents;
- broken Story/level or enemy/level mappings.

Armenian wording and pronunciation should still receive native-speaker review as
the course evolves. The structural checks prevent known ambiguity and drift but
cannot replace linguistic judgement.
