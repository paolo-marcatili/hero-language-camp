#!/usr/bin/env python3
"""Restructure the Armenian/Italian pack around a staged, tag-driven curriculum.

The source dictionary remains broad, but normal training uses tier:core items introduced
through stage:0..stage:8. All other material remains available as tier:extension.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "content-packs" / "hy-eastern-it"
DICT = PACK / "dictionary"
CURATED_DISTRACTORS_PATH = DICT / "core-translation-distractors.it.json"


class IndentDumper(yaml.SafeDumper):
    def increase_indent(self, flow: bool = False, indentless: bool = False):
        return super().increase_indent(flow, False)


def represent_curriculum_string(dumper: yaml.SafeDumper, data: str):
    style = "'" if ":" in data else None
    return dumper.represent_scalar("tag:yaml.org,2002:str", data, style=style)


IndentDumper.add_representer(str, represent_curriculum_string)


def dump_simple_yaml(value: Any) -> str:
    return yaml.dump(value, Dumper=IndentDumper, allow_unicode=True, sort_keys=False,
                     default_flow_style=False, width=100000, indent=2)


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def save_jsonl(path: Path, records: list[dict[str, Any]]) -> None:
    path.write_text("\n".join(json.dumps(item, ensure_ascii=False, separators=(",", ":")) for item in records) + "\n", encoding="utf-8")


def slug_tag(value: str) -> str:
    value = value.strip().lower().replace("_", "-").replace(" ", "-")
    value = re.sub(r"[^a-z0-9-]+", "", value)
    return value or "general"

TOPIC_MAP = {
    "animal": "animals", "animals": "animals", "people_animals": "animals",
    "basic": "essentials", "body": "body", "color": "colors", "colors": "colors",
    "drink": "food-drink", "food": "food-drink", "family": "family",
    "feeling": "feelings", "greeting": "greetings", "greetings": "greetings",
    "home": "home", "nature": "nature", "number": "numbers", "people": "people",
    "place": "places", "places": "places", "politeness": "politeness",
    "pronoun": "pronouns", "pronouns": "pronouns", "school": "school",
    "sentence_order": "sentences", "time": "time", "verb": "actions", "verbs": "actions",
    "holiday": "holidays", "travel": "travel", "weather": "weather", "letter": "letters",
    "adjective": "descriptions", "adjectives": "descriptions", "clothes": "clothes",
    "countries": "countries", "introductions": "introductions", "language": "language",
    "time_body": "body", "community": "community",
}


def base_topic_tags(item: dict[str, Any]) -> list[str]:
    topics: list[str] = []
    for raw in item.get("tags", []):
        raw_text = str(raw).strip()
        if raw_text.startswith(("stage:", "tier:", "function:", "grammar:")):
            continue
        if raw_text.startswith("topic:"):
            raw_text = raw_text.split(":", 1)[1]
        topic = TOPIC_MAP.get(raw_text, slug_tag(raw_text))
        tag = f"topic:{topic}"
        if tag not in topics and topic != "community":
            topics.append(tag)
    return topics[:3] or ["topic:essentials"]

# Each stage intentionally contains a compact, high-frequency active vocabulary.
CORE_WORDS: dict[int, list[str]] = {
    0: [
        "hy_barev", "hy_ayo", "hy_voch", "hy_jur", "hy_hats", "hy_kat", "hy_khndzor",
        "hy_mayrik", "hy_hayrik", "hy_shun", "hy_katu", "hy_tun", "hy_girq", "hy_lav", "hy_shnorhakalutyun",
    ],
    1: [
        "hy_exp_name_33d3ce", "hy_im", "hy_qo", "hy_exp_du_9be5fe", "hy_sa", "hy_ynker", "hy_yerekha",
        "hy_urakh", "hy_tkhur", "hy_mets", "hy_poqr", "hy_aystegh", "hy_exp_hayeren_19a472", "hy_exp_italeren_8dd19c",
    ],
    2: [
        "hy_exp_yntanik_a20b73", "hy_exp_mother_f167ef", "hy_exp_father_819c42", "hy_kuyr", "hy_yeghbayr",
        "hy_tatik", "hy_papik", "hy_exp_menk_6b880c", "hy_exp_nrank_379ace", "hy_achq", "hy_dzerq", "hy_qit",
    ],
    3: [
        "hy_brindz", "hy_mis", "hy_dzuk", "hy_utel", "hy_khmel", "hy_exp_banan_7f362e", "hy_exp_paniro", "hy_exp_tea",
    ],
    4: ["hy_gnal", "hy_gal", "hy_kardal", "hy_grel", "hy_khaghal", "hy_dprots", "hy_exp_sovorel_01bf1c", "hy_exp_play_f9568e"],
    5: ["hy_exp_store_1da4d8", "hy_exp_street_29ec1f", "hy_aystegh", "hy_tun", "hy_dprots", "hy_tsar"],
    6: ["hy_mek", "hy_yerku", "hy_yerek", "hy_aysor", "hy_vaghy", "hy_arev", "hy_andzrev"],
    7: ["hy_exp_menk_6b880c", "hy_exp_nrank_379ace", "hy_exp_du_unes_e6e546", "hy_exp_menk_unenk_7b78d9", "hy_exp_nrank_unen_d07f45"],
    8: ["hy_exp_hayeren_19a472", "hy_exp_italeren_8dd19c", "hy_exp_hay_5fecb5", "hy_exp_tongue_f906d3"],
}

# Optional IDs are ignored if a source import does not contain them.
NEW_WORDS = [
    {"id":"hy_yes","concept":"I","target":"ես","transliteration":"yes","translation":"io","emoji":"🙋","tags":["stage:1","tier:core","topic:pronouns","function:self-introduction"]},
    {"id":"hy_na","concept":"he_she","target":"նա","transliteration":"na","translation":"lui / lei","emoji":"🧒","tags":["stage:1","tier:core","topic:pronouns","grammar:copula-present"]},
    {"id":"hy_khndrem","concept":"please","target":"խնդրում եմ","transliteration":"khndrum em","translation":"per favore","emoji":"🙏","tags":["stage:3","tier:core","topic:politeness","function:request"]},
    {"id":"hy_uzel","concept":"want","target":"ուզել","transliteration":"uzel","translation":"volere","emoji":"💭","tags":["stage:3","tier:core","topic:actions","grammar:present-tense"]},
    {"id":"hy_sovats","concept":"hungry","target":"սոված","transliteration":"sovats","translation":"affamato / affamata","emoji":"🍽️","tags":["stage:3","tier:core","topic:feelings","function:needs"]},
    {"id":"hy_tsarav","concept":"thirsty","target":"ծարավ","transliteration":"tsarav","translation":"assetato / assetata","emoji":"🥤","tags":["stage:3","tier:core","topic:feelings","function:needs"]},
    {"id":"hy_haskanal","concept":"understand","target":"հասկանալ","transliteration":"haskanal","translation":"capire","emoji":"💡","tags":["stage:4","tier:core","topic:actions","function:classroom"]},
    {"id":"hy_krknel","concept":"repeat","target":"կրկնել","transliteration":"krknel","translation":"ripetere","emoji":"🔁","tags":["stage:4","tier:core","topic:actions","function:classroom"]},
    {"id":"hy_aygi","concept":"park","target":"այգի","transliteration":"aygi","translation":"parco / giardino","emoji":"🌳","tags":["stage:5","tier:core","topic:places"]},
    {"id":"hy_ayntegh","concept":"there","target":"այնտեղ","transliteration":"ayntegh","translation":"lì / là","emoji":"👉","tags":["stage:5","tier:core","topic:places","grammar:location"]},
    {"id":"hy_tey","concept":"tea","target":"թեյ","transliteration":"tey","translation":"tè","emoji":"🍵","tags":["stage:3","tier:core","topic:food-drink"]},
]

CORE_WORD_TRANSLATIONS = {
    "hy_ayo": "sì",
    "hy_hayrik": "papà",
    "hy_lav": "buono / bene",
    "hy_sa": "questo / questa",
    "hy_ynker": "amico / amica",
    "hy_yerekha": "bambino / bambina",
    "hy_im": "mio / mia",
    "hy_qo": "tuo / tua",
    "hy_tey": "tè",
    "hy_ayntegh": "lì / là",
    "hy_exp_play_f9568e": "gioco",
    "hy_exp_hay_5fecb5": "armeno / armena",
}

SENTENCE_STAGES: dict[int, list[str]] = {
    0: [],
    1: ["hy_sentence_this_is_mom", "hy_sentence_this_is_dad", "hy_sentence_this_is_dog", "hy_sentence_this_is_cat", "hy_sentence_this_is_apple", "hy_sentence_this_is_house", "hy_sentence_exp_fa35916e0d36", "hy_sentence_exp_d24a71eb2b31", "hy_sentence_friend_here"],
    2: ["hy_sentence_sister_sings", "hy_sentence_brother_plays", "hy_sentence_grandma_home", "hy_sentence_exp_27581bae2b7c", "hy_sentence_exp_b4fab2f8b516"],
    3: ["hy_sentence_i_want_water", "hy_sentence_i_want_bread", "hy_sentence_i_want_milk", "hy_sentence_i_want_tea", "hy_sentence_exp_942b00e362be"],
    4: ["hy_sentence_i_go_school", "hy_sentence_i_read_book", "hy_sentence_dad_eats_bread", "hy_sentence_exp_9dcc6010c3b9"],
    5: ["hy_sentence_school_near", "hy_sentence_exp_f9398a9ba2fe", "hy_sentence_exp_722d4834fa38"],
    6: ["hy_sentence_today_rain", "hy_sentence_tomorrow_school", "hy_sentence_two_dogs", "hy_sentence_three_apples", "hy_sentence_exp_baf218e40b59", "hy_sentence_exp_32247e450852", "hy_sentence_exp_82c11e5068f5"],
    7: [],
    8: [],
}

NEW_SENTENCES = [
    ("hy_sentence_hello", "Բարև։", "Ciao!", 0, ["topic:greetings", "function:greeting"], ["Ցտեսություն։", "Շնորհակալություն։", "Ոչ։"]),
    ("hy_sentence_yes", "Այո։", "Sì.", 0, ["topic:essentials", "function:confirmation"], ["Ոչ։", "Բարև։", "Լավ։"]),
    ("hy_sentence_no", "Ոչ։", "No.", 0, ["topic:essentials", "function:confirmation"], ["Այո։", "Բարև։", "Լավ։"]),
    ("hy_sentence_thank_you", "Շնորհակալություն։", "Grazie.", 0, ["topic:politeness", "function:politeness"], ["Բարև։", "Խնդրում եմ։", "Այո։"]),
    ("hy_sentence_i_am_ani", "Ես Անի եմ։", "Sono Ani.", 1, ["topic:introductions", "grammar:copula-present", "function:self-introduction"], ["Դու Անի ես։", "Նա Անի է։", "Ես Արամ եմ։"]),
    ("hy_sentence_how_are_you", "Ինչպե՞ս ես։", "Come stai?", 1, ["topic:greetings", "grammar:copula-present", "function:greeting"], ["Ո՞վ ես։", "Որտե՞ղ ես։", "Ի՞նչ ես ուզում։"]),
    ("hy_sentence_i_am_well", "Լավ եմ։", "Sto bene.", 1, ["topic:feelings", "grammar:copula-present", "function:greeting"], ["Տխուր եմ։", "Սոված եմ։", "Ծարավ եմ։"]),
    ("hy_sentence_this_is_my_mother", "Սա իմ մայրն է։", "Questa è mia madre.", 2, ["topic:family", "grammar:possession", "function:introduction"], ["Սա իմ հայրն է։", "Սա քո մայրն է։", "Նա իմ մայրն է։"]),
    ("hy_sentence_this_is_my_father", "Սա իմ հայրն է։", "Questo è mio padre.", 2, ["topic:family", "grammar:possession", "function:introduction"], ["Սա իմ մայրն է։", "Սա քո հայրն է։", "Նա իմ հայրն է։"]),
    ("hy_sentence_i_am_hungry", "Ես սոված եմ։", "Ho fame.", 3, ["topic:food-drink", "grammar:copula-present", "function:needs"], ["Ես ծարավ եմ։", "Ես ուրախ եմ։", "Ես ջուր եմ ուզում։"]),
    ("hy_sentence_i_am_thirsty", "Ես ծարավ եմ։", "Ho sete.", 3, ["topic:food-drink", "grammar:copula-present", "function:needs"], ["Ես սոված եմ։", "Ես ուրախ եմ։", "Ես ջուր եմ ուզում։"]),
    ("hy_sentence_please", "Խնդրում եմ։", "Per favore.", 3, ["topic:politeness", "function:request"], ["Շնորհակալություն։", "Բարև։", "Ոչ։"]),
    ("hy_sentence_i_do_not_understand", "Չեմ հասկանում։", "Non capisco.", 4, ["topic:language", "grammar:negation", "function:classroom"], ["Հասկանում եմ։", "Չեմ կարդում։", "Չեմ գրում։"]),
    ("hy_sentence_repeat_please", "Կրկնիր, խնդրում եմ։", "Ripeti, per favore.", 4, ["topic:language", "grammar:imperative", "function:classroom"], ["Կարդա, խնդրում եմ։", "Գրի՛ր, խնդրում եմ։", "Լսիր, խնդրում եմ։"]),
    ("hy_sentence_where_is_school", "Որտե՞ղ է դպրոցը։", "Dov'è la scuola?", 5, ["topic:places", "grammar:location", "function:ask-location"], ["Որտե՞ղ է տունը։", "Որտե՞ղ է այգին։", "Դպրոցը մոտ է։"]),
    ("hy_sentence_park_is_there", "Այգին այնտեղ է։", "Il parco è là.", 5, ["topic:places", "grammar:location", "function:location"], ["Այգին այստեղ է։", "Տունն այնտեղ է։", "Դպրոցը մոտ է։"]),
    ("hy_sentence_we_are_friends", "Մենք ընկերներ ենք։", "Noi siamo amici.", 7, ["topic:people", "grammar:plural-copula", "function:relationship"], ["Նրանք ընկերներ են։", "Մենք երեխաներ ենք։", "Մենք դպրոցում ենք։"]),
    ("hy_sentence_they_are_home", "Նրանք տանն են։", "Loro sono a casa.", 7, ["topic:home", "grammar:plural-copula", "function:location"], ["Մենք տանն ենք։", "Նրանք դպրոցում են։", "Նրանք ընկերներ են։"]),
    ("hy_sentence_we_do_not_go", "Մենք չենք գնում։", "Noi non andiamo.", 7, ["topic:actions", "grammar:negation", "function:action"], ["Մենք գնում ենք։", "Նրանք չեն գնում։", "Մենք չենք գալիս։"]),
    ("hy_sentence_short_dialogue", "Բարև, ես Անի եմ։ Իսկ դու՞։", "Ciao, sono Ani. E tu?", 8, ["topic:introductions", "grammar:dialogue", "function:self-introduction"], ["Բարև, ես լավ եմ։ Իսկ դու՞։", "Ես Անի եմ։ Որտե՞ղ ես։", "Բարև, նա Անի է։"]),
    ("hy_sentence_integrated_day", "Այսօր մենք դպրոց ենք գնում։", "Oggi andiamo a scuola.", 8, ["topic:school", "grammar:plural-present", "function:action"], ["Վաղը մենք դպրոց ենք գնում։", "Այսօր նրանք դպրոց են գնում։", "Այսօր մենք տուն ենք գնում։"]),
]

CORE_TRANSLATIONS = {
    "hy_sentence_sister_sings": "La sorella canta.",
    "hy_sentence_brother_plays": "Il fratello gioca.",
    "hy_sentence_we_are_friends": "Noi siamo amici.",
    "hy_sentence_they_are_home": "Loro sono a casa.",
    "hy_sentence_we_do_not_go": "Noi non andiamo.",
    "hy_sentence_this_is_mom": "Questa è la mamma.",
    "hy_sentence_this_is_dad": "Questo è il papà.",
    "hy_sentence_this_is_dog": "Questo è un cane.",
    "hy_sentence_this_is_cat": "Questo è un gatto.",
    "hy_sentence_this_is_apple": "Questa è una mela.",
    "hy_sentence_this_is_house": "Questa è una casa.",
    "hy_sentence_exp_fa35916e0d36": "Come ti chiami?",
    "hy_sentence_exp_d24a71eb2b31": "Mi chiamo Ani.",
    "hy_sentence_friend_here": "Il mio amico è qui.",
    "hy_sentence_grandma_home": "La nonna è a casa.",
    "hy_sentence_exp_27581bae2b7c": "Questa è casa mia.",
    "hy_sentence_exp_b4fab2f8b516": "La nostra casa è grande.",
    "hy_sentence_i_want_water": "Voglio dell'acqua.",
    "hy_sentence_i_want_bread": "Voglio del pane.",
    "hy_sentence_i_want_milk": "Voglio del latte.",
    "hy_sentence_i_want_tea": "Voglio del tè.",
    "hy_sentence_exp_942b00e362be": "Voglio dell'acqua.",
    "hy_sentence_i_go_school": "Vado a scuola.",
    "hy_sentence_i_read_book": "Leggo un libro.",
    "hy_sentence_dad_eats_bread": "Il papà mangia del pane.",
    "hy_sentence_exp_9dcc6010c3b9": "Domani vado a scuola.",
    "hy_sentence_school_near": "La scuola è vicina.",
    "hy_sentence_exp_f9398a9ba2fe": "La scuola è vicina a casa.",
    "hy_sentence_exp_722d4834fa38": "Dove vai?",
    "hy_sentence_today_rain": "Oggi piove.",
    "hy_sentence_tomorrow_school": "Domani c'è scuola.",
    "hy_sentence_two_dogs": "Ci sono due cani.",
    "hy_sentence_three_apples": "Ci sono tre mele.",
    "hy_sentence_exp_baf218e40b59": "Quanti anni hai?",
    "hy_sentence_exp_32247e450852": "Ho otto anni.",
    "hy_sentence_exp_82c11e5068f5": "Oggi il tempo è bello.",
}

GRAMMAR_FOR_STAGE = {
    0: "grammar:word-identification", 1: "grammar:copula-present", 2: "grammar:possession",
    3: "grammar:wants-needs", 4: "grammar:present-tense", 5: "grammar:location",
    6: "grammar:numbers-time", 7: "grammar:plural-negation", 8: "grammar:dialogue",
}


def make_audio_free_word(spec: dict[str, Any]) -> dict[str, Any]:
    return {
        **spec,
        "meanings": [spec["translation"]],
        "transliterations": [spec.get("transliteration", "")],
        "audio": [],
        "review_status": "needs_native_speaker_review",
        "source": "curriculum-v1-curated",
        "base_language": "it",
    }


def make_sentence(spec: tuple[str, str, str, int, list[str], list[str]]) -> dict[str, Any]:
    sid, target, translation, stage, extra_tags, distractors = spec
    return {
        "id": sid,
        "target_sentence": target,
        "distractors": distractors,
        "tags": [f"stage:{stage}", "tier:core", *extra_tags],
        "audio": [],
        "review_status": "needs_native_speaker_review",
        "source": "curriculum-v1-curated",
        "prompt": {"it": f"Scegli la frase armena: {translation}"},
        "translation": translation,
        "translations": {"it": translation},
        "base_language": "it",
        "translation_review_status": {"it": "reviewed"},
    }


def naturalize_basic_italian(text: str) -> str:
    text = text.strip()
    replacements = {
        "voglio te": "Voglio del tè.", "Voglio te": "Voglio del tè.",
        "domani c e scuola": "Domani c'è scuola.",
        "la nonna e a casa": "La nonna è a casa.",
        "il mio amico e qui": "Il mio amico è qui.",
        "la scuola e vicina": "La scuola è vicina.",
        "l acqua e fredda": "L'acqua è fredda.",
        "il papa mangia pane": "Il papà mangia del pane.",
    }
    if text in replacements:
        return replacements[text]
    text = re.sub(r"\b([Cc]) e\b", lambda m: "C'è" if m.group(1) == "C" else "c'è", text)
    text = re.sub(r"\b e \b", " è ", text)
    text = text.replace("l acqua", "l'acqua").replace("L acqua", "L'acqua")
    text = re.sub(r"\bpapa\b", "papà", text, flags=re.I)
    if text and text[-1] not in ".?!":
        text += "."
    return text[:1].upper() + text[1:] if text else text


def stage_tags(stage: int, original: dict[str, Any], extra: list[str] | None = None) -> list[str]:
    tags = [f"stage:{stage}", "tier:core", *base_topic_tags(original), GRAMMAR_FOR_STAGE[stage]]
    for tag in extra or []:
        if tag not in tags:
            tags.append(tag)
    return tags


def rebuild_distractors(sentences: list[dict[str, Any]]) -> None:
    curated: dict[str, list[str]] = {}
    if CURATED_DISTRACTORS_PATH.exists():
        curated = json.loads(CURATED_DISTRACTORS_PATH.read_text(encoding="utf-8"))

    by_stage: dict[int, list[dict[str, Any]]] = {}
    for sentence in sentences:
        stage = next((int(tag.split(":", 1)[1]) for tag in sentence.get("tags", []) if tag.startswith("stage:")), None)
        if stage is not None and "tier:core" in sentence.get("tags", []):
            by_stage.setdefault(stage, []).append(sentence)
    for sentence in sentences:
        if "tier:core" not in sentence.get("tags", []):
            continue
        stage = next(int(tag.split(":", 1)[1]) for tag in sentence["tags"] if tag.startswith("stage:"))
        correct = sentence["translation"]
        curated_values = [value for value in curated.get(sentence["id"], []) if value and value != correct]
        if len(dict.fromkeys(curated_values)) >= 3:
            sentence["translation_distractors"] = {"it": list(dict.fromkeys(curated_values))[:3]}
            continue
        pool = [s["translation"] for s in by_stage.get(stage, []) if s["id"] != sentence["id"] and s["translation"] != correct]
        pool += [s["translation"] for s in by_stage.get(max(0, stage - 1), []) if s["translation"] != correct]
        unique: list[str] = []
        for value in pool:
            if value not in unique:
                unique.append(value)
        # Keep three choices even in very small stages.
        fallbacks = ["Non lo so.", "È qui.", "Grazie.", "Vado a casa."]
        for value in fallbacks:
            if value != correct and value not in unique:
                unique.append(value)
        sentence["translation_distractors"] = {"it": unique[:3]}


def main() -> None:
    words_path = DICT / "words.jsonl"
    sentences_path = DICT / "sentences.jsonl"
    letters_path = DICT / "letters.jsonl"
    words = load_jsonl(words_path)
    sentences = load_jsonl(sentences_path)
    letters = load_jsonl(letters_path)

    words_by_id = {item["id"]: item for item in words}
    for spec in NEW_WORDS:
        words_by_id.setdefault(spec["id"], make_audio_free_word(spec))
    words = list(words_by_id.values())

    assigned_words: dict[str, int] = {}
    for stage, ids in CORE_WORDS.items():
        for item_id in ids:
            if item_id in words_by_id and item_id not in assigned_words:
                assigned_words[item_id] = stage
    for spec in NEW_WORDS:
        stage = int(next(tag.split(":", 1)[1] for tag in spec["tags"] if tag.startswith("stage:")))
        assigned_words[spec["id"]] = stage

    for item in words:
        item.pop("difficulty", None)
        item.pop("complexity", None)
        if item["id"] in assigned_words:
            stage = assigned_words[item["id"]]
            if item["id"] in CORE_WORD_TRANSLATIONS:
                item["translation"] = CORE_WORD_TRANSLATIONS[item["id"]]
                item["translations"] = {**item.get("translations", {}), "it": item["translation"]}
                item["meanings"] = [item["translation"]]
            existing_extra = [tag for tag in item.get("tags", []) if str(tag).startswith(("function:", "grammar:"))]
            item["tags"] = stage_tags(stage, item, existing_extra)
            item["translation_review_status"] = {"it": "reviewed"}
        else:
            item["tags"] = ["tier:extension", *base_topic_tags(item)]
            item["translation_review_status"] = {"it": "needs_review"}
        # The English-accent browser fallback is never retained in the canonical pack.
        item["audio"] = [ref for ref in item.get("audio", []) if ref.get("source_type") != "browser_tts"]

    sentences_by_id = {item["id"]: item for item in sentences}
    for spec in NEW_SENTENCES:
        sentences_by_id.setdefault(spec[0], make_sentence(spec))
    sentences = list(sentences_by_id.values())

    assigned_sentences: dict[str, int] = {}
    for stage, ids in SENTENCE_STAGES.items():
        for item_id in ids:
            if item_id in sentences_by_id and item_id not in assigned_sentences:
                assigned_sentences[item_id] = stage
    for spec in NEW_SENTENCES:
        assigned_sentences[spec[0]] = spec[3]

    extra_by_new_id = {spec[0]: spec[4] for spec in NEW_SENTENCES}
    for sentence in sentences:
        sentence.pop("difficulty", None)
        sentence.pop("complexity", None)
        sentence["translation"] = CORE_TRANSLATIONS.get(sentence["id"], naturalize_basic_italian(sentence.get("translation", "")))
        sentence["translations"] = {**sentence.get("translations", {}), "it": sentence["translation"]}
        sentence["prompt"] = {**sentence.get("prompt", {}), "it": f"Scegli la frase armena: {sentence['translation']}"}
        if sentence["id"] in assigned_sentences:
            stage = assigned_sentences[sentence["id"]]
            sentence["tags"] = stage_tags(stage, sentence, extra_by_new_id.get(sentence["id"], []))
            sentence["translation_review_status"] = {"it": "reviewed"}
        else:
            sentence["tags"] = ["tier:extension", *base_topic_tags(sentence)]
            sentence["translation_review_status"] = {"it": "needs_review"}
        sentence["audio"] = [ref for ref in sentence.get("audio", []) if ref.get("source_type") != "browser_tts"]

    rebuild_distractors(sentences)

    # Letters are introduced in small groups, while all remain visible in the dictionary.
    stage_sizes = [8, 5, 5, 5, 4, 4, 3, 3, 2]
    cursor = 0
    for stage, size in enumerate(stage_sizes):
        for letter in letters[cursor:cursor + size]:
            letter["tags"] = [f"stage:{stage}", "tier:core", "topic:letters"]
            letter["audio"] = [ref for ref in letter.get("audio", []) if ref.get("source_type") != "browser_tts"]
        cursor += size

    save_jsonl(words_path, words)
    save_jsonl(sentences_path, sentences)
    save_jsonl(letters_path, letters)

    # Controlled tag catalogue is generated from actual content plus curriculum metadata.
    all_tags = set()
    for collection in (words, sentences, letters):
        for item in collection:
            all_tags.update(item.get("tags", []))
    tags_doc = {
        "controlled_tags": [
            {"id": tag, "label": tag.split(":", 1)[-1].replace("-", " "), "description": f"Tag controllato del curriculum: {tag}"}
            for tag in sorted(all_tags)
        ]
    }
    (PACK / "tags.yaml").write_text(dump_simple_yaml(tags_doc), encoding="utf-8")

    print(f"Curriculum v1 written: {len(words)} words, {len(sentences)} sentences, {len(letters)} letters")
    print(f"Core words: {sum(1 for x in words if 'tier:core' in x.get('tags', []))}")
    print(f"Core sentences: {sum(1 for x in sentences if 'tier:core' in x.get('tags', []))}")


if __name__ == "__main__":
    main()
