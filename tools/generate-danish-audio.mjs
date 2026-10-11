#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadModularPack, parseJsonl, writeJsonl } from "./pack-utils.mjs";
import { fetchWithRetry, reusableNeuralAudio } from "./neural-audio-utils.mjs";
import { answerAudioId, mathAnswerAudioText } from "./danish-answer-text.mjs";

const target = resolve(process.argv[2] ?? "content-packs/da-foundations");
if (!statSync(target).isDirectory()) throw new Error("Expected the Danish foundations content-pack directory.");

const args = new Set(process.argv.slice(3));
const planOnly = args.has("--plan");
const sampleOnly = args.has("--sample");
const force = args.has("--force");
const adoptExisting = args.has("--adopt-existing");
const key = process.env.AZURE_SPEECH_KEY;
const region = process.env.AZURE_SPEECH_REGION;
const voice = process.env.AZURE_SPEECH_VOICE || "da-DK-ChristelNeural";
const rate = process.env.AZURE_SPEECH_RATE || "-6%";
const sourceDir = join(target, "audio", "auto-neural");
const endpoint = process.env.AZURE_SPEECH_ENDPOINT || `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

const pack = loadModularPack(target);
const files = pack.files || {};
const paths = {
  words: join(target, files.words || "dictionary/words.jsonl"),
  letters: join(target, files.letters || "dictionary/letters.jsonl"),
  math: join(target, files.math_problems || "curriculum/math-problems.jsonl"),
  reading: join(target, files.reading_problems || "curriculum/reading-problems.jsonl"),
  instructions: join(target, files.instructions || "curriculum/instructions.jsonl")
};
const collections = {
  words: parseJsonl(readFileSync(paths.words, "utf8")),
  letters: parseJsonl(readFileSync(paths.letters, "utf8")),
  math: parseJsonl(readFileSync(paths.math, "utf8")),
  reading: parseJsonl(readFileSync(paths.reading, "utf8")),
  instructions: parseJsonl(readFileSync(paths.instructions, "utf8"))
};

let queue = [
  ...collections.instructions.map((entry) => ({ entry, id: entry.id, kind: "instruction", text: entry.text?.da, field: "audio" })),
  ...collections.letters.map((entry) => ({ entry, id: entry.id, kind: "letter-name", text: getLetterName(entry), field: "audio" })),
  ...collections.words.map((entry) => ({ entry, id: entry.id, kind: "word", text: entry.target, field: "audio" })),
  ...collections.math.map((entry) => ({ entry, id: entry.id, kind: "math-prompt", text: entry.prompt?.da, field: "audio" })),
  ...collections.math.map((entry) => {
    const text = mathAnswerAudioText(entry);
    return { entry, id: answerAudioId(text), kind: "math-answer", text, field: "answer_audio" };
  }),
  ...collections.reading.map((entry) => ({ entry, id: entry.id, kind: "reading-target", text: getReadingAudioText(entry), field: "audio" })),
  ...collections.reading
    .filter((entry) => entry.domain === "mini_story")
    .map((entry) => ({ entry, id: `${entry.id}-prompt`, kind: "reading-prompt", text: entry.prompt?.da, field: "prompt_audio" }))
].filter((item) => item.text && item.entry.tags?.includes("tier:core"));

if (sampleOnly) {
  const answers = [...new Map(queue.filter((item) => item.kind === "math-answer").map((item) => [item.id, item])).values()];
  queue = [
    ...queue.filter((item) => item.kind === "instruction").slice(0, 5),
    ...queue.filter((item) => item.kind === "letter-name").slice(0, 5),
    ...queue.filter((item) => item.kind === "word").slice(0, 8),
    ...queue.filter((item) => item.kind === "math-prompt").slice(0, 8),
    ...[...new Map([
      ...answers.slice(0, 3),
      ...answers.filter((item) => /\d/.test(item.text)).slice(0, 2),
      ...answers.filter((item) => item.text.startsWith("Se det")).slice(0, 1)
    ].map((item) => [item.id, item])).values()],
    ...queue.filter((item) => item.kind === "reading-target").slice(0, 8),
    ...queue.filter((item) => item.kind === "reading-prompt").slice(0, 5)
  ];
}

// Several math problems can share one spoken answer sentence, hence one recording.
const unique = [...new Map(queue.map((item) => [item.id, item])).values()];
const counts = unique.reduce((result, item) => ({ ...result, [item.kind]: (result[item.kind] ?? 0) + 1 }), {});
console.log(`Danish audio plan: ${unique.length} files (${counts.instruction ?? 0} reusable instructions, ${counts["letter-name"] ?? 0} letter names, ${counts.word ?? 0} words, ${counts["math-prompt"] ?? 0} math prompts, ${counts["math-answer"] ?? 0} math answer sentences, ${counts["reading-target"] ?? 0} reading targets, ${counts["reading-prompt"] ?? 0} reading questions).`);
console.log("Isolated phonemes are intentionally excluded; use reviewed human recordings for those.");
const reusableIds = new Set(queue.filter((item) => !force && reusableNeuralAudio(item.entry, item.field, item.id, item.text, voice, rate, join(sourceDir, `${item.id}.mp3`))).map((item) => item.id));
const pending = unique.filter((item) => !reusableIds.has(item.id));
console.log(`Azure requests: ${pending.length}; reuse: ${unique.length - pending.length}; source-text characters: ${pending.reduce((sum, item) => sum + [...item.text].length, 0)}. Voice: ${voice}; rate: ${rate}.`);
console.log("Recordings without saved text/voice/rate metadata are regenerated once. --plan never calls Azure.");

const collectionOf = { instruction: "instructions", "letter-name": "letters", word: "words", "math-prompt": "math", "math-answer": "math", "reading-target": "reading", "reading-prompt": "reading" };
if (adoptExisting) {
  // Offline migration: stamp the saved rate on recordings made before metadata stored it.
  // Only recordings whose text and voice match today's plan and whose file exists are adopted.
  let adopted = 0;
  for (const item of queue) {
    const path = join(sourceDir, `${item.id}.mp3`);
    const audio = (item.entry[item.field] ?? []).find((candidate) => candidate.id === `${item.id}_azure_neural`
      && candidate.source_type === "automated" && candidate.text === item.text && candidate.voice === voice && candidate.rate === undefined);
    if (!audio || !existsSync(path) || statSync(path).size === 0) continue;
    const fields = Object.entries(audio);
    fields.splice(fields.findIndex(([name]) => name === "voice") + 1, 0, ["rate", rate]);
    item.entry[item.field] = item.entry[item.field].map((candidate) => candidate === audio ? Object.fromEntries(fields) : candidate);
    adopted += 1;
  }
  for (const [name, path] of Object.entries(paths)) writeFileSync(path, writeJsonl(collections[name]));
  console.log(`Adopted ${adopted} existing recordings with rate ${rate}. Run \`npm run content:build-danish\` next. No Azure request was made.`);
  process.exit(0);
}
if (planOnly) process.exit(0);
if (pending.length && (!key || !region)) {
  console.error("Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION before generating Danish neural audio.");
  console.error("Run `npm run content:audio:danish:plan` to inspect the exact scope without credentials.");
  process.exit(2);
}

const publicDir = join("apps", "danish-foundations", "public", "content-packs", pack.pack_id, "audio", "auto-neural");
mkdirSync(sourceDir, { recursive: true });
mkdirSync(publicDir, { recursive: true });

let generated = 0;
const recorded = new Map();
const persist = () => { for (const [name, path] of Object.entries(paths)) writeFileSync(path, writeJsonl(collections[name])); };
try {
  for (const item of queue) {
    const fileName = `${item.id}.mp3`;
    const sourcePath = join(sourceDir, fileName);
    const publicPath = join(publicDir, fileName);
    const own = !force && reusableNeuralAudio(item.entry, item.field, item.id, item.text, voice, rate, sourcePath);
    const shared = recorded.get(item.id);
    if (!own && !shared) {
      const bytes = await synthesize(item.text);
      writeFileSync(sourcePath, bytes);
      replaceGeneratedAudio(item, fileName);
      generated += 1;
      if (generated % 25 === 0) persist(); // checkpoint; the finally block also saves on interruption
      process.stdout.write(`\rGenerated ${generated}/${unique.length}: ${item.id}          `);
    } else if (!own) {
      attachRecording(item, shared);
    }
    recorded.set(item.id, own || shared || item.entry[item.field].find((audio) => audio.id === `${item.id}_azure_neural`));
    copyFileSync(sourcePath, publicPath);
  }
} finally {
  persist();
}
process.stdout.write("\n");
console.log(`Danish neural audio metadata updated for ${unique.length} files (${queue.length} entries) using ${voice}.`);

async function synthesize(text) {
  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "danish-foundations-audio-generator"
    },
    body: `<speak version="1.0" xml:lang="da-DK"><voice name="${escapeXml(voice)}"><prosody rate="${escapeXml(rate)}">${escapeXml(normalizeText(text))}</prosody></voice></speak>`
  });
  if (!response.ok) throw new Error(`Azure Speech ${response.status}: ${await response.text()}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  // Azure can answer 200 with an empty body. Never save that as audio.
  if (bytes.length === 0) throw new Error(`Azure Speech returned an empty audio body for: ${text}`);
  return bytes;
}

function replaceGeneratedAudio(item, fileName) {
  const current = Array.isArray(item.entry[item.field]) ? item.entry[item.field] : [];
  const preserved = current.filter((audio) => audio.source_type === "human" || audio.source_type === "browser_tts");
  item.entry[item.field] = [{
    id: `${item.id}_azure_neural`,
    url: `/content-packs/${pack.pack_id}/audio/auto-neural/${fileName}`,
    speaker_label: `Azure ${voice} Danish neural voice`,
    source_type: "automated",
    engine: "Azure AI Speech",
    provider: "Microsoft Azure",
    voice,
    rate,
    text: item.text,
    mime_type: "audio/mpeg",
    generated_at: new Date().toISOString(),
    license: "generated-for-project-use-review-provider-terms",
    review_status: "draft"
  }, ...preserved];
}

// A second problem that needs the same sentence points at the recording just made.
function attachRecording(item, audio) {
  const current = Array.isArray(item.entry[item.field]) ? item.entry[item.field] : [];
  const preserved = current.filter((candidate) => candidate.source_type === "human" || candidate.source_type === "browser_tts");
  item.entry[item.field] = [{ ...audio }, ...preserved];
}

function getReadingAudioText(entry) {
  if (entry.domain === "sentence_order") return String(entry.answer || entry.text || "");
  if (entry.domain === "missing_letter") return String(entry.text || "").replace("_", String(entry.answer || ""));
  if (entry.domain === "missing_word") return String(entry.text || "").replace("___", String(entry.answer || ""));
  return String(entry.text || "");
}

function getLetterName(entry) {
  return String(entry.spoken_name || entry.names?.da || entry.character || "").trim();
}
function normalizeText(text) { return String(text).replace(/\s+/g, " ").trim(); }
function escapeXml(text) { return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
