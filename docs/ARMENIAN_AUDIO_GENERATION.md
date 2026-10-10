> For the current curriculum release, follow [RELEASE_GUIDE.md](RELEASE_GUIDE.md). The historical build/public-copy commands below are superseded.

# Generate the Armenian neural audio pack

The repository does not contain Azure credentials. The generator creates ordinary MP3 files once, updates the content records, and copies the files into the web pack. The child does not need Azure or an internet connection after the generated files are committed and deployed.

## Recommended order

1. Generate the small review sample.
2. Ask an Eastern Armenian speaker to review pronunciation, stress, speed, names, and letter names.
3. Adjust the voice or rate if necessary.
4. Generate the complete core course.
5. Commit the generated MP3 files and updated JSONL records.
6. Generate extension audio only after the extension content has been linguistically reviewed.

The default voice is `hy-AM-AnahitNeural` at a speaking-rate adjustment of `-8%`.

## Option A: GitHub Actions

### 1. Create an Azure Speech resource

Create a Speech resource in the Azure portal and note:

- one API key;
- the resource region, such as `westeurope`.

Never place the key in a committed file.

### 2. Add GitHub repository secrets

In the GitHub repository, open:

`Settings` → `Secrets and variables` → `Actions` → `New repository secret`

Create both secrets:

- `AZURE_SPEECH_KEY`
- `AZURE_SPEECH_REGION`

### 3. Generate the sample

Open:

`Actions` → `Generate Armenian neural audio` → `Run workflow`

Choose `sample`. When the workflow finishes, download the artifact named `armenian-neural-audio-sample`.

Extract the artifact into the repository root. It contains updated dictionary records and `audio/auto-neural` MP3 files.

### 4. Review the sample

Test the sample in the app. Review at least:

- letter names;
- short and long words;
- names;
- questions;
- full sentences;
- difficult Armenian consonants;
- natural sentence stress.

The generated records remain marked `draft` until a reviewer changes their status.

### 5. Generate all core audio

Run the workflow again and choose `core`. Extract the downloaded artifact into the repository root, then run:

```bash
npm install
npm run check
GITHUB_PAGES=true GITHUB_PAGES_BASE=/hero-language-camp/ npm run build
```

Commit and push:

```bash
# public/content-packs is a generated, gitignored copy: commit the source pack only
git add content-packs/hy-eastern-it

git commit -m "Add Armenian neural course audio"
git push origin main
```

## Option B: Generate locally

Set credentials only in the current terminal session:

```bash
export AZURE_SPEECH_KEY="YOUR_KEY"
export AZURE_SPEECH_REGION="westeurope"
```

Inspect the number of files without making an API call:

```bash
npm run content:audio:plan
```

Generate a sample:

```bash
npm run content:auto-audio -- --sample --force
```

Generate the complete core course:

```bash
npm run content:auto-audio -- --force
```

Generate all core and extension entries only after review:

```bash
npm run content:auto-audio -- --all --force
```

Use a different Armenian voice or rate when testing:

```bash
export AZURE_SPEECH_VOICE="hy-AM-HaykNeural"
export AZURE_SPEECH_RATE="-5%"
npm run content:auto-audio -- --sample --force
```

## Scope

The core command includes:

- every `tier:core` word;
- every `tier:core` sentence;
- all 39 staged core letters.

The generator speaks each letter's Armenian `spoken_name`, not the Italian description of the letter. This creates the **letter-name** button. An isolated consonant or vowel sound is a different recording: add those only as reviewed `sound_audio` entries, ideally from a native speaker, because neural TTS is not reliable for isolated phonemes.

## Review status

Neural output is intentionally stored with:

```json
"review_status": "draft"
```

A native reviewer can change an accepted recording to `approved`. Human recordings always remain preferred by the application.
