import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { setWorkerUrl } from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import "./i18n";
import "maplibre-gl/dist/maplibre-gl.css";
import "./index.css";

setWorkerUrl(mapWorkerUrl);

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
