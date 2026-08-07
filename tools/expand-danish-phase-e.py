#!/usr/bin/env python3
"""Deterministically expand the Danish foundations pack for Phase E."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "content-packs" / "da-foundations"
WORDS_PATH = PACK / "dictionary" / "words.jsonl"
READING_PATH = PACK / "curriculum" / "reading-problems.jsonl"
MATH_PATH = PACK / "curriculum" / "math-problems.jsonl"


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def write_jsonl(path: Path, entries: list[dict]) -> None:
    path.write_text("\n".join(json.dumps(entry, ensure_ascii=False, separators=(",", ":")) for entry in entries) + "\n", encoding="utf-8")


def browser_audio(identifier: str, text: str) -> list[dict]:
    return [{
        "id": f"tts-{identifier}",
        "url": "browser-tts:da-DK",
        "text": text,
        "source_type": "browser_tts",
        "provider": "system",
        "license": "device voice",
        "review_status": "draft",
    }]


def word_entry(stage: int, word: str, da: str, it: str, emoji: str, decodability: str = "regular") -> dict:
    return {
        "id": f"word_{word.replace('æ','ae').replace('ø','oe').replace('å','aa')}",
        "concept": word,
        "target": word,
        "translation": da,
        "translations": {"da": da, "it": it},
        "translation_review_status": {"it": "reviewed"},
        "emoji": emoji,
        "graphemes": list(word),
        "phonemes": list(word),
        "decodability": decodability,
        "tags": [f"stage:{stage}", "tier:core", "literacy:high-frequency" if decodability == "high_frequency" else "literacy:decodable", "topic:expanded-reading"],
        "audio": browser_audio(f"word-{word}", word),
        "review_status": "needs_native_speaker_review",
    }


NEW_WORDS = [
    (1, "som", "som", "come", "🔗", "high_frequency"),
    (1, "tom", "tom", "vuoto", "📭", "regular"),
    (1, "salt", "salt", "sale", "🧂", "regular"),
    (2, "arm", "en arm", "braccio", "💪", "regular"),
    (2, "orm", "en orm", "verme", "🪱", "regular"),
    (2, "film", "en film", "film", "🎬", "regular"),
    (2, "fint", "fint", "bene", "👍", "high_frequency"),
    (2, "fri", "fri", "libero", "🕊️", "regular"),
    (2, "ris", "ris", "riso", "🍚", "regular"),
    (2, "rem", "en rem", "cintura", "➰", "regular"),
    (2, "ram", "ram", "colpisci", "🎯", "regular"),
    (3, "rum", "et rum", "stanza", "🚪", "regular"),
    (3, "bur", "et bur", "gabbia", "🪤", "regular"),
    (3, "kam", "en kam", "pettine", "🪮", "regular"),
    (3, "sur", "sur", "arrabbiato", "😠", "regular"),
    (3, "ben", "et ben", "gamba", "🦵", "regular"),
    (4, "ham", "ham", "lui", "👦", "high_frequency"),
    (4, "hav", "et hav", "mare", "🌊", "regular"),
    (4, "hane", "en hane", "gallo", "🐓", "regular"),
    (4, "vase", "en vase", "vaso", "🏺", "regular"),
    (4, "vin", "vin", "vino", "🍇", "regular"),
    (4, "varm", "varm", "caldo", "🔥", "regular"),
    (5, "and", "en and", "anatra", "🦆", "regular"),
    (5, "bad", "et bad", "bagno", "🛁", "regular"),
    (5, "bed", "et bed", "aiuola", "🌷", "regular"),
    (5, "fod", "en fod", "piede", "🦶", "regular"),
    (5, "ild", "ild", "fuoco", "🔥", "regular"),
    (5, "leg", "leg", "gioco", "🧸", "regular"),
    (5, "vej", "en vej", "strada", "🛣️", "high_frequency"),
    (5, "seng", "en seng", "letto", "🛏️", "regular"),
    (5, "sag", "en sag", "sega", "🪚", "regular"),
    (5, "tog", "et tog", "treno", "🚆", "regular"),
    (6, "fly", "et fly", "aereo", "✈️", "regular"),
    (6, "sæl", "en sæl", "foca", "🦭", "regular"),
    (6, "hæl", "en hæl", "tallone", "🦶", "regular"),
    (6, "mælk", "mælk", "latte", "🥛", "high_frequency"),
    (6, "hø", "hø", "fieno", "🌾", "regular"),
    (6, "løve", "en løve", "leone", "🦁", "regular"),
    (6, "nøgle", "en nøgle", "chiave", "🔑", "regular"),
    (6, "sød", "sød", "dolce", "😊", "regular"),
    (7, "må", "må", "può/deve", "✅", "high_frequency"),
    (7, "få", "få", "ottenere", "🎁", "high_frequency"),
    (7, "lås", "en lås", "serratura", "🔒", "regular"),
    (7, "båd", "en båd", "barca", "⛵", "regular"),
    (7, "rå", "rå", "crudo", "🥕", "regular"),
    (7, "cola", "cola", "cola", "🥤", "regular"),
    (7, "citron", "en citron", "limone", "🍋", "regular"),
    (7, "mål", "et mål", "obiettivo", "🥅", "regular"),
    (7, "stå", "stå", "stare in piedi", "🧍", "high_frequency"),
    (8, "men", "men", "ma", "↔️", "high_frequency"),
    (8, "så", "så", "così/poi", "➡️", "high_frequency"),
    (8, "til", "til", "a/per", "➡️", "high_frequency"),
    (8, "fra", "fra", "da", "⬅️", "high_frequency"),
    (8, "kom", "kom", "vieni", "👋", "high_frequency"),
    (8, "se", "se", "guarda", "👀", "high_frequency"),
    (8, "nu", "nu", "adesso", "⏱️", "high_frequency"),
    (8, "ud", "ud", "fuori", "🚪➡️", "high_frequency"),
    (8, "ind", "ind", "dentro", "➡️🚪", "high_frequency"),
    (9, "dør", "en dør", "porta", "🚪", "high_frequency"),
    (9, "bord", "et bord", "tavolo", "🪑", "regular"),
    (9, "vindue", "et vindue", "finestra", "🪟", "regular"),
    (9, "taske", "en taske", "borsa", "🎒", "regular"),
    (9, "madpakke", "en madpakke", "pranzo al sacco", "🍱", "regular"),
    (9, "frikvarter", "et frikvarter", "intervallo", "🛝", "regular"),
    (10, "banan", "en banan", "banana", "🍌", "regular"),
    (10, "tomat", "en tomat", "pomodoro", "🍅", "regular"),
    (10, "elefant", "en elefant", "elefante", "🐘", "regular"),
    (10, "telefon", "en telefon", "telefono", "📱", "regular"),
    (10, "computer", "en computer", "computer", "💻", "high_frequency"),
    (10, "regnbue", "en regnbue", "arcobaleno", "🌈", "regular"),
    (10, "fodbold", "fodbold", "calcio", "⚽", "regular"),
    (11, "legeplads", "en legeplads", "parco giochi", "🛝", "regular"),
    (11, "bibliotek", "et bibliotek", "biblioteca", "📚", "regular"),
    (11, "matematik", "matematik", "matematica", "➗", "regular"),
    (11, "klassekammerat", "en klassekammerat", "compagno di classe", "🧒", "regular"),
    (12, "opgave", "en opgave", "esercizio", "📝", "high_frequency"),
    (12, "regnestykke", "et regnestykke", "calcolo", "➕", "regular"),
    (12, "læsebog", "en læsebog", "libro di lettura", "📖", "regular"),
    (12, "skrivebog", "en skrivebog", "quaderno", "📓", "regular"),
    (13, "prinsesse", "en prinsesse", "principessa", "👸", "regular"),
    (13, "troldmand", "en troldmand", "mago", "🧙", "regular"),
    (13, "rumskib", "et rumskib", "astronave", "🚀", "regular"),
    (13, "dinosaur", "en dinosaur", "dinosauro", "🦕", "regular"),
]


def reading_problem(identifier: str, domain: str, stage: int, text: str, answer: str, options: list[str], image: str, instruction_id: str, prompt_da: str | None = None) -> dict:
    prompt = prompt_da or {
        "initial_sound": "Hvilket bogstav hører du først?",
        "final_sound": "Hvilket bogstav hører du til sidst?",
        "rhyme": "Hvilket ord rimer?",
        "syllable_count": "Hvor mange stavelser hører du?",
    }.get(domain, "Læs og vælg det rigtige svar.")
    return {
        "id": identifier,
        "domain": domain,
        "text": text,
        "prompt": {"da": prompt, "it": prompt},
        "answer": answer,
        "options": options,
        "image": image,
        "words": None,
        "audio": browser_audio(f"reading-{identifier}", text),
        "prompt_audio": [],
        "instruction_id": instruction_id,
        "tags": [f"stage:{stage}", "tier:core", f"reading:{domain}"],
        "review_status": "needs_native_speaker_review",
    }


INITIAL = [
    (0, "sol", "s", ["s", "m", "l", "a"], "☀️"), (0, "lam", "l", ["l", "s", "m", "o"], "🐑"),
    (0, "mus", "m", ["m", "s", "l", "a"], "🐭"), (0, "ost", "o", ["o", "a", "s", "m"], "🧀"),
    (0, "abe", "a", ["a", "o", "m", "s"], "🐒"), (1, "is", "i", ["i", "a", "o", "s"], "🍦"),
    (1, "nat", "n", ["n", "m", "t", "l"], "🌙"), (1, "tal", "t", ["t", "n", "l", "s"], "🔢"),
    (2, "far", "f", ["f", "r", "m", "t"], "👨"), (2, "ren", "r", ["r", "f", "n", "l"], "✨"),
    (3, "bil", "b", ["b", "k", "m", "p"], "🚗"), (3, "kat", "k", ["k", "b", "t", "h"], "🐱"),
    (4, "hus", "h", ["h", "p", "v", "s"], "🏠"), (4, "pil", "p", ["p", "h", "v", "l"], "➡️"),
    (4, "ven", "v", ["v", "h", "p", "f"], "🧒"), (5, "dag", "d", ["d", "g", "j", "t"], "🌞"),
    (5, "ged", "g", ["g", "d", "j", "k"], "🐐"), (5, "jeg", "j", ["j", "g", "d", "i"], "🙋"),
    (6, "lys", "l", ["l", "y", "s", "r"], "💡"), (6, "æg", "æ", ["æ", "ø", "y", "a"], "🥚"),
]

FINAL = [
    (1, "sol", "l", ["l", "s", "m", "t"], "☀️"), (1, "lam", "m", ["m", "l", "s", "n"], "🐑"),
    (1, "mus", "s", ["s", "m", "l", "t"], "🐭"), (1, "is", "s", ["s", "i", "n", "t"], "🍦"),
    (1, "nat", "t", ["t", "n", "s", "l"], "🌙"), (2, "far", "r", ["r", "f", "n", "m"], "👨"),
    (2, "fem", "m", ["m", "f", "r", "n"], "5️⃣"), (3, "bil", "l", ["l", "b", "t", "s"], "🚗"),
    (3, "kat", "t", ["t", "k", "l", "s"], "🐱"), (4, "hus", "s", ["s", "h", "m", "t"], "🏠"),
    (4, "pil", "l", ["l", "p", "s", "n"], "➡️"), (4, "ven", "n", ["n", "v", "m", "l"], "🧒"),
    (4, "hat", "t", ["t", "h", "s", "m"], "🎩"), (4, "hop", "p", ["p", "h", "t", "s"], "🦘"),
    (3, "buk", "k", ["k", "b", "t", "s"], "🐐"), (3, "tak", "k", ["k", "t", "s", "l"], "🙏"),
]

RHYME = [
    (3, "mus", "🏠 hus", ["🏠 hus", "🐱 kat", "🚗 bil"], "🐭"),
    (4, "kat", "🎩 hat", ["🎩 hat", "🏠 hus", "☀️ sol"], "🐱"),
    (4, "bil", "➡️ pil", ["➡️ pil", "🐭 mus", "🌙 nat"], "🚗"),
    (4, "nat", "🐱 kat", ["🐱 kat", "🏠 hus", "🧀 ost"], "🌙"),
    (5, "bog", "🚆 tog", ["🚆 tog", "🛏️ seng", "🐐 ged"], "📖"),
    (7, "gå", "🎁 få", ["🎁 få", "🌊 hav", "🐭 mus"], "🚶"),
    (7, "bål", "🥅 mål", ["🥅 mål", "🚪 dør", "🍋 citron"], "🔥"),
    (6, "sø", "🐸 frø", ["🐸 frø", "🦁 løve", "🛏️ seng"], "🌊"),
    (7, "hår", "📅 år", ["📅 år", "🏠 hus", "🚗 bil"], "💇"),
    (5, "dag", "🪚 sag", ["🪚 sag", "🚆 tog", "🦆 and"], "🌞"),
    (5, "mad", "😀 glad", ["😀 glad", "🛏️ seng", "🐭 mus"], "🍽️"),
    (6, "rød", "😊 sød", ["😊 sød", "🌳 grøn", "💙 blå"], "🔴"),
    (7, "blå", "🧍 stå", ["🧍 stå", "🚪 dør", "🦁 løve"], "🔵"),
]

SYLLABLES = [
    (2, "abe", "2", ["1", "2", "3"], "🐒"), (6, "ymer", "2", ["1", "2", "3"], "🥣"),
    (7, "cykel", "2", ["1", "2", "3"], "🚲"), (10, "pige", "2", ["1", "2", "3"], "👧"),
    (10, "robot", "2", ["1", "2", "3"], "🤖"), (10, "kanin", "2", ["1", "2", "3"], "🐇"),
    (10, "æble", "2", ["1", "2", "3"], "🍎"), (10, "sommer", "2", ["1", "2", "3"], "☀️"),
    (10, "elefant", "3", ["1", "2", "3"], "🐘"), (10, "telefon", "3", ["1", "2", "3"], "📱"),
    (9, "madpakke", "3", ["1", "2", "3"], "🍱"), (13, "eventyr", "3", ["2", "3", "4"], "🏰"),
    (11, "bibliotek", "4", ["2", "3", "4"], "📚"), (11, "matematik", "4", ["2", "3", "4"], "➗"),
    (11, "familie", "4", ["2", "3", "4"], "👨‍👩‍👧"), (13, "skattekiste", "4", ["2", "3", "4"], "🧰"),
]

MINI_STORIES = [
    (9, "Mia har en rød hat. Hun går ud i solen.", "Hvilken farve har hatten?", "Rød", ["Rød", "Blå", "Grøn"], "👧🎩☀️"),
    (9, "Noah har en bog. Han læser i sin seng.", "Hvor læser Noah?", "I sengen", ["I sengen", "I bussen", "I skoven"], "👦📖🛏️"),
    (9, "En kat sidder ved døren. Katten vil ind.", "Hvor sidder katten?", "Ved døren", ["Ved døren", "På bordet", "I bilen"], "🐱🚪"),
    (10, "Ida har en gul taske. I tasken ligger en madpakke.", "Hvad ligger i tasken?", "En madpakke", ["En madpakke", "En bold", "En kat"], "👧🎒🍱"),
    (10, "Ali ser en regnbue. Den har mange farver.", "Hvad ser Ali?", "En regnbue", ["En regnbue", "Et tog", "En computer"], "🧒🌈"),
    (10, "En elefant står ved et træ. Den spiser et grønt blad.", "Hvad spiser elefanten?", "Et blad", ["Et blad", "En is", "En bog"], "🐘🌳🍃"),
    (11, "Sofia går på legepladsen. Hun leger med sin ven. De gynger sammen.", "Hvem leger Sofia med?", "Sin ven", ["Sin ven", "Sin lærer", "En robot"], "👧🧒🛝"),
    (11, "Omar går på biblioteket. Han finder en bog om dinosaurer.", "Hvad handler bogen om?", "Dinosaurer", ["Dinosaurer", "Biler", "Mad"], "🧒📚🦕"),
    (11, "Det er vinter. Lea tager hue og vanter på. Så går hun ud.", "Hvad tager Lea på?", "Hue og vanter", ["Hue og vanter", "Badetøj", "En kjole"], "❄️🧤"),
    (12, "Læreren skriver et regnestykke. Emil finder svaret og skriver det i sin bog.", "Hvor skriver Emil svaret?", "I sin bog", ["I sin bog", "På døren", "På sin taske"], "🧑‍🏫➕📓"),
    (12, "Aya har en læsebog og en skrivebog. Hun læser først og skriver bagefter.", "Hvad gør Aya først?", "Hun læser", ["Hun læser", "Hun løber", "Hun sover"], "👧📖📓"),
    (12, "Klassen har frikvarter. Børnene spiller fodbold på legepladsen.", "Hvad spiller børnene?", "Fodbold", ["Fodbold", "Kort", "Musik"], "🧒⚽🛝"),
    (13, "En prinsesse finder en nøgle i skoven. Nøglen åbner en gammel kiste.", "Hvad åbner nøglen?", "En kiste", ["En kiste", "Et vindue", "En bog"], "👸🔑🧰"),
    (13, "Et rumskib lander ved skolen. En lille robot kommer ud og siger hej.", "Hvem kommer ud af rumskibet?", "En robot", ["En robot", "En løve", "En lærer"], "🚀🤖🏫"),
    (13, "En troldmand har tre stjerner. Han giver én stjerne til dragen.", "Hvor mange stjerner har troldmanden tilbage?", "To", ["En", "To", "Tre"], "🧙⭐⭐⭐🐉"),
    (13, "Dinosauren er stor, men musen er lille. De går sammen til søen.", "Hvem er lille?", "Musen", ["Musen", "Dinosauren", "Løven"], "🦕🐭🌊"),
]


def awareness_problem(identifier: str, domain: str, stage: int, prompt: str, answer: str, options: list[str], visual: str, sequence: list[str] | None, instruction_id: str) -> dict:
    return {
        "id": identifier,
        "domain": domain,
        "prompt": {"da": prompt, "it": prompt},
        "operands": [],
        "result": 0,
        "number_range": {"min": 0, "max": 20},
        "representation": "objects",
        "object": visual,
        "answer": answer,
        "options": options,
        "sequence": sequence,
        "instruction_id": instruction_id,
        "audio": browser_audio(f"math-{identifier}", prompt),
        "tags": [f"stage:{stage}", "tier:core", f"math:{domain}"],
        "review_status": "approved",
    }


SHAPES = [
    (0, "Hvilken figur er rund?", "⚪", ["⚪", "🔺", "🟦"], "?"),
    (0, "Hvilken figur har tre sider?", "🔺", ["🔺", "⚪", "🟦"], "3"),
    (1, "Hvilken figur har fire lige lange sider?", "🟦", ["🟦", "🔺", "⚪"], "4"),
    (1, "Find cirklen.", "⚪", ["⚪", "🔺", "🟦"], "?"),
    (2, "Find trekanten.", "🔺", ["🔺", "🟦", "⚪"], "?"),
    (2, "Find firkanten.", "🟦", ["🟦", "⚪", "🔺"], "?"),
    (3, "Hvilken figur har ingen hjørner?", "⚪", ["⚪", "🔺", "🟦"], "0"),
    (3, "Hvilken figur har tre hjørner?", "🔺", ["🔺", "⚪", "🟦"], "3"),
    (4, "Hvilken figur ligner en dør?", "▭", ["▭", "⚪", "🔺"], "🚪"),
    (4, "Hvilken figur ligner et hjul?", "⚪", ["⚪", "▭", "🔺"], "🛞"),
    (5, "Hvilken figur har fire hjørner og er længere end den er høj?", "▭", ["▭", "🟦", "⚪"], "4"),
    (5, "Hvilken figur har fire lige lange sider?", "🟦", ["🟦", "▭", "🔺"], "4"),
]

PATTERNS = [
    (0, ["🔴", "🔵", "🔴", "🔵", "?"], "🔴", ["🔴", "🔵", "🟢"]),
    (0, ["⭐", "🌙", "⭐", "🌙", "?"], "⭐", ["⭐", "🌙", "☀️"]),
    (1, ["🍎", "🍎", "🍌", "🍎", "🍎", "?"], "🍌", ["🍌", "🍎", "🍐"]),
    (1, ["🔺", "⚪", "🔺", "⚪", "?"], "🔺", ["🔺", "⚪", "🟦"]),
    (2, ["1", "2", "1", "2", "?"], "1", ["1", "2", "3"]),
    (2, ["🐱", "🐶", "🐶", "🐱", "🐶", "🐶", "?"], "🐱", ["🐱", "🐶", "🐭"]),
    (3, ["🟥", "🟨", "🟩", "🟥", "🟨", "?"], "🟩", ["🟥", "🟨", "🟩"]),
    (3, ["2", "4", "2", "4", "?"], "2", ["2", "3", "4"]),
    (4, ["⬆️", "➡️", "⬇️", "⬆️", "➡️", "?"], "⬇️", ["⬆️", "➡️", "⬇️"]),
    (4, ["🌲", "🌲", "🌸", "🌲", "🌲", "?"], "🌸", ["🌲", "🌸", "🍄"]),
    (5, ["1", "3", "5", "?"], "7", ["6", "7", "8"]),
    (5, ["10", "8", "6", "?"], "4", ["2", "4", "5"]),
    (6, ["A", "B", "C", "A", "B", "?"], "C", ["A", "B", "C"]),
    (7, ["⚪", "⚪", "🔺", "⚪", "⚪", "?"], "🔺", ["⚪", "🔺", "🟦"]),
    (8, ["3", "6", "3", "6", "?"], "3", ["3", "6", "9"]),
    (9, ["🟢", "🟡", "🟡", "🟢", "🟡", "🟡", "?"], "🟢", ["🟢", "🟡", "🔵"]),
]

SORTING = [
    (1, "Hvilken ting hører ikke til?", "🚗", ["🍎", "🍌", "🚗"], ["🍎", "🍌", "🚗"]),
    (2, "Hvilken ting hører ikke til?", "📘", ["🐱", "🐶", "📘"], ["🐱", "🐶", "📘"]),
    (3, "Hvilken ting hører ikke til?", "🔺", ["🍓", "🍎", "🔺"], ["🍓", "🍎", "🔺"]),
    (3, "Hvilken ting hører ikke til?", "🐟", ["🚗", "🚌", "🐟"], ["🚗", "🚌", "🐟"]),
    (4, "Hvilken ting hører ikke til?", "☀️", ["🔺", "🟦", "☀️"], ["🔺", "🟦", "☀️"]),
    (5, "Hvilken ting hører ikke til?", "🥕", ["✏️", "📘", "🥕"], ["✏️", "📘", "🥕"]),
    (6, "Hvilken ting hører ikke til?", "🚲", ["🦁", "🐘", "🚲"], ["🦁", "🐘", "🚲"]),
    (7, "Hvilken ting hører ikke til?", "🧤", ["🍋", "🍊", "🧤"], ["🍋", "🍊", "🧤"]),
    (8, "Hvilken ting hører ikke til?", "🐭", ["🏠", "🏫", "🐭"], ["🏠", "🏫", "🐭"]),
    (9, "Hvilken ting hører ikke til?", "📱", ["⚽", "🏀", "📱"], ["⚽", "🏀", "📱"]),
]

MEASUREMENT = [
    (1, "Hvilken streg er længst?", "━━━━━━", ["━━", "━━━━", "━━━━━━"], "📏"),
    (1, "Hvilken streg er kortest?", "━━", ["━━", "━━━━", "━━━━━━"], "📏"),
    (2, "Hvilken cirkel er størst?", "🔵", ["🔹", "🔵", "•"], "👀"),
    (2, "Hvilken cirkel er mindst?", "•", ["•", "🔹", "🔵"], "👀"),
    (3, "Hvilket tårn er højest?", "🧱🧱🧱🧱", ["🧱🧱", "🧱🧱🧱", "🧱🧱🧱🧱"], "🏗️"),
    (3, "Hvilket tårn er lavest?", "🧱", ["🧱", "🧱🧱", "🧱🧱🧱"], "🏗️"),
    (4, "Hvilket dyr er størst?", "🐘", ["🐭", "🐶", "🐘"], "👀"),
    (4, "Hvilket dyr er mindst?", "🐭", ["🐭", "🐶", "🐘"], "👀"),
    (5, "Hvilken række er længst?", "⭐⭐⭐⭐⭐", ["⭐⭐", "⭐⭐⭐", "⭐⭐⭐⭐⭐"], "📏"),
    (6, "Hvilken række er kortest?", "●●", ["●●", "●●●●", "●●●●●●"], "📏"),
    (7, "Hvilket reb er længst?", "➖➖➖➖", ["➖➖", "➖➖➖", "➖➖➖➖"], "🪢"),
    (8, "Hvilken bog er tykkest?", "📕📕📕", ["📕", "📕📕", "📕📕📕"], "📚"),
]


def main() -> None:
    words = read_jsonl(WORDS_PATH)
    ids = {entry["id"] for entry in words}
    targets = {entry["target"] for entry in words}
    for stage, word, da, it, emoji, decodability in NEW_WORDS:
        entry = word_entry(stage, word, da, it, emoji, decodability)
        if entry["id"] not in ids and word not in targets:
            words.append(entry)
            ids.add(entry["id"])
            targets.add(word)
    words.sort(key=lambda entry: (next((int(tag[6:]) for tag in entry.get("tags", []) if tag.startswith("stage:")), 0), entry["target"]))
    write_jsonl(WORDS_PATH, words)

    reading = read_jsonl(READING_PATH)
    instruction_by_domain = {
        "sentence_picture": "instruction_sentence_picture",
        "sentence_order": "instruction_sentence_order",
        "missing_letter": "instruction_missing_letter",
        "missing_word": "instruction_missing_word",
        "mini_story": "instruction_read_story",
        "initial_sound": "instruction_letter_initial",
        "final_sound": "instruction_letter_final",
        "rhyme": "instruction_rhyme",
        "syllable_count": "instruction_syllables",
    }
    for entry in reading:
        entry.setdefault("instruction_id", instruction_by_domain.get(entry.get("domain")))
        if entry.get("domain") == "mini_story" and not entry.get("prompt_audio"):
            question = str(entry.get("prompt", {}).get("da", "Læs og svar."))
            entry["prompt_audio"] = browser_audio(f"reading-prompt-{entry['id']}", question)
        else:
            entry.setdefault("prompt_audio", [])
    existing = {entry["id"] for entry in reading}
    additions: list[dict] = []
    for idx, (stage, text, answer, options, image) in enumerate(INITIAL):
        additions.append(reading_problem(f"phon_initial_{idx}", "initial_sound", stage, text, answer, options, image, "instruction_letter_initial"))
    for idx, (stage, text, answer, options, image) in enumerate(FINAL):
        additions.append(reading_problem(f"phon_final_{idx}", "final_sound", stage, text, answer, options, image, "instruction_letter_final"))
    for idx, (stage, text, answer, options, image) in enumerate(RHYME):
        additions.append(reading_problem(f"phon_rhyme_{idx}", "rhyme", stage, text, answer, options, image, "instruction_rhyme"))
    for idx, (stage, text, answer, options, image) in enumerate(SYLLABLES):
        additions.append(reading_problem(f"phon_syllables_{idx}", "syllable_count", stage, text, answer, options, image, "instruction_syllables"))
    for idx, (stage, text, question, answer, options, image) in enumerate(MINI_STORIES):
        identifier = f"mini_story_phase_e_{idx}"
        additions.append({
            "id": identifier,
            "domain": "mini_story",
            "text": text,
            "prompt": {"da": question, "it": question},
            "answer": answer,
            "options": options,
            "image": image,
            "words": None,
            "audio": browser_audio(f"reading-{identifier}", text),
            "prompt_audio": browser_audio(f"reading-prompt-{identifier}", question),
            "instruction_id": "instruction_read_story",
            "tags": [f"stage:{stage}", "tier:core", "reading:mini_story"],
            "review_status": "needs_native_speaker_review",
        })
    reading.extend(entry for entry in additions if entry["id"] not in existing)
    reading.sort(key=lambda entry: (next((int(tag[6:]) for tag in entry.get("tags", []) if tag.startswith("stage:")), 0), entry["id"]))
    write_jsonl(READING_PATH, reading)

    math = read_jsonl(MATH_PATH)
    existing_math = {entry["id"] for entry in math}
    math_additions: list[dict] = []
    for idx, (stage, prompt, answer, options, visual) in enumerate(SHAPES):
        math_additions.append(awareness_problem(f"shape_phase_e_{idx}", "shape", stage, prompt, answer, options, visual, None, "instruction_shape"))
    for idx, (stage, sequence, answer, options) in enumerate(PATTERNS):
        math_additions.append(awareness_problem(f"pattern_phase_e_{idx}", "pattern", stage, "Hvad kommer som det næste?", answer, options, "🧩", sequence, "instruction_pattern"))
    for idx, (stage, prompt, answer, options, sequence) in enumerate(SORTING):
        math_additions.append(awareness_problem(f"sorting_phase_e_{idx}", "sorting", stage, prompt, answer, options, "  ".join(sequence), sequence, "instruction_sorting"))
    for idx, (stage, prompt, answer, options, visual) in enumerate(MEASUREMENT):
        math_additions.append(awareness_problem(f"measurement_phase_e_{idx}", "measurement", stage, prompt, answer, options, visual, None, "instruction_measurement"))
    math.extend(entry for entry in math_additions if entry["id"] not in existing_math)
    math.sort(key=lambda entry: (next((int(tag[6:]) for tag in entry.get("tags", []) if tag.startswith("stage:")), 0), entry["id"]))
    write_jsonl(MATH_PATH, math)

    print(f"Phase E content: {len(words)} words, {len(reading)} reading tasks, {len(math)} math tasks.")


if __name__ == "__main__":
    main()
