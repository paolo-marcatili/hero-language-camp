import { ErrorBoundary } from "./components/ErrorBoundary";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./App.css";
import { safeLocalStorage } from "./safeStorage";

function armenianUiLanguage(): string {
  try {
    const requested = new URL(window.location.href).searchParams.get("pack");
    const pack = requested ?? safeLocalStorage.getItem("hero-language-camp:v1:armenian-pack");
    return pack === "hy-eastern-it" ? "it" : "en";
  } catch { return "en"; }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary getLanguage={armenianUiLanguage} storagePrefixes={["hero-language-camp:"]}>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
