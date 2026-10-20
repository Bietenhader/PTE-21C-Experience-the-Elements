// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./app/tokens.css";
import "./app/global.css";
import { App } from "./app/App";

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
