import { useEffect, useRef, useState } from "react";
import { createLatestThrottle } from "./progressThrottle";
import { publicUrl } from "./publicUrl";

export interface OfflineGroupState {
  completed: number;
  total: number;
  failed: number;
}

export interface OfflineState {
  supported: boolean;
  ready: boolean;
  appReady: boolean;
  audioReady: boolean;
  online: boolean;
  installing: boolean;
  phase: "essential" | "audio" | null;
  completed: number;
  total: number;
  failed: number;
  failedFiles: string[];
  essential: OfflineGroupState;
  audio: OfflineGroupState;
  updateAvailable: boolean;
  applyUpdate: () => void;
  retryDownload: () => void;
}

const EMPTY_GROUP: OfflineGroupState = { completed: 0, total: 0, failed: 0 };
// The service worker may report after every file; render at most ~4 times per second.
const PROGRESS_INTERVAL_MS = 250;

type InternalState = Omit<OfflineState, "applyUpdate" | "retryDownload">;

export function useOfflineState(): OfflineState {
  const [state, setState] = useState<InternalState>({
    supported: import.meta.env.PROD && typeof navigator !== "undefined" && "serviceWorker" in navigator,
    ready: false,
    appReady: false,
    audioReady: false,
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    installing: false,
    phase: null,
    completed: 0,
    total: 0,
    failed: 0,
    failedFiles: [],
    essential: EMPTY_GROUP,
    audio: EMPTY_GROUP,
    updateAvailable: false
  });
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const applyingUpdate = useRef(false);

  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let disposed = false;
    const onOnline = () => {
      setState((previous) => ({ ...previous, online: navigator.onLine }));
      if (navigator.onLine) navigator.serviceWorker.controller?.postMessage({ type: "RETRY_OFFLINE_DOWNLOAD" });
    };
    const updateFromGroups = (essential: OfflineGroupState, audio: OfflineGroupState, installing: boolean, phase: InternalState["phase"]) => {
      const completed = essential.completed + audio.completed;
      const total = essential.total + audio.total;
      const failed = essential.failed + audio.failed;
      setState((previous) => ({
        ...previous,
        essential,
        audio,
        completed,
        total,
        failed,
        appReady: essential.total > 0 && essential.completed === essential.total,
        audioReady: audio.total === 0 || audio.completed === audio.total,
        ready: essential.total > 0 && essential.completed === essential.total && (audio.total === 0 || audio.completed === audio.total),
        installing,
        phase
      }));
    };
    const applyProgress = (message: Record<string, unknown>) => {
        setState((previous) => {
          const group: OfflineGroupState = {
            completed: Number(message.completed) || 0,
            total: Number(message.total) || 0,
            failed: Number(message.failed) || 0
          };
          const essential = message.group === "essential" ? group : previous.essential;
          const audio = message.group === "audio" ? group : previous.audio;
          const completed = essential.completed + audio.completed;
          const total = essential.total + audio.total;
          const failed = essential.failed + audio.failed;
          return {
            ...previous,
            essential,
            audio,
            completed,
            total,
            failed,
            appReady: essential.total > 0 && essential.completed === essential.total,
            audioReady: audio.total === 0 || audio.completed === audio.total,
            ready: essential.total > 0 && essential.completed === essential.total && (audio.total === 0 || audio.completed === audio.total),
            installing: true,
            phase: message.group === "audio" ? "audio" : "essential",
            failedFiles: []
          };
        });
    };
    const progress = createLatestThrottle(applyProgress, PROGRESS_INTERVAL_MS);
    const onMessage = (event: MessageEvent) => {
      const message = event.data ?? {};
      if (message.type === "OFFLINE_PROGRESS") {
        progress.push(message);
      } else if (message.type === "OFFLINE_STATUS" || message.type === "OFFLINE_COMPLETE" || message.type === "OFFLINE_ERRORS") {
        progress.cancel(); // a status/complete message supersedes any queued progress
        const essential: OfflineGroupState = message.essential ?? EMPTY_GROUP;
        const audio: OfflineGroupState = message.audio ?? EMPTY_GROUP;
        updateFromGroups(essential, audio, false, null);
        setState((previous) => ({
          ...previous,
          failedFiles: message.type === "OFFLINE_ERRORS"
            ? (message.failures ?? []).map((failure: { url?: string }) => String(failure.url ?? "")).filter(Boolean)
            : []
        }));
      }
    };
    const postToController = (type: "GET_OFFLINE_STATUS" | "START_OFFLINE_DOWNLOAD" | "RETRY_OFFLINE_DOWNLOAD") => {
      navigator.serviceWorker.controller?.postMessage({ type });
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOnline);
    navigator.serviceWorker.addEventListener("message", onMessage);

    void navigator.serviceWorker.register(publicUrl("sw.js"), { scope: import.meta.env.BASE_URL }).then((registration) => {
      if (disposed) return;
      if (registration.waiting) {
        setWaiting(registration.waiting);
        setState((previous) => ({ ...previous, updateAvailable: true }));
      }
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            setWaiting(worker);
            setState((previous) => ({ ...previous, updateAvailable: true, installing: false }));
          }
        });
      });
      if (navigator.serviceWorker.controller) {
        postToController("GET_OFFLINE_STATUS");
        postToController("START_OFFLINE_DOWNLOAD");
      }
      if (navigator.onLine) void registration.update();
      void navigator.storage?.persist?.();
    }).catch(() => setState((previous) => ({ ...previous, supported: false, installing: false })));

    const onControllerChange = () => {
      if (applyingUpdate.current) {
        window.location.reload();
        return;
      }
      postToController("GET_OFFLINE_STATUS");
      postToController("START_OFFLINE_DOWNLOAD");
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      disposed = true;
      progress.cancel();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOnline);
      navigator.serviceWorker.removeEventListener("message", onMessage);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return {
    ...state,
    applyUpdate: () => {
      applyingUpdate.current = true;
      waiting?.postMessage({ type: "SKIP_WAITING" });
    },
    retryDownload: () => {
      setState((previous) => ({ ...previous, installing: true, failed: 0, failedFiles: [] }));
      navigator.serviceWorker.controller?.postMessage({ type: "RETRY_OFFLINE_DOWNLOAD" });
    }
  };
}
