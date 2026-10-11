import { Component, type CSSProperties, type ErrorInfo, type ReactNode } from "react";
import { safeLocalStorage } from "../safeStorage";

type Lang = "da" | "it" | "en";
const COPY: Record<Lang, { title: string; body: string; reload: string; download: string }> = {
  da: { title: "Noget gik galt", body: "Spillet stødte på en fejl. Dine fremskridt gemmes på denne enhed. Genindlæs siden, eller hent først en kopi af dine fremskridt.", reload: "Genindlæs", download: "Hent mine fremskridt" },
  it: { title: "Qualcosa non ha funzionato", body: "Il gioco ha incontrato un errore. I progressi restano su questo dispositivo. Ricarica la pagina oppure scarica prima una copia dei progressi.", reload: "Ricarica", download: "Scarica i miei progressi" },
  en: { title: "Something went wrong", body: "The game hit an error. Your progress is kept on this device. Reload the page, or download a copy of your progress first.", reload: "Reload", download: "Download my progress" }
};

declare global { interface Window { __heroErrorLogging?: boolean } }

export function installGlobalErrorLogging(): void {
  if (typeof window === "undefined" || window.__heroErrorLogging) return;
  window.__heroErrorLogging = true;
  window.addEventListener("error", (event) => console.error("[hero] uncaught error:", event.error ?? event.message));
  window.addEventListener("unhandledrejection", (event) => console.error("[hero] unhandled rejection:", event.reason));
}
installGlobalErrorLogging();

interface Props { children: ReactNode; fallback?: ReactNode; getLanguage?: () => string; storagePrefixes?: string[]; }
interface State { failed: boolean }
const button: CSSProperties = { padding: "10px 16px", borderRadius: 8, border: 0, fontSize: 16, cursor: "pointer" };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo): void { console.error("[hero] render error:", error, info.componentStack); }

  private language(): Lang {
    try { const value = this.props.getLanguage?.(); return value === "da" || value === "it" ? value : "en"; } catch { return "en"; }
  }
  private progressKeys(): string[] {
    const prefixes = this.props.storagePrefixes ?? [];
    return safeLocalStorage.keys().filter((key) => prefixes.some((p) => key.startsWith(p)) && !key.includes(":local-pack"));
  }
  private download = (): void => {
    const keys: Record<string, string> = {};
    for (const key of this.progressKeys()) { const value = safeLocalStorage.getItem(key); if (value !== null) keys[key] = value; }
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), path: window.location.pathname, keys }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `hero-language-camp-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    const copy = COPY[this.language()];
    return (
      <main role="alert" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#244540", color: "#fff", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 22 }}>{copy.title}</h1>
          <p>{copy.body}</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" style={button} onClick={() => window.location.reload()}>{copy.reload}</button>
            <button type="button" style={button} onClick={this.download} disabled={this.progressKeys().length === 0}>{copy.download}</button>
          </div>
        </div>
      </main>
    );
  }
}
