import { Suspense, lazy } from "react";
import type { PhaserWorldProps, WorldEncounter } from "./PhaserWorldImpl";

export type { WorldEncounter };

// Phaser (~1.2 MB minified) is only evaluated once the world is first rendered.
const PhaserWorldImpl = lazy(() => import("./PhaserWorldImpl").then((module) => ({ default: module.PhaserWorldImpl })));

export function PhaserWorld(props: PhaserWorldProps) {
  return (
    <Suspense
      fallback={(
        <section className="phaser-world-shell" aria-label="Hero side-scrolling path" aria-busy="true">
          <div className="phaser-stage" />
        </section>
      )}
    >
      <PhaserWorldImpl {...props} />
    </Suspense>
  );
}
