import type { ArmenianPackId } from "../armenianPacks";

export function PackChooser({ onSelect }: { onSelect: (packId: ArmenianPackId) => void }) {
  return (
    <main className="pack-chooser-shell">
      <section className="pack-chooser-card" aria-labelledby="pack-chooser-title">
        <p className="eyebrow">Eastern Armenian</p>
        <h1 id="pack-chooser-title">Choose your instruction language</h1>
        <p>The Armenian course is the same app. Explanations, stories, menus and exercises will use the language you choose.</p>
        <div className="pack-chooser-actions">
          <button type="button" onClick={() => onSelect("hy-eastern-it")}><strong>Italiano</strong><span>Armenian with Italian explanations</span></button>
          <button type="button" onClick={() => onSelect("hy-eastern-en")}><strong>English</strong><span>Armenian with English explanations</span></button>
        </div>
      </section>
    </main>
  );
}
