import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode
} from "react";
import type { PackLabyrinthConfig } from "@hero-lang/content-schema";
import type { TrainingFocus } from "@hero-lang/learning-engine";
import {
  findCell,
  getCurrentLabyrinthEncounter,
  getEncounterForCell,
  getLabyrinthNeighbor,
  getLabyrinthNeighbors,
  getLabyrinthQuestionTotal,
  getLabyrinthWallEdges,
  validateLabyrinthTopology,
  type LabyrinthCell,
  type LabyrinthDirection,
  type LabyrinthEncounterKind,
  type LabyrinthSession,
  type LabyrinthWallEdge
} from "../labyrinth";
import { t } from "../i18n";
import { publicUrl } from "../publicUrl";
import { LabyrinthLog } from "./labyrinth/LabyrinthLog";
import { QuestionCard } from "./QuestionCard";

interface LabyrinthPanelProps {
  language: string;
  config: PackLabyrinthConfig;
  session: LabyrinthSession;
  onMove: (cellId: string) => void;
  onAnswer: (selectedOptionId: string) => void;
  onPause: () => void;
  onAbandon: () => void;
}

const ASSET_ROOT = publicUrl("assets/pixel/labyrinth");
const FLOOR_ASSETS = [`${ASSET_ROOT}/floor-01.png`, `${ASSET_ROOT}/floor-02.png`, `${ASSET_ROOT}/floor-03.png`] as const;
const PATH_ASSETS: readonly string[] = Array.from({ length: 16 }, (_, mask) => `${ASSET_ROOT}/path-${String(mask).padStart(2, "0")}.png`);
const DECOR_ASSETS = [`${ASSET_ROOT}/decoration-01.png`, `${ASSET_ROOT}/decoration-02.png`, `${ASSET_ROOT}/decoration-03.png`, `${ASSET_ROOT}/decoration-04.png`, `${ASSET_ROOT}/decoration-05.png`, `${ASSET_ROOT}/decoration-06.png`] as const;
const RUNE_ASSET: Record<TrainingFocus, string> = {
  vocabulary: `${ASSET_ROOT}/rune-vocabulary.png`,
  comprehension: `${ASSET_ROOT}/rune-comprehension.png`,
  grammar: `${ASSET_ROOT}/rune-grammar.png`,
  pronunciation: `${ASSET_ROOT}/rune-pronunciation.png`
};
const WALL_ASSET: Record<LabyrinthDirection, string> = {
  north: `${ASSET_ROOT}/wall-northeast.png`,
  east: `${ASSET_ROOT}/wall-southeast.png`,
  south: `${ASSET_ROOT}/wall-southwest.png`,
  west: `${ASSET_ROOT}/wall-northwest.png`
};
const KEY_DIRECTION: Readonly<Record<string, LabyrinthDirection>> = {
  ArrowUp: "north", w: "north", W: "north",
  ArrowRight: "east", d: "east", D: "east",
  ArrowDown: "south", s: "south", S: "south",
  ArrowLeft: "west", a: "west", A: "west"
};
type LabyrinthMobileTab = "question" | "story";

export function LabyrinthPanel({ language, config, session, onMove, onAnswer, onPause, onAbandon }: LabyrinthPanelProps) {
  const [mobileTab, setMobileTab] = useState<LabyrinthMobileTab>("question");
  const totalQuestions = getLabyrinthQuestionTotal(session);
  const currentEncounter = getCurrentLabyrinthEncounter(session);
  const currentEncounterCell = currentEncounter ? findCell(session, currentEncounter.cellId) : undefined;
  const currentCell = findCell(session, session.positionCellId);
  const questionActive = session.status === "question" && Boolean(session.currentQuestion);
  const previousQuestionActive = useRef(questionActive);

  useEffect(() => {
    if (questionActive) setMobileTab("question");
    else if (previousQuestionActive.current) setMobileTab("story");
    previousQuestionActive.current = questionActive;
  }, [questionActive, session.currentEncounterId]);
  useLabyrinthKeyboardNavigation(session, onMove);

  return (
    <section className={`labyrinth-shell ${questionActive ? "question-open" : "exploring"}`} role="dialog" aria-label={t(language, "labyrinthTitle")}>
      <header className="labyrinth-header">
        <div><span className="eyebrow">{t(language, "labyrinthTraining")}</span><h2>{t(language, "labyrinthTitle")}</h2><p>{t(language, "labyrinthGoal")}</p></div>
        <div className="labyrinth-header-actions">
          <button type="button" className="ghost-button compact-button" onClick={onPause} disabled={session.locked}>{t(language, "labyrinthPause")}</button>
          <button type="button" className="ghost-button compact-button danger-button" onClick={onAbandon} disabled={session.locked}>{t(language, "labyrinthAbandon")}</button>
        </div>
      </header>
      <div className="labyrinth-status-row">
        <LabyrinthHearts current={session.hearts} total={session.maxHearts} />
        <div className="labyrinth-runes" aria-label={t(language, "labyrinthRunes")}>
          {(["vocabulary", "comprehension", "grammar", "pronunciation"] as TrainingFocus[]).map((focus) => (
            <span key={focus} className={session.collectedRunes.includes(focus) ? "rune-token collected" : "rune-token"} title={t(language, focus)}><img src={RUNE_ASSET[focus]} alt="" /></span>
          ))}
        </div>
        <div className="labyrinth-progress"><strong>{session.questionsAnswered}/{totalQuestions}</strong><span>{t(language, "labyrinthQuestions")}</span>{session.runCoins > 0 ? <em>{t(language, "labyrinthRunCoins", { coins: session.runCoins })}</em> : null}</div>
      </div>
      <div className="labyrinth-workspace">
        <div className="labyrinth-map-column">
          <LabyrinthMap language={language} session={session} interactive={!questionActive} onMove={onMove} />
          <div className="labyrinth-map-help"><strong>{t(language, "labyrinthChoosePath")}</strong><span>{t(language, "labyrinthKeyboardHint")}</span></div>
        </div>
        <aside className="labyrinth-side-column" aria-live="polite">
          <div className="labyrinth-mobile-tabs" role="tablist" aria-label={t(language, "labyrinthPanelTabs")}>
            <button type="button" role="tab" aria-selected={mobileTab === "question"} className={mobileTab === "question" ? "active" : ""} onClick={() => setMobileTab("question")}>{t(language, questionActive ? "question" : "labyrinthEvent")}</button>
            {!questionActive ? (
              <button type="button" role="tab" aria-selected={mobileTab === "story"} className={mobileTab === "story" ? "active" : ""} onClick={() => setMobileTab("story")}>{t(language, "labyrinthStoryLog")}</button>
            ) : null}
          </div>
          <div className={`labyrinth-side-tab labyrinth-question-tab ${questionActive || mobileTab === "question" ? "active" : ""}`}>
            {!questionActive ? <LabyrinthEventCard language={language} session={session} cell={currentCell} /> : null}
            {questionActive && session.currentQuestion ? (
              <div className="labyrinth-question-stage">
                <EncounterScene language={language} encounterKind={currentEncounter?.kind} focus={currentEncounterCell?.focus} variant={currentEncounterCell?.eventVariant ?? 0} feedback={session.feedback ?? null} current={session.currentQuestionIndex + 1} total={currentEncounter?.focuses.length ?? 0} />
                <QuestionCard question={session.currentQuestion} language={language} disabled={session.locked} mode="training" index={Math.max(0, session.questionsAnswered - (session.feedback ? 1 : 0))} total={totalQuestions} feedback={session.feedback ?? null} onAnswer={onAnswer} />
              </div>
            ) : <div className="labyrinth-exploration-prompt"><strong>{t(language, "labyrinthExplorePromptTitle")}</strong><p>{t(language, "labyrinthExplorePromptBody")}</p></div>}
          </div>
          <div
            className={`labyrinth-side-tab labyrinth-story-tab ${!questionActive && mobileTab === "story" ? "active" : ""} ${questionActive ? "temporarily-hidden" : ""}`}
            aria-hidden={questionActive}
          >
            <LabyrinthLog entries={session.log ?? []} language={language} />
          </div>
        </aside>
      </div>
      <footer className="labyrinth-footer"><span title={config.map.theme}>{t(language, "labyrinthThemeName")}</span><span>{t(language, "labyrinthAutosave")}</span></footer>
    </section>
  );
}

function LabyrinthEventCard({ language, session, cell }: { language: string; session: LabyrinthSession; cell?: LabyrinthCell }) {
  const asset = cell ? getCellAsset(session, cell) : null;
  const key = session.messageKey ?? eventDescriptionKey(cell?.kind);
  return (
    <section className={`labyrinth-event-card event-${cell?.kind ?? "path"}`}>
      {asset ? <img src={asset} alt="" /> : <span className="labyrinth-event-symbol" aria-hidden="true">✦</span>}
      <div><span>{t(language, "labyrinthCurrentEvent")}</span><strong>{t(language, eventTitleKey(cell?.kind))}</strong><p>{t(language, key)}</p></div>
    </section>
  );
}
function eventTitleKey(kind: LabyrinthCell["kind"] | undefined): string {
  if (kind === "monster") return "labyrinthMonsterEncounter";
  if (kind === "trap") return "labyrinthTrapEncounter";
  if (kind === "rune") return "labyrinthRuneEncounter";
  if (kind === "cache") return "labyrinthCacheEventTitle";
  if (kind === "healing") return "labyrinthHealingEventTitle";
  if (kind === "reveal") return "labyrinthRevealEventTitle";
  if (kind === "treasure") return "labyrinthTreasureEventTitle";
  if (kind === "entrance") return "labyrinthEntranceEventTitle";
  return "labyrinthPathEventTitle";
}
function eventDescriptionKey(kind: LabyrinthCell["kind"] | undefined): string {
  if (kind === "monster") return "labyrinthMonsterEventBody";
  if (kind === "trap") return "labyrinthTrapEventBody";
  if (kind === "rune") return "labyrinthRuneEventBody";
  if (kind === "cache") return "labyrinthCacheEventBody";
  if (kind === "healing") return "labyrinthHealingEventBody";
  if (kind === "reveal") return "labyrinthRevealEventBody";
  if (kind === "treasure") return "labyrinthTreasureEventBody";
  if (kind === "entrance") return "labyrinthEntranceEventBody";
  return "labyrinthPathEventBody";
}

function useLabyrinthKeyboardNavigation(
  session: LabyrinthSession,
  onMove: (cellId: string) => void
): void {
  useEffect(() => {
    if (session.status !== "exploring" || session.locked) return undefined;

    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.repeat || isEditableTarget(event.target)) return;
      const direction = KEY_DIRECTION[event.key];
      if (!direction) return;
      const neighbor = getLabyrinthNeighbor(session, direction);
      if (!neighbor) return;
      event.preventDefault();
      onMove(neighbor.id);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [session, onMove]);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable
    || tagName === "input"
    || tagName === "textarea"
    || tagName === "select"
    || tagName === "button"
    || tagName === "a";
}

function EncounterScene({
  language,
  encounterKind,
  focus,
  variant,
  feedback,
  current,
  total
}: {
  language: string;
  encounterKind: LabyrinthEncounterKind | undefined;
  focus?: TrainingFocus;
  variant: number;
  feedback: LabyrinthSession["feedback"];
  current: number;
  total: number;
}) {
  const asset = encounterAsset(encounterKind, focus, variant);
  const stateClass = feedback?.correct === true
    ? "answer-correct"
    : feedback?.correct === false
      ? "answer-wrong"
      : "";

  return (
    <div className={`labyrinth-encounter-scene encounter-${encounterKind ?? "monster"} ${stateClass}`}>
      <img className="labyrinth-encounter-backdrop" src={`${ASSET_ROOT}/encounter-backdrop.png`} alt="" />
      <div className="labyrinth-encounter-party" aria-hidden="true">
        <img className="labyrinth-encounter-hero" src={`${ASSET_ROOT}/hero.png`} alt="" />
      </div>
      <img className="labyrinth-encounter-creature" src={asset} alt="" />
      <div className="labyrinth-encounter-title">
        <strong>{t(language, encounterTitleKey(encounterKind))}</strong>
        <small>{current}/{total}</small>
      </div>
      <span className="labyrinth-impact-flash" aria-hidden="true" />
    </div>
  );
}

function LabyrinthMap({
  language,
  session,
  interactive,
  onMove
}: {
  language: string;
  session: LabyrinthSession;
  interactive: boolean;
  onMove: (cellId: string) => void;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [compact, setCompact] = useState(false);
  const [miniMapOpen, setMiniMapOpen] = useState(false);

  useEffect(() => {
    const element = frameRef.current;
    if (!element || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setCompact(entry.contentRect.width < 680);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const validation = validateLabyrinthTopology(session);
    if (!validation.valid) console.warn("Invalid labyrinth topology", validation);
  }, [session.seed, session.cells, session.width, session.height]);

  const geometry = useMemo(
    () => getMapGeometry(session.width, session.height),
    [session.width, session.height]
  );
  const currentCell = findCell(session, session.positionCellId) ?? session.cells[0];
  const targetCamera = currentCell
    ? getCamera(currentCell, geometry, compact)
    : getFallbackCamera(geometry, compact);
  const camera = useAnimatedCamera(targetCamera);
  const revealed = new Set(session.revealedCellIds);
  const explored = new Set(session.exploredCellIds);
  const neighborIds = new Set(getLabyrinthNeighbors(session).map((cell) => cell.id));
  const visibleCells = session.cells.filter((cell) => revealed.has(cell.id));
  const orderedCells = [...visibleCells].sort((a, b) => a.row + a.column - (b.row + b.column));
  const wallEdges = useMemo(
    () => getLabyrinthWallEdges(session),
    [session.cells, session.width, session.height]
  );

  const sceneItems: SceneItem[] = [];

  for (const edge of wallEdges) {
    if (!revealed.has(edge.cellId) && !(edge.adjacentCellId && revealed.has(edge.adjacentCellId))) continue;
    const owner = findCell(session, edge.cellId);
    if (!owner) continue;
    const visual = getWallVisual(owner, edge, geometry);
    sceneItems.push({
      key: `wall:${edge.id}`,
      sortY: visual.sortY,
      priority: 1,
      node: (
        <g className={`maze-wall-edge maze-wall-${edge.direction}`} data-edge-id={edge.id}>
          <line
            x1={visual.start.x}
            y1={visual.start.y}
            x2={visual.end.x}
            y2={visual.end.y}
            className="maze-wall-underlay"
          />
          <image
            href={WALL_ASSET[edge.direction]}
            x={visual.imageX}
            y={visual.imageY}
            width={geometry.wallWidth}
            height={geometry.wallHeight}
            preserveAspectRatio="xMidYMid meet"
            className="maze-wall"
          />
        </g>
      )
    });
  }

  for (const cell of orderedCells) {
    const point = cellPoint(cell, geometry);
    const isCurrent = cell.id === session.positionCellId;
    const isExplored = explored.has(cell.id);
    const asset = isExplored ? getCellAsset(session, cell) : null;
    const decoration = isExplored && !isCurrent && !asset ? getDecoration(cell) : null;
    const isResolved = Boolean(cell.resolved || getEncounterForCell(session, cell.id)?.completed);

    sceneItems.push({
      key: `content:${cell.id}`,
      sortY: point.y,
      priority: 2,
      node: (
        <g className={`maze-cell-content ${isCurrent ? "current" : ""} ${isExplored ? "explored" : "revealed"}`}>
          {decoration ? (
            <image
              href={decoration.asset}
              x={point.x - geometry.decorationSize / 2 + decoration.offsetX}
              y={point.y - geometry.decorationSize + geometry.contentGroundOffset + decoration.offsetY}
              width={geometry.decorationSize}
              height={geometry.decorationSize}
              preserveAspectRatio="xMidYMid meet"
              className="maze-decoration"
              filter="url(#labyrinth-token-shadow)"
            />
          ) : null}

          {asset ? (
            <image
              href={asset}
              x={point.x - geometry.eventSize / 2}
              y={point.y - geometry.eventSize + geometry.contentGroundOffset}
              width={geometry.eventSize}
              height={geometry.eventSize}
              preserveAspectRatio="xMidYMid meet"
              className={`maze-event event-${cell.kind}${isResolved ? " resolved" : ""}`}
              filter="url(#labyrinth-token-shadow)"
            />
          ) : null}

          {isCurrent ? (
            <>
              <image
                href={`${ASSET_ROOT}/hero.png`}
                x={point.x - geometry.heroSize / 2}
                y={point.y - geometry.heroSize + geometry.heroGroundOffset}
                width={geometry.heroSize}
                height={geometry.heroSize}
                preserveAspectRatio="xMidYMid meet"
                className="maze-hero-token"
                filter="url(#labyrinth-token-shadow)"
              />
            </>
          ) : null}

          {!isExplored ? (
            <image
              href={`${ASSET_ROOT}/fog.png`}
              x={point.x - geometry.tileWidth / 2}
              y={point.y - geometry.tileHeight / 2}
              width={geometry.tileWidth}
              height={geometry.tileHeight}
              preserveAspectRatio="none"
              className="maze-fog"
            />
          ) : null}
        </g>
      )
    });
  }

  sceneItems.sort((a, b) => a.sortY - b.sortY || a.priority - b.priority || a.key.localeCompare(b.key));

  return (
    <div ref={frameRef} className="labyrinth-map-frame">
      <svg
        className="labyrinth-map"
        viewBox={`0 0 ${camera.viewWidth} ${camera.viewHeight}`}
        role="group"
        aria-label={t(language, "labyrinthMapLabel")}
        aria-keyshortcuts="ArrowUp ArrowRight ArrowDown ArrowLeft W A S D"
      >
        <defs>
          <filter id="labyrinth-token-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#3a2718" floodOpacity="0.42" />
          </filter>
          <filter id="labyrinth-warm-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <clipPath id="labyrinth-camera-clip">
            <rect x="0" y="0" width={camera.viewWidth} height={camera.viewHeight} rx="18" />
          </clipPath>
        </defs>

        <image
          href={`${ASSET_ROOT}/map-backdrop.png`}
          x="0"
          y="0"
          width={camera.viewWidth}
          height={camera.viewHeight}
          preserveAspectRatio="xMidYMid slice"
          className="labyrinth-map-backdrop"
        />

        <g clipPath="url(#labyrinth-camera-clip)">
          <g
            className="labyrinth-world"
            transform={`translate(${-camera.left} ${-camera.top})`}
          >
            <g className="labyrinth-floors">
              {orderedCells.map((cell) => {
                const point = cellPoint(cell, geometry);
                return (
                  <image
                    key={`floor:${cell.id}`}
                    href={FLOOR_ASSETS[cell.floorVariant % FLOOR_ASSETS.length]}
                    x={point.x - geometry.tileWidth / 2}
                    y={point.y - geometry.tileHeight / 2}
                    width={geometry.tileWidth}
                    height={geometry.tileHeight}
                    preserveAspectRatio="none"
                    className={explored.has(cell.id) ? "maze-floor explored" : "maze-floor revealed"}
                  />
                );
              })}
            </g>

            <g className="labyrinth-paths">
              {orderedCells.map((cell) => {
                const point = cellPoint(cell, geometry);
                const routeAsset = PATH_ASSETS[getExitMask(cell.exits)] ?? PATH_ASSETS[0];
                return (
                  <image
                    key={`path:${cell.id}`}
                    href={routeAsset}
                    x={point.x - geometry.tileWidth / 2}
                    y={point.y - geometry.tileHeight / 2}
                    width={geometry.tileWidth}
                    height={geometry.tileHeight}
                    preserveAspectRatio="none"
                    className={explored.has(cell.id) ? "maze-path explored" : "maze-path revealed"}
                  />
                );
              })}
            </g>

            <g className="labyrinth-depth-sorted-scene">
              {sceneItems.map((item) => <g key={item.key}>{item.node}</g>)}
            </g>

            <g className="labyrinth-interaction-layer">
              {orderedCells.map((cell) => {
                const isAvailable = interactive && neighborIds.has(cell.id);
                if (!isAvailable) return null;
                const point = cellPoint(cell, geometry);
                return (
                  <g
                    key={`interaction:${cell.id}`}
                    className="maze-cell available"
                    role="button"
                    tabIndex={0}
                    aria-label={t(language, "labyrinthMoveHere")}
                    onClick={() => onMove(cell.id)}
                    onKeyDown={(event: ReactKeyboardEvent<SVGGElement>) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onMove(cell.id);
                      }
                    }}
                  >
                    <polygon
                      points={diamondPoints(point.x, point.y, geometry.tileWidth * 0.9, geometry.tileHeight * 0.84)}
                      className="maze-available-glow"
                      filter="url(#labyrinth-warm-glow)"
                    />
                    <polygon
                      points={diamondPoints(point.x, point.y, geometry.tileWidth, geometry.tileHeight)}
                      className="maze-hit-area"
                      aria-hidden="true"
                    />
                  </g>
                );
              })}
            </g>
          </g>
        </g>
      </svg>

      <LabyrinthDirectionPad
        language={language}
        session={session}
        interactive={interactive}
        onMove={onMove}
      />

      <button
        type="button"
        className={`labyrinth-minimap-toggle ${miniMapOpen ? "active" : ""}`}
        onClick={() => setMiniMapOpen((open) => !open)}
        aria-label={t(language, miniMapOpen ? "labyrinthHideMiniMap" : "labyrinthShowMiniMap")}
        aria-pressed={miniMapOpen}
      >
        {miniMapOpen ? "×" : "🗺️"}
      </button>

      {miniMapOpen ? <LabyrinthMiniMap session={session} /> : null}
    </div>
  );
}

function LabyrinthDirectionPad({
  language,
  session,
  interactive,
  onMove
}: {
  language: string;
  session: LabyrinthSession;
  interactive: boolean;
  onMove: (cellId: string) => void;
}) {
  const neighbor = (direction: LabyrinthDirection) => getLabyrinthNeighbor(session, direction);
  const button = (direction: LabyrinthDirection, symbol: string, className: string) => {
    const target = neighbor(direction);
    return (
      <button
        type="button"
        className={`labyrinth-dpad-button ${className}`}
        disabled={!interactive || !target}
        aria-label={`${t(language, "labyrinthMoveHere")} ${symbol}`}
        onClick={() => target && onMove(target.id)}
      >
        {symbol}
      </button>
    );
  };

  return (
    <div className="labyrinth-dpad" aria-label={t(language, "labyrinthKeyboardHint")}>
      {button("north", "↑", "up")}
      {button("west", "←", "left")}
      {button("east", "→", "right")}
      {button("south", "↓", "down")}
    </div>
  );
}

function LabyrinthMiniMap({ session }: { session: LabyrinthSession }) {
  const tileWidth = 22;
  const tileHeight = 11;
  const margin = 18;
  const width = (session.width + session.height) * tileWidth / 2 + margin * 2;
  const height = (session.width + session.height) * tileHeight / 2 + margin * 2;
  const originX = session.height * tileWidth / 2 + margin;
  const originY = margin;
  const explored = new Set(session.exploredCellIds);
  const revealed = new Set(session.revealedCellIds);

  const point = (cell: LabyrinthCell) => ({
    x: originX + (cell.column - cell.row) * tileWidth / 2,
    y: originY + (cell.column + cell.row) * tileHeight / 2
  });

  return (
    <div className="labyrinth-minimap-panel">
      <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        {session.cells.filter((cell) => revealed.has(cell.id)).map((cell) => {
          const center = point(cell);
          return (
            <polygon
              key={cell.id}
              points={diamondPoints(center.x, center.y, tileWidth * 0.9, tileHeight * 0.9)}
              className={explored.has(cell.id) ? "minimap-cell explored" : "minimap-cell revealed"}
            />
          );
        })}
        {session.cells.filter((cell) => explored.has(cell.id)).flatMap((cell) => {
          const start = point(cell);
          return cell.exits.flatMap((direction) => {
            if (direction !== "east" && direction !== "south") return [];
            const delta = direction === "east" ? { row: 0, column: 1 } : { row: 1, column: 0 };
            const neighbor = session.cells.find(
              (candidate) => candidate.row === cell.row + delta.row && candidate.column === cell.column + delta.column
            );
            if (!neighbor || !explored.has(neighbor.id)) return [];
            const end = point(neighbor);
            return [<line key={`${cell.id}:${direction}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} className="minimap-route" />];
          });
        })}
        {/* LEARNING_APP_RELEASE_AB_2026_08: minimap landmarks */}
      {session.cells
        .filter((cell) => revealed.has(cell.id) && !cell.resolved && ["monster", "rune", "treasure", "reveal", "healing"].includes(cell.kind))
        .map((cell) => {
          const center = point(cell);
          return <circle key={`event:${cell.id}`} cx={center.x} cy={center.y} r={cell.kind === "treasure" ? 4.2 : 3.2} className={`minimap-event minimap-event-${cell.kind}`} />;
        })}
      {(() => {
          const current = findCell(session, session.positionCellId);
          if (!current) return null;
          const center = point(current);
          return <circle cx={center.x} cy={center.y} r="5" className="minimap-hero" />;
        })()}
      </svg>
    </div>
  );
}

function LabyrinthHearts({ current, total }: { current: number; total: number }) {
  return (
    <div className="labyrinth-hearts" aria-label={`${current}/${total}`}>
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={index < current ? "full" : "empty"}>
          {index < current ? "❤️" : "♡"}
        </span>
      ))}
    </div>
  );
}

function getCellAsset(session: LabyrinthSession, cell: LabyrinthCell): string | null {
  const encounter = getEncounterForCell(session, cell.id);
  const completed = Boolean(cell.resolved || encounter?.completed);

  if (cell.kind === "entrance") return `${ASSET_ROOT}/entrance.png`;
  if (cell.kind === "treasure") {
    if (encounter?.completed) return `${ASSET_ROOT}/treasure-open.png`;
    return session.collectedRunes.length >= 4
      ? `${ASSET_ROOT}/guardian.png`
      : `${ASSET_ROOT}/treasure-locked.png`;
  }
  if (cell.kind === "rune" && cell.focus) return RUNE_ASSET[cell.focus];
  if (cell.kind === "monster") return completed ? null : `${ASSET_ROOT}/monster-${padVariant(cell.eventVariant, 3)}.png`;
  if (cell.kind === "trap") return completed ? null : `${ASSET_ROOT}/trap-${padVariant(cell.eventVariant, 4)}.png`;
  if (cell.kind === "cache") return `${ASSET_ROOT}/${completed ? "cache-open" : "cache-closed"}.png`;
  if (cell.kind === "healing") return `${ASSET_ROOT}/healing-fountain.png`;
  if (cell.kind === "reveal") return `${ASSET_ROOT}/reveal-obelisk.png`;
  return null;
}

function encounterAsset(
  kind: LabyrinthEncounterKind | undefined,
  focus: TrainingFocus | undefined,
  variant: number
): string {
  if (kind === "rune" && focus) return RUNE_ASSET[focus];
  if (kind === "trap") return `${ASSET_ROOT}/trap-${padVariant(variant, 4)}.png`;
  if (kind === "guardian") return `${ASSET_ROOT}/guardian.png`;
  return `${ASSET_ROOT}/monster-${padVariant(variant, 3)}.png`;
}

function padVariant(value: number | undefined, count: number): string {
  const safe = ((Math.floor(value ?? 0) % count) + count) % count;
  return String(safe + 1).padStart(2, "0");
}

function getDecoration(cell: LabyrinthCell): { asset: string; offsetX: number; offsetY: number } | null {
  if (cell.kind !== "path") return null;
  const hash = hashCellId(cell.id);
  if (hash % 100 >= 28) return null;
  return {
    asset: DECOR_ASSETS[hash % DECOR_ASSETS.length] ?? DECOR_ASSETS[0],
    offsetX: ((hash >>> 8) % 23) - 11,
    offsetY: ((hash >>> 16) % 7) - 3
  };
}

function hashCellId(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getExitMask(exits: readonly LabyrinthDirection[]): number {
  let mask = 0;
  if (exits.includes("north")) mask |= 1;
  if (exits.includes("east")) mask |= 2;
  if (exits.includes("south")) mask |= 4;
  if (exits.includes("west")) mask |= 8;
  return mask;
}

function encounterTitleKey(kind: LabyrinthEncounterKind | undefined): string {
  if (kind === "rune") return "labyrinthRuneEncounter";
  if (kind === "trap") return "labyrinthTrapEncounter";
  if (kind === "guardian") return "labyrinthGuardianEncounter";
  return "labyrinthMonsterEncounter";
}

interface MapGeometry {
  tileWidth: number;
  tileHeight: number;
  wallWidth: number;
  wallHeight: number;
  wallAnchorRatio: number;
  heroSize: number;
  dragonSize: number;
  eventSize: number;
  decorationSize: number;
  heroGroundOffset: number;
  contentGroundOffset: number;
  originX: number;
  originY: number;
  worldWidth: number;
  worldHeight: number;
}

interface MapCamera {
  viewWidth: number;
  viewHeight: number;
  left: number;
  top: number;
}

interface SceneItem {
  key: string;
  sortY: number;
  priority: number;
  node: ReactNode;
}

interface Point {
  x: number;
  y: number;
}

interface WallVisual {
  start: Point;
  end: Point;
  sortY: number;
  imageX: number;
  imageY: number;
}

function useAnimatedCamera(target: MapCamera): MapCamera {
  const [camera, setCamera] = useState<MapCamera>(target);
  const cameraRef = useRef<MapCamera>(target);

  useEffect(() => {
    const from = cameraRef.current;
    const dimensionsChanged = from.viewWidth !== target.viewWidth || from.viewHeight !== target.viewHeight;
    const reduceMotion = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (dimensionsChanged || reduceMotion) {
      cameraRef.current = target;
      setCamera(target);
      return undefined;
    }

    const distance = Math.hypot(target.left - from.left, target.top - from.top);
    if (distance < 0.5) {
      cameraRef.current = target;
      setCamera(target);
      return undefined;
    }

    const duration = 280;
    const startedAt = performance.now();
    let frame = 0;

    const animate = (now: number): void => {
      const linear = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - linear, 3);
      const next: MapCamera = {
        viewWidth: target.viewWidth,
        viewHeight: target.viewHeight,
        left: from.left + (target.left - from.left) * eased,
        top: from.top + (target.top - from.top) * eased
      };
      cameraRef.current = next;
      setCamera(next);
      if (linear < 1) frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [target.left, target.top, target.viewWidth, target.viewHeight]);

  return camera;
}

function getMapGeometry(width: number, height: number): MapGeometry {
  const tileWidth = 170;
  const tileHeight = 86;
  const horizontalSpan = (width + height) * tileWidth / 2;
  const verticalSpan = (width + height) * tileHeight / 2;
  const horizontalMargin = 210;
  const topMargin = 180;
  const bottomMargin = 170;
  const wallHeight = tileWidth * 192 / 256;

  return {
    tileWidth,
    tileHeight,
    wallWidth: tileWidth,
    wallHeight,
    wallAnchorRatio: 128 / 192,
    heroSize: 122,
    dragonSize: 68,
    eventSize: 112,
    decorationSize: 82,
    heroGroundOffset: 34,
    contentGroundOffset: 30,
    originX: height * tileWidth / 2 + horizontalMargin,
    originY: topMargin,
    worldWidth: horizontalSpan + horizontalMargin * 2,
    worldHeight: verticalSpan + topMargin + bottomMargin
  };
}

function getCamera(cell: LabyrinthCell, geometry: MapGeometry, compact: boolean): MapCamera {
  const viewWidth = compact ? 620 : 960;
  const viewHeight = compact ? 480 : 560;
  const point = cellPoint(cell, geometry);
  const desiredLeft = point.x - viewWidth / 2;
  const desiredTop = point.y - viewHeight * 0.53;
  return {
    viewWidth,
    viewHeight,
    left: clamp(desiredLeft, 0, Math.max(0, geometry.worldWidth - viewWidth)),
    top: clamp(desiredTop, 0, Math.max(0, geometry.worldHeight - viewHeight))
  };
}

function getFallbackCamera(geometry: MapGeometry, compact: boolean): MapCamera {
  const viewWidth = compact ? 620 : 960;
  const viewHeight = compact ? 480 : 560;
  return { viewWidth, viewHeight, left: 0, top: 0 };
}

function cellPoint(cell: LabyrinthCell, geometry: MapGeometry): Point {
  return {
    x: geometry.originX + (cell.column - cell.row) * geometry.tileWidth / 2,
    y: geometry.originY + (cell.column + cell.row) * geometry.tileHeight / 2
  };
}

function getWallVisual(
  owner: LabyrinthCell,
  edge: LabyrinthWallEdge,
  geometry: MapGeometry
): WallVisual {
  const point = cellPoint(owner, geometry);
  const segment = getEdgeSegment(point, edge.direction, geometry.tileWidth, geometry.tileHeight);
  return {
    start: segment.start,
    end: segment.end,
    sortY: (segment.start.y + segment.end.y) / 2,
    imageX: point.x - geometry.wallWidth / 2,
    imageY: point.y - geometry.wallHeight * geometry.wallAnchorRatio
  };
}

function getEdgeSegment(
  point: Point,
  direction: LabyrinthDirection,
  tileWidth: number,
  tileHeight: number
): { start: Point; end: Point } {
  const north = { x: point.x, y: point.y - tileHeight / 2 };
  const east = { x: point.x + tileWidth / 2, y: point.y };
  const south = { x: point.x, y: point.y + tileHeight / 2 };
  const west = { x: point.x - tileWidth / 2, y: point.y };

  if (direction === "north") return { start: north, end: east };
  if (direction === "east") return { start: east, end: south };
  if (direction === "south") return { start: south, end: west };
  return { start: west, end: north };
}

function diamondPoints(x: number, y: number, width: number, height: number): string {
  return [
    `${x},${y - height / 2}`,
    `${x + width / 2},${y}`,
    `${x},${y + height / 2}`,
    `${x - width / 2},${y}`
  ].join(" ");
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
