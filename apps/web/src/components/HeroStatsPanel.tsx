import type { LearnerState } from "@hero-lang/learning-engine";
import { getAverageMastery } from "@hero-lang/learning-engine";
import { t } from "../i18n";
import { formatGameNumber } from "./numberFormat";

interface HeroStatsPanelProps {
  state: LearnerState;
  language: string;
  statCap: number;
}

export function HeroStatsPanel({ state, language, statCap }: HeroStatsPanelProps) {
  const stats = state.hero_stats;
  const deferred = state.pending_item_stat_bonuses ?? { strength: 0, defense: 0, precision: 0, stamina: 0 };
  const capExplanation = language.startsWith("it")
    ? "Il livello aumenta il limite. Gli attributi crescono completando allenamenti e labirinti; i bonus degli oggetti in attesa si attivano automaticamente."
    : language.startsWith("da")
      ? "Niveauet hæver grænsen. Egenskaber vokser gennem gennemførte træninger og labyrinter; ventende udstyrsbonusser aktiveres automatisk."
      : "A level raises the cap. Attributes grow through completed training and labyrinths; waiting equipment bonuses activate automatically.";
  const mastery = Math.round(getAverageMastery(state) * 100);
  const cap = statCap;

  return (
    <section className="hero-status-card" aria-label="Hero stats">
      <div className="hero-status-top">
        <div>
          <span>{t(language, "hero")}</span>
          <strong>{state.hero_name}</strong>
        </div>
        <div className="coin-pill">🪙 {formatGameNumber(state.coins)}</div>
      </div>
      <div className="hero-core-stats">
        <div><span>{t(language, "level")}</span><strong>{state.level}</strong></div>
        <div><span>{t(language, "xp")}</span><strong>{formatGameNumber(state.xp)}</strong></div>
        <div><span>{t(language, "mastery")}</span><strong>{mastery}%</strong></div>
        <div><span>{t(language, "statCap")}</span><strong>{formatGameNumber(cap)}</strong></div>
      </div>
      <div className="attribute-list compact-attributes">
        <StatBar label={t(language, "strength")} value={stats.strength} cap={cap} icon="💪" deferred={deferred.strength} />
        <StatBar label={t(language, "defense")} value={stats.defense} cap={cap} icon="🛡️" deferred={deferred.defense} />
        <StatBar label={t(language, "precision")} value={stats.precision} cap={cap} icon="🎯" deferred={deferred.precision} />
        <StatBar label={t(language, "stamina")} value={stats.stamina} cap={cap} icon="❤️" deferred={deferred.stamina} />
      </div>
      <p className="stat-cap-explanation">{capExplanation}</p>
    </section>
  );
}

function StatBar({ label, value, cap, icon, deferred = 0 }: { label: string; value: number; cap: number; icon: string; deferred?: number }) {
  const percent = Math.min(100, Math.max(8, (value / cap) * 100));
  return (
    <div className="stat-bar-row">
      <div className="stat-bar-label"><span>{icon} {label}</span><strong>{formatGameNumber(value)}/{formatGameNumber(cap)}{deferred > 0 ? <small className="deferred-item-bonus" title="Equipment bonus waiting for a higher cap"> +{formatGameNumber(deferred)} 🎒</small> : null}</strong></div>
      <div className="stat-bar-track"><div className="stat-bar-fill" style={{ width: `${percent}%` }} /></div>
    </div>
  );
}
