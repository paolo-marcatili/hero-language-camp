# Testing, audio and family-device updates

Prepared 27 September 2026 for the revised curriculum package. The source ZIP was commit `287589b62dc55b0d86121a94fb81b6d0d41c7be0`; the live GitHub branch has not been inspected or changed. Commands below use the existing remote name **hero**. Run commands from the repository root. The shell examples use Bash (`bash` in macOS Terminal).

Use a feature branch, test it, optionally generate and review audio, then merge a pull request into `main`. The Pages workflow publishes pushes to `main`; pushing this feature branch alone does not publish the game. A manually dispatched Pages workflow can deploy a branch, so do not use that workflow as a preview.

## 1. Bring the update into Git

Install Node 24, npm 10 or newer, Python 3 and Git LFS. If you use nvm, `nvm install 24` followed by `nvm use 24` selects the required Node version. Check `node --version`, `npm --version`, `python3 --version` and `git lfs version`.

Use your existing clone, especially if it contains the Xcode/Android projects and signing configuration used for the children's installed apps. Those native projects are ignored by Git and are absent from a fresh clone.

```bash
cd /path/to/your/hero-language-camp
bash
git status --short
git remote -v
```

The working tree must be clean before applying the update. Commit your own outstanding work first. Confirm that `hero` points to `paolo-marcatili/hero-language-camp`. For a genuinely fresh clone, use `git clone --origin hero https://github.com/paolo-marcatili/hero-language-camp.git` instead.

Download `hero-language-camp-update.patch` into Downloads. It contains the source changes relative to your supplied ZIP, including deleted obsolete source files. It avoids copying an old ZIP snapshot over any newer work on `main`.

```bash
git lfs install
git fetch hero
git switch -c curriculum-cleanup hero/main
git lfs pull hero
git tag before-curriculum-update-2026-09-27 hero/main
git apply --check --3way "$HOME/Downloads/hero-language-camp-update.patch"
git apply --3way "$HOME/Downloads/hero-language-camp-update.patch"
```

Use a different tag/branch name if either already exists. If the patch check reports conflicts, resolve the overlap with newer work before continuing; do not replace the checkout wholesale with the ZIP. The patch uses Git's original file hashes to help merge changes from the archived version. It is for a clone that has not already received this update.

Two generated/binary paths are deliberately excluded from the text patch. Stop tracking the copied public packs and remove the old build ZIP:

```bash
git rm -r --cached --ignore-unmatch apps/web/public/content-packs
git rm --ignore-unmatch apps/web/dist.zip
git diff --cached --stat
git diff --cached --check
```

The editable packs remain under `content-packs/`. Dev/build scripts recreate public copies. Do not commit `node_modules`, `dist`, `site`, generated public packs, Azure credentials or children's backup files. The complete refreshed ZIP is also available for inspection or a standalone test; it is not a Git checkout.

## 2. Install and run the automated checks

Create the Python environment outside the repository so it cannot accidentally be committed:

```bash
python3 -m venv "$HOME/.venvs/hero-language-camp"
source "$HOME/.venvs/hero-language-camp/bin/activate"
python3 -m pip install 'PyYAML>=6.0.2,<7'
npm ci
npm run verify:local
npm audit --omit=dev --audit-level=moderate
```

`verify:local` runs regression tests, Danish generation consistency, curriculum/schema audits, Italian and English checks, TypeScript checks, release-asset checks and both production builds. The final audit command matches the additional CI dependency gate. Every command must succeed before release; language-review warnings are different from validation errors.

The working environment used to prepare this package could not complete `npm ci` because the registry returned HTTP 403. Engine/content and audio-pipeline regression checks passed; full TypeScript compilation, production rendering and real-device playback still need your machine or CI. No paid Azure generation was run here.

For a quick development session, use two terminals:

```bash
# Terminal 1
npm run dev
# Open http://127.0.0.1:5173/
```

```bash
# Terminal 2
npm run dev:danish
# Open http://127.0.0.1:5174/
```

Use a parent/test profile. Development sites have their own progress, separate from the children's live site. Test at least:

| Check | Expected result |
|---|---|
| Both courses, both Armenian source languages | Training, battle, labyrinth and shop work |
| Danish levels 0, 19, 20, 39, 40 and 59 | Correct year boundary and increasing difficulty |
| Danish grade 0 | Child can hear instructions and choices without needing to read |
| Armenian levels 0, 24, 25, 40 and 48 | Vocabulary, sentences and passages are reachable |
| Settings → Level and progress | Direct placement works; optional 8-question check does not erase possessions |
| Save progress, then restore into a test profile | Level, coins, inventory and learning history match; other profiles are unaffected |
| Existing save migration | Old Danish level 13 becomes 29 once; Armenian level remains in place |
| Replay, missing audio, slow audio, interruptions | No unfair timer loss; inspect real phone behavior |
| Equivalent answers | Authored accepted variants are accepted; no equivalent distractor is marked wrong |
| Close/reopen and refresh | Saved progress survives |

Automated answer tests check structure and authored variants; a native speaker still needs to review the new Armenian material and sample the actual choices.

For the production site, after `verify:local` has built `site/`:

```bash
mkdir -p .pages-preview
ln -sfn ../site .pages-preview/hero-language-camp
python3 -m http.server 8080 --bind 127.0.0.1 --directory .pages-preview
```

Open `http://localhost:8080/hero-language-camp/armenian/` and `/hero-language-camp/danish/` on the Mac. Check course navigation and wait for app and audio downloads to complete. Then disconnect the network or use browser offline mode and reload. Browser-generated speech may still depend on installed system voices, even when the recorded audio cache is complete.

For a phone layout/gameplay test on the same Wi-Fi, use `npm run dev:lan` and `npm run dev:danish:lan`, and open the Mac's Wi-Fi address at ports 5173 and 5174. `ipconfig getifaddr en0` usually reports that address on a Mac. Open each URL directly; the default development course-switch links point to loopback. To test switching, set both `VITE_ARMENIAN_APP_URL` and `VITE_DANISH_APP_URL` to the corresponding Mac-IP URLs when starting each server. HTTP on a LAN address is not a valid offline/PWA test; use localhost on the Mac or the deployed HTTPS site for that check.

## 3. Generate neural audio, if wanted

Generation is optional for testing the software. Existing MP3s remain available. New content uses device/browser speech until it has recordings; Armenian system voices are not reliably available on every device, so review and generate recordings before relying on listening-only play.

The scripts use **Azure AI Speech**, generate MP3s ahead of time and attach them to the content packs. The children do not need Azure accounts or API keys. Set lesson audio to **Human + automatic voices** to allow these recordings. Human-only mode intentionally excludes neural voices.

First finish the text and synchronize its generated content:

```bash
npm run content:build-danish
npm run content:sync-english
```

In Azure, create/use a Speech resource. Copy its key and region from **Keys and Endpoint**. Use the resource's own region identifier. The generator accepts `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION`, plus an optional endpoint override. Microsoft documents the regional REST endpoint and supported voices in the references below.

In Bash, read the key without echoing it or writing it into shell history:

```bash
read -r -s -p 'Azure Speech key: ' AZURE_SPEECH_KEY
printf '\n'
export AZURE_SPEECH_KEY
read -r -p 'Azure Speech region: ' AZURE_SPEECH_REGION
export AZURE_SPEECH_REGION
```

Armenian uses Anahit by default; Hayk is the other supported preset. Start with a plan and a small sample:

```bash
export AZURE_SPEECH_VOICE='hy-AM-AnahitNeural'
export AZURE_SPEECH_RATE='-8%'
npm run content:audio:plan
npm run content:auto-audio -- --sample
```

Listen to the sample MP3s under `content-packs/hy-eastern-it/audio/auto-neural/`. Check greetings, letter names, numbers and pronunciation. The sample selects early entries; it does not certify later B1 passages. Once satisfied, generate the active course:

```bash
npm run content:auto-audio
npm run content:sync-english
```

Danish uses Christel by default; Jeppe is the other preset:

```bash
export AZURE_SPEECH_VOICE='da-DK-ChristelNeural'
export AZURE_SPEECH_RATE='-6%'
npm run content:audio:danish:plan
npm run content:audio:danish -- --sample
```

Listen under `content-packs/da-foundations/audio/auto-neural/`. Check letter names, words, questions, maths and narration. Then:

```bash
npm run content:audio:danish
npm run content:build-danish
npm run content:sync-english
npm run verify:local
unset AZURE_SPEECH_KEY AZURE_SPEECH_REGION AZURE_SPEECH_VOICE AZURE_SPEECH_RATE
```

The Danish compiler step after generation normalizes the JSONL formatting and retains matching recordings. The English synchronization shares Armenian recordings with the English course; do not generate a second set for it. Both production builds copy the source packs automatically.

| Active scope in this package | Files in plan | Source-text characters |
|---|---:|---:|
| Armenian | 987 | 21,414 |
| Danish | 1,992 | 56,036 |

`--plan` makes no Azure requests and reports the actual requests/reuse for the selected voice and rate. Character counts are a planning aid, not an Azure invoice estimate. Check your resource's pricing/quota before generating the full set.

The refreshed generators reuse a recording only if file, text, voice and speaking rate match, and checkpoint completed requests so interrupted runs can resume. The older recording metadata did not store the rate: the first run of the refreshed generator will conservatively regenerate those recordings once. Thus the initial plans above currently show all 987 and 1,992 requests, even though many older MP3s already exist. You can keep using the existing recordings without running the generator. A repeat run with unchanged content/settings then reuses the generated files. `--force` intentionally regenerates the whole selected scope; avoid it for normal updates. `--all` on Armenian also includes material outside the active curriculum and is unnecessary here.

Danish isolated phonemes are excluded and need reviewed human recordings. Some dynamically spoken choices and gap-exercise prompts still use device speech; generating the pack is not a promise that every sound works offline. Test grade-0 choices on the actual devices.

Generated recordings are marked draft. Review representative later Armenian sentences/passages and Danish school tasks with a proficient/native speaker before treating them as approved teaching material.

Commit source MP3s and their metadata together; Git LFS must be installed before staging audio:

```bash
git add content-packs/hy-eastern-it content-packs/hy-eastern-en content-packs/da-foundations
git diff --cached --stat
git lfs status
```

### GitHub Actions alternative

The repo also has **Generate Armenian neural audio** and **Generate Danish neural audio** workflows. Add `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` as repository Actions secrets. Push the feature branch, select that branch when running the audio workflow, select `sample` first, and choose the appropriate voice/rate. The refreshed workflows use incremental generation, not unconditional `--force`.

These workflows upload artifacts, retained for 14 days. They do **not** commit or deploy the generated audio. Download the artifact and copy its `content-packs/` into the same source revision used for generation; `AUDIO_GENERATION.txt` records its source commit. Do not overlay old dictionary files onto a newer curriculum. Then run `content:build-danish`, `content:sync-english`, `verify:local`, review and commit the MP3s plus metadata. The local route above is simpler for this first update.

## 4. Back up each child's existing device before release

Progress is saved locally, per child and course. Git/GitHub does not back it up or synchronize it between devices. Keep the same app, browser profile, storage keys, pack IDs and site origin (protocol, hostname and port). Normal source and service-worker updates do not clear localStorage.

For a device already running the new version:

1. Select the child and course.
2. Open Settings → **Level and progress** → **Save progress**. Danish labels are **Niveau og fremskridt** → **Gem fremskridt**; Italian uses **Livello e progressi** → **Salva progressi**.
3. Save the JSON outside browser storage, for example in Files/iCloud Drive or on your Mac.
4. Rename it with child, course, device and date. The default filename contains only the course, so repeat exports need distinct names.
5. Repeat for every child and course, and for independently used devices. Record each child's level and coins as a quick visual cross-check.
6. Test **Open progress backup** and **Restore this backup** in a separate test profile. Restore replaces the selected profile's course progress; it does not merge multiple saves.

This backup covers learning progress and possessions. It is not a complete backup of profile appearance, app settings, locally recorded dictionary audio or an in-progress labyrinth. Use the full device-storage backup below if those also matter. On a native install, verify that Save progress actually creates an accessible file; browser download behavior in a native webview needs device testing.

### First upgrade: the old version has no progress-export button

Before publishing the update, connect a Mac's browser developer tools to the **actual game instance on the child's device**, then run this read-only snippet in that instance's JavaScript console. On iOS/iPadOS use Safari Web Inspector; on Android Chrome use USB remote debugging. A copy opened in a Mac browser is not the child's save. A home-screen app or native webview must be selected as its own inspection target when applicable. If the native build cannot be inspected and cannot export, make a device backup before updating; do not assume a backup of the Mac's browser covers it.

```javascript
(() => {
  const storage = Object.fromEntries(Object.entries(localStorage).filter(
    ([key]) => /^(hero-language-camp|danish-foundations):/.test(key)
  ));
  if (!Object.keys(storage).length) throw new Error('No game saves found: check the inspection target.');
  const json = JSON.stringify({
    format: 'hero-language-camp-device-backup', version: 1,
    origin: location.origin, exported_at: new Date().toISOString(), storage
  }, null, 2);
  if (typeof copy === 'function') copy(json);
  else console.log(json);
  return 'Copy the JSON into a plain-text .json file on the Mac.';
})();
```

The console's `copy` helper, where available, copies the JSON to the Mac clipboard; otherwise copy the logged JSON. Save as plain UTF-8 text, not rich text, for example `kids-device-backup.json`. Check that it opens as valid JSON and contains profile/state keys. It can contain names and family recordings; keep it private and outside Git.

For testing real old saves in the new app, this terminal command converts the supplied version's per-profile state entries into files accepted by the new import control:

```bash
node --input-type=module - "$HOME/Downloads/kids-device-backup.json" <<'JS'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const backup = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (backup.format !== 'hero-language-camp-device-backup' || backup.version !== 1) throw new Error('Wrong backup format');
const directory = '.local-data/progress-backups';
mkdirSync(directory, { recursive: true });
let count = 0;
for (const [key, value] of Object.entries(backup.storage)) {
  const match = key.match(/^(?:hero-language-camp|danish-foundations):v0\.9:state:([^:]+):([^:]+)$/);
  if (!match) continue;
  const [, pack_id, profile_id] = match;
  const name = `${pack_id}-${profile_id}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const state = JSON.parse(value);
  writeFileSync(`${directory}/${name}.json`, JSON.stringify({format:'hero-language-camp-progress',version:1,pack_id,state}, null, 2), {flag:'wx'});
  console.log(name, 'level', state.level, 'coins', state.coins);
  count++;
}
if (!count) throw new Error('No v0.9 per-profile saves found; retain the raw backup and inspect its keys.');
JS
```

This reads the backup file, not the device. It never alters the original. Output is in the Git-ignored `.local-data/progress-backups/`; use a fresh output folder on a repeat run. Import these files into parent/test profiles to verify migration before deploying. The raw device backup and a per-course progress backup are different formats; do not feed the raw file directly to the new import button. Retain the raw file for settings, profiles and recorded-audio recovery as well.

## 5. Push, review and publish

After local checks, audio review if generated, and device backups:

```bash
git add -A
git diff --cached --stat
git diff --cached --check
git commit -m "Expand curricula and preserve learner progress"
git push -u hero curriculum-cleanup
```

Review the staged file list before committing; sensitive data belongs outside Git. The patch already stages its source changes. Open a GitHub pull request from `curriculum-cleanup` into `main`. Wait for CI to pass. In repository Settings → Pages, the publishing source should be **GitHub Actions** for the supplied deployment workflow; keep the existing domain and URL.

Merge the pull request only when ready to update the live website. The **Deploy unified learning apps to GitHub Pages** workflow runs `verify:local`, uploads `site/` and publishes the two courses. Verify the workflow succeeds before expecting device updates. The expected paths are:

- `https://paolo-marcatili.github.io/hero-language-camp/armenian/`
- `https://paolo-marcatili.github.io/hero-language-camp/danish/`

Use your existing custom domain instead if one is configured. Do not change hostname during this release. A code tag records the previous source version, not the children's progress.

## 6. Update the children's installations

| How the game was installed | How it receives this update |
|---|---|
| Browser or Add to Home Screen | Publish Pages, then update the existing web app while online |
| Xcode/Capacitor native iPhone or iPad app | Rebuild/sync and install over the existing app with the same identity/signing |
| Android Studio/Capacitor app | Rebuild/sync and install over the existing app with the same application ID/signing |

### Browser/home-screen game

First verify the deployed release on a parent/test device. Then connect a child's device to Wi-Fi and open the existing game icon/browser profile. Finish the current exercise. When **Update app** appears, tap it and let the page reload. Wait for the app and audio offline downloads to finish. If it does not appear, close and reopen the existing app while online; do not clear site data as an update procedure.

Check the selected child, level, coins and equipment, complete one question, close/reopen and check again. Test an offline reload after downloading, then move to the next device. Do not delete/reinstall the icon or clear browser data to force a refresh. Safari, Chrome, private mode, a native wrapper and a home-screen instance can have separate storage contexts; continue using the instance that holds the save.

The new Danish course maps old levels into the finer sequence. Old levels 0–9 map to 0, 2, …, 18; old 10, 11, 12 and 13 map to 20, 23, 26 and 29. A larger displayed number is expected. Current Armenian levels 0–24 remain in place. Older pre-level-zero save formats also run the pre-existing legacy migration. Review suitability with a parent; use direct placement or the optional quick check if the restored course is too easy.

### Existing native iPhone/iPad app

Use the checkout containing the **existing `ios/` project**. Back up first and retain the same bundle identifier, signing team and Capacitor origin settings used for the installed app. The repository default is `org.herolanguagecamp.app`, but if you used a personal suffix, keep that existing identifier. Changing it installs a separate app with separate storage.

```bash
# Select the tested release in the existing checkout after the PR is merged.
git switch main
git pull --ff-only hero main
git lfs pull hero
source "$HOME/.venvs/hero-language-camp/bin/activate"
npm ci
npm run verify:local
unset GITHUB_PAGES GITHUB_PAGES_BASE
npm run mobile:ios
```

`mobile:ios` already builds the web app, runs `cap sync ios` and opens Xcode. You do not need to run `mobile:sync` immediately before it. In Xcode choose the existing app target, existing signing settings and the connected child's device, then press Run to install over the app. Do not delete the app first or recreate the native project just for this update. Check progress after launch. Keep the existing signing identity when re-signing a development build.

**The current Capacitor configuration bundles `apps/web/dist`, the Armenian app.** `build:site` produces both web courses, but `mobile:ios` does not produce a combined Armenian-and-Danish native app. Continue using the Danish web app unless you already have a separate Danish native target/configuration; do not apply the Armenian native commands to that separate app blindly.

### Existing Android app

Use its existing native project and signing configuration. After the same checkout/dependency/verification steps, run `npm run mobile:android`, select the device and update the installed app through Android Studio. Keep the same application ID and signing key, including the same debug keystore if the existing app uses it. If Android reports a signature mismatch, fix the signing setup instead of uninstalling the child's app. Publishing Pages alone does not update bundled native assets.

## 7. If something goes wrong

If a child appears reset, stop before creating replacement profiles or resetting anything. Check the exact app/browser, selected child, course and URL first. Restore the correct per-child/per-course JSON using **Open progress backup**, preview it, then **Restore this backup**. Use parent placement only for a level correction; it cannot reconstruct missing coins or learning history.

For a broken release, pause further device updates and make a corrective branch. GitHub can revert the merged PR with a new PR; after CI, that becomes another Pages deployment. Preserve current exports and the pre-upgrade backups. Older code is not guaranteed to understand saves written by newer code, so a source-code rollback is not a progress rollback. Prefer a forward fix for migration bugs. If an old app must run again, use the corresponding pre-update save in its original storage context.

## References checked for this guide

- [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Azure Speech language/voice support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts)
- [Azure text-to-speech REST API](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech)
- [Browser localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- [Capacitor development workflow](https://capacitorjs.com/docs/basics/workflow)
- [Inspecting iOS/iPadOS](https://developer.apple.com/documentation/safari-developer-tools/inspecting-ios)
- [Chrome Android remote debugging](https://developer.chrome.com/docs/devtools/remote-debugging)
