import React from "react";
import ReactDOM from "react-dom/client";
import { initMapWeb } from "@navigation/chart-web";
import { AppRouter } from "./app/router";
import { hydrateNavigation } from "./store";
import "./i18n";
import "./index.css";

// 必须在创建地图前注册 worker 并加载地图 CSS。
initMapWeb();

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <AppRouter />
    </React.StrictMode>,
  );
}

// 先渲染应用，由界面展示加载/失败/恢复状态；hydrate 在后台进行，不阻塞首屏。
void hydrateNavigation();
