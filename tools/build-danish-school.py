#!/usr/bin/env python3
"""Deterministic school curriculum. Edit school-plan.json, not the generated pack.

Existing IDs/audio remain stable; former 0–13 is mapped once into the new course.
New language is draft pending Danish teacher review. No synthetic isolated phonemes.
"""
import copy
import hashlib
import json
import sys
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'content-packs/da-foundations'
DATA = PACK / 'curriculum'
PLAN = json.loads((DATA / 'school-plan.json').read_text())
SEED = json.loads((DATA / 'legacy-material.json').read_text())
MAP = {i: i * 2 if i < 10 else 20 + (i - 10) * 3 for i in range(14)}
CHECK = '--check' in sys.argv


class Dumper(yaml.SafeDumper):
    def increase_indent(self, flow=False, indentless=False):
        return super().increase_indent(flow, False)


Dumper.add_representer(str, lambda dumper, value: dumper.represent_scalar('tag:yaml.org,2002:str', value, style="'" if ':' in value else None))


def emit(name, data):
    put(name, yaml.dump(data, Dumper=Dumper, allow_unicode=True, sort_keys=False, width=100000))


def put(name, text):
    if CHECK:
        if (PACK / name).read_text() != text:
            raise ValueError(f'Danish curriculum is out of sync: {name}')
    else:
        (PACK / name).write_text(text, encoding='utf-8')


def jsonl(name, rows):
    # Regenerating a curriculum must not discard recordings added since the seed.
    path = PACK / name
    previous = {row['id']: row for row in map(json.loads, path.read_text().splitlines())} if path.exists() else {}
    for row in rows:
        old = previous.get(row['id'], {})
        for key in ('audio', 'prompt_audio', 'answer_audio'):
            generated = row.get(key, [])
            spoken = {entry.get('text') for entry in generated if entry.get('text')}
            field = 'prompt' if key == 'prompt_audio' else 'target' if 'target' in row else 'text' if 'text' in row else 'prompt'
            unchanged = bool(old) and old.get(field) == row.get(field)
            if key == 'answer_audio':
                # Answer sentences are derived from the numbers, not authored here:
                # keep a recording only while the facts the sentence is built from are unchanged.
                unchanged = bool(old) and all(old.get(fact) == row.get(fact) for fact in ('domain', 'operands', 'result', 'whole', 'operation'))
                recordings = [entry for entry in old.get(key, []) if entry.get('source_type') != 'browser_tts' and unchanged]
            else:
                recordings = [entry for entry in old.get(key, []) if entry.get('source_type') != 'browser_tts'
                              and (entry.get('text') in spoken or not entry.get('text') and unchanged)]
            if recordings:
                row[key] = list({entry['id']: entry for entry in [*generated, *recordings]}.values())
    put(name, ''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in rows))


def staged(row):
    row = copy.deepcopy(row)
    row['tags'] = [f'stage:{MAP[int(t[6:])]}' if t.startswith('stage:') else t for t in row['tags']]
    return row


def tags(level, domain):
    return [f'stage:{level}', 'tier:core', f'school:{level // 20}', domain]


def speech(text, id):
    return [{'id': f'voice-{id}', 'url': 'browser-tts:da-DK', 'text': text, 'source_type': 'browser_tts', 'license': 'synthetic-browser-preview', 'review_status': 'draft'}]


def reading(id, level, text, question, answer, wrong, oral=False):
    return dict(id=id, domain='mini_story', text=text, prompt={'da': question}, answer=answer,
                options=[answer, *wrong], oral=oral, image='👂' if oral else '📖',
                audio=speech(text, id), prompt_audio=speech(question, id + '-question'),
                tags=tags(level, 'reading:mini_story'), review_status='needs_native_speaker_review')


def arithmetic(id, level, domain, a, b, limit):
    result = {'addition': lambda: a+b, 'subtraction': lambda: a-b,
              'multiplication': lambda: a*b, 'division': lambda: a//b}[domain]()
    words = {'addition': 'plus', 'subtraction': 'minus', 'multiplication': 'gange', 'division': 'delt med'}
    prompt = f'Hvad er {a} {words[domain]} {b}?'
    return dict(id=id, domain=domain, prompt={'da': prompt}, operands=[a, b], result=result,
                number_range={'min': 0, 'max': limit}, representation='objects' if limit <= 20 else 'numeral',
                object='●', audio=speech(prompt, id), tags=tags(level, f'math:{domain}'), review_status='draft')


def visual(id, level, domain, prompt, display, answer, wrong):
    return dict(id=id, domain=domain, prompt={'da': prompt}, object=display, answer=answer,
                options=[answer, *wrong], result=0, number_range={'min': 0, 'max': 1000},
                audio=speech(prompt, id), tags=tags(level, f'math:{domain}'), review_status='draft')


words = [staged(r) for r in SEED['words']]
letters = [staged(r) for r in SEED['letters']]
instructions = copy.deepcopy(SEED['instructions'])
for entry in instructions:
    exact = {'instruction_sentence_order': 'Byg præcis den sætning, du hører.',
             'instruction_missing_word': 'Lyt til hele sætningen. Vælg det ord, du hørte i den tomme plads.',
             'instruction_missing_letter': 'Lyt til hele ordet. Vælg det bogstav, der mangler.'}.get(entry['id'])
    if exact:
        entry['text'] = {'da': exact}; entry['audio'] = speech(exact, entry['id'])
# Spoken by the engine for the 'hear a word, pick the written word' task (the older
# 'instruction_picture_word' wording is a different, unused prompt).
instructions.append({'id': 'instruction_listen_written_word', 'text': {'da': 'Lyt til ordet. Hvilket skrevet ord hørte du?'},
                     'audio': speech('Lyt til ordet. Hvilket skrevet ord hørte du?', 'instruction_listen_written_word'),
                     'tags': ['tier:core', 'instruction:reading'], 'review_status': 'draft'})
# Spoken labels of answer buttons that no letter name, word or instruction already covers. The list is
# school-plan.json "option_labels" (refresh it with `node tools/check-danish-audio-coverage.mjs --print-option-labels`);
# the engine finds these rows by their text, so they need no extra wiring.
for phrase in PLAN.get('option_labels', []):
    option_id = 'option_label_' + hashlib.sha1(phrase.lower().encode('utf-8')).hexdigest()[:12]
    instructions.append({'id': option_id, 'text': {'da': phrase}, 'audio': speech(phrase, option_id),
                         'tags': ['tier:core', 'instruction:option-label'], 'review_status': 'draft'})
reads = [staged(r) for r in SEED['reading']]
math = [staged(r) for r in SEED['math']]
for row in reads:
    row['oral'] = row['domain'] in ('mini_story', 'sentence_picture', 'initial_sound', 'final_sound', 'syllable_count', 'rhyme')

# State the grouping rule; an unexplained 'odd one out' has many valid readings.
sorting_prompts = ['Hvilken ting er ikke en frugt?', 'Hvilken ting er ikke et dyr?',
                   'Hvilken ting er ikke en frugt?', 'Hvilken ting er ikke et køretøj?',
                   'Hvilket billede viser solen?', 'Hvilken ting kan man spise?',
                   'Hvilken ting er ikke et dyr?', 'Hvilken ting er ikke en frugt?',
                   'Hvilken ting er ikke en bygning?', 'Hvilken ting er ikke en bold?']
for row in math:
    if row['id'].startswith('sorting_phase_e_'):
        question = sorting_prompts[int(row['id'].split('_')[-1])]
        row['prompt'] = {'da': question}; row['audio'] = speech(question, row['id']); row.pop('instruction_id', None)
    # Horizontal repeated bricks/books measure count, not height or thickness.
    if row['id'] in ('measurement_phase_e_4', 'measurement_phase_e_5', 'measurement_phase_e_11'):
        question = 'Hvilken række har færrest ting?' if row['id'].endswith('_5') else 'Hvilken række har flest ting?'
        row['prompt'] = {'da': question}; row['audio'] = speech(question, row['id']); row.pop('instruction_id', None)
    if row['id'] in ('measurement_phase_e_6', 'measurement_phase_e_7'):
        question = 'Hvilket voksent dyr er normalt størst i virkeligheden?' if row['id'].endswith('_6') else 'Hvilket voksent dyr er normalt mindst i virkeligheden?'
        row['prompt'] = {'da': question}; row['audio'] = speech(question, row['id']); row.pop('instruction_id', None)

levels, chapters, enemies = [], [], []
for unit in PLAN['months']:
    grade, month = unit['grade'], unit['month']
    for half in range(2):
        n = grade * 20 + (month - 1) * 2 + half
        title = f"{grade}. klasse · {month}{'A' if half == 0 else 'B'} · {unit['title']}"
        objectives = [unit['language'], unit['math'], unit['logic']]
        cap = 5 + 3*n
        levels.append(dict(number=n, title=title, school_grade=grade, teaching_month=month, fortnight=half+1,
                           reading_mode='oral' if grade == 0 else 'supported' if n < 30 else 'independent',
                           objectives=objectives, stat_cap=cap, content_tags=[f'stage:{n}'],
                           theme={'da': unit['title']}, learning_goal={'da': ' '.join(objectives)}, chapter_id=f'school_{n}',
                           unlock_requires={'completed_training_sessions': 6 + grade*2, 'answered_fight_questions': 10,
                                            'min_stats': {k: max(1, min(cap-2, n+1)) for k in ['strength','defense','precision','stamina']}},
                           fight={'min_questions': 10, 'at_min_questions': 10, 'timer_seconds': 30, 'max_questions': 24, 'max_mistakes_to_win': 8}))
        chapters.append(dict(id=f'school_{n}', minimum_level=n, title={'da': title},
            summary={'da': ' '.join(objectives)}, fiction={'da': f"Helten følger stien til {unit['title'].lower()}. Dragen har fundet en ny gåde. Brug det, du lærer, til at åbne den næste port."},
            lesson={'title': {'da': unit['title']}, 'objectives': [{'da': text} for text in objectives],
                    'explanation': {'da': unit['parent_activity']}, 'examples': [{'target': unit['story'], 'translation': {'da': unit['story']}}]},
            mission={'da': unit['parent_activity']}, cliffhanger={'da': 'Den næste port åbner for en ny opdagelse.'}))
        enemy = copy.deepcopy(SEED['enemies']['enemies'][min(13,n//2)])
        enemy.update(id=f'da_school_{n}', level=n, max_energy=100+45*n, reward_coins=15+5*n, semantic_tags=[f'stage:{n}'])
        enemies.append(enemy)
        # Four authored comprehension questions per month, two at each fortnight.
        for j, q in enumerate(unit['questions'][half*2:half*2+2]):
            reads.append(reading(f'school_read_{n}_{j}', n, unit['story'], q[0], q[1], q[2:], grade == 0))
        # Controlled number families: each operation and representation has a purpose.
        limit = unit['number_limit']
        for j in range(6):
            a = 1 + (month + j + half) % max(2, limit // 2)
            b = 1 + (j*2 + half) % max(2, min(10, limit // 3))
            if grade > 0 and limit >= 100: a += (j % 4 + 1) * 10
            if limit >= 1000: a += (j % 3 + 1) * 100
            math.append(arithmetic(f'school_add_{n}_{j}', n, 'addition', a, b, limit))
            math.append(arithmetic(f'school_sub_{n}_{j}', n, 'subtraction', a+b, b, limit))
        for j, logic in enumerate(unit['logic_tasks']):
            math.append(visual(f'school_logic_{n}_{j}', n, *logic))
        if grade == 2 and month >= 3:
            multiplier = [2,5,10,3,4,2,5,10][month-3]
            for j in range(1,6):
                math.append(arithmetic(f'school_mul_{n}_{j}', n, 'multiplication', multiplier, j+half, 100))
                math.append(arithmetic(f'school_div_{n}_{j}', n, 'division', multiplier*(j+half), multiplier, 100))
        for j, word in enumerate(unit.get('words', [])):
            if any(r['target'] == word[0] for r in words): continue
            words.append(dict(id=f'school_word_{n}_{j}', concept=word[0], target=word[0], translation=word[0], translations={'da':word[0]},
                              emoji=word[1], graphemes=list(word[0]), phonemes=[], decodability='high_frequency',
                              tags=tags(n,'topic:school'), audio=speech(word[0],f'school_word_{n}_{j}'), review_status='needs_native_speaker_review'))

emit('levels.yaml', {'progression': {'stat_cap_start':5,'stat_cap_per_level':3,'unauthored_level_mode':'review',
                                    'curriculum_revision':2,'legacy_level_map_revision':2,'legacy_level_map':MAP}, 'levels':levels})
story = copy.deepcopy(SEED['story']); story['chapters'] = chapters; emit('story.yaml',story)
emit('enemies.yaml', {'enemies': enemies, 'fallback': {'enemy_id': enemies[-1]['id'], 'energy_growth_per_level':.08,'reward_growth_per_level':.08,'max_scale':1.45}})
jsonl('dictionary/words.jsonl',words); jsonl('dictionary/letters.jsonl',letters)
jsonl('curriculum/reading-problems.jsonl',reads); jsonl('curriculum/math-problems.jsonl',math)
jsonl('curriculum/instructions.jsonl',instructions)
tag_doc = yaml.safe_load((PACK/'tags.yaml').read_text())
known = {tag['id'] for tag in tag_doc['controlled_tags']}
for tag in sorted({tag for row in [*words,*letters,*reads,*math] for tag in row['tags']} | {'instruction:option-label'} | {f'stage:{n}' for n in range(60)}):
    if tag not in known:
        tag_doc['controlled_tags'].append({'id':tag,'label':tag,'description':'Kontrolleret tag for skoleforløbet.'})
emit('tags.yaml',tag_doc)
meta=yaml.safe_load((PACK/'pack.yaml').read_text()); meta.update(version='1.1.0',age_band='5-9',description='Sprog, logik og matematik fra 0. til 2. klasse.'); emit('pack.yaml',meta)
print(f'Danish school course: {len(levels)} levels; {len(reads)} reading/listening tasks; {len(math)} maths/logic tasks; {len(words)} words.')
