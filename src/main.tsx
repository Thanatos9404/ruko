import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./kit/styles/fonts";
import "./styles/app.css";
import { App } from "./App";
import { installLinkInterceptor } from "./lib/router";

installLinkInterceptor();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
