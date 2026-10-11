import type { LanguagePack } from "@hero-lang/content-schema";
import { getLevelStatCap, getMaxEnergy, normalizeLearnerState, type LearnerState, type HeroStats } from "./index.ts";

/** Placement changes the route and combat readiness, never claims item mastery. */
export function placeLearner(pack: LanguagePack, state: LearnerState, target: number): LearnerState {
  if (!Number.isInteger(target) || !pack.levels?.some((entry) => entry.number === target)) {
    throw new Error("Choose an authored course level.");
  }
  const cap = getLevelStatCap(target, pack);
  const previousCap = target === 0 ? 1 : getLevelStatCap(target - 1, pack);
  const stats = Object.fromEntries(Object.entries(state.hero_stats).map(([key, value]) =>
    [key, Math.min(cap, Math.max(value, previousCap))])) as unknown as HeroStats;
  return {
    ...state, level: target, hero_stats: stats, max_energy: getMaxEnergy(target, stats),
    course_revision: pack.progression?.curriculum_revision ?? 1,
    // A revisited level must still have a defeatable encounter.
    defeated_enemies: state.defeated_enemies.filter((id) => {
      const level = pack.enemies?.find((enemy) => enemy.id === id)?.level
        ?? Number(id.match(/_level_(\d+)$/)?.[1] ?? -1);
      return level < target;
    })
  };
}

export function exportProgress(pack: LanguagePack, state: LearnerState) {
  return { format: "hero-language-camp-progress", version: 1, pack_id: pack.pack_id,
    exported_at: new Date().toISOString(), state };
}

export function importProgress(pack: LanguagePack, value: unknown): LearnerState {
  if (!value || typeof value !== "object") throw new Error("Invalid progress file.");
  const backup = value as Record<string, unknown>;
  const compatible = backup.pack_id === pack.pack_id ||
    (String(backup.pack_id).startsWith("hy-eastern-") && pack.pack_id.startsWith("hy-eastern-"));
  if (backup.format !== "hero-language-camp-progress" || backup.version !== 1 || !compatible ||
    !backup.state || typeof backup.state !== "object" ||
    !Number.isInteger((backup.state as LearnerState).level) ||
    !(backup.state as LearnerState).hero_stats) throw new Error("This is not a compatible progress backup.");
  return normalizeLearnerState(pack, backup.state);
}
