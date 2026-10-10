#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { loadModularPack, parseJsonl, writeJsonl } from "./pack-utils.mjs";

const contributionPath = process.argv[2];
const packTarget = resolve(process.argv[3] ?? "content-packs/hy-eastern-it");

if (!contributionPath) {
  console.error("Usage: npm run content:merge -- ./contribution.json [content-packs/hy-eastern-it]");
  process.exit(1);
}

if (!statSync(packTarget).isDirectory()) {
  console.error("v0.7 merge expects a modular pack directory, e.g. content-packs/hy-eastern-it");
  process.exit(1);
}

const contribution = JSON.parse(readFileSync(contributionPath, "utf8"));
const pack = loadModularPack(packTarget);
const packSlug = pack.pack_id;
const files = pack.files || {};
const wordsPath = join(packTarget, files.words || "dictionary/words.jsonl");
const sentencesPath = join(packTarget, files.sentences || "dictionary/sentences.jsonl");
const words = parseJsonl(readFileSync(wordsPath, "utf8"));
const sentences = parseJsonl(existsSync(sentencesPath) ? readFileSync(sentencesPath, "utf8") : "");
const sourceCommunityDir = join(packTarget, "audio", "human");
const publicCommunityDir = join("apps", "web", "public", "content-packs", packSlug, "audio", "human");
mkdirSync(sourceCommunityDir, { recursive: true });
mkdirSync(publicCommunityDir, { recursive: true });

let addedItems = 0;
let updatedItems = 0;
let addedGrammar = 0;
let updatedGrammar = 0;
let addedAudio = 0;

for (const contributionItem of contribution.items ?? []) {
  const target = String(contributionItem.target ?? "").trim();
  if (!target) continue;
  let item = words.find((candidate) => candidate.id === contributionItem.id || String(candidate.target || "").trim() === target);
  if (!item) {
    item = {
      id: uniqueId(words, contributionItem.id || `hy_${slugify(contributionItem.transliteration || target)}`),
      concept: contributionItem.concept || slugify(contributionItem.transliteration || target),
      target,
      translation: contributionItem.translations?.[pack.source_language] || contributionItem.translation || target,
      translations: contributionItem.translations || (contributionItem.translation ? { [pack.source_language]: contributionItem.translation } : {}),
      emoji: contributionItem.emoji || undefined,
      transliteration: contributionItem.transliteration || undefined,
      difficulty: Number(contributionItem.difficulty || 1),
      complexity: Number(contributionItem.complexity || contributionItem.difficulty || 1),
      tags: cleanTags(contributionItem.tags),
      audio: [],
      hard_distractor_ids: [],
      review_status: "needs_native_speaker_review"
    };
    words.push(item); addedItems += 1;
  } else {
    if (contributionItem.translation) item.translation = contributionItem.translation;
    if (contributionItem.translations) item.translations = { ...(item.translations || {}), ...contributionItem.translations };
    if (contributionItem.emoji) item.emoji = contributionItem.emoji;
    if (contributionItem.transliteration) item.transliteration = contributionItem.transliteration;
    item.tags = uniqueStrings([...(item.tags || []), ...cleanTags(contributionItem.tags)]);
    item.complexity = Number(contributionItem.complexity || item.complexity || item.difficulty || 1);
    updatedItems += 1;
  }
  addedAudio += appendAudioReferences(item, contributionItem.audio ?? [], item.id, target, pack.language?.bcp47 || "hy-AM");
}

for (const contributionGrammar of contribution.grammar_items ?? []) {
  const targetSentence = String(contributionGrammar.target_sentence ?? "").trim();
  if (!targetSentence) continue;
  let grammar = sentences.find((candidate) => candidate.id === contributionGrammar.id || String(candidate.target_sentence || "").trim() === targetSentence);
  if (!grammar) {
    grammar = {
      id: uniqueId(sentences, contributionGrammar.id || `hy_sentence_${slugify(targetSentence)}`),
      prompt: contributionGrammar.prompt || { [pack.source_language]: contributionGrammar.translation || contributionGrammar.translations?.[pack.source_language] || targetSentence },
      target_sentence: targetSentence,
      translation: contributionGrammar.translation || contributionGrammar.translations?.[pack.source_language] || targetSentence,
      translations: contributionGrammar.translations || (contributionGrammar.translation ? { [pack.source_language]: contributionGrammar.translation } : {}),
      translation_distractors: cleanLocalizedStringLists(contributionGrammar.translation_distractors),
      distractors: Array.isArray(contributionGrammar.distractors) ? contributionGrammar.distractors : [],
      difficulty: Number(contributionGrammar.difficulty || 1),
      complexity: Number(contributionGrammar.complexity || contributionGrammar.difficulty || 1),
      tags: cleanTags(contributionGrammar.tags),
      audio: [],
      review_status: "needs_native_speaker_review"
    };
    sentences.push(grammar); addedGrammar += 1;
  } else {
    if (contributionGrammar.translation) grammar.translation = contributionGrammar.translation;
    if (contributionGrammar.translations) grammar.translations = { ...(grammar.translations || {}), ...contributionGrammar.translations };
    const translationDistractors = cleanLocalizedStringLists(contributionGrammar.translation_distractors);
    if (translationDistractors) grammar.translation_distractors = { ...(grammar.translation_distractors || {}), ...translationDistractors };
    grammar.tags = uniqueStrings([...(grammar.tags || []), ...cleanTags(contributionGrammar.tags)]);
    grammar.distractors = uniqueStrings([...(grammar.distractors || []), ...(contributionGrammar.distractors || [])]);
    grammar.complexity = Number(contributionGrammar.complexity || grammar.complexity || grammar.difficulty || 1);
    updatedGrammar += 1;
  }
  addedAudio += appendAudioReferences(grammar, contributionGrammar.audio ?? [], grammar.id, targetSentence, pack.language?.bcp47 || "hy-AM");
}

writeFileSync(wordsPath, writeJsonl(words));
writeFileSync(sentencesPath, writeJsonl(sentences));
console.log(JSON.stringify({ addedItems, updatedItems, addedGrammar, updatedGrammar, addedAudio }, null, 2));

function cleanLocalizedStringLists(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const cleaned = Object.fromEntries(
    Object.entries(value)
      .map(([code, entries]) => [code, uniqueStrings(Array.isArray(entries) ? entries.map(String) : [])])
      .filter(([, entries]) => entries.length > 0)
  );
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function appendAudioReferences(entry, audioContributions, entryId, text, languageTag) {
  if (!Array.isArray(entry.audio)) entry.audio = [];
  let count = 0;
  for (const audio of audioContributions) {
    const sourceType = audio.source_type || "human";
    const audioId = uniqueAudioId(entry.audio, `${entryId}_${sourceType}_${Date.now()}_${count}`);
    const url = materializeAudio(audio, entryId, audioId);
    entry.audio.push({
      id: audioId,
      url,
      speaker_label: audio.speaker_label || (sourceType === "human" ? "Community speaker" : "Automated preview"),
      source_type: sourceType,
      engine: sourceType === "browser_tts" ? "Browser SpeechSynthesis" : audio.engine,
      text: audio.text || text,
      mime_type: audio.mime_type || audio.mimeType,
      license: audio.license || (sourceType === "human" ? "CC-BY-4.0" : "synthetic-browser-preview"),
      review_status: audio.review_status || (sourceType === "human" ? "needs_native_speaker_review" : "draft")
    });
    count += 1;
  }
  const hasHuman = entry.audio.some((audio) => audio.source_type === "human");
  const hasBrowserTts = entry.audio.some((audio) => audio.source_type === "browser_tts" || String(audio.url || "").startsWith("browser-tts:"));
  if (!hasHuman && !hasBrowserTts) {
    entry.audio.push({ id: uniqueAudioId(entry.audio, `${entryId}_browser_tts`), url: `browser-tts:${languageTag}`, speaker_label: "Browser TTS fallback", source_type: "browser_tts", engine: "Browser SpeechSynthesis", text, license: "synthetic-browser-preview", review_status: "draft" });
    count += 1;
  }
  return count;
}

function materializeAudio(audio, entryId, audioId) {
  const dataUrl = audio.data_url || audio.dataUrl || (String(audio.url || "").startsWith("data:") ? audio.url : undefined);
  if (audio.url && !String(audio.url).startsWith("data:") && !dataUrl) return audio.url;
  if (!dataUrl) throw new Error(`Audio contribution ${audioId} has neither url nor data_url.`);
  const { buffer, extension, mimeType } = decodeDataUrl(dataUrl, audio.mime_type || audio.mimeType);
  const hash = createHash("sha1").update(buffer).digest("hex").slice(0, 10);
  const fileName = `${audioId}_${hash}${extension}`;
  const sourceDir = join(sourceCommunityDir, entryId);
  const publicDir = join(publicCommunityDir, entryId);
  mkdirSync(sourceDir, { recursive: true });
  mkdirSync(publicDir, { recursive: true });
  const sourcePath = join(sourceDir, fileName);
  const publicPath = join(publicDir, fileName);
  writeFileSync(sourcePath, buffer);
  copyFileSync(sourcePath, publicPath);
  audio.mime_type = mimeType;
  return `/content-packs/${packSlug}/audio/human/${entryId}/${fileName}`;
}

function decodeDataUrl(dataUrl, fallbackMimeType = "audio/webm") {
  const match = /^data:([^,]*),(.*)$/s.exec(String(dataUrl));
  if (!match) throw new Error("Invalid data URL in contribution audio. Expected data:audio/...;base64,...");
  const meta = match[1] || fallbackMimeType;
  const payload = match[2] || "";
  const mimeType = (meta.split(";")[0] || fallbackMimeType).trim();
  const isBase64 = meta.split(";").includes("base64");
  const buffer = isBase64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload));
  return { buffer, mimeType, extension: extensionForMime(mimeType) };
}

function extensionForMime(mimeType) {
  if (mimeType.includes("wav")) return ".wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return ".mp3";
  if (mimeType.includes("ogg")) return ".ogg";
  if (mimeType.includes("mp4")) return ".m4a";
  return ".webm";
}
function cleanTags(tags = []) { return Array.isArray(tags) && tags.length ? tags.map(String).map((tag) => tag.trim()).filter(Boolean) : ["community"]; }
function slugify(value) { return String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "item"; }
function uniqueId(items, preferred) { const existing = new Set(items.map((item) => item.id)); let id = String(preferred || "item").replace(/[^A-Za-z0-9_\-]/g, "_"); let suffix = 2; while (existing.has(id)) { id = `${preferred}_${suffix}`; suffix += 1; } return id; }
function uniqueAudioId(audio, preferred) { const existing = new Set(audio.map((item) => item.id)); let id = String(preferred).replace(/[^A-Za-z0-9_\-]/g, "_"); let suffix = 2; while (existing.has(id)) { id = `${preferred}_${suffix}`; suffix += 1; } return id; }
function uniqueStrings(values) { return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))]; }
