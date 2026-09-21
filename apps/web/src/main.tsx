import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element missing");
}
const mount: HTMLElement = rootEl;

async function boot() {
  if (import.meta.env.VITE_PRESENT_ONLY === "true") {
    const { Presentation } = await import("./Presentation");
    createRoot(mount).render(
      <StrictMode>
        <Presentation />
      </StrictMode>,
    );
    return;
  }

  const [{ default: App }, { Presentation, isPresentationRoute }] = await Promise.all([
    import("./App"),
    import("./Presentation"),
  ]);

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

  createRoot(mount).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}

void boot();
