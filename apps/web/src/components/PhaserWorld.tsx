import { useEffect, useRef } from "react";
import Phaser from "phaser";
import type { LearnerState, TrainingFocus } from "@hero-lang/learning-engine";
import type { EnemyConfig, HeroActionEvent, HeroActionName, TrainingOption } from "../gameConfig";
import type { GraphicsPack, HeroAppearance } from "../storage";
import { t } from "../i18n";
import {
  COMPANION_FRAME,
  COMPANION_SPRITESHEETS,
  DEPTH,
  HERO_ANIMATIONS,
  HERO_FRAME,
  HERO_SPRITESHEETS,
  LOOPING_TRAINING_ANIMS,
  MONSTER_ROWS,
  OBJECT_FRAMES,
  PARALLAX_LAYERS,
  SPRITESHEETS,
  TRAINING_STATION_FRAMES,
  WORLD,
  WORLD_OBJECT_LAYERS,
  getCompanionAnimationKey,
  getHeroAnimationKey,
  getHeroRenderY,
  getParallaxSpeed,
  type HeroAnimationName,
  type ParallaxLayerConfig,
  type WorldObjectKind,
  type WorldObjectLayerConfig,
  type WorldObjectLayerId
} from "../worldConfig";

export type WorldEncounter =
  | { type: "training"; focus: TrainingFocus }
  | { type: "fight"; enemy: EnemyConfig }
  | { type: "labyrinth" };

interface PhaserWorldProps {
  language: string;
  state: LearnerState;
  appearance: HeroAppearance;
  graphicsPack: GraphicsPack;
  debug: boolean;
  debugBypass: boolean;
  statCap: number;
  trainingOptions: TrainingOption[];
  actionEvent: HeroActionEvent | null;
  encounter: WorldEncounter | null;
  encounterMode: "approaching" | "active" | null;
  sessionActive: boolean;
}

interface SceneProps extends PhaserWorldProps {
  encounterLabel: string;
}

interface DecorObject {
  sprite: Phaser.GameObjects.Sprite;
  layer: WorldObjectLayerConfig;
  kind: WorldObjectKind | null;
}

const HERO_ACTION_ANIMS: Partial<Record<HeroActionName, HeroAnimationName>> = {
  walk: "walk",
  run: "run",
  jump: "jump",
  sword: "attack1",
  move_forward: "run",
  stumble: "hit",
  fall: "fall",
  hero_hit: "attack1",
  enemy_hit: "hit",
  super_punch: "attack2",
  fart_attack: "fart",
  self_punch: "hit",
  parry: "defend",
  dagger_throw: "throw",
  strategy_spell: "trainPrecision",
  monster_defeat: "victoryJump",
  victory: "victoryJump",
  training_dummy: "trainStrength",
  shield_block: "trainDefense",
  rune_focus: "trainPrecision",
  echo_crystal: "trainStamina",
  lift_rock: "trainStrength",
  target_throw: "throw",
  puzzle_think: "trainPrecision",
  letter_trace: "trainPrecision"
};

export function PhaserWorld(props: PhaserWorldProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<SideScrollerScene | null>(null);
  const lastActionSerial = useRef<number | null>(null);

  useEffect(() => {
    if (!hostRef.current || gameRef.current) return;
    const scene = new SideScrollerScene();
    sceneRef.current = scene;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: WORLD.width,
      height: WORLD.height,
      backgroundColor: "#83dbff",
      pixelArt: false,
      roundPixels: true,
      fps: {
        // World motion is delta-based; keep real frame time after tab/focus changes.
        smoothStep: false
      },
      physics: { default: "arcade" },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: WORLD.width,
        height: WORLD.height
      },
      scene
    });
    gameRef.current = game;
    return () => {
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    // Station and encounter labels are intentionally disabled. The visual
    // station/monster should communicate the encounter without floating text.
    const sceneProps = { ...props, encounterLabel: "" };
    sceneRef.current?.setWorldProps(sceneProps);
  }, [props.language, props.state.path_distance, props.state.level, props.state.inventory, props.appearance.spriteSet, props.graphicsPack, props.debug, props.debugBypass, props.statCap, props.encounter, props.encounterMode, props.sessionActive, props.trainingOptions]);

  useEffect(() => {
    if (!props.actionEvent) return;
    if (lastActionSerial.current === props.actionEvent.serial) return;
    lastActionSerial.current = props.actionEvent.serial;
    sceneRef.current?.playHeroAction(props.actionEvent.name);
  }, [props.actionEvent]);

  return (
    <section className="phaser-world-shell" aria-label="Hero side-scrolling path">
      <div className="phaser-stage" ref={hostRef} />
      {props.debug ? (
        <div className="world-debug-card phaser-debug-card">
          <div><span>{t(props.language, "path")}</span><strong>{Math.floor(props.state.path_distance)} m</strong></div>
          <div><span>{t(props.language, "renderer")}</span><strong>Phaser 2D</strong></div>
          <div><span>{t(props.language, "statCap")}</span><strong>{Number.isFinite(props.statCap) ? props.statCap : "∞"}</strong></div>
          <div><span>{t(props.language, "testMode")}</span><strong>{props.debugBypass ? "ON" : "OFF"}</strong></div>
        </div>
      ) : null}
    </section>
  );
}


class SideScrollerScene extends Phaser.Scene {
  private props: SceneProps | null = null;
  private imageLayers = new Map<string, Phaser.GameObjects.Image>();
  private tileLayers = new Map<string, Phaser.GameObjects.TileSprite>();
  private layerConfigs = new Map<string, ParallaxLayerConfig>();
  private failedTextures = new Set<string>();
  private decorObjects: DecorObject[] = [];
  private decorByLayer = new Map<WorldObjectLayerId, DecorObject[]>();
  private kindDecks = new Map<WorldObjectLayerId, WorldObjectKind[]>();
  private lastKindByLayer = new Map<WorldObjectLayerId, WorldObjectKind>();
  private hero!: Phaser.GameObjects.Sprite;
  private monster!: Phaser.GameObjects.Sprite;
  private station!: Phaser.GameObjects.Sprite;
  private encounterLabel!: Phaser.GameObjects.Text;
  private actionText!: Phaser.GameObjects.Text;
  private actionGraphics!: Phaser.GameObjects.Graphics;
  private companion!: Phaser.GameObjects.Sprite;
  private lastEncounterKey = "";
  private encounterStart = 0;
  private currentMonsterRow = 0;
  private currentMonsterScale: number = WORLD.monsterScale;
  private companionVictoryActive = false;

  constructor() {
    super("side-scroller");
  }

  preload() {
    this.load.on("loaderror", (file: { key?: string }) => {
      if (file.key) this.failedTextures.add(file.key);
    });
    for (const layer of PARALLAX_LAYERS) this.load.image(layer.textureKey, layer.path);
    for (const sheet of Object.values(HERO_SPRITESHEETS)) {
      this.load.spritesheet(sheet.key, sheet.path, {
        frameWidth: HERO_FRAME.width,
        frameHeight: HERO_FRAME.height
      });
    }
    for (const sheet of Object.values(COMPANION_SPRITESHEETS)) {
      this.load.spritesheet(sheet.key, sheet.path, {
        frameWidth: COMPANION_FRAME.width,
        frameHeight: COMPANION_FRAME.height
      });
    }
    for (const sheet of SPRITESHEETS) {
      this.load.spritesheet(sheet.key, sheet.path, {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight
      });
    }
  }

  create() {
    this.createParallaxLayers();
    this.createDecorObjects();

    this.station = this.add.sprite(WORLD.encounterX, WORLD.walkY + 2, "training-stations", 0).setScale(WORLD.stationScale).setDepth(DEPTH.station).setVisible(false).setOrigin(0.5, 1);
    this.monster = this.add.sprite(WORLD.encounterX, WORLD.walkY - 4, "monsters", 0).setScale(WORLD.monsterScale).setDepth(DEPTH.monster).setVisible(false).setOrigin(0.5, 1);
    this.encounterLabel = this.add.text(WORLD.encounterX, WORLD.walkY - 118, "", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#1e2635",
      backgroundColor: "#fff3b0",
      padding: { left: 8, right: 8, top: 4, bottom: 4 }
    }).setOrigin(0.5).setDepth(DEPTH.ui).setVisible(false).setResolution(1);

    this.hero = this.add
      .sprite(WORLD.heroX, getHeroRenderY(), HERO_SPRITESHEETS.walk.key, 0)
      .setScale(WORLD.heroScale)
      .setDepth(DEPTH.hero)
      .setOrigin(0.5, 1);
    this.createHeroAnimations();
    this.hero.play(getHeroAnimationKey("walk"));

    this.createCompanionAnimations();
    this.companion = this.add
      .sprite(
        WORLD.heroX + WORLD.companionOffsetX,
        WORLD.walkY + WORLD.companionOffsetY,
        COMPANION_SPRITESHEETS.walk.key,
        0
      )
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.companion)
      .setScale(WORLD.companionScale)
      .setVisible(false);

    this.actionGraphics = this.add.graphics().setDepth(DEPTH.effects);
    this.actionText = this.add.text(WORLD.heroX + 76, WORLD.walkY - 118, "", {
      fontFamily: "monospace",
      fontSize: "22px",
      color: "#182033",
      backgroundColor: "#fff36f",
      padding: { left: 8, right: 8, top: 4, bottom: 4 }
    }).setOrigin(0.5).setVisible(false).setDepth(DEPTH.ui).setResolution(1);

    this.updateTheme();
    if (this.props) this.applyWorldProps(this.props);
  }

  update(_time: number, delta: number) {
    const props = this.props;
    const moving = !props?.sessionActive;
    const baseSpeed = moving ? (props?.encounterMode === "approaching" ? 125 : 150) : 0;
    const step = (delta / 1000) * baseSpeed;

    for (const layer of PARALLAX_LAYERS) {
      const tile = this.tileLayers.get(layer.id);
      if (tile && layer.speed > 0) tile.tilePositionX += step * layer.speed;
    }

    this.scrollDecorObjects(step);
    this.updateEncounterPosition();
    this.maintainEncounterClearance();
    this.syncCompanion();
  }

  setWorldProps(props: SceneProps) {
    this.props = props;
    if (this.hero) this.applyWorldProps(props);
  }

  playHeroAction(action: HeroActionName) {
    if (!this.hero) return;

    const animName = HERO_ACTION_ANIMS[action] ?? "idle";
    const definition = HERO_ANIMATIONS[animName];
    const key = getHeroAnimationKey(animName);

    if (this.anims.exists(key)) this.hero.play(key, true);
    else this.hero.play(getHeroAnimationKey("walk"), true);

    this.animateHeroForAction(action);
    this.showActionEffect(action);
    this.updateMonsterForAction(action);
    this.updateCompanionForAction(action);

    const isLoopingTraining =
      LOOPING_TRAINING_ANIMS.has(animName) &&
      this.props?.sessionActive === true &&
      this.props.encounter?.type === "training";

    if (isLoopingTraining || animName === "walk" || animName === "run") return;

    const frameCount = definition.end - definition.start + 1;
    if (definition.repeat === 0 && frameCount > 1) {
      // Listen only for this animation. A generic animationcomplete listener
      // can be triggered by a later action when animations are interrupted.
      this.hero.once(`animationcomplete-${key}`, () => {
        if (!this.hero?.active) return;
        this.playRestingAnimation();
      });
    }

    // Looping aliases used outside training do not emit animationcomplete.
    // A duration-aware fallback also keeps the single-frame jump visible long
    // enough for its Phaser movement tween.
    const fallbackMs =
      action === "jump"
        ? 420
        : this.getHeroAnimationDurationMs(animName) + 160;

    this.time.delayedCall(fallbackMs, () => {
      if (!this.hero?.active) return;
      if (!this.hero.anims.isPlaying || this.hero.anims.currentAnim?.key === key) {
        this.playRestingAnimation();
      }
    });
  }

  private getHeroAnimationDurationMs(name: HeroAnimationName): number {
    const definition = HERO_ANIMATIONS[name];
    const frameCount = definition.end - definition.start + 1;
    return Math.max(220, Math.ceil((frameCount / definition.frameRate) * 1000));
  }

  private createParallaxLayers() {
    for (const layer of PARALLAX_LAYERS) {
      this.layerConfigs.set(layer.id, layer);
      if (this.failedTextures.has(layer.textureKey) || !this.textures.exists(layer.textureKey)) continue;
      if (layer.kind === "image") {
        const image = this.add.image(layer.x, layer.y, layer.textureKey).setOrigin(0, 0).setDepth(layer.depth).setDisplaySize(layer.width, layer.height);
        this.imageLayers.set(layer.id, image);
      } else {
        const tile = this.add.tileSprite(layer.x, layer.y, layer.width, layer.height, layer.textureKey).setOrigin(0, 0).setDepth(layer.depth);
        this.tileLayers.set(layer.id, tile);
      }
    }
  }

  private applyWorldProps(props: SceneProps) {
    // Do not force the hero back to the walking texture here: every animation
    // now lives in its own spritesheet and Phaser swaps textures per frame.
    this.hero.setScale(WORLD.heroScale);

    const trainingAnimation = this.getTrainingAnimation();
    const currentAnimation = this.hero.anims.currentAnim?.key ?? "";

    if (trainingAnimation) {
      const trainingKey = getHeroAnimationKey(trainingAnimation);
      const maySwitchToTraining =
        !this.hero.anims.isPlaying ||
        currentAnimation === getHeroAnimationKey("idle") ||
        currentAnimation === getHeroAnimationKey("walk") ||
        currentAnimation === getHeroAnimationKey("run");

      if (maySwitchToTraining && currentAnimation !== trainingKey) {
        this.hero.play(trainingKey, true);
      }
    } else if (
      props.sessionActive &&
      (currentAnimation === getHeroAnimationKey("walk") ||
        currentAnimation === getHeroAnimationKey("run"))
    ) {
      this.hero.play(getHeroAnimationKey("idle"), true);
    } else if (
      !props.sessionActive &&
      currentAnimation !== getHeroAnimationKey("walk")
    ) {
      this.hero.play(getHeroAnimationKey("walk"), true);
    }

    this.updateTheme();
    this.updateEncounterVisibility(props);
    this.syncCompanion();
  }

  private getTrainingAnimation(): HeroAnimationName | null {
    if (!this.props?.sessionActive || this.props.encounter?.type !== "training") {
      return null;
    }

    switch (this.props.encounter.focus) {
      case "vocabulary":
        return "trainStrength";
      case "comprehension":
        return "trainDefense";
      case "grammar":
        return "trainPrecision";
      case "pronunciation":
        return "trainStamina";
      default:
        return null;
    }
  }

  private playRestingAnimation() {
    if (!this.hero?.active) return;

    const trainingAnimation = this.getTrainingAnimation();
    const animation = trainingAnimation ?? (this.props?.sessionActive ? "idle" : "walk");
    this.hero.play(getHeroAnimationKey(animation), true);
  }

  private updateTheme() {
    const theme = this.props?.graphicsPack ?? "forest";
    const all = [...this.imageLayers.values(), ...this.tileLayers.values()];
    for (const item of all) item.clearTint();
    if (theme === "night") {
      this.tintLayers({
        "layer-00-sky": 0x8fc4ff,
        "layer-01-far-mountains": 0x7e94bc,
        "layer-02-far-hills": 0x6f997a,
        "layer-03-mid-hills": 0x628c72,
        "layer-04-sparse-forest": 0x587a64,
        "layer-05-village-back": 0x766b78,
        "layer-06-path-ground": 0x6fb36a
      });
    } else if (theme === "candy") {
      this.tintLayers({
        "layer-00-sky": 0xffd7fa,
        "layer-01-far-mountains": 0xf1bfdc,
        "layer-02-far-hills": 0xc8ef9a,
        "layer-03-mid-hills": 0xb9eca0,
        "layer-04-sparse-forest": 0xd4f8a8,
        "layer-05-village-back": 0xffe0bd,
        "layer-06-path-ground": 0xeec285
      });
    }
  }

  private tintLayers(tints: Partial<Record<string, number>>) {
    for (const [id, tint] of Object.entries(tints)) {
      const image = this.imageLayers.get(id);
      const tile = this.tileLayers.get(id);
      image?.setTint(tint);
      tile?.setTint(tint);
    }
  }

  private updateEncounterVisibility(props: SceneProps) {
    const encounterId = !props.encounter
      ? "none"
      : props.encounter.type === "fight"
        ? props.encounter.enemy.id
        : props.encounter.type === "training"
          ? props.encounter.focus
          : "enchanted-ruins";
    const key = props.encounter ? `${props.encounter.type}:${encounterId}:${props.encounterMode}` : "none";
    if (key !== this.lastEncounterKey) {
      this.lastEncounterKey = key;
      this.encounterStart = this.time.now;
    }

    if (!props.encounter) {
      this.station.setVisible(false);
      this.monster.setVisible(false);
      this.encounterLabel.setVisible(false);
      return;
    }

    this.encounterLabel.setText("").setVisible(false);
    if (props.encounter.type === "fight") {
      this.station.setVisible(false);
      this.currentMonsterScale = WORLD.monsterScale * props.encounter.enemy.scale;
      this.monster.setVisible(true).setAlpha(1).setScale(this.currentMonsterScale).setY(WORLD.walkY - 4);
      this.currentMonsterRow = props.encounter.enemy.spriteRow ?? MONSTER_ROWS[props.encounter.enemy.sprite] ?? 0;
      this.monster.setFrame(this.currentMonsterRow * 4);
      if (props.encounter.enemy.tint !== undefined) this.monster.setTint(props.encounter.enemy.tint);
      else this.monster.clearTint();
    } else {
      this.monster.setVisible(false);
      const stationFrame = props.encounter.type === "labyrinth"
        ? 2
        : TRAINING_STATION_FRAMES[props.encounter.focus] ?? 0;
      this.station.setVisible(true).setFrame(stationFrame);
    }
    this.updateEncounterPosition(true);
  }

  private updateEncounterPosition(force = false) {
    const props = this.props;
    if (!props?.encounter) return;
    let x = WORLD.encounterX;
    if (props.encounterMode === "approaching") {
      const progress = Phaser.Math.Clamp((this.time.now - this.encounterStart) / 1050, 0, 1);
      const eased = Phaser.Math.Easing.Cubic.Out(progress);
      x = WORLD.width + 90 - eased * (WORLD.width + 90 - WORLD.encounterX);
    }
    const visible = props.encounter.type === "fight" ? this.monster : this.station;
    visible.x = force ? x : Phaser.Math.Linear(visible.x, x, 0.18);
    this.encounterLabel.x = visible.x;
    this.encounterLabel.y = WORLD.walkY - (props.encounter.type === "fight" ? 125 : 120);
  }

  private createHeroAnimations() {
    for (const [name, definition] of Object.entries(HERO_ANIMATIONS) as Array<[
      HeroAnimationName,
      (typeof HERO_ANIMATIONS)[HeroAnimationName]
    ]>) {
      const key = getHeroAnimationKey(name);
      if (this.anims.exists(key)) continue;

      const sheet = HERO_SPRITESHEETS[definition.sheet];
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(sheet.key, {
          start: definition.start,
          end: definition.end
        }),
        frameRate: definition.frameRate,
        repeat: definition.repeat
      });
    }
  }

  private createCompanionAnimations() {
    const walkKey = getCompanionAnimationKey("walk");
    if (!this.anims.exists(walkKey)) {
      this.anims.create({
        key: walkKey,
        frames: this.anims.generateFrameNumbers(COMPANION_SPRITESHEETS.walk.key, {
          start: 0,
          end: COMPANION_FRAME.count - 1
        }),
        frameRate: 14,
        repeat: -1
      });
    }

    const victoryKey = getCompanionAnimationKey("victory");
    if (!this.anims.exists(victoryKey)) {
      this.anims.create({
        key: victoryKey,
        frames: this.anims.generateFrameNumbers(COMPANION_SPRITESHEETS.victory.key, {
          start: 0,
          end: COMPANION_FRAME.count - 1
        }),
        frameRate: 14,
        repeat: 0
      });
    }
  }

  private createDecorObjects() {
    this.decorObjects = [];
    this.decorByLayer.clear();
    this.kindDecks.clear();
    this.lastKindByLayer.clear();

    for (const layer of WORLD_OBJECT_LAYERS) {
      const layerObjects: DecorObject[] = [];
      this.decorByLayer.set(layer.id, layerObjects);

      let nextLeftEdge = Phaser.Math.Between(layer.initialMinX, layer.initialMaxX);

      for (let index = 0; index < layer.count; index += 1) {
        const sprite = this.add
          .sprite(0, layer.groundY, "objects-small", 0)
          .setOrigin(0.5, 1)
          .setDepth(layer.depth);

        const decor: DecorObject = { sprite, layer, kind: null };
        this.decorObjects.push(decor);
        layerObjects.push(decor);

        this.configureDecorAppearance(decor);
        sprite.setX(nextLeftEdge + sprite.displayWidth / 2);
        nextLeftEdge =
          sprite.x +
          sprite.displayWidth / 2 +
          this.randomGap(layer);
      }
    }
  }

  private scrollDecorObjects(step: number) {
    for (const decor of this.decorObjects) {
      decor.sprite.x -= step * getParallaxSpeed(decor.layer.anchorLayerId);

      const despawnX = -Math.max(96, decor.sprite.displayWidth * 0.65);
      if (decor.sprite.x < despawnX) {
        this.recycleDecorToRight(decor);
      }
    }
  }

  private recycleDecorToRight(decor: DecorObject) {
    const layerObjects = this.decorByLayer.get(decor.layer.id) ?? [];
    const otherObjects = layerObjects.filter((candidate) => candidate !== decor);
    const rightmostEdge = otherObjects.reduce<number>(
      (max, candidate) =>
        Math.max(max, candidate.sprite.x + candidate.sprite.displayWidth / 2),
      WORLD.width
    );

    this.configureDecorAppearance(decor);

    const offscreenStart =
      WORLD.width +
      Phaser.Math.Between(
        decor.layer.spawnPaddingMin,
        decor.layer.spawnPaddingMax
      );
    const leftEdge = Math.max(
      offscreenStart,
      rightmostEdge + this.randomGap(decor.layer)
    );

    decor.sprite.setX(leftEdge + decor.sprite.displayWidth / 2);
  }

  private configureDecorAppearance(decor: DecorObject) {
    const kind = this.nextDecorKind(decor.layer);
    const frame = OBJECT_FRAMES[kind] ?? OBJECT_FRAMES.smallRock;

    decor.kind = kind;
    decor.sprite
      .setTexture(frame.textureKey, frame.frame)
      .setY(
        decor.layer.groundY +
          Phaser.Math.Between(-decor.layer.yJitter, decor.layer.yJitter)
      )
      .setDepth(decor.layer.depth)
      .setScale(
        Phaser.Math.FloatBetween(
          decor.layer.minScale,
          decor.layer.maxScale
        )
      )
      .setFlipX(Math.random() < decor.layer.flipChance)
      .setVisible(true)
      .setData("kind", kind)
      .setData("layerId", decor.layer.id)
      .setData("anchorLayerId", decor.layer.anchorLayerId);
  }

  private nextDecorKind(layer: WorldObjectLayerConfig): WorldObjectKind {
    let deck = this.kindDecks.get(layer.id) ?? [];

    if (deck.length === 0) {
      deck = Phaser.Utils.Array.Shuffle([...layer.kinds]);
      const lastKind = this.lastKindByLayer.get(layer.id);

      // Do not repeat the previous cycle's final object at the start of the
      // next cycle when another kind is available.
      if (deck.length > 1 && lastKind && deck[0] === lastKind) {
        [deck[0], deck[1]] = [deck[1], deck[0]];
      }

      this.kindDecks.set(layer.id, deck);
    }

    const kind = deck.shift() ?? layer.kinds[0] ?? "smallRock";
    this.lastKindByLayer.set(layer.id, kind);
    return kind;
  }

  private randomGap(layer: WorldObjectLayerConfig): number {
    return Phaser.Math.Between(layer.minGap, layer.maxGap);
  }

  private maintainEncounterClearance() {
    const encounterObject = this.station.visible
      ? this.station
      : this.monster.visible
        ? this.monster
        : null;

    if (!encounterObject) return;

    for (const decor of this.decorObjects) {
      const tooClose =
        Math.abs(decor.sprite.x - encounterObject.x) <
        decor.layer.avoidEncounterRadius;

      if (tooClose) this.recycleDecorToRight(decor);
    }
  }

  private syncCompanion() {
    if (!this.companion || !this.hero || !this.props) return;

    const inventory = this.props.state.inventory ?? [];
    const hasPet = inventory.some((item) => item.includes("pet") || item.includes("dragon"));
    const companionVisible = hasPet || this.props.debug;
    this.companion.setVisible(companionVisible);
    if (!companionVisible) return;

    this.companion
      .setPosition(
        this.hero.x + WORLD.companionOffsetX,
        WORLD.walkY + WORLD.companionOffsetY
      )
      .setScale(WORLD.companionScale)
      .setDepth(DEPTH.companion);

    if (this.companionVictoryActive) return;

    if (!this.props.sessionActive) {
      const walkKey = getCompanionAnimationKey("walk");
      if (this.companion.anims.currentAnim?.key !== walkKey || !this.companion.anims.isPlaying) {
        this.companion.play(walkKey, true);
      }
    } else {
      this.companion.stop();
      this.companion.setTexture(COMPANION_SPRITESHEETS.walk.key, 0);
    }
  }

  private updateCompanionForAction(action: HeroActionName) {
    if (!this.companion?.visible) return;
    if (action !== "victory" && action !== "monster_defeat") return;
    if (this.companionVictoryActive) return;

    const victoryKey = getCompanionAnimationKey("victory");
    this.companionVictoryActive = true;
    this.companion.play(victoryKey, true);
    this.companion.once(`animationcomplete-${victoryKey}`, () => {
      this.companionVictoryActive = false;
      this.syncCompanion();
    });
  }

  private animateHeroForAction(action: HeroActionName) {
    const baseY = getHeroRenderY();

    this.tweens.killTweensOf(this.hero);
    this.hero
      .setAngle(0)
      .setX(WORLD.heroX)
      .setY(baseY)
      .setScale(WORLD.heroScale);

    if (action === "jump") {
      this.tweens.add({
        targets: this.hero,
        y: baseY - 40,
        duration: 170,
        yoyo: true,
        ease: "Quad.easeOut"
      });
    } else if (action === "victory" || action === "monster_defeat") {
      // The imported victory poses already carry most of the movement. A
      // smaller scene tween adds lift without doubling the jump.
      this.tweens.add({
        targets: this.hero,
        y: baseY - 22,
        duration: 220,
        yoyo: true,
        ease: "Quad.easeOut"
      });
    } else if (
      action === "move_forward" ||
      action === "hero_hit" ||
      action === "super_punch"
    ) {
      this.tweens.add({
        targets: this.hero,
        x: WORLD.heroX + 44,
        duration: 180,
        yoyo: true,
        ease: "Cubic.easeOut"
      });
    } else if (
      action === "enemy_hit" ||
      action === "stumble" ||
      action === "self_punch"
    ) {
      this.tweens.add({
        targets: this.hero,
        x: WORLD.heroX - 24,
        angle: -6,
        duration: 150,
        yoyo: true,
        ease: "Sine.easeInOut"
      });
    } else if (action === "fall") {
      // The fall sheet contains the full fall-and-recovery motion. Rotating the
      // entire 256px frame would make the authored poses look distorted.
      this.tweens.add({
        targets: this.hero,
        x: WORLD.heroX - 16,
        duration: 260,
        yoyo: true,
        hold: 180,
        ease: "Sine.easeOut"
      });
    } else if (action === "fart_attack") {
      this.tweens.add({
        targets: this.hero,
        angle: 7,
        x: WORLD.heroX - 12,
        duration: 95,
        yoyo: true,
        repeat: 3
      });
    }
  }

  private showActionEffect(action: HeroActionName) {
    this.actionText.setVisible(false);
    this.actionGraphics.clear();
    const label = actionLabel(action);
    if (label) {
      this.actionText.setText(label).setVisible(true).setAlpha(1).setScale(1);
      this.tweens.add({ targets: this.actionText, y: WORLD.walkY - 155, alpha: 0, scale: 1.3, duration: 720, ease: "Cubic.easeOut", onComplete: () => this.actionText.setVisible(false) });
    }
    if (action === "fart_attack") {
      for (let index = 0; index < 5; index += 1) {
        const c = this.add.circle(WORLD.heroX - 42 - index * 8, WORLD.walkY - 40 - index * 4, 10 + index * 3, 0x73d35f, 0.64).setDepth(DEPTH.effects);
        this.tweens.add({ targets: c, x: c.x - 42, y: c.y - 24, alpha: 0, scale: 1.7, duration: 900, ease: "Sine.easeOut", onComplete: () => c.destroy() });
      }
    }
    if (action === "dagger_throw" || action === "target_throw") {
      const dagger = this.add.triangle(WORLD.heroX + 45, WORLD.walkY - 72, 0, 0, 20, 5, 0, 10, 0xf3f8ff, 1).setStrokeStyle(2, 0x1e2635).setDepth(DEPTH.effects);
      this.tweens.add({ targets: dagger, x: WORLD.encounterX - 34, duration: 330, ease: "Quad.easeIn", onComplete: () => dagger.destroy() });
    }
    if (action === "strategy_spell") {
      for (let index = 0; index < 6; index += 1) {
        const star = this.add.star(WORLD.heroX + 50 + index * 12, WORLD.walkY - 100 - (index % 2) * 14, 5, 3, 9, 0xffec6f, 1).setDepth(DEPTH.effects);
        this.tweens.add({ targets: star, x: WORLD.encounterX - 40 + index * 10, alpha: 0, duration: 700, ease: "Sine.easeOut", onComplete: () => star.destroy() });
      }
    }
  }

  private updateMonsterForAction(action: HeroActionName) {
    if (!this.monster.visible) return;
    const base = this.currentMonsterRow * 4;
    if (action === "monster_defeat") {
      this.monster.setFrame(base + 3);
      this.tweens.add({ targets: this.monster, alpha: 0, y: this.monster.y - 40, scale: this.currentMonsterScale * 1.3, duration: 760, ease: "Cubic.easeOut", onComplete: () => { this.monster.setAlpha(1).setScale(this.currentMonsterScale); } });
      return;
    }
    if (["hero_hit", "super_punch", "fart_attack", "dagger_throw", "strategy_spell"].includes(action)) {
      this.monster.setFrame(base + 1);
      this.tweens.add({ targets: this.monster, x: this.monster.x + 18, duration: 90, yoyo: true, repeat: 2, onComplete: () => this.monster.setFrame(base) });
    } else if (action === "enemy_hit") {
      this.monster.setFrame(base + 2);
      this.tweens.add({ targets: this.monster, x: this.monster.x - 28, duration: 140, yoyo: true, onComplete: () => this.monster.setFrame(base) });
    }
  }
}

function actionLabel(_action: HeroActionName): string {
  return "";
}
