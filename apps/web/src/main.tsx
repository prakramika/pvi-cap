import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { Presentation, isPresentationRoute } from "./Presentation";
import "./index.css";

function Root() {
  const [present, setPresent] = useState(isPresentationRoute);
  useEffect(() => {
    const sync = () => setPresent(isPresentationRoute());
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);
  return present ? <Presentation /> : <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
