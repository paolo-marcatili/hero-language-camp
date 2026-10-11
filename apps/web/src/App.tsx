import { useEffect, useState } from "react";
import type { LanguagePack } from "@hero-lang/content-schema";
import GameApp from "./GameApp";
import * as storage from "./storage";
import { resolveInitialArmenianPack, selectArmenianPack } from "./armenianPacks";

type InitialPack = { pack: LanguagePack; requiresChoice: boolean };
// Start loading at module evaluation (same moment the old synchronous call ran).
const initialPackPromise = resolveInitialArmenianPack();

export default function App() {
  const [initial, setInitial] = useState<InitialPack | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    initialPackPromise.then(
      (value) => { if (!cancelled) setInitial(value); },
      () => { if (!cancelled) setFailed(true); }
    );
    return () => { cancelled = true; };
  }, []);
  if (failed) return <div role="alert" className="boot-message"><button type="button" onClick={() => window.location.reload()}>Reload</button></div>;
  if (!initial) return <div role="status" aria-busy="true" className="boot-message">Hero Language Camp…</div>;
  return <GameApp starterPack={initial.pack} storage={storage} requiresPackChoice={initial.requiresChoice} onPackChange={selectArmenianPack} />;
}
