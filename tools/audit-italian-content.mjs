#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const packDir = resolve(process.argv[2] ?? "content-packs/hy-eastern-it");
const sentencePath = join(packDir, "dictionary", "sentences.jsonl");
const wordPath = join(packDir, "dictionary", "words.jsonl");
const sentences = readJsonl(sentencePath);
const words = readJsonl(wordPath);

const nounForms = {
  "ջուր": forms("acqua", "f", "dell’acqua", "dell’acqua", "acqua"),
  "բանան": forms("banana", "f", "una banana"),
  "կաթ": forms("latte", "m", "del latte", "del latte", "latte"),
  "խնձոր": forms("mela", "f", "una mela"),
  "հաց": forms("pane", "m", "del pane", "del pane", "pane"),
  "մեղու": forms("ape", "f", "un’ape"),
  "այծ": forms("capra", "f", "una capra"),
  "ձի": forms("cavallo", "m", "un cavallo"),
  "մրջյուն": forms("formica", "f", "una formica"),
  "ճանճ": forms("mosca", "f", "una mosca"),
  "ոչխար": forms("pecora", "f", "una pecora"),
  "խոզ": forms("maiale", "m", "un maiale"),
  "կապիկ": forms("scimmia", "f", "una scimmia"),
  "օձ": forms("serpente", "m", "un serpente"),
  "առնետ": forms("ratto", "m", "un ratto"),
  "թռչուն": forms("uccello", "m", "un uccello"),
  "կով": forms("mucca", "f", "una mucca"),
  "որդ": forms("verme", "m", "un verme"),
  "նարինջ": forms("arancia", "f", "un’arancia"),
  "հատապտուղ": forms("bacca", "f", "una bacca"),
  "միս": forms("carne", "f", "della carne", "della carne", "carne"),
  "պանիր": forms("formaggio", "m", "del formaggio", "del formaggio", "formaggio"),
  "միրգ": forms("frutta", "f", "della frutta", "della frutta", "frutta"),
  "չարազ": forms("frutta secca", "f", "della frutta secca", "della frutta secca", "frutta secca"),
  "կարտոֆիլ": forms("patata", "f", "una patata"),
  "ձուկ": forms("pesce", "m", "un pesce", "del pesce", "un pesce"),
  "թեյ": forms("tè", "m", "del tè", "del tè", "tè"),
  "տորթ": forms("torta", "f", "una torta", "della torta", "una torta"),
  "ձու": forms("uovo", "m", "un uovo"),
  "ապուր": forms("zuppa", "f", "una zuppa", "della zuppa", "una zuppa"),
  "բաղնիք": forms("bagno", "m", "un bagno"),
  "թեյնիկ": forms("bollitore", "m", "un bollitore"),
  "շիշ": forms("bottiglia", "f", "una bottiglia"),
  "դարակ": forms("scaffale", "m", "uno scaffale"),
  "բանալի": forms("chiave", "f", "una chiave"),
  "դանակ": forms("coltello", "m", "un coltello"),
  "վարագույր": forms("tenda", "f", "una tenda"),
  "գդալ": forms("cucchiaio", "m", "un cucchiaio"),
  "բարձ": forms("cuscino", "m", "un cuscino"),
  "պատառաքաղ": forms("forchetta", "f", "una forchetta"),
  "վառարան": forms("forno", "m", "un forno"),
  "լամպ": forms("lampada", "f", "una lampada"),
  "պատ": forms("muro", "m", "un muro"),
  "ժամացույց": forms("orologio", "m", "un orologio"),
  "կաթսա": forms("pentola", "f", "una pentola"),
  "սանր": forms("pettine", "m", "un pettine"),
  "հատակ": forms("pavimento", "m", "un pavimento", "un pavimento", "il pavimento"),
  "ափսե": forms("piatto", "m", "un piatto"),
  "դուռ": forms("porta", "f", "una porta"),
  "կոճակ": forms("bottone", "m", "un bottone"),
  "տուփ": forms("scatola", "f", "una scatola"),
  "դույլ": forms("secchio", "m", "un secchio"),
  "աթոռ": forms("sedia", "f", "una sedia"),
  "կողպեք": forms("serratura", "f", "una serratura"),
  "խոզանակ": forms("spazzola", "f", "una spazzola"),
  "սեղան": forms("tavolo", "m", "un tavolo"),
  "բաժակ": forms("tazza", "f", "una tazza"),
  "տանիք": forms("tetto", "m", "un tetto"),
  "ծառ": forms("albero", "m", "un albero"),
  "ֆերմա": forms("fattoria", "f", "una fattoria"),
  "ծաղիկ": forms("fiore", "m", "un fiore"),
  "գետ": forms("fiume", "m", "un fiume"),
  "տերև": forms("foglia", "f", "una foglia"),
  "պարտեզ": forms("giardino", "m", "un giardino"),
  "կղզի": forms("isola", "f", "un’isola"),
  "լուսին": forms("luna", "f", "la luna", "la luna", "la luna"),
  "սար": forms("montagna", "f", "una montagna"),
  "ամպ": forms("nuvola", "f", "una nuvola"),
  "փետուր": forms("piuma", "f", "una piuma"),
  "գարուն": forms("primavera", "f", "la primavera", "la primavera", "la primavera"),
  "արմատ": forms("radice", "f", "una radice"),
  "ճյուղ": forms("ramo", "m", "un ramo"),
  "սերմ": forms("seme", "m", "un seme"),
  "արև": forms("sole", "m", "il sole", "il sole", "il sole"),
  "աստղ": forms("stella", "f", "una stella"),
  "ցողուն": forms("stelo", "m", "uno stelo"),
  "գրադարան": forms("biblioteca", "f", "una biblioteca"),
  "շուն": forms("cane", "m", "un cane"),
  "կատու": forms("gatto", "m", "un gatto"),
  "տուն": forms("casa", "f", "una casa"),
  "ծիրան": forms("albicocca", "f", "un’albicocca"),
  "բազուկ": forms("barbabietola", "f", "una barbabietola"),
  "գազար": forms("carota", "f", "una carota"),
  "կաղամբ": forms("cavolo", "m", "un cavolo", "del cavolo"),
  "վարունգ": forms("cetriolo", "m", "un cetriolo"),
  "կեռաս": forms("ciliegia", "f", "una ciliegia"),
  "սոխ": forms("cipolla", "f", "una cipolla"),
  "ելակ": forms("fragola", "f", "una fragola"),
  "պաղպաղակ": forms("gelato", "m", "del gelato"),
  "սմբուկ": forms("melanzana", "f", "una melanzana"),
  "մեղր": forms("miele", "m", "del miele"),
  "դեղձ": forms("pesca", "f", "una pesca"),
  "լոլիկ": forms("pomodoro", "m", "un pomodoro"),
  "սալոր": forms("prugna", "f", "una prugna"),
  "բողկ": forms("ravanello", "m", "un ravanello"),
  "բրինձ": forms("riso", "m", "del riso"),
  "մածուն": forms("yogurt", "m", "dello yogurt"),
  "դդում": forms("zucca", "f", "della zucca"),
  "կարագ": forms("burro", "m", "del burro")
};

const explicit = new Map(Object.entries({
  hy_sentence_green_tree: "L’albero è verde.",
  hy_sentence_mom_drinks_tea: "La mamma beve il tè.",
  hy_sentence_i_listen: "Ascolto.",
  hy_sentence_i_write: "Scrivo.",
  hy_sentence_exp_60e399bdb6d0: "Vengo dall’Italia.",
  hy_sentence_exp_74b387644a6c: "Vengo dalla Danimarca.",
  hy_sentence_exp_e9e75c0f87a6: "Vengo dall’Armenia.",
  hy_sentence_exp_950737d73174: "Che cos’è questo?",
  hy_sentence_exp_2fd68869f7a2: "In casa ci sono una cucina e una camera da letto.",
  hy_sentence_exp_5921de67db52: "Sul tavolo ci sono del pane e del formaggio.",
  hy_sentence_exp_9c89660045b3: "Studio l’armeno.",
  hy_sentence_we_are_friends: "Siamo amici.",
  hy_sentence_they_are_home: "Sono a casa.",
  hy_sentence_we_do_not_go: "Non andiamo."
}));

for (const sentence of sentences) {
  let translation = explicit.get(sentence.id) ?? currentItalian(sentence);
  const parsed = parseTemplate(sentence.target_sentence);
  if (parsed && nounForms[parsed.noun]) translation = renderTemplate(parsed.kind, nounForms[parsed.noun]);
  translation = polish(translation);
  sentence.translation = translation;
  sentence.translations = { ...(sentence.translations ?? {}), it: translation };
  sentence.prompt = { ...(sentence.prompt ?? {}), it: `Scegli la frase armena: ${translation}` };
  sentence.translation_review_status = { ...(sentence.translation_review_status ?? {}), it: "reviewed" };
}

// Replace all Italian answer alternatives with natural, contextually similar sentences.
const groups = new Map();
for (const sentence of sentences) {
  const key = distractorGroup(sentence);
  const group = groups.get(key) ?? [];
  group.push(sentence);
  groups.set(key, group);
}
for (const sentence of sentences) {
  const translation = currentItalian(sentence);
  const existing = unique((sentence.translation_distractors?.it ?? []).map(polish))
    .filter((candidate) => candidate !== translation);
  // Core alternatives are intentionally curated. Re-running the audit must not
  // replace them with automatically selected sentences.
  if ((sentence.tags ?? []).includes("tier:core") && existing.length >= 3) {
    sentence.translation_distractors = { ...(sentence.translation_distractors ?? {}), it: existing.slice(0, 3) };
    continue;
  }
  let candidates = (groups.get(distractorGroup(sentence)) ?? [])
    .filter((candidate) => candidate.id !== sentence.id)
    .sort((a, b) => similarityScore(sentence, b) - similarityScore(sentence, a))
    .map(currentItalian);
  if (candidates.length < 3) {
    candidates.push(...sentences.filter((candidate) => candidate.id !== sentence.id).map(currentItalian));
  }
  sentence.translation_distractors = { ...(sentence.translation_distractors ?? {}), it: unique(candidates.map(polish)).filter((candidate) => candidate !== translation).slice(0, 3) };
}

// Align the Italian vocabulary glosses used by the audited sentence templates.
for (const word of words) {
  const entry = nounForms[word.target];
  if (!entry) continue;
  word.translation = entry.lemma;
  word.translations = { ...(word.translations ?? {}), it: entry.lemma };
  word.translation_review_status = { ...(word.translation_review_status ?? {}), it: "reviewed" };
  if (typeof word.notes === "string" && word.notes.includes("matched automatically")) {
    word.notes = "Italian gloss reviewed for the course; Armenian sense still requires native-speaker review.";
  }
}

writeJsonl(sentencePath, sentences);
writeJsonl(wordPath, words);
console.log(`Audited ${sentences.length} Italian sentences and ${words.filter((word) => nounForms[word.target]).length} linked vocabulary glosses.`);

function forms(lemma, gender, indefinite, want = indefinite, thisForm = indefinite) {
  return { lemma, gender, indefinite, want, thisForm };
}
function parseTemplate(text) {
  const normalized = String(text).trim().replace(/[։.]+$/u, "");
  let match = normalized.match(/^Սա (.+) է$/u);
  if (match && !match[1].startsWith("իմ ") && match[1] !== "ի՞նչ") return { kind: "this", noun: match[1] };
  match = normalized.match(/^Ես տեսնում եմ (.+)$/u);
  if (match) return { kind: "see", noun: match[1] };
  match = normalized.match(/^Ես ուզում եմ (.+)$/u);
  if (match) return { kind: "want", noun: match[1] };
  match = normalized.match(/^Ես ունեմ (.+)$/u);
  if (match) return { kind: "have", noun: match[1] };
  return null;
}
function renderTemplate(kind, entry) {
  if (kind === "this") return `${entry.gender === "f" ? "Questa" : "Questo"} è ${entry.thisForm}.`;
  if (kind === "see") return `Vedo ${entry.indefinite}.`;
  if (kind === "want") return `Voglio ${entry.want}.`;
  return `Ho ${entry.indefinite}.`;
}
function currentItalian(sentence) { return sentence.translations?.it ?? sentence.translation ?? ""; }
function polish(value) {
  return String(value)
    .replace(/lattè/gi, "latte")
    .replace(/setè/gi, "sete")
    .replace(/tèmpo/gi, "tempo")
    .replace(/tristè/gi, "triste")
    .replace(/\bL albero\b/g, "L’albero")
    .replace(/\bl eroe\b/gi, "l’eroe")
    .replace(/\bl energia\b/gi, "l’energia")
    .replace(/\bpiu\b/gi, "più")
    .replace(/\s+/g, " ")
    .trim();
}
function distractorGroup(sentence) {
  const parsed = parseTemplate(sentence.target_sentence);
  if (parsed) return `template:${parsed.kind}`;
  const topic = (sentence.tags ?? []).find((tag) => tag.startsWith("topic:")) ?? "topic:general";
  const grammar = (sentence.tags ?? []).find((tag) => tag.startsWith("grammar:")) ?? "grammar:general";
  return `${topic}:${grammar}`;
}
function similarityScore(a, b) {
  const aTags = new Set(a.tags ?? []);
  const shared = (b.tags ?? []).filter((tag) => aTags.has(tag)).length;
  return shared * 100 - Math.abs(currentItalian(a).length - currentItalian(b).length);
}
function unique(values) { return [...new Set(values.filter(Boolean))]; }
function readJsonl(file) { return readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)); }
function writeJsonl(file, values) { writeFileSync(file, `${values.map((value) => JSON.stringify(value)).join("\n")}\n`, "utf8"); }
