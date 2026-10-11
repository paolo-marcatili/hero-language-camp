#!/usr/bin/env python3
"""Expand the Danish foundations prototype through full 0. klasse and early 1. klasse."""
from __future__ import annotations
import json
from pathlib import Path
import yaml


class ReadableYamlDumper(yaml.SafeDumper):
    """Emit lists indented under keys so the browser pack parser can read them."""
    def increase_indent(self, flow=False, indentless=False):
        return super().increase_indent(flow, False)

    def ignore_aliases(self, data):
        return True


def _represent_string(dumper, value):
    style = '"' if ':' in value or value.startswith(('*', '&', '!')) else None
    return dumper.represent_scalar('tag:yaml.org,2002:str', value, style=style)


ReadableYamlDumper.add_representer(str, _represent_string)


def dump_yaml(value):
    return yaml.dump(
        value,
        Dumper=ReadableYamlDumper,
        allow_unicode=True,
        sort_keys=False,
        width=1_000_000,
    )

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "content-packs" / "da-foundations"


def read_jsonl(path: Path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def write_jsonl(path: Path, entries):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(json.dumps(x, ensure_ascii=False, separators=(",", ":")) for x in entries) + "\n", encoding="utf-8")


def tts(text: str, ident: str):
    return [{"id": f"tts-{ident}", "url": "browser-tts:da-DK", "text": text, "source_type": "browser_tts", "provider": "system", "license": "device voice", "review_status": "draft"}]


def tags(stage: int, *more: str):
    return [f"stage:{stage}", "tier:core", *more]

# Add the remaining letters expected before ordinary 1st-grade reading.
letters_path = PACK / "dictionary" / "letters.jsonl"
letters = {x["id"]: x for x in read_jsonl(letters_path)}
new_letters = [
    (5, "d", "D", "de", "word_dag"),
    (5, "g", "G", "ge", "word_ged"),
    (5, "j", "J", "jod", "word_jeg"),
    (6, "y", "Y", "y", "word_ymer"),
    (6, "æ", "Æ", "æ", "word_aeg"),
    (6, "ø", "Ø", "ø", "word_oe"),
    (7, "å", "Å", "å", "word_aar"),
    (7, "c", "C", "se", "word_cykel"),
]
for stage, lower, upper, name, example_id in new_letters:
    ident = {"æ":"ae","ø":"oe","å":"aa"}.get(lower, lower)
    letters[f"letter_{ident}"] = {
        "id": f"letter_{ident}", "character": lower, "uppercase": upper, "lowercase": lower,
        "names": {"da": name, "it": name}, "spoken_name": name, "sound": lower,
        "example_item_ids": [example_id],
        "tags": tags(stage, "literacy:letter-name", "literacy:letter-sound"),
        "audio": tts(name, f"letter-{ident}-name"), "sound_audio": [],
        "review_status": "needs_native_speaker_review"
    }
write_jsonl(letters_path, sorted(letters.values(), key=lambda x: (int(x["tags"][0].split(":")[1]), x["id"])))

# Words. The app uses pictures/emoji and spoken Danish rather than translation questions.
words_path = PACK / "dictionary" / "words.jsonl"
words = {x["id"]: x for x in read_jsonl(words_path)}
word_specs = [
    # stage, target, Danish gloss, Italian parent gloss, emoji, decodability
    (5,"dag","en dag","giorno","📅","regular"),(5,"ged","en ged","capra","🐐","regular"),
    (5,"jord","jord","terra","🌍","regular"),(5,"glad","glad","felice","😀","regular"),
    (5,"god","god","buono","👍","high_frequency"),(5,"jeg","jeg","io","🙋","high_frequency"),
    (5,"dig","dig","te","👉","high_frequency"),(5,"mad","mad","cibo","🍽️","regular"),
    (5,"gris","en gris","maiale","🐷","regular"),(5,"gul","gul","giallo","🟡","regular"),
    (5,"jul","jul","Natale","🎄","regular"),(5,"dreng","en dreng","bambino","👦","high_frequency"),
    (6,"dyr","et dyr","animale","🦌","regular"),(6,"ymer","ymer","latte fermentato danese","🥣","regular"),(6,"by","en by","città","🏙️","regular"),
    (6,"ny","ny","nuovo","✨","regular"),(6,"lys","et lys","luce","💡","regular"),
    (6,"æg","et æg","uovo","🥚","regular"),(6,"træ","et træ","albero","🌳","regular"),
    (6,"sø","en sø","lago","🌊","regular"),(6,"ø","en ø","isola","🏝️","regular"),
    (6,"frø","en frø","rana","🐸","regular"),(6,"løb","løb","corsa","🏃","regular"),
    (6,"rød","rød","rosso","🔴","high_frequency"),(6,"grøn","grøn","verde","🟢","high_frequency"),
    (7,"år","et år","anno","📆","high_frequency"),(7,"gå","gå","andare","🚶","high_frequency"),
    (7,"blå","blå","blu","🔵","regular"),(7,"bål","et bål","falò","🔥","regular"),
    (7,"tå","en tå","dito del piede","🦶","regular"),(7,"hår","hår","capelli","💇","regular"),
    (7,"cykel","en cykel","bicicletta","🚲","high_frequency"),(7,"cirkus","et cirkus","circo","🎪","high_frequency"),
    (8,"det","det","esso/questo","🔹","high_frequency"),(8,"den","den","esso/quello","🔸","high_frequency"),
    (8,"et","et","un/uno","1️⃣","high_frequency"),(8,"er","er","è/sono","🟰","high_frequency"),
    (8,"har","har","ha/hanno","🎒","high_frequency"),(8,"kan","kan","può/possono","💪","high_frequency"),
    (8,"vil","vil","vuole/vogliono","⭐","high_frequency"),(8,"ikke","ikke","non","🚫","high_frequency"),
    (8,"på","på","su","⬆️","high_frequency"),(8,"med","med","con","🤝","high_frequency"),
    (8,"og","og","e","➕","high_frequency"),(8,"her","her","qui","📍","high_frequency"),
    (8,"der","der","lì","👉","high_frequency"),
    (9,"skole","en skole","scuola","🏫","high_frequency"),(9,"bog","en bog","libro","📘","regular"),
    (9,"barn","et barn","bambino","🧒","high_frequency"),(9,"leg","en leg","gioco","🎲","regular"),
    (9,"læse","læse","leggere","📖","high_frequency"),(9,"skrive","skrive","scrivere","✏️","high_frequency"),
    (9,"regne","regne","calcolare","🧮","high_frequency"),(9,"spil","et spil","gioco","🎮","regular"),
    (9,"hjem","hjem","casa","🏡","high_frequency"),(9,"ude","ude","fuori","🌤️","regular"),
    (9,"inde","inde","dentro","🏠","regular"),
    (10,"pige","en pige","bambina","👧","high_frequency"),(10,"læser","læser","legge","📖","high_frequency"),
    (10,"spiser","spiser","mangia","🍽️","high_frequency"),(10,"løber","løber","corre","🏃","high_frequency"),
    (10,"hopper","hopper","salta","🐇","regular"),(10,"æble","et æble","mela","🍎","high_frequency"),
    (10,"kanin","en kanin","coniglio","🐇","regular"),(10,"robot","en robot","robot","🤖","regular"),
    (10,"sommer","sommer","estate","☀️","high_frequency"),(10,"huse","huse","case","🏘️","regular"),
    (11,"vinter","vinter","inverno","❄️","high_frequency"),(11,"morgen","morgen","mattina","🌅","high_frequency"),
    (11,"aften","aften","sera","🌆","high_frequency"),(11,"familie","en familie","famiglia","👨‍👩‍👧‍👦","high_frequency"),
    (11,"historie","en historie","storia","📚","high_frequency"),(11,"taler","taler","parla","💬","regular"),
    (11,"leger","leger","gioca","🧸","regular"),(11,"tegner","tegner","disegna","🎨","regular"),
    (11,"finder","finder","trova","🔎","regular"),(11,"venner","venner","amici","🧑‍🤝‍🧑","regular"),
    (12,"klasse","en klasse","classe","🏫","high_frequency"),(12,"lærer","en lærer","insegnante","🧑‍🏫","high_frequency"),
    (12,"blyant","en blyant","matita","✏️","high_frequency"),(12,"papir","papir","carta","📄","regular"),
    (12,"bogstav","et bogstav","lettera","🔤","high_frequency"),(12,"sætning","en sætning","frase","📝","high_frequency"),
    (12,"nummer","et nummer","numero","#️⃣","regular"),(12,"plus","plus","più","➕","regular"),
    (12,"minus","minus","meno","➖","regular"),
    (13,"eventyr","et eventyr","fiaba","🏰","high_frequency"),(13,"skovtur","en skovtur","gita nel bosco","🌲","regular"),
    (13,"hemmelig","hemmelig","segreto","🤫","high_frequency"),(13,"skattekiste","en skattekiste","scrigno","🧰","regular"),
    (13,"drage","en drage","drago","🐉","regular"),(13,"stjerne","en stjerne","stella","⭐","regular"),
    (13,"sammen","sammen","insieme","🤝","high_frequency"),
]
for stage, target, da, it, emoji, dec in word_specs:
    ident = target.replace("æ","ae").replace("ø","oe").replace("å","aa").replace(" ","_")
    words[f"word_{ident}"] = {
        "id": f"word_{ident}", "concept": target, "target": target, "translation": da,
        "translations": {"da": da, "it": it}, "translation_review_status": {"it": "reviewed"},
        "emoji": emoji, "graphemes": list(target), "phonemes": list(target), "decodability": dec,
        "tags": tags(stage, "literacy:decodable" if dec == "regular" else "literacy:high-frequency", "topic:school-reading"),
        "audio": tts(target, f"word-{ident}"), "review_status": "needs_native_speaker_review"
    }
write_jsonl(words_path, sorted(words.values(), key=lambda x: (int(x["tags"][0].split(":")[1]), x["target"])))

# Reading problems: short sentences, construction, missing word/letter, and mini-stories.
reading = []
def add_read(stage, ident, domain, text, prompt_da, answer, options=None, image=None, words=None, prompt_it=""):
    spoken_text = text
    if domain == "sentence_order":
        spoken_text = answer
    elif domain == "missing_letter":
        spoken_text = text.replace("_", answer)
    elif domain == "missing_word":
        spoken_text = text.replace("___", answer)
    reading.append({
        "id": ident, "domain": domain, "text": text,
        "prompt": {"da": prompt_da, "it": prompt_it or prompt_da},
        "answer": answer, "options": options or [], "image": image, "words": words,
        "audio": tts(spoken_text, f"reading-{ident}"),
        "tags": tags(stage, f"reading:{domain}"), "review_status": "needs_native_speaker_review"
    })

sentence_sets = {
5:[("En ged er glad.","🐐😀",["🐐😀","🐷😴","🐱🏠"]),("Jeg ser en gris.","🙋👀🐷",["🙋👀🐷","🙋👀🐐","👦🍽️"]),("Mad er god.","🍽️👍",["🍽️👍","🍽️🚫","🌍😀"])],
6:[("Et æg er på et træ.","🥚🌳",["🥚🌳","🐸🌊","🏙️💡"]),("En frø er ved en sø.","🐸🌊",["🐸🌊","🥚🌳","🦌🏙️"]),("Lyset er rødt.","💡🔴",["💡🔴","💡🟢","🌳🔵"])],
7:[("En blå cykel står her.","🚲🔵📍",["🚲🔵📍","🚲🔴👉","🐴🔵📍"]),("Vi går til et bål.","🚶🔥",["🚶🔥","🚲🏫","🐸🌊"]),("Cirkus er i byen.","🎪🏙️",["🎪🏙️","🏫🌲","🏠🌊"])],
8:[("Det er en kat.","🐱",["🐱","🐶","🐭"]),("Den har en hat.","🎩",["🎩","🦺","🏹"]),("Jeg vil lege med en ven.","🙋🎲🧑‍🤝‍🧑",["🙋🎲🧑‍🤝‍🧑","🙋📖🏫","👦🍽️🐷"])],
9:[("Et barn læser en bog.","🧒📖📘",["🧒📖📘","🧒🎮🏠","👧🏃🌲"]),("Vi regner i skolen.","🧮🏫",["🧮🏫","🎮🏡","📖🌲"]),("Bogen er inde i huset.","📘🏠",["📘🏠","📘🌤️","🚲🏫"])],
10:[("Pigen spiser et æble.","👧🍎",["👧🍎","👦📘","🤖🏃"]),("Kaninen hopper ved huset.","🐇🏠",["🐇🏠","🐱🚲","🤖🏫"]),("Robotten løber til skolen.","🤖🏃🏫",["🤖🏃🏫","🐇🍎🏠","👧📖🌲"])],
}
for stage, rows in sentence_sets.items():
    for i,(text,answer,opts) in enumerate(rows):
        add_read(stage,f"sentence_picture_{stage}_{i}","sentence_picture",text,"Læs sætningen, og vælg billedet.",answer,opts)
        words_row=text.rstrip(".").split()
        add_read(stage,f"sentence_order_{stage}_{i}","sentence_order",text,"Byg sætningen, du hører.",text,words=words_row)

missing_rows = {
5:[("En ___ er glad.","ged",["ged","gris","dag"]),("Jeg ser ___.","dig",["dig","mad","gul"])],
6:[("Et ___ ligger i reden.","æg",["æg","træ","sø"]),("En frø er ved en ___.","sø",["sø","by","ø"])],
7:[("Cyklen er ___.","blå",["blå","gul","rød"]),("Vi går til et ___.","bål",["bål","år","tå"])],
8:[("Jeg ___ læse.","kan",["kan","har","er"]),("Katten er ___ huset.","på",["på","med","og"])],
9:[("Barnet læser en ___.","bog",["bog","leg","skole"]),("Vi ___ i skolen.","regner",["regner","spil","ude"])],
10:[("Pigen ___ et æble.","spiser",["spiser","løber","læser"]),("Kaninen ___.","hopper",["hopper","finder","taler"])],
11:[("Familien taler om en ___.","historie",["historie","morgen","vinter"]),("Vennerne ___ sammen.","leger",["leger","tegner","finder"])],
12:[("Jeg skriver med en ___.","blyant",["blyant","klasse","nummer"]),("Et ord har flere ___.","bogstaver",["bogstaver","lærere","papirer"])],
}
for stage, rows in missing_rows.items():
    for i,(text,ans,opts) in enumerate(rows):
        add_read(stage,f"missing_word_{stage}_{i}","missing_word",text,"Hvilket ord mangler i sætningen?",ans,opts)

missing_letter_rows=[
(5,"_ag","dag","d",["d","g","j"]),(5,"_ed","ged","g",["g","d","j"]),(5,"_eg","jeg","j",["j","g","d"]),
(6,"d_r","dyr","y",["y","æ","ø"]),(6,"_g","æg","æ",["æ","ø","y"]),(6,"s_","sø","ø",["ø","æ","y"]),
(7,"_r","år","å",["å","o","a"]),(7,"_ykel","cykel","c",["c","s","k"]),
(9,"sk_le","skole","o",["o","å","ø"]),(10,"p_ge","pige","i",["i","e","y"]),
(11,"v_nter","vinter","i",["i","e","y"]),(12,"bl_ant","blyant","y",["y","i","æ"])
]
for stage,shown,word,ans,opts in missing_letter_rows:
    emoji = next((x.get("emoji") for x in words.values() if x["target"]==word),"✏️")
    add_read(stage,f"missing_letter_{word}","missing_letter",shown,f"Hvilket bogstav mangler i ordet {word}?",ans,opts,image=emoji)

stories=[
(9,"Mia er i skole. Hun har en bog. Mia læser med en ven.","Hvad har Mia?","en bog",["en bog","en cykel","et æg"]),
(9,"Ali er hjemme. Han spiller et spil. Bagefter går han ud.","Hvad gør Ali først?","spiller et spil",["spiller et spil","læser en bog","går i skole"]),
(10,"En pige ser en kanin. Kaninen hopper hen til et hus. Pigen går efter den.","Hvad hopper hen til huset?","kaninen",["kaninen","pigen","robotten"]),
(10,"En robot står ved skolen. Den har et rødt lys. Lyset bliver grønt.","Hvilken farve får lyset?","grønt",["grønt","rødt","blåt"]),
(11,"Det er morgen. Far laver mad, og mor finder kopper. Familien spiser sammen.","Hvornår spiser familien?","om morgenen",["om morgenen","om aftenen","om vinteren"]),
(11,"Det er vinter. To venner leger ude. De bygger et lille hus af sne.","Hvad bygger vennerne?","et hus af sne",["et hus af sne","en cykel","et bål"]),
(12,"I klassen får Lea papir og en blyant. Hun skriver tre ord og tegner en stjerne.","Hvad tegner Lea?","en stjerne",["en stjerne","en drage","et æble"]),
(12,"Læreren skriver et nummer. Børnene regner plus og minus. Til sidst læser de en sætning.","Hvad gør børnene til sidst?","læser en sætning",["læser en sætning","løber ude","spiser et æble"]),
(13,"Tre venner går på skovtur. De finder et kort under et træ. Kortet viser en hemmelig kiste.","Hvor finder de kortet?","under et træ",["under et træ","i skolen","ved en sø"]),
(13,"En lille drage vogter en skattekiste. Dragen er ikke sur. Den vil læse eventyr sammen med børnene.","Hvad vil dragen?","læse eventyr",["læse eventyr","tage cyklen","gemme en blyant"]),
(13,"Om aftenen ser Nora en stjerne. Hun skriver om den i sin første bog. Næste morgen viser hun bogen til klassen.","Hvem ser bogen næste morgen?","klassen",["klassen","en kanin","dragen"]),
]
for idx,(stage,text,q,ans,opts) in enumerate(stories):
    add_read(stage,f"mini_story_{stage}_{idx}","mini_story",text,q,ans,opts)

write_jsonl(PACK / "curriculum" / "reading-problems.jsonl", reading)

# Extend mathematics through 20, number bonds, and contextual problems.
math_path = PACK / "curriculum" / "math-problems.jsonl"
math = {x["id"]: x for x in read_jsonl(math_path)}
objects=["⭐","🍎","🔵","🌼","🐟","🟡"]
def add_math(entry): math[entry["id"]]=entry
def mp(stage,ident,domain,prompt,result,operands=None,maxn=10,obj="⭐",representation="objects",operation=None,whole=None):
    return {"id":ident,"domain":domain,"prompt":{"da":prompt,"it":prompt},"operands":operands,"result":result,"number_range":{"min":0,"max":maxn},"representation":representation,"object":obj,"operation":operation,"whole":whole,"tags":tags(stage,f"math:{domain}"),"review_status":"needs_native_speaker_review"}
# Stage 5: number line and fluency within ten.
for n in range(1,10): add_math(mp(5,f"line_missing_{n}_stage5","number_order",f"Hvilket tal mangler mellem {n-1} og {n+1}?",n,[n-1,n+1],10,representation="number_line"))
for i,(a,b) in enumerate([(2,3),(4,2),(5,4),(7,3),(6,2),(8,1)]): add_math(mp(5,f"add_fluency_{a}_{b}_stage5","addition",f"Hvad er {a} plus {b}?",a+b,[a,b],10,objects[i%len(objects)]))
for i,(a,b) in enumerate([(5,2),(7,3),(9,4),(10,6),(8,2),(6,1)]): add_math(mp(5,f"sub_fluency_{a}_{b}_stage5","subtraction",f"Hvad er {a} minus {b}?",a-b,[a,b],10,objects[i%len(objects)]))
# Stages 6-8: number bonds and equal-value understanding.
for stage, whole in [(6,5),(6,6),(7,7),(7,8),(8,9),(8,10)]:
    for part in range(0,whole+1, max(1,whole//3)):
        missing=whole-part
        add_math(mp(stage,f"bond_{whole}_{part}_stage{stage}","number_bond",f"{part} og hvor mange giver {whole}?",missing,[part],whole,objects[(part+stage)%len(objects)],"objects",whole=whole))
# Stage 9 mixed story problems to ten.
for i,(op,a,b,obj) in enumerate([("addition",3,4,"🍎"),("subtraction",9,3,"⭐"),("addition",5,5,"🐟"),("subtraction",10,4,"🌼"),("addition",2,6,"🔵"),("subtraction",8,5,"🟡")]):
    result=a+b if op=="addition" else a-b
    prompt=(f"Der er {a} ting. Der kommer {b} til. Hvor mange er der nu?" if op=="addition" else f"Der er {a} ting. {b} bliver taget væk. Hvor mange er der tilbage?")
    add_math(mp(9,f"story_{op}_{a}_{b}_stage9","story_problem",prompt,result,[a,b],10,obj,"objects",operation=op))
# Stages 10-13: numbers to 20, number lines, bonds and contextual operations.
for n in range(11,21):
    add_math(mp(10,f"count_{n}_stage10","counting",f"Tæl tingene. Hvor mange er der?",n,maxn=20,obj=objects[n%len(objects)]))
    add_math(mp(10,f"match_{n}_stage10","number_match",f"Hvilken gruppe har {n} ting?",n,maxn=20,obj=objects[(n+1)%len(objects)]))
for n in range(11,20): add_math(mp(10,f"order_{n}_stage10","number_order",f"Hvilket tal står mellem {n-1} og {n+1}?",n,[n-1,n+1],20,representation="number_line"))
for whole in [10,12,15,20]:
    stage=11 if whole<=10 else 12
    parts=sorted(set([0,1,2,5,whole//2,whole-5,whole-2,whole-1]))
    for part in [p for p in parts if 0<=p<=whole]:
        add_math(mp(stage,f"bond_{whole}_{part}_stage{stage}","number_bond",f"{part} og hvor mange giver {whole}?",whole-part,[part],20,objects[(whole+part)%len(objects)],"objects",whole=whole))
for stage, rows in {
11:[("addition",8,5),("addition",9,4),("subtraction",14,5),("subtraction",16,7)],
12:[("addition",7,8),("addition",9,9),("subtraction",18,6),("subtraction",20,9)],
13:[("addition",6,7),("addition",8,9),("subtraction",17,8),("subtraction",19,7)]
}.items():
    for i,(op,a,b) in enumerate(rows):
        res=a+b if op=="addition" else a-b
        prompt=(f"Der er {a} perler. Du får {b} perler mere. Hvor mange perler har du nu?" if op=="addition" else f"Der er {a} perler. Du giver {b} væk. Hvor mange har du tilbage?")
        add_math(mp(stage,f"story_{op}_{a}_{b}_stage{stage}","story_problem",prompt,res,[a,b],20,objects[i%len(objects)],"objects",operation=op))
write_jsonl(math_path, sorted(math.values(), key=lambda x: (int(x["tags"][0].split(":")[1]), x["id"])))

# Levels 5-13.
levels_path=PACK/"levels.yaml"
levels_doc=yaml.safe_load(levels_path.read_text(encoding="utf-8"))
levels={x["number"]:x for x in levels_doc["levels"]}
level_specs=[
(5,"Sætningsbroen","Bogstaverne d, g og j, korte sætninger og talrækken til 10","Le lettere d, g e j, frasi brevi e la linea dei numeri fino a 10","Læs og byg korte sætninger, og brug talrækken til at finde plus og minus.","Leggere e costruire frasi brevi e usare la linea dei numeri per addizioni e sottrazioni.","chapter_5_sentence_bridge",9,14),
(6,"Søen med ord","Bogstaverne y, æ og ø, manglende ord og talvenner","Le lettere y, æ e ø, parole mancanti e coppie di numeri","Læs små sætninger med y, æ og ø, og find talpar der tilsammen giver 5 eller 6.","Leggere brevi frasi con y, æ e ø e trovare coppie che formano 5 o 6.","chapter_6_word_lake",9,14),
(7,"Å-porten","Bogstaverne å og c, hyppige ord og talvenner til 8","Le lettere å e c, parole frequenti e coppie fino a 8","Mød de sidste centrale bogstaver, læs hyppige ord og find flere talvenner.","Incontrare le ultime lettere principali, leggere parole frequenti e trovare altre coppie numeriche.","chapter_7_aa_gate",9,14),
(8,"De små beskeder","Hyppige småord, sætningsrækkefølge og blandet regning til 10","Parole frequenti, ordine della frase e calcolo misto fino a 10","Læs beskeder med det, den, er, har, kan og ikke, og vælg regnestrategi.","Leggere messaggi con parole frequenti e scegliere una strategia di calcolo.","chapter_8_messages",10,15),
(9,"Fortællingens nøgle","Korte tekster, forståelse og hverdagens regnehistorier","Testi brevi, comprensione e problemi quotidiani","Læs en lille tekst, find svaret i teksten, og løs regnehistorier inden for 10.","Leggere un breve testo, trovare la risposta e risolvere problemi entro il 10.","chapter_9_story_key",10,15),
(10,"Skolestien","Ord med to stavelser og tallene 11 til 20","Parole bisillabiche e numeri da 11 a 20","Læs længere ord og sætninger, og forbind tallene 11 til 20 med mængder og talrækken.","Leggere parole e frasi più lunghe e collegare 11-20 a quantità e linea dei numeri.","chapter_10_school_path",10,16),
(11,"Historiehaven","Minihistorier og talvenner til 10","Mini-storie e coppie numeriche fino a 10","Læs tre sammenhængende sætninger, og brug talvenner til at regne smartere.","Leggere tre frasi collegate e usare le coppie numeriche per calcolare.","chapter_11_story_garden",10,16),
(12,"Skriveværkstedet","Manglende bogstaver, sætningsbygning og regning til 20","Lettere mancanti, costruzione di frasi e calcolo fino a 20","Byg og færdiggør ord og sætninger, og løs plus og minus inden for 20.","Completare parole e frasi e risolvere addizioni e sottrazioni entro il 20.","chapter_12_writing_workshop",11,17),
(13,"Den første bog","Læsning med forståelse og blandede problemer","Lettura con comprensione e problemi misti","Læs små fortællinger selvstændigt, svar på spørgsmål og vælg en regnestrategi.","Leggere brevi racconti, rispondere e scegliere una strategia di calcolo.","chapter_13_first_book",12,18),
]
for number,title,theme_da,theme_it,goal_da,goal_it,chapter,sessions,fightq in level_specs:
    levels[number]={"number":number,"title":title,"stat_cap":17+(number-4)*3,"content_tags":[f"stage:{number}"],"theme":{"da":theme_da,"it":theme_it},"learning_goal":{"da":goal_da,"it":goal_it},"chapter_id":chapter,"unlock_requires":{"completed_training_sessions":sessions,"answered_fight_questions":fightq,"min_stats":{"strength":min(12,number+1),"defense":min(12,number+1),"precision":min(12,number+1),"stamina":min(12,number+1)}},"fight":{"min_questions":fightq,"at_min_questions":fightq,"timer_seconds":26 if number<10 else 30,"max_questions":fightq+10,"max_mistakes_to_win":10}}
levels_doc["levels"]=[levels[n] for n in sorted(levels)]
levels_path.write_text(dump_yaml(levels_doc),encoding="utf-8")

# Chapters 5-13.
story_path=PACK/"story.yaml"
story=yaml.safe_load(story_path.read_text(encoding="utf-8"))
chapters={x["id"]:x for x in story["chapters"]}
chapter_specs=[
(5,"chapter_5_sentence_bridge","Sætningsbroen","Il ponte delle frasi","Bogstaverne d, g og j danner nye ord og de første hele sætninger.","Le lettere d, g e j formano nuove parole e le prime frasi.","En bro er dækket af løse ord. Hver planke ligger forkert, og kun en hel sætning kan holde helten oppe.","Un ponte è coperto di parole sparse. Solo una frase completa può reggere l'eroe.","En sætning fortæller noget helt","Una frase comunica un'idea completa","En sætning begynder med stort bogstav og slutter med punktum. Ordene skal stå i en rækkefølge, der giver mening. På talrækken kan du gå frem ved plus og tilbage ved minus.","Una frase inizia con la maiuscola e termina con il punto. Sulla linea dei numeri si va avanti col più e indietro col meno.","Byg tre sætninger og reparer broen.","Costruisci tre frasi e ripara il ponte."),
(6,"chapter_6_word_lake","Søen med ord","Il lago delle parole","Læs y, æ og ø i små sætninger og find manglende ord.","Leggere y, æ e ø in brevi frasi e trovare parole mancanti.","Ved søen flyder ord på åkander. Nogle sætninger har mistet ét ord, og søens frøer kan kun hoppe videre, når det findes.","Sul lago le parole galleggiano sulle ninfee. Alcune frasi hanno perso una parola.","Brug hele sætningen som hjælp","Usa tutta la frase come indizio","Når et ord mangler, skal både betydning og bogstaver passe. Talvenner er to dele, som tilsammen giver et helt tal.","Quando manca una parola devono corrispondere significato e lettere. Le coppie numeriche formano un numero intero.","Find de manglende ord og seks talvenner.","Trova le parole mancanti e sei coppie numeriche."),
(7,"chapter_7_aa_gate","Å-porten","La porta Å","Mød å og c, og øv ord som år, gå og cykel.","Incontrare å e c e allenare parole come år, gå e cykel.","Den sidste bogstavport har to låse. Den ene ligner en lille ring over a, den anden bruges især i lånte ord.","L'ultima porta delle lettere ha due serrature: å e c.","Nogle bogstaver kræver ekstra opmærksomhed","Alcune lettere richiedono attenzione","Å er sit eget bogstav. C kan lyde forskelligt i ord som cykel og cirkus. Brug ordets lyd og billedet sammen.","Å è una lettera distinta. C può avere suoni diversi; usa insieme suono e immagine.","Åbn begge låse og saml talvenner til otte.","Apri entrambe le serrature e trova coppie fino a otto."),
(8,"chapter_8_messages","De små beskeder","I piccoli messaggi","Læs hyppige småord og sæt ord i rigtig rækkefølge.","Leggere parole frequenti e ordinare le parole.","Små beskeder dukker op på tårnets vægge. De korte ord ser simple ud, men de styrer hele meningen.","Piccoli messaggi compaiono sulle pareti della torre. Le parole brevi guidano il significato.","Hyppige ord skal genkendes sikkert","Le parole frequenti vanno riconosciute","Ord som det, den, er, har, kan, ikke, på, med og og møder du igen og igen. Læs dem i sætningen, ikke alene.","Parole frequenti come det, den, er e ikke vanno lette nel contesto.","Læs beskederne og vælg den rigtige vej.","Leggi i messaggi e scegli la strada."),
(9,"chapter_9_story_key","Fortællingens nøgle","La chiave del racconto","Læs korte tekster og find oplysninger, der står direkte i teksten.","Leggere testi brevi e trovare informazioni esplicite.","En bog er låst med spørgsmål. Hver side giver et spor, men svaret findes kun, hvis helten husker det læste.","Un libro è chiuso da domande. La risposta è nel testo.","Læs først, find derefter svaret","Prima leggi, poi trova la risposta","En kort tekst har personer, handlinger og steder. Læs spørgsmålet og gå tilbage til sætningen, hvor svaret står.","Un testo breve contiene persone, azioni e luoghi. Torna alla frase che contiene la risposta.","Læs to små historier og åbn bogen.","Leggi due storie e apri il libro."),
(10,"chapter_10_school_path","Skolestien","Il sentiero della scuola","Læs ord med to stavelser og arbejd med tallene 11 til 20.","Leggere parole bisillabiche e lavorare con 11-20.","Skolestien har tyve sten. På hver sten står et længere ord eller et tal, og helten må tage dem i orden.","Il sentiero della scuola ha venti pietre con parole e numeri.","Del længere ord i små bidder","Dividi le parole lunghe","Ord som skole, pige, kanin og sommer kan deles i stavelser. Tallene 11 til 20 består af ti og nogle flere.","Parole come skole e kanin possono essere divise in sillabe. I numeri 11-20 sono dieci più altre unità.","Læs stiens ord og nå frem til tallet 20.","Leggi le parole e raggiungi il numero 20."),
(11,"chapter_11_story_garden","Historiehaven","Il giardino delle storie","Læs tre sætninger, og brug talvenner til 10.","Leggere tre frasi e usare coppie fino a 10.","I haven vokser historier som blomster. Hver historie har en begyndelse, en midte og en slutning.","Nel giardino le storie crescono come fiori.","Sæt oplysninger sammen","Collega le informazioni","Når du læser flere sætninger, skal du huske hvem teksten handler om, hvad der sker, og hvornår. Talvenner til 10 hjælper med hurtig regning.","Con più frasi ricorda chi, cosa e quando. Le coppie fino a 10 aiutano il calcolo.","Læs historierne og få haven til at blomstre.","Leggi le storie e fai fiorire il giardino."),
(12,"chapter_12_writing_workshop","Skriveværkstedet","Il laboratorio di scrittura","Færdiggør ord og sætninger, og regn inden for 20.","Completare parole e frasi e calcolare entro 20.","I værkstedet er bogstaver faldet ud af ordene. Helten får papir og blyant og reparerer dem ét tegn ad gangen.","Nel laboratorio alcune lettere sono cadute dalle parole.","Skrivning bygger på lyd og rækkefølge","La scrittura usa suoni e ordine","Lyt til ordet, sig lydene langsomt, og vælg det bogstav der mangler. En sætning skal have mellemrum og punktum.","Ascolta, segmenta i suoni e scegli la lettera mancante. Una frase usa spazi e punto.","Reparer værkstedets ord og løs fire regnestykker.","Ripara le parole e risolvi quattro calcoli."),
(13,"chapter_13_first_book","Den første bog","Il primo libro","Læs små fortællinger med forståelse og løs blandede problemer.","Leggere brevi racconti e risolvere problemi misti.","Alle de samlede ord bliver til heltens første bog. Den sidste drage vil ikke kæmpe; den vil høre historien.","Tutte le parole diventano il primo libro dell'eroe. L'ultimo drago vuole ascoltare.","Læsning og regning bruges til at løse problemer","Lettura e matematica risolvono problemi","Læs hele opgaven, find de vigtige oplysninger, og vælg derefter en strategi. Du må gerne læse igen.","Leggi tutto, trova le informazioni importanti e scegli una strategia. Puoi rileggere.","Læs bogen højt og løs den sidste gåde.","Leggi il libro e risolvi l'ultimo enigma."),
]
for num,cid,title_da,title_it,sum_da,sum_it,fic_da,fic_it,lesson_da,lesson_it,exp_da,exp_it,mission_da,mission_it in chapter_specs:
    chapters[cid]={"id":cid,"minimum_level":num,"title":{"da":f"Kapitel {num} · {title_da}","it":f"Capitolo {num} · {title_it}"},"summary":{"da":sum_da,"it":sum_it},"fiction":{"da":fic_da,"it":fic_it},"lesson":{"title":{"da":lesson_da,"it":lesson_it},"objectives":[{"da":sum_da,"it":sum_it},{"da":"Forklar dit valg med ord eller billeder.","it":"Spiegare la scelta con parole o immagini."}],"explanation":{"da":exp_da,"it":exp_it},"examples":[{"target":"Læs · tænk · svar","translation":{"da":"Tag én del ad gangen.","it":"Affronta una parte alla volta."}}],"common_mistakes":[{"da":"Gæt ikke ud fra det første tegn; brug hele ordet eller hele opgaven.","it":"Non indovinare dal primo segno; usa tutta la parola o il problema."}]},"mission":{"da":mission_da,"it":mission_it}}
story["chapters"]=[chapters[x["chapter_id"]] for x in levels_doc["levels"]]
story_path.write_text(dump_yaml(story),encoding="utf-8")

# Enemies and scalable visual variants.
enemies_path=PACK/"enemies.yaml"
enemy_doc=yaml.safe_load(enemies_path.read_text(encoding="utf-8"))
enemies={x["level"]:x for x in enemy_doc["enemies"]}
enemy_specs=[
(5,"sentence_guardian","sentenceGuardian",300,90,"comprehension","goblin",0,"bridge","#ffd6a5"),
(6,"lake_frog","lakeFrog",360,100,"grammar","bat",1,"lake","#8de5d1"),
(7,"aa_keeper","aaKeeper",425,115,"vocabulary","troll",2,"ring","#8fc9ff"),
(8,"message_mage","messageMage",495,130,"comprehension","wizard",4,"message","#f2b8ff"),
(9,"story_owl","storyOwl",570,145,"comprehension","bat",1,"book","#d7c6ff"),
(10,"twenty_dragon","twentyDragon",655,165,"grammar","dragon",3,"twenty","#ffd37d"),
(11,"garden_troll","gardenTroll",750,185,"pronunciation","troll",2,"garden","#a8e6a1"),
(12,"ink_wizard","inkWizard",855,210,"comprehension","wizard",4,"ink","#9bb7ff"),
(13,"book_dragon","bookDragon",980,240,"comprehension","dragon",3,"book","#c79bff"),
]
for level,eid,key,hp,reward,focus,sprite,row,var,tint in enemy_specs:
    enemies[level]={"id":eid,"level":level,"name_key":key,"max_energy":hp,"reward_coins":reward,"preferred_focus":focus,"sprite":sprite,"sprite_row":row,"visual_variant":var,"scale":round(1.1+(level-4)*0.025,3),"tint":tint,"semantic_tags":["encounter:reading" if focus=="comprehension" else "encounter:math"],"skill_weaknesses":["defense","precision"] if focus=="comprehension" else ["precision","stamina"]}
enemy_doc["enemies"]=[enemies[n] for n in sorted(enemies)]
enemies_path.write_text(dump_yaml(enemy_doc),encoding="utf-8")

# Three difficulty bands for labyrinths.
lab_path=PACK/"labyrinths.yaml"
lab=yaml.safe_load(lab_path.read_text(encoding="utf-8"))
base=lab["labyrinths"][0]
lab["labyrinths"]=[base,
 {**base,"id":"sentence_bridge_maze","minimum_level":5,"map":{**base["map"],"width":8,"height":8,"theme":"word_bridge"},"questions":{"minimum":18,"target":20,"maximum":22,"minimum_per_focus":3,"monster_encounters":3},"hearts":4,"semantic_tags":["encounter:reading"]},
 {**base,"id":"first_book_maze","minimum_level":10,"map":{**base["map"],"width":9,"height":9,"theme":"story_garden"},"questions":{"minimum":22,"target":24,"maximum":26,"minimum_per_focus":4,"monster_encounters":4},"hearts":4,"semantic_tags":["encounter:reading","encounter:math"]}
]
lab_path.write_text(dump_yaml(lab),encoding="utf-8")

# Pack metadata.
pack_path=PACK/"pack.yaml"
pack=yaml.safe_load(pack_path.read_text(encoding="utf-8"))
pack["version"]="0.4.0"
pack["description"]="Dansk læsestart og matematik gennem 0. klasse og begyndelsen af 1. klasse."
pack["files"]["reading_problems"]="curriculum/reading-problems.jsonl"
pack_path.write_text(dump_yaml(pack),encoding="utf-8")
print(f"Expanded Danish pack: {len(letters)} letters, {len(words)} words, {len(reading)} reading problems, {len(math)} math problems, {len(levels_doc['levels'])} levels.")
