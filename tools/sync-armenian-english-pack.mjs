#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from './pack-utils.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'content-packs', 'hy-eastern-it');
const TARGET = join(ROOT, 'content-packs', 'hy-eastern-en');
const CHECK = process.argv.includes('--check');

function parseJsonl(path) {
  return readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}
function jsonl(rows) { return rows.map((row) => JSON.stringify(row)).join('\n') + '\n'; }
function normalize(text) { return String(text ?? '').trim().toLocaleLowerCase('en').replace(/[\s\p{P}\p{S}]+/gu, ' '); }
function yamlScalar(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (value === '') return "''";
  return JSON.stringify(String(value));
}
function isEmptyCollection(value) {
  return (Array.isArray(value) && value.length === 0)
    || (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);
}
function inlineCollection(value) {
  return Array.isArray(value) ? '[]' : '{}';
}
function toYaml(value, indent = 0) {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (!value.length) return `${pad}[]\n`;
    return value.map((item) => {
      if (!item || typeof item !== 'object') return `${pad}- ${yamlScalar(item)}\n`;
      if (Array.isArray(item)) return item.length ? `${pad}-\n${toYaml(item, indent + 2)}` : `${pad}- []\n`;
      const entries = Object.entries(item);
      if (!entries.length) return `${pad}- {}\n`;
      const [[firstKey, firstValue], ...rest] = entries;
      let out = '';
      if (firstValue && typeof firstValue === 'object') {
        out += isEmptyCollection(firstValue)
          ? `${pad}- ${firstKey}: ${inlineCollection(firstValue)}\n`
          : `${pad}- ${firstKey}:\n${toYaml(firstValue, indent + 4)}`;
      } else out += `${pad}- ${firstKey}: ${yamlScalar(firstValue)}\n`;
      for (const [key, child] of rest) {
        if (child && typeof child === 'object') {
          out += isEmptyCollection(child)
            ? `${' '.repeat(indent + 2)}${key}: ${inlineCollection(child)}\n`
            : `${' '.repeat(indent + 2)}${key}:\n${toYaml(child, indent + 4)}`;
        } else out += `${' '.repeat(indent + 2)}${key}: ${yamlScalar(child)}\n`;
      }
      return out;
    }).join('');
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([key, item]) => {
      if (item && typeof item === 'object') {
        return isEmptyCollection(item)
          ? `${pad}${key}: ${inlineCollection(item)}\n`
          : `${pad}${key}:\n${toYaml(item, indent + 2)}`;
      }
      return `${pad}${key}: ${yamlScalar(item)}\n`;
    }).join('');
  }
  return `${pad}${yamlScalar(value)}\n`;
}
function put(rel, content) {
  const path = join(TARGET, rel);
  mkdirSync(dirname(path), { recursive: true });
  const expected = Buffer.from(content, 'utf8');
  if (CHECK) {
    if (!existsSync(path) || !readFileSync(path).equals(expected)) throw new Error(`English pack is out of sync: ${rel}`);
  } else writeFileSync(path, expected);
}

const sourcePack = parseYaml(readFileSync(join(SOURCE, 'pack.yaml'), 'utf8'));
const sourceLevels = parseYaml(readFileSync(join(SOURCE, 'levels.yaml'), 'utf8'));
const sourceTags = parseYaml(readFileSync(join(SOURCE, 'tags.yaml'), 'utf8'));
const sourceWords = parseJsonl(join(SOURCE, 'dictionary', 'words.jsonl'));
const sourceLetters = parseJsonl(join(SOURCE, 'dictionary', 'letters.jsonl'));
const sourceSentences = parseJsonl(join(SOURCE, 'dictionary', 'sentences.jsonl'));

const levelCopy = [
  ['First sparks', 'Letters, greetings and essential words'],
  ['Who am I?', 'Introduce yourself and ask someone’s name'],
  ['My family', 'Family, possession and simple descriptions'],
  ['Hungry and thirsty', 'Needs, food and polite requests'],
  ['My day', 'Everyday actions and useful classroom phrases'],
  ['Where are we?', 'Places, here/there and location questions'],
  ['Numbers and time', 'Age, numbers, today, tomorrow and weather'],
  ['Us and them', 'Plural forms and negation'],
  ['Small adventures', 'Short dialogues and integrated comprehension']
];
const levels = (sourceLevels.levels ?? []).map((level) => {
  const [theme, goal] = levelCopy[level.number] ?? [`Level ${level.number}`, 'Review and extend previous material'];
  return { ...level, title: `Level ${level.number} · ${theme}`, theme: { en: theme }, learning_goal: { en: goal } };
});

const pack = {
  ...sourcePack,
  pack_id: 'hy-eastern-en',
  version: '0.1.0',
  title: 'Eastern Armenian for English-speaking children',
  description: 'A gradual Eastern Armenian course for children who use English for explanations, stories and menus.',
  base_language: { code: 'en', name_english: 'English', name_native: 'English', is_default: true }
};
const ui = {
  language: 'en',
  text: {
    packName: 'Eastern Armenian · English',
    adminItalian: 'English',
    adminTranslationDistractors: 'English alternatives (one per line)',
    adminTranslationDistractorsHint: 'Add similar but clearly incorrect alternatives by changing the subject, action, place or meaning.',
    fightHint: 'Answer quickly for a stronger hit. A correct answer after time runs out causes no damage; a wrong answer still lets the monster strike.',
    packWarning: 'Learning content: Armenian wording and pronunciation should continue to be reviewed by native speakers.',
    addTagInCode: 'Add tags in content-packs/hy-eastern-en/tags.yaml'
  }
};
const tags = { controlled_tags: (sourceTags.controlled_tags ?? []).map((tag) => ({ ...tag, description: `Controlled curriculum tag: ${tag.id}` })) };

const wordsById = new Map(sourceWords.map((word) => [word.id, word]));
const conceptById = new Map(sourceWords.map((word) => [word.id, normalize(word.concept)]));
const keepWordKeys = ['id','concept','target','transliteration','tags','audio','review_status','hard_distractor_ids','ipa','emoji','syllables','transliterations','image','image_review_status','source','source_location'];
const ITALIAN_SOURCE_IDS = new Set(['user-gist-quizzario', 'uploaded-lesson-archive']);
const ENGLISH_WORD_OVERRIDES = new Map(Object.entries({
  hy_exp_yntanik_a20b73: 'family',
  hy_exp_hayeren_19a472: 'Armenian (language)',
  hy_exp_hay_5fecb5: 'Armenian (person)',
  hy_exp_italeren_8dd19c: 'Italian (language)',
  hy_exp_nrank_379ace: 'they',
  hy_exp_nrank_unen_d07f45: 'they have',
  hy_exp_menk_6b880c: 'we',
  hy_exp_menk_unenk_7b78d9: 'we have',
  hy_exp_du_9be5fe: 'you',
  hy_exp_du_unes_e6e546: 'you have',
  hy_exp_sovorel_01bf1c: 'study'
}));
const trustedConceptByTarget = new Map();
for (const source of sourceWords) {
  if (!source.concept || typeof source.concept !== 'string') continue;
  if (!ITALIAN_SOURCE_IDS.has(source.source)) trustedConceptByTarget.set(source.target, source.concept);
}
function englishWordLabel(source) {
  const explicit = ENGLISH_WORD_OVERRIDES.get(source.id);
  if (explicit) return explicit;
  if (!ITALIAN_SOURCE_IDS.has(source.source)) return source.concept;
  const duplicate = trustedConceptByTarget.get(source.target);
  if (duplicate) return duplicate;
  const isCurriculumItem = (source.tags ?? []).some((tag) => /^stage:\d+$/.test(tag) || tag === 'tier:core');
  if (isCurriculumItem) throw new Error(`Missing curated English translation for curriculum word ${source.id}: ${source.concept}`);
  return null;
}
const excludedItalianExtensionIds = [];
const words = sourceWords.flatMap((source) => {
  if (!source.concept || typeof source.concept !== 'string') throw new Error(`Missing source concept on ${source.id}`);
  const english = englishWordLabel(source);
  if (!english) {
    excludedItalianExtensionIds.push(source.id);
    return [];
  }
  const item = {};
  for (const key of keepWordKeys) if (source[key] !== undefined) item[key] = source[key];
  item.concept = english;
  const correct = normalize(english);
  item.hard_distractor_ids = (source.hard_distractor_ids ?? []).filter((id) => {
    const other = wordsById.get(id);
    if (!other) return false;
    const otherEnglish = englishWordLabel(other);
    return otherEnglish && normalize(otherEnglish) !== correct;
  });
  item.translation = english;
  item.base_language = 'en';
  item.meanings = [english];
  item.translations = { en: english };
  item.translation_review_status = { en: 'reviewed' };
  return [item];
});

const letters = sourceLetters.map((source) => ({
  ...source,
  names: { en: `${source.spoken_name ?? source.character} · sound ${source.sound}` },
  sound_approximation: { en: `Approximate sound: ${source.sound}. Listen to the Armenian audio for the exact pronunciation.` }
}));

const EN = new Map(Object.entries({
  hy_sentence_hello: 'Hello!',
  hy_sentence_yes: 'Yes.',
  hy_sentence_no: 'No.',
  hy_sentence_thank_you: 'Thank you.',
  hy_sentence_i_am_ani: 'I am Ani.',
  hy_sentence_how_are_you: 'How are you?',
  hy_sentence_i_am_well: 'I’m fine.',
  hy_sentence_exp_fa35916e0d36: 'What is your name?',
  hy_sentence_exp_d24a71eb2b31: 'My name is Ani.',
  hy_sentence_this_is_mom: 'This is Mom.',
  hy_sentence_this_is_dad: 'This is Dad.',
  hy_sentence_this_is_dog: 'This is a dog.',
  hy_sentence_this_is_cat: 'This is a cat.',
  hy_sentence_this_is_house: 'This is a house.',
  hy_sentence_this_is_my_mother: 'This is my mother.',
  hy_sentence_this_is_my_father: 'This is my father.',
  hy_sentence_exp_27581bae2b7c: 'This is my house.',
  hy_sentence_exp_b4fab2f8b516: 'Our house is big.',
  hy_sentence_sister_sings: 'The sister is singing.',
  hy_sentence_brother_plays: 'The brother is playing.',
  hy_sentence_grandma_home: 'Grandma is at home.',
  hy_sentence_i_am_hungry: 'I am hungry.',
  hy_sentence_i_am_thirsty: 'I am thirsty.',
  hy_sentence_please: 'Please.',
  hy_sentence_i_want_water: 'I want some water.',
  hy_sentence_i_want_bread: 'I want some bread.',
  hy_sentence_i_want_tea: 'I want some tea.',
  hy_sentence_i_do_not_understand: 'I don’t understand.',
  hy_sentence_repeat_please: 'Please repeat that.',
  hy_sentence_i_read_book: 'I am reading a book.',
  hy_sentence_dad_eats_bread: 'Dad is eating bread.',
  hy_sentence_where_is_school: 'Where is the school?',
  hy_sentence_park_is_there: 'The park is over there.',
  hy_sentence_school_near: 'The school is nearby.',
  hy_sentence_exp_722d4834fa38: 'Where are you going?',
  hy_sentence_two_dogs: 'There are two dogs.',
  hy_sentence_three_apples: 'There are three apples.',
  hy_sentence_today_rain: 'It is raining today.',
  hy_sentence_tomorrow_school: 'We have school tomorrow.',
  hy_sentence_exp_baf218e40b59: 'How old are you?',
  hy_sentence_exp_32247e450852: 'I am eight years old.',
  hy_sentence_we_are_friends: 'We are friends.',
  hy_sentence_they_are_home: 'They are at home.',
  hy_sentence_we_do_not_go: 'We are not going.',
  hy_sentence_short_dialogue: 'Hello, I’m Ani. And you?',
  hy_sentence_integrated_day: 'Today we are going to school.'
}));
const selected = sourceSentences.filter((row) => EN.has(row.id));
if (selected.length !== EN.size) {
  const have = new Set(selected.map((row) => row.id));
  throw new Error(`Missing curated sentence IDs: ${[...EN.keys()].filter((id) => !have.has(id)).join(', ')}`);
}
function stageOf(row) {
  const tag = (row.tags ?? []).find((value) => /^stage:\d+$/.test(value));
  return tag ? Number(tag.split(':')[1]) : 0;
}
const byStage = new Map();
for (const row of selected) {
  const stage = stageOf(row);
  if (!byStage.has(stage)) byStage.set(stage, []);
  byStage.get(stage).push(row);
}
const sentences = selected.map((source) => {
  const translation = EN.get(source.id);
  const sameStage = byStage.get(stageOf(source)) ?? [];
  const semanticWrong = [...sameStage, ...selected].filter((row) => row.id !== source.id && normalize(EN.get(row.id)) !== normalize(translation));
  const armenianDistractor = semanticWrong[0]?.target_sentence;
  const translationDistractors = [];
  for (const row of semanticWrong) {
    const value = EN.get(row.id);
    if (!translationDistractors.some((candidate) => normalize(candidate) === normalize(value))) translationDistractors.push(value);
    if (translationDistractors.length === 3) break;
  }
  if (!armenianDistractor || translationDistractors.length !== 3) throw new Error(`Not enough unambiguous distractors for ${source.id}`);
  return {
    id: source.id,
    target_sentence: source.target_sentence,
    distractors: [armenianDistractor],
    tags: source.tags,
    audio: source.audio,
    review_status: source.review_status,
    source: source.source,
    source_location: source.source_location,
    prompt: { en: `Choose the Armenian sentence: ${translation}` },
    translation,
    base_language: 'en',
    translation_distractors: { en: translationDistractors },
    translations: { en: translation },
    translation_review_status: { en: 'reviewed' }
  };
});

function chapter(id, level, title, summary, fiction, lessonTitle, objectives, explanation, examples, notes, mistake, mission, cliffhanger) {
  return {
    id, minimum_level: level, title: { en: `Chapter ${level} · ${title}` }, summary: { en: summary }, fiction: { en: fiction },
    story_beats: [{ en: cliffhanger }],
    lesson: {
      title: { en: lessonTitle }, objectives: objectives.map((en) => ({ en })), explanation: { en: explanation },
      examples: examples.map(([target, transliteration, translation, note]) => ({ target, transliteration, translation: { en: translation }, ...(note ? { note: { en: note } } : {}) })),
      dialogue: [], study_notes: notes.map((en) => ({ en })), common_mistakes: [{ en: mistake }]
    },
    mission: { en: mission }, cliffhanger: { en: cliffhanger }
  };
}
const story = {
  title: { en: 'The Spark Path' },
  opening: { en: 'Each chapter mixes a short adventure with a clear Armenian lesson. Reopen earlier chapters whenever you want to review.' },
  milestones: [],
  chapters: [
    chapter('chapter_stage_0',0,'The first sparks','Meet the first letters and use a few essential one-word messages.','A tiny spark lands in the hero’s hand and draws Armenian letters in the air. Each recognised sign lights a stone on the first path.','Letters and one-word messages',['Recognise the first group of Armenian letters.','Use hello, yes, no and thank you.'],'Armenian uses its own alphabet. At first, connect each shape with its Armenian name and sound instead of trying to learn the whole alphabet at once. A single Armenian word can also be a complete message.',[['Բարև։','barev','Hello!'],['Շնորհակալություն։','shnorhakalutyun','Thank you.'],['Այո։ / Ոչ։','ayo / voch','Yes. / No.']],['Keep the name of a letter separate from the sound it represents.','Use the alphabet atlas to revisit letters already introduced.'],'Do not assume an Armenian letter sounds like a Latin letter just because its shape looks familiar.','Light the first runes with greetings and letter recognition.','Beyond the gate, someone has erased every name from a stone bridge.'),
    chapter('chapter_stage_1',1,'The guardian of names','Introduce yourself, ask a name and notice simple forms of “to be”.','A guardian has forgotten every name. The bridge opens only for travellers who can say who they are and ask another person’s name.','Introducing yourself',['Say your name.','Ask another person’s name.','Notice եմ, ես and է in short sentences.'],'In short Armenian identity sentences, a form of “to be” often comes near the end. English usually prefers “I am Ani” or “My name is Ani” rather than copying Armenian word order.',[['Ես Անի եմ։','yes Ani em','I am Ani.'],['Ի՞նչ է քո անունը։','inch e qo anuny','What is your name?'],['Իմ անունը Անի է։','im anuny Ani e','My name is Ani.','A closer word-for-word rendering is “My name is Ani.”']],['Learn the Armenian sentence as a chunk before translating word by word.','Change only the name when practising the pattern.'],'Do not treat every Armenian word-order variation as a different English meaning.','Tell the guardian your name and learn theirs.','The recovered name opens a house full of photographs with missing labels.'),
    chapter('chapter_stage_2',2,'The house of photographs','Talk about family, point to people and things, and express possession.','Moonlit photographs have lost their labels. The hero restores each memory by identifying the people in it.','This is… and possession',['Introduce a nearby person or object.','Use իմ for “my”.','Make a simple description.'],'Սա introduces a nearby person or thing. Իմ means “my” and does not change for grammatical gender the way words do in some European languages.',[['Սա իմ մայրն է։','sa im mayrn e','This is my mother.'],['Սա իմ հայրն է։','sa im hayrn e','This is my father.'],['Մեր տունը մեծ է։','mer tuny mets e','Our house is big.']],['English needs a natural article where appropriate; Armenian structure does not map word for word.','Notice that իմ stays the same with different nouns.'],'Do not add a gender distinction to Armenian իմ.','Relabel the photographs and introduce the family.','The last photograph shows a banquet table with every plate mysteriously empty.'),
    chapter('chapter_stage_3',3,'The silent banquet','Say that you are hungry or thirsty and make polite requests.','Food appears in an enchanted dining hall only when somebody makes a clear request.','Needs and polite requests',['Say that you are hungry or thirsty.','Use ուզում եմ to say what you want.','Add a polite request.'],'Ուզում եմ is a useful “I want” chunk. Armenian and English use articles differently, so choose natural English such as “some water” or “some bread” rather than translating mechanically.',[['Ես ջուր եմ ուզում։','yes jur em uzum','I want some water.'],['Ես սոված եմ։','yes sovats em','I am hungry.'],['Խնդրում եմ։','khndrum em','Please.']],['Practise ուզում եմ as one reusable block.','Translate the meaning naturally instead of matching every Armenian word with one English word.'],'A grammatically possible alternative word order must never be used as the only “wrong” answer.','Make the banquet appear by asking clearly and politely.','A book-shaped key points toward a school that moves every morning.'),
    chapter('chapter_stage_4',4,'The moving school','Use everyday actions and ask for help during a lesson.','The school changes position every morning. It slows down when the hero describes what they are doing and asks for repetition when something is unclear.','Actions and classroom language',['Talk about reading and other current actions.','Say when you do not understand.','Ask somebody to repeat.'],'Armenian present-tense forms can correspond to English simple or continuous forms depending on context. In these lessons we choose the natural English interpretation for the situation.',[['Ես գիրք եմ կարդում։','yes girk em kardum','I am reading a book.'],['Չեմ հասկանում։','chem haskanum','I don’t understand.'],['Կրկնիր, խնդրում եմ։','krknir, khndrum em','Please repeat that.']],['Use classroom phrases as complete chunks.','Listen for the negative form in Չեմ հասկանում։'],'Do not force one English tense mechanically onto every Armenian present-tense sentence.','Stop the moving school by describing actions and asking for help.','Behind the board appears a map whose landmarks keep drifting.'),
    chapter('chapter_stage_5',5,'The map in the mist','Ask where something is and distinguish here from there.','A map appears only in patches. Asking the right location question reveals the next landmark.','Places and location questions',['Ask where a place is.','Understand nearby, here and there.','Use a short destination question.'],'English usually needs an article in “Where is the school?” even though Armenian packages the idea differently. Learn the whole Armenian question pattern.',[['Որտե՞ղ է դպրոցը։','vortegh e dprotsy','Where is the school?'],['Այգին այնտեղ է։','aygin ayntegh e','The park is over there.'],['Ո՞ւր ես գնում։','ur es gnum','Where are you going?']],['Keep “where is…?” and “where are you going?” as separate question patterns.','Use landmarks from the game to practise.'],'Do not accept two answer choices that express the same location meaning with only harmless English word-order changes.','Reveal the route through the mist.','At the end of the map, clouds form the hands of a giant clock.'),
    chapter('chapter_stage_6',6,'The cloud clock','Use numbers, age, today, tomorrow and simple weather language.','A clock made of clouds will not move until the hero counts correctly and places events in time.','Numbers and time',['Say how old you are.','Count small groups.','Talk about today, tomorrow and weather.'],'Armenian expresses age differently from English. Translate Քանի՞ տարեկան ես։ naturally as “How old are you?” and Ես ութ տարեկան եմ։ as “I am eight years old.”',[['Քանի՞ տարեկան ես։','kani tarekan es','How old are you?'],['Ես ութ տարեկան եմ։','yes ut tarekan em','I am eight years old.'],['այսօր անձրև է գալիս','aysor andzrev e galis','It is raining today.']],['Treat age expressions as meaning-based phrases, not literal word substitutions.','Notice the time word first: այսօր is today and վաղը is tomorrow.'],'Do not use the Italian-style age construction in English; English uses “I am … years old.”','Set the cloud clock moving again.','The clock chimes summon several shadowy voices speaking together.'),
    chapter('chapter_stage_7',7,'The chorus of shadows','Use we/they forms and simple negation.','Several shadows speak at once. The hero has to hear whether they mean “we”, “they”, or a negative action.','We, they and negation',['Recognise we and they.','Use plural forms of “to be”.','Understand a simple negative action.'],'English pronouns are normally stated explicitly, so Նրանք տանն են։ should be presented as “They are at home,” not the ambiguous Italian-style “are at home.”',[['Մենք ընկերներ ենք։','menk ynkerner enk','We are friends.'],['Նրանք տանն են։','nrank tann en','They are at home.'],['Մենք չենք գնում։','menk chenk gnum','We are not going.']],['Listen for the plural verb ending as well as the pronoun.','Contrast Մենք and Նրանք aloud.'],'Never offer an English translation that hides a subject distinction the Armenian sentence explicitly makes.','Separate the voices and identify who is speaking.','When the shadows clear, all the earlier paths join into one final road.'),
    chapter('chapter_stage_8',8,'The path of voices','Combine familiar phrases into short dialogues.','The final path echoes with greetings, introductions, places and school language from every previous chapter.','Putting the pieces together',['Follow a short dialogue.','Combine known sentence patterns.','Use context rather than translating one word at a time.'],'At this stage, focus on meaning across a whole exchange. English and Armenian do not need to share the same word order for the translation to be correct.',[['Բարև, ես Անի եմ։ Իսկ դու՞։','barev, yes Ani em. isk du?','Hello, I’m Ani. And you?'],['Այսօր մենք դպրոց ենք գնում։','aysor menk dprots enk gnum','Today we are going to school.']],['Revisit earlier chapters when a pattern feels uncertain.','Use the story dialogue to practise several known chunks together.'],'Do not mark a natural equivalent translation wrong merely because its English word order differs.','Follow the combined path using everything learned so far.','The road remains open for the next chapter of the course.')
  ]
};

if (!CHECK && existsSync(TARGET)) rmSync(TARGET, { recursive: true, force: true });
put('pack.yaml', toYaml(pack));
put('interface.yaml', toYaml(ui));
put('tags.yaml', toYaml(tags));
put('levels.yaml', toYaml(sourceLevels.progression ? { progression: sourceLevels.progression, levels } : { levels }));
put('story.yaml', toYaml(story));
put('dictionary/words.jsonl', jsonl(words));
put('dictionary/letters.jsonl', jsonl(letters));
put('dictionary/sentences.jsonl', jsonl(sentences));
for (const rel of ['tasks.yaml','enemies.yaml','labyrinths.yaml']) {
  const sourcePath = join(SOURCE, rel);
  const targetPath = join(TARGET, rel);
  if (CHECK) {
    if (!existsSync(targetPath) || !readFileSync(targetPath).equals(readFileSync(sourcePath))) throw new Error(`English pack is out of sync: ${rel}`);
  } else {
    mkdirSync(dirname(targetPath), { recursive: true });
    cpSync(sourcePath, targetPath);
  }
}
put('README.md', `# Eastern Armenian · English\n\nThis pack reuses Armenian target text, audio and media from \`hy-eastern-it\`, but all learner-facing explanations and translations are curated for neutral English.\n\nThe generated grammar set deliberately uses semantic distractors rather than word-order permutations, so a valid Armenian inversion is not treated as the only wrong answer.\n\nRegenerate with \`npm run content:sync-english\`.\n`);
console.log(`${CHECK ? 'Checked' : 'Generated'} hy-eastern-en: ${words.length} English-ready words (${excludedItalianExtensionIds.length} uncurated Italian-source extensions omitted), ${letters.length} letters, ${sentences.length} curated sentence exercises, ${story.chapters.length} chapters.`);
