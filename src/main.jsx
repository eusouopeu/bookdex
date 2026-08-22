import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { DataProvider } from "./state/DataContext";
import { PrefsProvider } from "./state/PrefsContext";
import "./utilities.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <DataProvider>
      <PrefsProvider>
        <App />
      </PrefsProvider>
    </DataProvider>
  </StrictMode>
);
