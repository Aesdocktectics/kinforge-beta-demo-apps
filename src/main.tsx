import React from "react";
import ReactDOM from "react-dom/client";
import CloudWorkspace from "./CloudWorkspace";
import { HashRouter } from "react-router-dom";
import { StartupBoundary } from "./StartupBoundary";
import "./styles.css";
import "./workspace.css";
import "./glyphs.css";
import "./cloud.css";

const publicHost = window.location.hostname === "kinforge-genealogy-studio-public.marianneleong3.chatgpt.site";
const publicLandingPath = window.location.pathname === "/" || window.location.pathname === "/index.html";
const shouldShowPublicLanding = publicHost && publicLandingPath;
if (shouldShowPublicLanding) {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
      .catch(() => undefined)
      .finally(() => window.location.replace("/website/"));
  } else {
    window.location.replace("/website/");
  }
}

if (import.meta.env.PROD && !publicHost && "serviceWorker" in navigator && window.location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  });
}

if (!shouldShowPublicLanding) {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <StartupBoundary><React.Suspense fallback={<main className="cloud-loading" role="status"><h1>KinForge</h1><p>Opening your library...</p></main>}><HashRouter useTransitions={false}><CloudWorkspace /></HashRouter></React.Suspense></StartupBoundary>
    </React.StrictMode>
  );
}
