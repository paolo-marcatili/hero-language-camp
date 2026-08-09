import type { TrainingFocus } from "@hero-lang/learning-engine";
import type { EnemyConfig } from "./gameConfig";
import { publicUrl } from "./publicUrl";

export const WORLD = {
  width: 960,
  height: 540,
  groundTopY: 318,
  walkY: 457,
  heroX: 245,
  encounterX: 690,
  heroScale: 1.34,
  monsterScale: 1.35,
  stationScale: 1.35,
  companionScale: 0.48,
  companionOffsetX: -122,
  companionOffsetY: -10,
  speedMult: 1
} as const;

export const DEPTH = {
  sky: 0,
  layer01FarMountains: 1,
  layer02FarHills: 2,
  layer03MidHills: 3,
  layer04SparseForest: 4,
  layer05VillageBack: 6,
  ground: 12,
  largeObjectsBehindHero: 14,
  pathBackObjects: 16,
  station: 18,
  monster: 19,
  companion: 21,
  hero: 22,
  foregroundObjects: 28,
  effects: 51,
  ui: 55
} as const;

/* -------------------------------------------------------------------------- */
/* Parallax layers                                                            */
/* -------------------------------------------------------------------------- */

export const PARALLAX_LAYER_IDS = [
  "layer-00-sky",
  "layer-01-far-mountains",
  "layer-02-far-hills",
  "layer-03-mid-hills",
  "layer-04-sparse-forest",
  "layer-05-village-back",
  "layer-06-path-ground"
] as const;

export type ParallaxLayerId = (typeof PARALLAX_LAYER_IDS)[number];

export interface ParallaxLayerConfig {
  id: ParallaxLayerId;
  textureKey: string;
  path: string;
  kind: "image" | "tile";
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  speed: number;
}

const parallaxSpeed = (baseSpeed: number): number =>
  baseSpeed * WORLD.speedMult;

export const PARALLAX_LAYERS = [
  {
    id: "layer-00-sky",
    textureKey: "layer-00-sky",
    path: publicUrl("assets/pixel/layer-00-sky.png"),
    kind: "image",
    x: 0,
    y: 0,
    width: WORLD.width,
    height: WORLD.height,
    depth: DEPTH.sky,
    speed: 0
  },
  {
    id: "layer-01-far-mountains",
    textureKey: "layer-01-far-mountains",
    path: publicUrl("assets/pixel/layer-01-far-mountains.png"),
    kind: "tile",
    x: 0,
    y: 108,
    width: WORLD.width,
    height: 190,
    depth: DEPTH.layer01FarMountains,
    speed: parallaxSpeed(0.05)
  },
  {
    id: "layer-02-far-hills",
    textureKey: "layer-02-far-hills",
    path: publicUrl("assets/pixel/layer-02-far-hills.png"),
    kind: "tile",
    x: 0,
    y: 164,
    width: WORLD.width,
    height: 146,
    depth: DEPTH.layer02FarHills,
    speed: parallaxSpeed(0.15)
  },
  {
    id: "layer-03-mid-hills",
    textureKey: "layer-03-mid-hills",
    path: publicUrl("assets/pixel/layer-03-mid-hills.png"),
    kind: "tile",
    x: 0,
    y: 190,
    width: WORLD.width,
    height: 128,
    depth: DEPTH.layer03MidHills,
    speed: parallaxSpeed(0.32)
  },
  {
    id: "layer-04-sparse-forest",
    textureKey: "layer-04-sparse-forest",
    path: publicUrl("assets/pixel/layer-04-sparse-forest.png"),
    kind: "tile",
    x: 0,
    y: 176,
    width: WORLD.width,
    height: 178,
    depth: DEPTH.layer04SparseForest,
    speed: parallaxSpeed(0.58)
  },
  {
    id: "layer-05-village-back",
    textureKey: "layer-05-village-back",
    path: publicUrl("assets/pixel/layer-05-village-back.png"),
    kind: "tile",
    x: 0,
    y: 206,
    width: WORLD.width,
    height: 154,
    depth: DEPTH.layer05VillageBack,
    speed: parallaxSpeed(0.77)
  },
  {
    id: "layer-06-path-ground",
    textureKey: "layer-06-path-ground",
    path: publicUrl("assets/pixel/layer-06-path-ground.png"),
    kind: "tile",
    x: 0,
    y: WORLD.groundTopY,
    width: WORLD.width,
    height: WORLD.height - WORLD.groundTopY,
    depth: DEPTH.ground,
    speed: parallaxSpeed(1)
  }
] as const satisfies readonly ParallaxLayerConfig[];

const PARALLAX_SPEED_BY_ID = new Map<ParallaxLayerId, number>(
  PARALLAX_LAYERS.map((layer) => [layer.id, layer.speed])
);

export function getParallaxSpeed(layerId: ParallaxLayerId): number {
  return PARALLAX_SPEED_BY_ID.get(layerId) ?? 0;
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The imported hero animations are kept as separate 5 x 5 sheets.
 *
 * A single 25-column atlas would be 6,400 pixels wide, which is larger than
 * the safe texture limit on some mobile GPUs. Separate sheets also let an
 * artist replace one animation without rebuilding every other animation.
 */
export const HERO_FRAME = {
  width: 256,
  height: 256,
  columns: 5,
  rows: 5,
  count: 25,
  // tools/import-hero-animation-sheets.py aligns visible artwork to this
  // transparent margin below the character.
  bottomPadding: 12
} as const;

export function getHeroRenderY(scale = WORLD.heroScale): number {
  return WORLD.walkY + HERO_FRAME.bottomPadding * scale;
}

export interface HeroSpriteSheetConfig {
  key: string;
  path: string;
}

export const HERO_SPRITESHEETS = {
  walk: {
    key: "hero-walk",
    path: publicUrl("assets/pixel/hero-walk.png")
  },
  attack1: {
    key: "hero-attack-simple",
    path: publicUrl("assets/pixel/hero-attack-simple.png")
  },
  attack2: {
    key: "hero-attack-swing",
    path: publicUrl("assets/pixel/hero-attack-swing.png")
  },
  fall: {
    key: "hero-fall",
    path: publicUrl("assets/pixel/hero-fall.png")
  },
  energy: {
    key: "hero-energy-ball",
    path: publicUrl("assets/pixel/hero-energy-ball.png")
  },
  parry: {
    key: "hero-parry",
    path: publicUrl("assets/pixel/hero-parry.png")
  },
  victory: {
    key: "hero-victory",
    path: publicUrl("assets/pixel/hero-victory.png")
  }
} as const satisfies Record<string, HeroSpriteSheetConfig>;

export type HeroSpriteSheetId = keyof typeof HERO_SPRITESHEETS;

export const HERO_ANIMATION_PREFIX = "hero";

export interface HeroAnimationConfig {
  sheet: HeroSpriteSheetId;
  start: number;
  end: number;
  frameRate: number;
  repeat: number;
}

const fullHeroAnimation = (
  sheet: HeroSpriteSheetId,
  frameRate: number,
  repeat: number
): HeroAnimationConfig => ({
  sheet,
  start: 0,
  end: HERO_FRAME.count - 1,
  frameRate,
  repeat
});

export const HERO_ANIMATIONS = {
  // Standing is the first authored walking frame.
  idle: {
    sheet: "walk",
    start: 0,
    end: 0,
    frameRate: 1,
    repeat: -1
  },

  walk: fullHeroAnimation("walk", 16, -1),
  run: fullHeroAnimation("walk", 21, -1),

  // There is no dedicated jump file. Phaser supplies the short vertical
  // movement while the standing frame remains visible.
  jump: {
    sheet: "walk",
    start: 0,
    end: 0,
    frameRate: 1,
    repeat: 0
  },

  attack1: fullHeroAnimation("attack1", 20, 0),
  attack2: fullHeroAnimation("attack2", 20, 0),
  special: fullHeroAnimation("attack2", 20, 0),

  defend: fullHeroAnimation("parry", 16, 0),
  parry: fullHeroAnimation("parry", 16, 0),

  hitFall: fullHeroAnimation("fall", 16, 0),
  fall: fullHeroAnimation("fall", 16, 0),
  hit: {
    sheet: "fall",
    start: 0,
    end: 8,
    frameRate: 16,
    repeat: 0
  },

  victoryJump: fullHeroAnimation("victory", 16, 0),
  energyBall: fullHeroAnimation("energy", 16, 0),

  // Training mappings requested for these source sheets.
  trainStrength: fullHeroAnimation("attack2", 14, -1),
  trainDefense: fullHeroAnimation("parry", 14, -1),
  trainPrecision: fullHeroAnimation("attack1", 14, -1),
  trainStamina: fullHeroAnimation("energy", 14, -1),

  // Existing action aliases retain compatibility with the game event names.
  throw: fullHeroAnimation("attack1", 18, 0),
  fart: fullHeroAnimation("energy", 16, 0)
} as const satisfies Record<string, HeroAnimationConfig>;

export type HeroAnimationName = keyof typeof HERO_ANIMATIONS;

export function getHeroAnimationKey(name: HeroAnimationName): string {
  return `${HERO_ANIMATION_PREFIX}-${name}`;
}

export const LOOPING_TRAINING_ANIMS: ReadonlySet<HeroAnimationName> = new Set([
  "trainStrength",
  "trainDefense",
  "trainPrecision",
  "trainStamina"
]);


/* -------------------------------------------------------------------------- */
/* Companion                                                                  */
/* -------------------------------------------------------------------------- */

export const COMPANION_FRAME = {
  width: 256,
  height: 256,
  columns: 5,
  rows: 5,
  count: 25,
  bottomPadding: 10
} as const;

export interface CompanionSpriteSheetConfig {
  key: string;
  path: string;
}

export const COMPANION_SPRITESHEETS = {
  walk: {
    key: "companion-dragon-walk",
    path: publicUrl("assets/pixel/companion-dragon-walk.png")
  },
  victory: {
    key: "companion-dragon-victory",
    path: publicUrl("assets/pixel/companion-dragon-victory.png")
  }
} as const satisfies Record<string, CompanionSpriteSheetConfig>;

export type CompanionAnimationName = keyof typeof COMPANION_SPRITESHEETS;

export const COMPANION_ANIMATION_PREFIX = "companion-dragon";

export function getCompanionAnimationKey(name: CompanionAnimationName): string {
  return `${COMPANION_ANIMATION_PREFIX}-${name}`;
}

/* -------------------------------------------------------------------------- */
/* Other sprite sheets                                                        */
/* -------------------------------------------------------------------------- */

export interface SpriteSheetConfig {
  key: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
}

export const SPRITESHEETS = [
  {
    key: "monsters",
    path: publicUrl("assets/pixel/monsters.png"),
    frameWidth: 96,
    frameHeight: 96
  },
  {
    key: "objects-small",
    path: publicUrl("assets/pixel/objects-small.png"),
    frameWidth: 64,
    frameHeight: 64
  },
  {
    key: "objects-large",
    path: publicUrl("assets/pixel/objects-large.png"),
    frameWidth: 256,
    frameHeight: 256
  },
  {
    key: "objects-front",
    path: publicUrl("assets/pixel/objects-front.png"),
    frameWidth: 96,
    frameHeight: 96
  },
  {
    key: "training-stations",
    path: publicUrl("assets/pixel/training-stations.png"),
    frameWidth: 96,
    frameHeight: 96
  }
] as const satisfies readonly SpriteSheetConfig[];

export const TRAINING_STATION_FRAMES: Record<TrainingFocus, number> = {
  vocabulary: 0,
  comprehension: 1,
  grammar: 2,
  pronunciation: 3
};

export const MONSTER_ROWS: Record<string, number> = {
  goblin: 0,
  bat: 1,
  troll: 2,
  dragon: 3,
  wizard: 4,
  blob: 5
};

/* -------------------------------------------------------------------------- */
/* World objects                                                              */
/* -------------------------------------------------------------------------- */

export type ObjectTextureKey =
  | "objects-small"
  | "objects-large"
  | "objects-front";

export interface ObjectFrameConfig {
  textureKey: ObjectTextureKey;
  frame: number;
}

export const OBJECT_FRAMES = {
  log: { textureKey: "objects-small", frame: 0 },
  stump: { textureKey: "objects-small", frame: 1 },
  sign: { textureKey: "objects-small", frame: 2 },
  crate: { textureKey: "objects-small", frame: 3 },
  barrel: { textureKey: "objects-small", frame: 4 },
  smallRock: { textureKey: "objects-small", frame: 5 },
  smallBush: { textureKey: "objects-small", frame: 6 },
  markerPost: { textureKey: "objects-small", frame: 7 },

  largePine: { textureKey: "objects-large", frame: 0 },
  largeOak: { textureKey: "objects-large", frame: 1 },
  largeCottage: { textureKey: "objects-large", frame: 2 },
  largeHouse: { textureKey: "objects-large", frame: 3 },
  arch: { textureKey: "objects-large", frame: 4 },
  well: { textureKey: "objects-large", frame: 5 },
  boulder: { textureKey: "objects-large", frame: 6 },
  largeMushroom: { textureKey: "objects-large", frame: 7 },

  frontGrass: { textureKey: "objects-front", frame: 0 },
  frontFlower: { textureKey: "objects-front", frame: 1 },
  frontRock: { textureKey: "objects-front", frame: 2 },
  frontBush: { textureKey: "objects-front", frame: 3 },
  fern: { textureKey: "objects-front", frame: 4 },
  frontMushroom: { textureKey: "objects-front", frame: 5 }
} as const satisfies Record<string, ObjectFrameConfig>;

export type WorldObjectKind = keyof typeof OBJECT_FRAMES;

export type WorldObjectLayerId =
  | "behindHeroLarge"
  | "pathBack"
  | "foreground";

export interface WorldObjectLayerConfig {
  id: WorldObjectLayerId;
  anchorLayerId: ParallaxLayerId;
  depth: number;
  groundY: number;
  count: number;
  kinds: readonly WorldObjectKind[];
  minScale: number;
  maxScale: number;
  minGap: number;
  maxGap: number;
  initialMinX: number;
  initialMaxX: number;
  spawnPaddingMin: number;
  spawnPaddingMax: number;
  yJitter: number;
  flipChance: number;
  avoidEncounterRadius: number;
}

/**
 * Scenery is intentionally sparse. Each layer uses a shuffle bag at runtime,
 * so all configured kinds appear in a different order before any kind repeats.
 */
export const WORLD_OBJECT_LAYERS = [
  {
    id: "behindHeroLarge",
    anchorLayerId: "layer-06-path-ground",
    depth: DEPTH.largeObjectsBehindHero,
    groundY: WORLD.walkY - 58,
    count: 2,
    kinds: [
      "largePine",
      "largeOak",
      "largeHouse",
      "largeCottage",
      "boulder",
      "well",
      "largeMushroom",
      "arch"
    ],
    minScale: 0.82,
    maxScale: 1.12,
    minGap: 1300,
    maxGap: 2200,
    initialMinX: -260,
    initialMaxX: 820,
    spawnPaddingMin: 130,
    spawnPaddingMax: 340,
    yJitter: 5,
    flipChance: 0.4,
    avoidEncounterRadius: 250
  },
  {
    id: "pathBack",
    anchorLayerId: "layer-06-path-ground",
    depth: DEPTH.pathBackObjects,
    groundY: WORLD.walkY - 45,
    count: 2,
    kinds: [
      "log",
      "stump",
      "sign",
      "crate",
      "barrel",
      "smallRock",
      "smallBush",
      "markerPost"
    ],
    minScale: 0.9,
    maxScale: 1.25,
    minGap: 900,
    maxGap: 1650,
    initialMinX: -160,
    initialMaxX: 900,
    spawnPaddingMin: 100,
    spawnPaddingMax: 280,
    yJitter: 5,
    flipChance: 0.5,
    avoidEncounterRadius: 210
  },
  {
    id: "foreground",
    anchorLayerId: "layer-06-path-ground",
    depth: DEPTH.foregroundObjects,
    groundY: WORLD.walkY + 75,
    count: 2,
    kinds: [
      "frontGrass",
      "frontFlower",
      "frontRock",
      "frontBush",
      "fern",
      "frontMushroom"
    ],
    minScale: 1.1,
    maxScale: 1.65,
    minGap: 700,
    maxGap: 1350,
    initialMinX: -220,
    initialMaxX: 780,
    spawnPaddingMin: 80,
    spawnPaddingMax: 240,
    yJitter: 8,
    flipChance: 0.55,
    avoidEncounterRadius: 180
  }
] as const satisfies readonly WorldObjectLayerConfig[];
