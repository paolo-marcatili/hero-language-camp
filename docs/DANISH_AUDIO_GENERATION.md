# Danish neural audio generation and integration

The Danish app works with a device `da-DK` voice, but fixed MP3 files provide more consistent pronunciation and reliable offline playback.

## What the core workflow generates

Run the plan without using Azure credits:

```bash
npm run content:audio:danish:plan
```

The plan includes:

- reusable child-facing instructions;
- Danish letter names;
- every staged core word;
- complete mathematics prompts;
- reading targets and stories;
- the spoken comprehension question for every mini-story.

Isolated phonemes are intentionally excluded. Short sounds such as `/s/` and `/m/` should be recorded by a Danish speaker and added to each letter's `sound_audio` field.

## 1. Add Azure credentials to GitHub

Open the `danish-foundations` repository:

1. **Settings**
2. **Secrets and variables**
3. **Actions**
4. Add `AZURE_SPEECH_KEY`
5. Add `AZURE_SPEECH_REGION`, for example `westeurope`

## 2. Generate a review sample

Open **Actions → Generate Danish neural audio → Run workflow**.

Choose:

- Scope: `sample`
- Voice: `da-DK-ChristelNeural`
- Rate: `-6%`

Download the `danish-neural-audio-sample` artifact. Listen for natural Danish stress, number pronunciation, letter names and question intonation.

## 3. Generate the complete core set

Run the workflow again with scope `core`. Download `danish-neural-audio-core.zip`.

## 4. Integrate the artifact safely

Extract the artifact to a temporary folder:

```bash
mkdir -p /tmp/danish-audio-update
unzip -o ~/Downloads/danish-neural-audio-core.zip -d /tmp/danish-audio-update
```

From the monorepo root, run:

```bash
npm run content:audio:danish:integrate -- /tmp/danish-audio-update
npm run content:sync-danish
npm run check:danish
```

The integration command copies both the MP3 files and all updated metadata files, including:

- `curriculum/instructions.jsonl`
- `curriculum/reading-problems.jsonl`
- `curriculum/math-problems.jsonl`
- `dictionary/letters.jsonl`
- `dictionary/words.jsonl`

This avoids the common failure mode where MP3 files are copied without the references that make the app use them.

## 5. Test locally

```bash
npm run dev:danish
```

Test one question from each area and verify the Network panel loads files from:

```text
/content-packs/da-foundations/audio/auto-neural/
```

Then test offline after the audio package reports complete.

## 6. Review status

Generated entries remain `draft`. After listening, keep a list of files that require regeneration or replacement. Do not mark the whole set approved solely because generation completed.

## 7. Commit and deploy

```bash
# public/content-packs is a generated, gitignored copy: commit the source pack only
git add content-packs/da-foundations
git commit -m "Add Danish neural audio"
git push origin main
git push danish main
```

The GitHub Pages build will include the fixed MP3 files in the offline audio cache.

## Current scope and the offline steps (after the 2026-10-10 update)

- Plan: 2,480 files (24 instructions, 25 letter names, 275 words, 1,246 maths prompts, 487 distinct maths answer sentences, 276 reading targets, 147 reading questions). After the `rate` backfill the Azure requests are 1,812 and 668 recordings are reused, about 52,900 characters.
- Stamp the rate on existing recordings without any Azure call: `node tools/generate-danish-audio.mjs content-packs/da-foundations --adopt-existing`, then `npm run content:build-danish`, then `npm run content:check-danish-sync`.
- Normalise the filename encoding (dry run first): `node tools/normalize-danish-audio-names.mjs content-packs/da-foundations`, add `--write` to apply.
- Coverage (warn-only by default; `--strict` fails on non-residual gaps): `node tools/check-danish-audio-coverage.mjs`. Numeral and emoji option labels and other option texts are residual browser speech by design: the option buttons have no recording reference yet.
- Browser speech remains the fallback when no recording matches the spoken text. Maths wrong-answer audio becomes neural only after the Azure run is integrated.
