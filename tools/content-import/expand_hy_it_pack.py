#!/usr/bin/env python3
"""Build the expanded Eastern Armenian-through-Italian draft pack.

Inputs are deliberately retained under content-packs/hy-eastern-it/sources so
reviewers can trace every generated record.  Machine-matched translations and
all automatically composed sentences remain marked for native-speaker review.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[2]
PACK = ROOT / "content-packs" / "hy-eastern-it"
DICT = PACK / "dictionary"
SOURCES = PACK / "sources"
WORDS_PATH = DICT / "words.jsonl"
SENTENCES_PATH = DICT / "sentences.jsonl"
LETTERS_PATH = DICT / "letters.jsonl"
REPORT_PATH = SOURCES / "content-review-report.md"
TARGET_WORDS = 620
TARGET_SENTENCES = 260

MANUAL_ITALIAN = {
    "angle": "angolo", "ant": "formica", "apple": "mela", "arch": "arco", "arm": "braccio", "army": "esercito",
    "baby": "bambino", "bag": "borsa", "ball": "palla", "band": "banda", "board": "tavola", "boot": "stivale",
    "box": "scatola", "camera": "macchina fotografica", "cart": "carretto", "circle": "cerchio", "coat": "cappotto",
    "collar": "colletto", "comb": "pettine", "cord": "corda", "eye": "occhio", "foot": "piede", "frame": "cornice",
    "glove": "guanto", "hat": "cappello", "jewel": "gioiello", "kettle": "bollitore", "orange": "arancia",
    "oven": "forno", "pen": "penna", "pocket": "tasca", "pot": "pentola", "rail": "binario", "root": "radice",
    "seed": "seme", "ship": "nave", "shirt": "camicia", "skirt": "gonna", "sock": "calzino",
    "spade/shovel": "pala", "sponge": "spugna", "spring": "primavera", "stocking": "calza", "tooth": "dente",
    "tray": "vassoio", "umbrella": "ombrello", "whip": "frusta", "addition": "aggiunta", "balance": "equilibrio",
    "belief": "credenza", "canvas": "tela", "chalk": "gesso", "cloth": "stoffa", "color": "colore",
    "comparison": "confronto", "condition": "condizione", "cotton": "cotone", "crush": "schiacciare",
    "development": "sviluppo", "direction": "direzione", "discussion": "discussione", "disease": "malattia",
    "echo": "eco", "education": "educazione", "event": "evento", "experience": "esperienza", "feeling": "sentimento",
    "form": "forma", "front": "davanti", "growth": "crescita", "hearing": "udito", "hour": "ora", "humor": "umorismo",
    "invention": "invenzione", "kick": "calcio", "law": "legge", "learning": "apprendimento", "minute": "minuto",
    "motion": "movimento", "music": "musica", "news": "notizie", "opinion": "opinione", "position": "posizione",
    "quality": "qualità", "record": "registrazione", "rhythm": "ritmo", "selection": "selezione", "sister": "sorella",
    "smile": "sorriso", "song": "canzone", "sound": "suono", "start": "inizio", "story": "storia", "test": "prova",
    "thought": "pensiero", "time": "tempo", "touch": "toccare", "turn": "girare", "value": "valore", "voice": "voce",
    "walk": "camminare", "way": "modo", "weather": "tempo atmosferico", "work": "lavoro", "writing": "scrittura",
    "kind": "gentile", "hard": "duro", "right": "giusto", "light": "luce", "open": "aperto", "past": "passato",
    "present": "presente", "quick": "veloce", "quiet": "tranquillo", "ready": "pronto", "same": "stesso",
    "sharp": "affilato", "straight": "dritto", "sweet": "dolce", "true": "vero", "warm": "caldo", "wide": "largo",
    "wrong": "sbagliato", "street": "strada", "road": "strada", "attempt": "tentativo", "laugh": "ridere", "meaning": "significato", "size": "dimensione", "rule": "regola", "grip": "afferrare", "degree": "grado", "get": "ottenere", "let": "lasciare", "make": "fare", "put": "mettere", "take": "prendere",
    "be": "essere", "have": "avere", "say": "dire", "see": "vedere", "send": "mandare", "can": "potere",
    "about": "circa / riguardo", "at": "a / presso", "by": "da", "from": "da", "in": "in", "on": "su",
    "through": "attraverso", "to": "verso", "under": "sotto", "up": "su", "as": "come", "for": "per",
    "the": "il / la", "all": "tutto", "any": "qualsiasi", "every": "ogni", "little": "poco", "much": "molto",
    "no": "no", "other": "altro", "that": "quello / che", "this": "questo", "I": "io", "he": "lui",
    "you": "tu / voi", "who": "chi", "and": "e", "because": "perché", "but": "ma", "or": "o", "if": "se",
    "how": "come", "when": "quando", "where": "dove", "why": "perché", "again": "di nuovo", "far": "lontano",
    "forward": "avanti", "here": "qui", "near": "vicino", "now": "adesso", "out": "fuori", "still": "ancora",
    "then": "poi", "there": "lì", "together": "insieme", "well": "bene", "almost": "quasi", "enough": "abbastanza",
    "even": "perfino", "only": "solo", "quite": "piuttosto", "so": "così", "very": "molto", "tomorrow": "domani",
    "yesterday": "ieri", "north": "nord", "south": "sud", "east": "est", "west": "ovest", "please": "per favore",
    "yes": "sì"
}

EXCLUDED = {
    "gun", "prison", "crime", "war", "violent", "military", "punishment", "religion", "tax", "death", "destruction",
    "coal", "chemical", "authority", "committee", "political", "theory", "steel", "tin", "copper", "credit", "debt",
    "current(electrical)", "apparatus", "canvas", "cork", "linen", "polish", "verse", "vessel", "whip", "army"
}

TAG_KEYWORDS = {
    "animal": {"ant", "bee", "bird", "cat", "cow", "dog", "fish", "fly", "goat", "horse", "monkey", "pig", "rat", "sheep", "snake", "worm", "animal"},
    "food": {"apple", "berry", "bread", "butter", "cake", "cheese", "egg", "fish", "nuts", "orange", "potato", "rice", "soup", "sugar", "water", "wine", "taste"},
    "body": {"arm", "bone", "brain", "chest", "chin", "ear", "eye", "face", "finger", "foot", "hair", "hand", "head", "heart", "knee", "leg", "lip", "mouth", "muscle", "neck", "nerve", "nose", "skin", "stomach", "throat", "tongue", "tooth", "blood", "body", "breath"},
    "home": {"bath", "bed", "bottle", "box", "brush", "bucket", "bulb", "button", "clock", "comb", "cup", "curtain", "cushion", "door", "drawer", "floor", "fork", "house", "kettle", "key", "knife", "lock", "oven", "plate", "pot", "roof", "shelf", "spoon", "table", "wall", "window"},
    "school": {"board", "book", "chalk", "library", "map", "pen", "pencil", "picture", "school", "scissors", "writing", "learning", "teaching", "test", "word"},
    "nature": {"air", "branch", "cloud", "farm", "feather", "garden", "island", "leaf", "moon", "root", "seed", "spring", "star", "stem", "stone", "sun", "tree", "weather", "wind", "winter", "wood", "snow", "river", "sand", "sea"},
    "travel": {"boat", "bridge", "carriage", "farm", "hospital", "island", "map", "office", "plane", "rail", "ship", "station", "street", "ticket", "town", "train", "transport", "direction", "distance", "journey", "road", "walk"},
    "clothes": {"boot", "coat", "collar", "dress", "glove", "hat", "pocket", "shirt", "shoe", "skirt", "sock", "stocking", "trousers", "umbrella"},
    "family": {"baby", "boy", "brother", "daughter", "girl", "sister", "son", "woman", "man", "family", "mother", "father"},
    "color": {"color", "black", "brown", "grey/gray", "red", "yellow", "blue", "green", "white"},
    "time": {"day", "hour", "minute", "month", "night", "time", "week", "year", "summer", "winter", "spring", "tomorrow", "yesterday", "now", "early", "late", "past", "present", "future"},
}

EMOJI = {
    "apple": "🍎", "book": "📘", "cat": "🐱", "dog": "🐶", "bird": "🐦", "fish": "🐟", "horse": "🐴",
    "house": "🏠", "school": "🏫", "hospital": "🏥", "sun": "☀️", "moon": "🌙", "star": "⭐", "tree": "🌳",
    "water": "💧", "bread": "🍞", "cheese": "🧀", "egg": "🥚", "potato": "🥔", "orange": "🍊", "cake": "🍰",
    "carriage": "🚃", "train": "🚆", "plane": "✈️", "boat": "⛵", "key": "🔑", "clock": "🕐",
    "heart": "❤️", "eye": "👁️", "hand": "✋", "foot": "🦶", "ear": "👂", "nose": "👃",
    "red": "🔴", "blue": "🔵", "green": "🟢", "yellow": "🟡", "black": "⚫", "white": "⚪"
}

ALPHABET = [
    ("Ա", "ա", "այբ", "a", "a"), ("Բ", "բ", "բեն", "b", "b"), ("Գ", "գ", "գիմ", "g", "g"),
    ("Դ", "դ", "դա", "d", "d"), ("Ե", "ե", "եչ", "ye/e", "ye/e"), ("Զ", "զ", "զա", "z", "z"),
    ("Է", "է", "է", "e", "e"), ("Ը", "ը", "ըթ", "ə", "uh"), ("Թ", "թ", "թո", "tʰ", "t'"),
    ("Ժ", "ժ", "ժե", "zh", "zh"), ("Ի", "ի", "ինի", "i", "i"), ("Լ", "լ", "լյուն", "l", "l"),
    ("Խ", "խ", "խե", "kh", "kh"), ("Ծ", "ծ", "ծա", "ts", "ts"), ("Կ", "կ", "կեն", "k", "k"),
    ("Հ", "հ", "հո", "h", "h"), ("Ձ", "ձ", "ձա", "dz", "dz"), ("Ղ", "ղ", "ղատ", "gh", "gh"),
    ("Ճ", "ճ", "ճե", "ch", "ch"), ("Մ", "մ", "մեն", "m", "m"), ("Յ", "յ", "հի", "y", "y"),
    ("Ն", "ն", "նու", "n", "n"), ("Շ", "շ", "շա", "sh", "sh"), ("Ո", "ո", "ո", "vo/o", "vo/o"),
    ("Չ", "չ", "չա", "chʰ", "ch'"), ("Պ", "պ", "պե", "p", "p"), ("Ջ", "ջ", "ջե", "j", "j"),
    ("Ռ", "ռ", "ռա", "rr", "rr"), ("Ս", "ս", "սե", "s", "s"), ("Վ", "վ", "վեվ", "v", "v"),
    ("Տ", "տ", "տյուն", "t", "t"), ("Ր", "ր", "րե", "r", "r"), ("Ց", "ց", "ցո", "tsʰ", "ts'"),
    ("Ւ", "ւ", "հյուն", "w/v", "w/v"), ("Փ", "փ", "փյուր", "pʰ", "p'"), ("Ք", "ք", "քե", "kʰ", "k'"),
    ("Եվ", "և", "և", "yev/ev", "yev/ev"), ("Օ", "օ", "օ", "o", "o"), ("Ֆ", "ֆ", "ֆե", "f", "f")
]

ARCHIVE_WORDS = [
    ("խոհանոց", "khohanots", "cucina", ["home"], "das3L.docx"), ("ննջասենյակ", "nnjasenyak", "camera da letto", ["home"], "das3L.docx"),
    ("հյուրասենյակ", "hyurasenyak", "soggiorno", ["home"], "das3L.docx"), ("լոգարան", "logaran", "bagno", ["home"], "das3L.docx"),
    ("միջանցք", "mijantsk", "corridoio", ["home"], "das3L.docx"), ("պատշգամբ", "patshgamb", "balcone", ["home"], "das3L.docx"),
    ("բակ", "bak", "cortile", ["home"], "das3L.docx"), ("հասցե", "hastse", "indirizzo", ["home", "place"], "das3L.docx"),
    ("առաջին հարկ", "arajin hark", "primo piano", ["home", "number"], "das3L.docx"), ("տուն վերադարձ", "tun veradardz", "ritorno a casa", ["home"], "das3L.docx"),
    ("կենդանաբանական այգի", "kendanabanakan aygi", "zoo", ["animal", "place"], "das3L.docx"),
    ("առյուծ", "aryuts", "leone", ["animal"], "das3L.docx"), ("վագր", "vagr", "tigre", ["animal"], "das3L.docx"),
    ("ընձուղտ", "yndzught", "giraffa", ["animal"], "das3L.docx"), ("փիղ", "pigh", "elefante", ["animal"], "das3L.docx"),
    ("մուկ", "muk", "topo", ["animal"], "das3L.docx"), ("արջ", "arj", "orso", ["animal"], "das3L.docx"),
    ("նապաստակ", "napastak", "coniglio", ["animal"], "das3L.docx"), ("աղվես", "aghves", "volpe", ["animal"], "das3L.docx"),
    ("գայլ", "gayl", "lupo", ["animal"], "das3L.docx"), ("կրիա", "kria", "tartaruga", ["animal"], "das3L.docx"),
    ("ընձառյուծ", "yndzaryuts", "leopardo", ["animal"], "das3L.docx"), ("ճագար", "chagar", "coniglio", ["animal"], "das3L.docx"),
    ("սոխ", "sokh", "cipolla", ["food"], "das4L.docx"), ("վարունգ", "varung", "cetriolo", ["food"], "das4L.docx"),
    ("բազուկ", "bazuk", "barbabietola", ["food"], "das4L.docx"), ("բողկ", "boghk", "ravanello", ["food"], "das4L.docx"),
    ("կաղամբ", "kaghamb", "cavolo", ["food"], "das4L.docx"), ("գազար", "gazar", "carota", ["food"], "das4L.docx"),
    ("սմբուկ", "smbuk", "melanzana", ["food"], "das4L.docx"), ("դդում", "ddum", "zucca", ["food"], "das4L.docx"),
    ("լոլիկ", "lolik", "pomodoro", ["food"], "das4L.docx"), ("ծիրան", "tsiran", "albicocca", ["food"], "das4L.docx"),
    ("դեղձ", "deghdz", "pesca", ["food"], "das4L.docx"), ("սալոր", "salor", "prugna", ["food"], "das4L.docx"),
    ("կեռաս", "keras", "ciliegia", ["food"], "das4L.docx"), ("ելակ", "yelak", "fragola", ["food"], "das4L.docx"),
    ("մեղր", "meghr", "miele", ["food"], "das4L.docx"), ("կաթ", "kat", "latte", ["drink", "food"], "das4L.docx"),
    ("մածուն", "matsun", "yogurt", ["food"], "das4L.docx"), ("պաղպաղակ", "paghpaghak", "gelato", ["food"], "das4L.docx"),
    ("ընտանի կենդանի", "yntani kendani", "animale domestico", ["animal", "home"], "das6L.docx"),
    ("ամենամեծ", "amenamets", "il più grande", ["adjective"], "das6L.docx"), ("ամենափոքր", "amenapokr", "il più piccolo", ["adjective"], "das6L.docx")
]

ARCHIVE_SENTENCES = [
    ("Սա իմ տունն է։", "Questa è la mia casa.", ["home"], "das3L.docx"),
    ("Ես ապրում եմ քաղաքում։", "Vivo in città.", ["home", "place"], "das3L.docx"),
    ("Մեր տունը մեծ է։", "La nostra casa è grande.", ["home", "adjective"], "das3L.docx"),
    ("Տանը կա խոհանոց և ննջասենյակ։", "In casa ci sono una cucina e una camera da letto.", ["home"], "das3L.docx"),
    ("Բակում ծառ կա։", "Nel cortile c'è un albero.", ["home", "nature"], "das3L.docx"),
    ("Ես դպրոց եմ գնում։", "Vado a scuola.", ["school", "verb"], "das3L.docx"),
    ("Դպրոցը տան մոտ է։", "La scuola è vicino a casa.", ["school", "home"], "das3L.docx"),
    ("Կենդանաբանական այգում շատ կենդանիներ կան։", "Allo zoo ci sono molti animali.", ["animal", "place"], "das3L.docx"),
    ("Առյուծը մեծ է։", "Il leone è grande.", ["animal", "adjective"], "das3L.docx"),
    ("Նապաստակը փոքր է։", "Il coniglio è piccolo.", ["animal", "adjective"], "das3L.docx"),
    ("Ես սիրում եմ մրգեր։", "Mi piace la frutta.", ["food"], "das4L.docx"),
    ("Ես ուզում եմ ջուր։", "Voglio dell'acqua.", ["drink"], "das4L.docx"),
    ("Սեղանին հաց և պանիր կա։", "Sul tavolo ci sono pane e formaggio.", ["food", "home"], "das4L.docx"),
    ("Կատուն քնած է։", "Il gatto dorme.", ["animal"], "das6L.docx"),
    ("Շունը բակում է։", "Il cane è nel cortile.", ["animal", "home"], "das6L.docx"),
    ("Մենք միասին ենք խաղում։", "Giochiamo insieme.", ["people", "verb"], "das6L.docx"),
    ("Իմ ընկերն ուրախ է։", "Il mio amico è felice.", ["people", "feeling"], "das6L.docx"),
    ("Այսօր եղանակը լավ է։", "Oggi il tempo è bello.", ["weather", "time"], "das7L.docx"),
    ("Վաղը դպրոց եմ գնում։", "Domani vado a scuola.", ["time", "school"], "das7L.docx"),
    ("Ես հայերեն եմ սովորում։", "Studio armeno.", ["school", "language"], "das7L.docx")
]


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def write_jsonl(path: Path, rows: Iterable[dict[str, Any]]) -> None:
    path.write_text("\n".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) for row in rows) + "\n", encoding="utf-8")


def norm(value: str) -> str:
    return re.sub(r"[\W_]+", "", value.casefold(), flags=re.UNICODE)


def slug(value: str) -> str:
    asciiish = re.sub(r"[^a-z0-9]+", "_", value.casefold()).strip("_")
    return asciiish[:42] or hashlib.sha1(value.encode("utf-8")).hexdigest()[:12]


def load_romanization() -> dict[str, str]:
    result: dict[str, str] = {}
    with (SOURCES / "eng_arm_rom.csv").open(encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            target = row.get("ARMENIAN", "").strip()
            romanized = row.get("ROMANIZED", "").strip()
            if target and romanized:
                result[norm(target)] = romanized
    return result


def load_italian_candidates() -> dict[str, list[tuple[int, str]]]:
    candidates: dict[str, list[tuple[int, str]]] = defaultdict(list)
    with (SOURCES / "italian-vocab.tsv").open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle, delimiter="\t"):
            italian = (row.get("Italian") or "").strip().strip('"')
            try:
                rank = int((row.get("Frequency Rank") or "999999").strip('"'))
            except ValueError:
                rank = 999999
            for line in (row.get("English") or "").splitlines():
                rhs = line.split(":", 1)[1] if ":" in line else line
                for raw in re.split(r"[,;/]", rhs):
                    term = re.sub(r"\([^)]*\)", "", raw).strip().casefold()
                    term = re.sub(r"^(to|a|an|the) ", "", term)
                    if term and len(term) < 45 and italian:
                        candidates[term].append((rank, italian))
    return candidates


def choose_italian(english: str, target: str, category: str, candidates: dict[str, list[tuple[int, str]]]) -> tuple[str | None, str]:
    key = english.strip()
    lower = key.casefold()
    base = re.sub(r"\([^)]*\)", "", lower).strip().split("/")[0].strip()
    if key in MANUAL_ITALIAN:
        return MANUAL_ITALIAN[key], "manual"
    if lower in MANUAL_ITALIAN:
        return MANUAL_ITALIAN[lower], "manual"
    options = candidates.get(base, [])
    if not options:
        return None, "missing"
    filtered = options
    # Armenian infinitives normally end in -ել/-ալ. Prefer an Italian infinitive
    # for those entries; otherwise prefer a noun-like candidate for the source
    # dictionary's broad THINGS categories.
    target_is_verb = target.endswith(("ել", "ալ"))
    if target_is_verb:
        verbish = [(rank, word) for rank, word in options if re.search(r"(are|ere|ire)$", word)]
        if verbish:
            filtered = verbish
    elif category.startswith("THINGS"):
        nounish = [(rank, word) for rank, word in options if not re.search(r"(are|ere|ire)$", word) and word not in {"fare", "essere", "avere"}]
        if nounish:
            filtered = nounish
    rank, word = min(filtered, key=lambda item: (item[0], len(item[1])))
    return word, "auto_tomcumming"


def tags_for(english: str, category: str) -> list[str]:
    e = english.casefold()
    tags = [tag for tag, terms in TAG_KEYWORDS.items() if e in terms]
    if category == "QUALITIES" or category == "QUALITIES - OPPOSITES":
        tags.append("adjective")
    elif category == "OPERATIONS":
        tags.append("verb" if e in {"come", "get", "give", "go", "keep", "let", "make", "put", "seem", "take", "be", "do", "have", "say", "see", "send", "can", "wait"} else "basic")
    elif not tags:
        tags.append("basic" if category.startswith("THINGS") else "daily-life")
    return list(dict.fromkeys(tags))


def merge_word(store: dict[str, dict[str, Any]], item: dict[str, Any]) -> None:
    key = norm(item["target"])
    previous = store.get(key)
    if previous is None:
        store[key] = item
        return
    meanings = list(dict.fromkeys([previous.get("translation", ""), *(previous.get("meanings") or []), item.get("translation", ""), *(item.get("meanings") or [])]))
    meanings = [value for value in meanings if value]
    previous["meanings"] = meanings
    previous["translation"] = meanings[0]
    transliterations = list(dict.fromkeys([previous.get("transliteration", ""), *(previous.get("transliterations") or []), item.get("transliteration", ""), *(item.get("transliterations") or [])]))
    transliterations = [value for value in transliterations if value]
    if transliterations:
        previous["transliteration"] = transliterations[0]
        previous["transliterations"] = transliterations
    previous["tags"] = list(dict.fromkeys([*(previous.get("tags") or []), *(item.get("tags") or [])]))
    aliases = list(dict.fromkeys([*(previous.get("aliases") or []), *(item.get("aliases") or [])]))
    if aliases:
        previous["aliases"] = aliases


def word_item(target: str, transliteration: str, italian: str, tags: list[str], source: str, location: str, complexity: int = 2, concept: str | None = None, emoji: str | None = None, notes: str | None = None) -> dict[str, Any]:
    item: dict[str, Any] = {
        "id": f"hy_exp_{slug(concept or transliteration or target)}_{hashlib.sha1(target.encode()).hexdigest()[:6]}",
        "concept": concept or slug(italian),
        "target": target.strip(),
        "transliteration": transliteration.strip(),
        "translation": italian.strip(),
        "base_language": "it",
        "difficulty": max(1, min(4, complexity)),
        "complexity": max(0, min(5, complexity)),
        "tags": tags,
        "audio": [],
        "source": source,
        "source_location": location,
        "review_status": "needs_native_speaker_review"
    }
    if emoji:
        item["emoji"] = emoji
    if notes:
        item["notes"] = notes
    return item


def distractors(sentence: str) -> list[str]:
    words = sentence.rstrip("։.!?").split()
    candidates: list[str] = []
    if len(words) >= 2:
        candidates.append(" ".join(reversed(words)))
        candidates.append(" ".join(words[1:] + words[:1]))
        swapped = words[:]
        swapped[0], swapped[1] = swapped[1], swapped[0]
        candidates.append(" ".join(swapped))
    if len(words) >= 4:
        candidates.append(" ".join(words[:1] + list(reversed(words[1:]))))
    return list(dict.fromkeys(value + "։" for value in candidates if value and value != " ".join(words)))[:3]


def sentence_item(target: str, italian: str, tags: list[str], source: str, location: str, complexity: int = 2) -> dict[str, Any]:
    return {
        "id": f"hy_sentence_exp_{hashlib.sha1((target + italian).encode()).hexdigest()[:12]}",
        "prompt": {"it": f"Scegli la frase armena: {italian}"},
        "target_sentence": target,
        "translation": italian,
        "base_language": "it",
        "distractors": distractors(target),
        "difficulty": complexity,
        "complexity": complexity,
        "tags": list(dict.fromkeys([*tags, "sentence_order"])),
        "audio": [],
        "source": source,
        "source_location": location,
        "review_status": "needs_native_speaker_review"
    }


def build_words() -> tuple[list[dict[str, Any]], list[str]]:
    generated_sources = {
        "user-gist-quizzario",
        "uploaded-lesson-archive",
        "shay-ellison-armenian-words-mit",
        "curated-a0-a2-draft"
    }
    existing = [
        item for item in read_jsonl(WORDS_PATH)
        if item.get("source") not in generated_sources and not str(item.get("id", "")).startswith("hy_exp_")
    ]
    store = {norm(item["target"]): item for item in existing}
    review: list[str] = []
    romanization = load_romanization()
    candidates = load_italian_candidates()

    gist = json.loads((SOURCES / "gist-vocabulary.json").read_text(encoding="utf-8"))
    for category, entries in gist["categories"].items():
        for index, (target, translit, italian) in enumerate(entries):
            merge_word(store, word_item(target, translit, italian, [category, "community"], "user-gist-quizzario", f"{category}[{index}]", 1 if category in {"greetings", "family", "colors"} else 2))

    for target, translit, italian, tags, location in ARCHIVE_WORDS:
        merge_word(store, word_item(target, translit, italian, [*tags, "community"], "uploaded-lesson-archive", location, 2))

    with (SOURCES / "eng_arm.csv").open(encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))
    for index, row in enumerate(rows):
        english = (row.get("ENGLISH") or "").strip()
        target = (row.get("ARMENIAN") or "").strip()
        category = (row.get("CATEGORY") or "").strip()
        if not english or not target or english.casefold() in EXCLUDED:
            continue
        italian, method = choose_italian(english, target, category, candidates)
        if not italian:
            review.append(f"- Missing Italian translation: `{english}` → `{target}` (eng_arm.csv line {index + 2})")
            continue
        complexity = 1 if category == "THINGS - TANGIBLE" else 2 if category.startswith("QUALITIES") or category == "OPERATIONS" else 3
        item = word_item(
            target,
            romanization.get(norm(target), ""),
            italian,
            tags_for(english, category),
            "shay-ellison-armenian-words-mit",
            f"eng_arm.csv:{index + 2}",
            complexity,
            concept=english,
            emoji=EMOJI.get(english.casefold()),
            notes="Italian meaning matched automatically from tomcumming/italian-vocab; verify sense." if method.startswith("auto") else None
        )
        merge_word(store, item)
        if method.startswith("auto") and index < 650:
            review.append(f"- Check automatic sense: `{target}` / {english} → **{italian}**")
        if len(store) >= TARGET_WORDS:
            break

    ordered = list(store.values())
    ordered.sort(key=lambda item: (int(item.get("complexity", 2)), (item.get("tags") or ["z"])[0], item.get("translation", "")))
    return ordered[:TARGET_WORDS], review


def build_letters(words: list[dict[str, Any]]) -> list[dict[str, Any]]:
    examples: dict[str, str] = {}
    for item in words:
        target = item.get("target", "")
        if target:
            examples.setdefault(target[0], item["id"])
    rows = []
    for index, (upper, lower, armenian_name, sound, translit) in enumerate(ALPHABET):
        rows.append({
            "id": f"hy_letter_{index + 1:02d}_{slug(translit)}",
            "character": lower,
            "uppercase": upper,
            "lowercase": lower,
            "names": {"it": f"{armenian_name} · suono {sound}"},
            "sound": sound,
            "transliteration": translit,
            "example_item_ids": [examples[lower]] if lower in examples else [],
            "example_word": next((item["target"] for item in words if item.get("id") == examples.get(lower)), ""),
            "similar_letter_ids": [],
            "audio": [],
            "source": "shay-ellison-romanization-guidelines-mit",
            "source_location": f"alphabet:{index + 1}",
            "review_status": "needs_native_speaker_review"
        })
    return rows


def build_sentences(words: list[dict[str, Any]]) -> list[dict[str, Any]]:
    generated_sources = {"user-gist-quizzario", "uploaded-lesson-archive", "curated-a0-a2-draft"}
    existing = [
        item for item in read_jsonl(SENTENCES_PATH)
        if item.get("source") not in generated_sources and not str(item.get("id", "")).startswith("hy_sentence_exp_")
    ]
    store = {norm(item["target_sentence"]): item for item in existing}
    gist = json.loads((SOURCES / "gist-vocabulary.json").read_text(encoding="utf-8"))
    for category, entries in gist["categories"].items():
        for index, (target, _translit, italian) in enumerate(entries):
            if len(target.split()) >= 2 and target[-1:] in "։?" or len(target.split()) >= 3:
                target_sentence = target if target.endswith(("։", "?", "!")) else target + "։"
                store.setdefault(norm(target_sentence), sentence_item(target_sentence, italian, [category], "user-gist-quizzario", f"{category}[{index}]", 1 if category == "greetings" else 2))
    for target, italian, tags, location in ARCHIVE_SENTENCES:
        store.setdefault(norm(target), sentence_item(target, italian, [*tags, "community"], "uploaded-lesson-archive", location, 2))

    # Select concrete nouns and simple adjectives from the generated pack.
    nouns = [item for item in words if any(tag in item.get("tags", []) for tag in ("animal", "food", "home", "school", "nature", "travel")) and len(item["target"].split()) == 1]
    adjectives = [item for item in words if "adjective" in item.get("tags", []) and len(item["target"].split()) == 1]

    templates: list[tuple[str, str, list[str], int]] = []
    for item in nouns[:80]:
        templates.append((f"Սա {item['target']} է։", f"Questo / questa è {item['translation']}.", item.get("tags", []), 1))
    for item in nouns[:55]:
        templates.append((f"Ես տեսնում եմ {item['target']}։", f"Vedo {item['translation']}.", item.get("tags", []), 2))
    for item in [item for item in nouns if "food" in item.get("tags", [])][:40]:
        templates.append((f"Ես ուզում եմ {item['target']}։", f"Voglio {item['translation']}.", ["food"], 2))
    for item in [item for item in nouns if "home" in item.get("tags", []) or "school" in item.get("tags", [])][:35]:
        templates.append((f"Ես ունեմ {item['target']}։", f"Ho {item['translation']}.", item.get("tags", []), 2))
    for adjective in adjectives[:45]:
        templates.append((f"Սա {adjective['target']} է։", f"Questo è {adjective['translation']}.", ["adjective"], 2))
    fixed = [
        ("Ես այսօր տանն եմ։", "Oggi sono a casa.", ["home", "time"], 2),
        ("Մենք վաղը դպրոց ենք գնում։", "Domani andiamo a scuola.", ["school", "time"], 3),
        ("Նա գիրք է կարդում։", "Lui / lei legge un libro.", ["school", "verb"], 2),
        ("Երեխան ջուր է խմում։", "Il bambino beve acqua.", ["drink", "people"], 2),
        ("Ընտանիքը միասին է։", "La famiglia è insieme.", ["family"], 2),
        ("Դրսում արև է։", "Fuori c'è il sole.", ["nature", "weather"], 2),
        ("Այսօր ցուրտ է։", "Oggi fa freddo.", ["weather", "time"], 2),
        ("Այսօր տաք է։", "Oggi fa caldo.", ["weather", "time"], 2),
        ("Որտե՞ղ է դպրոցը։", "Dov'è la scuola?", ["school", "place"], 2),
        ("Ո՞վ է քո ընկերը։", "Chi è il tuo amico?", ["people"], 2),
        ("Ի՞նչ ես ուզում։", "Che cosa vuoi?", ["basic"], 2),
        ("Ես հայերեն եմ խոսում։", "Parlo armeno.", ["language", "verb"], 2)
    ]
    templates.extend(fixed)
    for index, (target, italian, tags, complexity) in enumerate(templates):
        store.setdefault(norm(target), sentence_item(target, italian, tags, "curated-a0-a2-draft", f"template:{index + 1}", complexity))
        if len(store) >= TARGET_SENTENCES:
            break
    rows = list(store.values())[:TARGET_SENTENCES]
    return rows


def update_tags(words: list[dict[str, Any]], sentences: list[dict[str, Any]]) -> None:
    existing_text = (PACK / "tags.yaml").read_text(encoding="utf-8")
    existing = set(re.findall(r'- id: "([^"]+)"', existing_text))
    all_tags = sorted({tag for item in [*words, *sentences] for tag in item.get("tags", [])})
    additions = [tag for tag in all_tags if tag not in existing]
    if not additions:
        return
    with (PACK / "tags.yaml").open("a", encoding="utf-8") as handle:
        for tag in additions:
            handle.write(f'  - id: "{tag}"\n    label: "{tag.replace("-", " ").replace("_", " ")}"\n    description: "Contenuto controllato: {tag}"\n')


def append_readings_to_story() -> None:
    story_path = PACK / "story.yaml"
    text = story_path.read_text(encoding="utf-8")
    if "chapter_04_a_day" in text:
        return
    text += '''\n  - id: "chapter_04_a_day"\n    minimum_level: 2\n    title:\n      it: "Lettura · una giornata"\n      en: "Reading · a day"\n    body:\n      it: "Հայերեն · Անիի օրը սկսվում է առավոտյան։ Նա նախաճաշում է, գնում է դպրոց, սովորում է և խաղում ընկերների հետ։ Երեկոյան նա վերադառնում է տուն ու գիրք է կարդում։\\n\\nItaliano · La giornata di Ani comincia al mattino. Fa colazione, va a scuola, studia e gioca con gli amici. La sera torna a casa e legge un libro."\n      en: "Armenian · Ani's day begins in the morning. She has breakfast, goes to school, studies and plays with friends. In the evening she returns home and reads a book."\n  - id: "chapter_05_friends"\n    minimum_level: 3\n    title:\n      it: "Lettura · due amici"\n      en: "Reading · two friends"\n    body:\n      it: "Հայերեն · Արամը և Դավիթը ընկերներ են։ Նրանք միասին դպրոց են գնում, ֆուտբոլ են խաղում և օգնում են իրար։ Մի օր նրանք այգում փոքրիկ կատու են գտնում և ջուր են տալիս նրան։\\n\\nItaliano · Aram e Davit sono amici. Vanno a scuola insieme, giocano a calcio e si aiutano. Un giorno trovano un piccolo gatto nel parco e gli danno dell'acqua."\n      en: "Aram and Davit are friends. They go to school together, play football and help each other. One day they find a small cat in the park and give it water."\n'''
    story_path.write_text(text, encoding="utf-8")


def main() -> None:
    words, review = build_words()
    sentences = build_sentences(words)
    letters = build_letters(words)
    write_jsonl(WORDS_PATH, words)
    write_jsonl(SENTENCES_PATH, sentences)
    write_jsonl(LETTERS_PATH, letters)
    update_tags(words, sentences)
    append_readings_to_story()
    report = [
        "# Eastern Armenian–Italian content review report",
        "",
        f"Generated words/phrases: **{len(words)}**",
        f"Generated sentence exercises: **{len(sentences)}**",
        f"Alphabet entries: **{len(letters)}**",
        "",
        "All newly generated or automatically matched entries remain `needs_native_speaker_review`. Existing human audio was preserved; no new synthetic gameplay audio was generated.",
        "",
        "## Items requiring attention",
        "",
        *review[:350],
        "",
        f"Additional automatic-sense checks omitted from this report: {max(0, len(review) - 350)}"
    ]
    REPORT_PATH.write_text("\n".join(report) + "\n", encoding="utf-8")
    print(f"Wrote {len(words)} words, {len(sentences)} sentences, {len(letters)} letters")


if __name__ == "__main__":
    main()
