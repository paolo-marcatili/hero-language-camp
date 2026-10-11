import { ErrorBoundary } from "../../web/src/components/ErrorBoundary";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary getLanguage={() => "da"} storagePrefixes={["danish-foundations:", "hero-language-camp:da-foundations:"]}>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
