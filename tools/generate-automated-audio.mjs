#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadModularPack, parseJsonl, writeJsonl } from "./pack-utils.mjs";

const args = new Set(process.argv.slice(3));
const force = args.has("--force");
const planOnly = args.has("--plan");
const allContent = args.has("--all");
const sampleOnly = args.has("--sample");
const finalEvOnly = args.has("--final-ev-only");
const evProbe = args.has("--ev-probe");
const target = resolve(process.argv[2] ?? "content-packs/hy-eastern-it");
if (!statSync(target).isDirectory()) throw new Error("Expected a modular content-pack directory.");

const key = process.env.AZURE_SPEECH_KEY;
const region = process.env.AZURE_SPEECH_REGION;
const voice = process.env.AZURE_SPEECH_VOICE || "hy-AM-AnahitNeural";
const rate = process.env.AZURE_SPEECH_RATE || "-8%";
const endpoint = process.env.AZURE_SPEECH_ENDPOINT || `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
const pack = loadModularPack(target);
const packSlug = pack.pack_id;
const sourceDir = join(target, "audio", "auto-neural");
const publicDir = join("apps", "web", "public", "content-packs", packSlug, "audio", "auto-neural");
const files = pack.files || {};
const paths = {
  words: join(target, files.words || "dictionary/words.jsonl"),
  letters: join(target, files.letters || "dictionary/letters.jsonl"),
  sentences: join(target, files.sentences || "dictionary/sentences.jsonl")
};
const collections = {
  words: parseJsonl(readFileSync(paths.words, "utf8")),
  letters: parseJsonl(readFileSync(paths.letters, "utf8")),
  sentences: parseJsonl(readFileSync(paths.sentences, "utf8"))
};

if (evProbe) {
  const probes = finalEvProbeItems();
  console.log(`Final-և pronunciation probe: ${probes.length} files using ${voice}.`);
  for (const probe of probes) {
    console.log(`  ${probe.id}: ${probe.text} (${probe.variant})`);
  }
  if (planOnly) process.exit(0);
  if (!key || !region) {
    console.error("Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION before generating the pronunciation probe.");
    process.exit(2);
  }
  const probeDir = join(target, "audio", "tts-probes", "final-ev");
  mkdirSync(probeDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const samples = [];
  for (const probe of probes) {
    const fileName = `${probe.id}.mp3`;
    const bytes = await synthesize(probe.text);
    writeFileSync(join(probeDir, fileName), bytes);
    samples.push({ ...probe, file: fileName });
    console.log(`Generated probe: ${fileName} <- ${probe.text}`);
  }
  writeFileSync(join(probeDir, "manifest.json"), JSON.stringify({
    generated_at: generatedAt,
    voice,
    rate,
    note: "Pronunciation probe only. Probe spellings are never written back to learner content or audio metadata.",
    samples
  }, null, 2) + "\n");
  console.log(`Probe files ready in ${probeDir}. Normal content and audio metadata were not changed.`);
  process.exit(0);
}

let queue = [
  ...collections.words.map((entry) => ({ entry, id: entry.id, text: entry.target, kind: "word" })),
  ...collections.sentences.map((entry) => ({ entry, id: entry.id, text: entry.target_sentence, kind: "sentence" })),
  ...collections.letters.map((entry) => ({ entry, id: entry.id, text: getLetterName(entry), kind: "letter" }))
].filter(({ entry }) => allContent || entry.tags?.includes("tier:core"));

if (sampleOnly) {
  const chosen = [];
  for (const kind of ["letter", "word", "sentence"]) {
    chosen.push(...queue.filter((item) => item.kind === kind).slice(0, kind === "sentence" ? 10 : 8));
  }
  queue = chosen;
}

if (finalEvOnly) {
  queue = queue.filter(({ text }) => hasWordFinalEv(text));
  console.log(`Word-final և filter: ${queue.length} affected entries.`);
  if (planOnly) {
    for (const item of queue) console.log(`  ${item.kind} ${item.id}: ${item.text}`);
  }
}
const counts = queue.reduce((result, item) => ({ ...result, [item.kind]: (result[item.kind] ?? 0) + 1 }), {});
console.log(`Audio plan: ${queue.length} files (${counts.word ?? 0} words, ${counts.sentence ?? 0} sentences, ${counts.letter ?? 0} letters).`);
if (planOnly) process.exit(0);
if (!key || !region) {
  console.error("Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION before generating neural Armenian audio.");
  console.error("Run `npm run content:audio:plan` first to inspect the exact scope without credentials.");
  process.exit(2);
}

mkdirSync(sourceDir, { recursive: true });
mkdirSync(publicDir, { recursive: true });

let generated = 0;
for (const item of queue) {
  const fileName = `${item.id}.mp3`;
  const sourcePath = join(sourceDir, fileName);
  const publicPath = join(publicDir, fileName);
  if (force || !existsSync(sourcePath)) {
    const bytes = await synthesize(item.text);
    writeFileSync(sourcePath, bytes);
    generated += 1;
    process.stdout.write(`\rGenerated ${generated}/${queue.length}: ${item.id}          `);
  }
  copyFileSync(sourcePath, publicPath);
  replaceGeneratedAudio(item.entry, item.id, item.text, fileName);
}
process.stdout.write("\n");

writeFileSync(paths.words, writeJsonl(collections.words));
writeFileSync(paths.letters, writeJsonl(collections.letters));
writeFileSync(paths.sentences, writeJsonl(collections.sentences));
console.log(`Neural Armenian audio ready for ${queue.length} core entries using ${voice}.`);

async function synthesize(text) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "hero-language-camp-audio-generator"
    },
    body: `<speak version="1.0" xml:lang="hy-AM"><voice name="${escapeXml(voice)}"><prosody rate="${escapeXml(rate)}">${escapeXml(normalizeTextForNeuralTts(text))}</prosody></voice></speak>`
  });
  if (!response.ok) throw new Error(`Azure Speech ${response.status}: ${await response.text()}`);
  return Buffer.from(await response.arrayBuffer());
}

function replaceGeneratedAudio(entry, id, text, fileName) {
  const preserved = (entry.audio || []).filter((audio) => audio.source_type === "human");
  entry.audio = [{
    id: `${id}_azure_neural`,
    url: `/content-packs/${packSlug}/audio/auto-neural/${fileName}`,
    speaker_label: `Azure ${voice} Armenian neural voice`,
    source_type: "automated",
    engine: "Azure AI Speech",
    provider: "Microsoft Azure",
    voice,
    text,
    mime_type: "audio/mpeg",
    generated_at: new Date().toISOString(),
    license: "generated-for-project-use-review-provider-terms",
    review_status: "draft"
  }, ...preserved];
}

function hasWordFinalEv(text) {
  return /[\u0531-\u0556\u0561-\u0586]և(?![\u0531-\u0556\u0561-\u0587])/u.test(String(text));
}

function finalEvProbeItems() {
  return [
    { id: "barev-original", word: "barev", variant: "original և", text: "բարև" },
    { id: "barev-separate-ew", word: "barev", variant: "separate եւ", text: "բարեւ" },
    { id: "barev-explicit-ev", word: "barev", variant: "explicit եվ", text: "բարեվ" },
    { id: "arev-original", word: "arev", variant: "original և", text: "արև" },
    { id: "arev-separate-ew", word: "arev", variant: "separate եւ", text: "արեւ" },
    { id: "arev-explicit-ev", word: "arev", variant: "explicit եվ", text: "արեվ" }
  ];
}

function getLetterName(entry) {
  if (entry.spoken_name) return String(entry.spoken_name).trim();
  const label = entry.names?.it || entry.names?.en || entry.character;
  return String(label).split("·")[0].trim() || entry.character;
}
function normalizeTextForNeuralTts(text) {
  const normalized = normalizeText(text);
  return normalized.replace(/([\u0531-\u0556\u0561-\u0586])և(?![\u0531-\u0556\u0561-\u0587])/gu, "$1եվ");
}

function normalizeText(text) { return String(text).replace(/[։:;]+/g, ".").replace(/\s+/g, " ").trim(); }
function escapeXml(text) { return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
