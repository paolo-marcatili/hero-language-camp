import type { ChangeEvent } from "react";
import type { LanguagePack } from "@hero-lang/content-schema";
import type { AppSettings, ChildProfile, GraphicsPack, HeroAppearance, HeroSpriteSet, LearningAudioMode, ViewportPreset } from "../storage";
import { createChildProfile } from "../storage";
import { t } from "../i18n";
import { publicUrl } from "../publicUrl";

interface SettingsPanelProps {
  pack: LanguagePack;
  language: string;
  profiles: ChildProfile[];
  activeProfileId: string;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  onProfilesChange: (profiles: ChildProfile[]) => void;
  onActiveProfileChange: (profileId: string) => void;
  onResetProgress: () => void;
  onOpenDictionary: () => void;
  showContentEditor?: boolean;
  onClose: () => void;
}

const GRAPHICS_PACKS: Array<{ id: GraphicsPack; labelKey: string }> = [
  { id: "forest", labelKey: "graphicsForest" },
  { id: "candy", labelKey: "graphicsCandy" },
  { id: "night", labelKey: "graphicsNight" }
];

const AUDIO_MODES: Array<{ id: LearningAudioMode; labelKey: string }> = [
  { id: "human_only", labelKey: "audioHumanOnly" },
  { id: "human_and_automatic", labelKey: "audioHumanAndAuto" }
];

const HERO_SPRITES: Array<{ id: HeroSpriteSet; labelKey: string }> = [
  { id: "adventurer", labelKey: "heroSpriteAdventurer" }
];

const VIEWPORT_PRESETS: Array<{ id: ViewportPreset; labelKey: string }> = [
  { id: "auto", labelKey: "viewportAuto" },
  { id: "desktop_split", labelKey: "viewportDesktopSplit" },
  { id: "iphone_portrait", labelKey: "viewportIphonePortrait" },
  { id: "android_portrait", labelKey: "viewportAndroidPortrait" },
  { id: "small_phone", labelKey: "viewportSmallPhone" },
  { id: "tablet_portrait", labelKey: "viewportTabletPortrait" },
  { id: "phone_landscape", labelKey: "viewportPhoneLandscape" }
];


const COURSE_OPTIONS = [
  { id: "hy-eastern-it", label: "Հայերեն · Eastern Armenian", href: import.meta.env.VITE_ARMENIAN_APP_URL },
  { id: "da-foundations", label: "Dansk · Danish Foundations", href: import.meta.env.VITE_DANISH_APP_URL }
] as const;

export function SettingsPanel({
  pack,
  language,
  profiles,
  activeProfileId,
  settings,
  onSettingsChange,
  onProfilesChange,
  onActiveProfileChange,
  onResetProgress,
  onOpenDictionary,
  showContentEditor = true,
  onClose
}: SettingsPanelProps) {
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];

  function switchCourse(packId: string): void {
    const selected = COURSE_OPTIONS.find((option) => option.id === packId);
    if (!selected || !selected.href || selected.id === pack.pack_id) return;
    window.location.assign(String(selected.href));
  }

  function updateProfile(nextProfile: ChildProfile) {
    onProfilesChange(profiles.map((profile) => profile.id === nextProfile.id ? nextProfile : profile));
  }

  function updateAppearance(patch: Partial<HeroAppearance>) {
    if (!activeProfile) return;
    updateProfile({ ...activeProfile, appearance: { ...activeProfile.appearance, ...patch } });
  }

  function addProfile() {
    const profile = createChildProfile(t(language, "newHeroName"), profiles.length);
    onProfilesChange([...profiles, profile]);
    window.setTimeout(() => onActiveProfileChange(profile.id), 0);
  }

  return (
    <section className="settings-panel" role="dialog" aria-label={t(language, "settings")}>
      <div className="sheet-handle" />
      <div className="panel-heading compact panel-sticky-heading">
        <span>{t(language, "settings")}</span>
        <strong>{t(language, "settingsTitle")}</strong>
      <button type="button" className="panel-close-button" onClick={onClose} aria-label={t(language, "close")} title={t(language, "close")}>✕</button>
      </div>

      <div className="settings-section">
        <h3>{t(language, "settingsProfiles")}</h3>
        <div className="settings-row two-cols">
          <label>
            <span>{t(language, "activeHero")}</span>
            <select value={activeProfileId} onChange={(event: ChangeEvent<HTMLSelectElement>) => onActiveProfileChange(event.target.value)}>
              {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
            </select>
          </label>
          <button type="button" className="small-button" onClick={addProfile}>{t(language, "addHero")}</button>
        </div>
        {activeProfile ? (
          <label>
            <span>{t(language, "heroName")}</span>
            <input value={activeProfile.name} onChange={(event: ChangeEvent<HTMLInputElement>) => updateProfile({ ...activeProfile, name: event.target.value })} />
          </label>
        ) : null}
      </div>

      {activeProfile ? (
        <div className="settings-section">
          <h3>{t(language, "appearance")}</h3>
          <div className="sprite-choice-grid" aria-label={t(language, "heroSpriteSet")}>
            {HERO_SPRITES.map((sprite) => (
              <button
                key={sprite.id}
                type="button"
                className={activeProfile.appearance.spriteSet === sprite.id ? "sprite-choice active" : "sprite-choice"}
                onClick={() => updateAppearance({ spriteSet: sprite.id })}
              >
                <img src={publicUrl("assets/pixel/hero-preview.png")} alt="" />
                <strong>{t(language, sprite.labelKey)}</strong>
              </button>
            ))}
          </div>
          <p className="settings-help-text">{t(language, "heroSpriteHint")}</p>
        </div>
      ) : null}

      <div className="settings-section">
        <h3>{t(language, "settingsGame")}</h3>
        <div className="settings-row two-cols">
          <label>
            <span>{t(language, "languagePack")}</span>
            <select value={pack.pack_id} onChange={(event: ChangeEvent<HTMLSelectElement>) => switchCourse(event.target.value)}>
              {COURSE_OPTIONS.map((course) => <option key={course.id} value={course.id}>{course.label}</option>)}
            </select>
          </label>
          <label>
            <span>{t(language, "targetLanguage")}</span>
            <select value={pack.target_language} disabled>
              <option value={pack.target_language}>{pack.language.name_native} · {pack.language.variety ?? pack.language.name_english}</option>
            </select>
          </label>
        </div>
        <div className="settings-row two-cols">
          <label>
            <span>{t(language, "graphicsPack")}</span>
            <select value={settings.graphicsPack} onChange={(event: ChangeEvent<HTMLSelectElement>) => onSettingsChange({ ...settings, graphicsPack: event.target.value as GraphicsPack })}>
              {GRAPHICS_PACKS.map((packOption) => <option key={packOption.id} value={packOption.id}>{t(language, packOption.labelKey)}</option>)}
            </select>
          </label>
          <label>
            <span>{t(language, "audioMode")}</span>
            <select value={settings.audioMode} onChange={(event: ChangeEvent<HTMLSelectElement>) => onSettingsChange({ ...settings, audioMode: event.target.value as LearningAudioMode })}>
              {AUDIO_MODES.map((mode) => <option key={mode.id} value={mode.id}>{t(language, mode.labelKey)}</option>)}
            </select>
          </label>
        </div>
        <label className="toggle-row">
          <input type="checkbox" checked={settings.speedBonusEnabled} onChange={(event: ChangeEvent<HTMLInputElement>) => onSettingsChange({ ...settings, speedBonusEnabled: event.target.checked })} />
          <span>{t(language, "speedBonusSetting")}</span>
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={settings.debug} onChange={(event: ChangeEvent<HTMLInputElement>) => onSettingsChange({ ...settings, debug: event.target.checked })} />
          <span>{t(language, "debugMode")}</span>
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={settings.debugBypass} onChange={(event: ChangeEvent<HTMLInputElement>) => onSettingsChange({ ...settings, debugBypass: event.target.checked })} />
          <span>{t(language, "debugBypassMode")}</span>
        </label>
      </div>

      <div className="settings-section developer-settings">
        <h3>{t(language, "developerLayout")}</h3>
        <p className="settings-help-text">{t(language, "developerLayoutHint")}</p>
        <label>
          <span>{t(language, "viewportPreset")}</span>
          <select value={settings.viewportPreset} onChange={(event: ChangeEvent<HTMLSelectElement>) => onSettingsChange({ ...settings, viewportPreset: event.target.value as ViewportPreset })}>
            {VIEWPORT_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{t(language, preset.labelKey)}</option>)}
          </select>
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={settings.showDeviceFrame} onChange={(event: ChangeEvent<HTMLInputElement>) => onSettingsChange({ ...settings, showDeviceFrame: event.target.checked })} />
          <span>{t(language, "showDeviceFrame")}</span>
        </label>
      </div>

      <div className="settings-actions">
        {showContentEditor ? (
          <button type="button" className="primary-button" onClick={onOpenDictionary}>🛠️ {t(language, "editDictionary")}</button>
        ) : null}
        <button type="button" className="ghost-button danger-text" onClick={onResetProgress}>{t(language, "resetProgress")}</button>
        <button type="button" className="ghost-button" onClick={onClose}>{t(language, "close")}</button>
      </div>
    </section>
  );
}
