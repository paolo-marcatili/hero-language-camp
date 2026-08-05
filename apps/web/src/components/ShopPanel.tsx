import type { LanguagePack } from "@hero-lang/content-schema";
import { buyShopItem, type HeroStatKey, type LearnerState } from "@hero-lang/learning-engine";
import { getNextShopUnlockLevel, getVisibleShopItems, meetsRequirements, missingRequirements } from "../gameConfig";
import { playSound, unlockAudio } from "../audio";
import { t } from "../i18n";

interface ShopPanelProps {
  // LEARNING_APP_RELEASE_AB_2026_08: pack-aware shop cap
  pack: LanguagePack;
  state: LearnerState;
  language: string;
  onStateChange: (state: LearnerState) => void;
  debugBypass?: boolean;
  onClose: () => void;
  embedded?: boolean;
}

const STAT_ORDER: HeroStatKey[] = ["strength", "defense", "precision", "stamina"];

export function ShopPanel({ pack, state, language, onStateChange, debugBypass = false, onClose, embedded = false }: ShopPanelProps) {
  const visibleItems = getVisibleShopItems(state.level, debugBypass);
  const nextUnlockLevel = getNextShopUnlockLevel(state.level);

  return (
    <section className={`${embedded ? "embedded-panel" : "bottom-sheet"} shop-sheet`} role="dialog" aria-label={t(language, "shop")}>
      {embedded ? null : <div className="sheet-handle" />}
      <div className="panel-heading compact panel-sticky-heading">
        <span>{t(language, "shop")}</span>
        <strong>🪙 {state.coins}</strong>
      <button type="button" className="panel-close-button" onClick={onClose} aria-label={t(language, "close")} title={t(language, "close")}>✕</button>
      </div>
      <p className="sheet-intro">{t(language, "shopIntro")}</p>
      <div className="shop-grid">
        {visibleItems.map((item) => {
          const owned = state.inventory.includes(item.id);
          const statsOk = debugBypass || meetsRequirements(state.hero_stats, item.requiredStats);
          const missing = missingRequirements(state.hero_stats, item.requiredStats);
          const canBuy = (debugBypass || state.coins >= item.price) && !owned && statsOk;
          return (
            <article className={`shop-item ${owned ? "owned" : ""}`} key={item.id}>
              <div className="shop-icon">{item.icon}</div>
              <div className="shop-copy">
                <strong>{t(language, item.nameKey)}</strong>
                <p>{t(language, item.descriptionKey)}</p>
                {Object.keys(item.requiredStats ?? {}).length > 0 ? (
                  <small className={statsOk ? "requirement-ok" : "requirement-missing"}>
                    {statsOk ? t(language, "requirementsMet") : `${t(language, "needsTraining")}: ${formatRequirements(missing, language)}`}
                  </small>
                ) : null}
              </div>
              <button
                type="button"
                className="small-button"
                disabled={!canBuy}
                onClick={() => {
                  void unlockAudio();
                  const result = debugBypass && state.coins < item.price ? buyShopItem({ ...state, coins: item.price }, item, pack) : buyShopItem(state, item, pack);
                  if (result.ok) {
                    playSound("shop");
                    onStateChange(debugBypass && state.coins < item.price ? { ...result.state, coins: state.coins } : result.state);
                  }
                }}
              >
                {owned ? t(language, "owned") : !statsOk ? t(language, "trainMore") : canBuy ? `${t(language, "buy")} ${item.price}` : t(language, "needCoins")}
              </button>
            </article>
          );
        })}
      </div>
      {nextUnlockLevel ? <div className="next-unlock">{t(language, "nextShopUnlock", { level: nextUnlockLevel })}</div> : null}
      <button type="button" className="ghost-button full-width" onClick={onClose}>{t(language, "close")}</button>
    </section>
  );
}

function formatRequirements(requirements: Partial<Record<HeroStatKey, number>>, language: string): string {
  return STAT_ORDER.filter((stat) => requirements[stat]).map((stat) => `${t(language, stat)} ${requirements[stat]}`).join(" · ");
}
