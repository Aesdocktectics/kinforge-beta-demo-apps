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
const appRootPath = window.location.pathname === "/" || window.location.pathname === "/index.html";
if (publicHost && appRootPath && !window.location.hash) {
  window.location.replace("/website/");
}

if (import.meta.env.PROD && "serviceWorker" in navigator && window.location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <StartupBoundary><React.Suspense fallback={<main className="cloud-loading" role="status"><h1>KinForge</h1><p>Opening your library...</p></main>}><HashRouter useTransitions={false}><CloudWorkspace /></HashRouter></React.Suspense></StartupBoundary>
  </React.StrictMode>
);
