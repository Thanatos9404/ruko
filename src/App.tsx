import { lazy, Suspense, useEffect } from "react";
import { usePath } from "./lib/router";

const Landing = lazy(() => import("./pages/Landing"));
const DemoPage = lazy(() => import("./pages/DemoPage"));
const CheckPage = lazy(() => import("./pages/CheckPage"));
const ContactPhone = lazy(() => import("./pages/ContactPhone"));
const ConsolePage = lazy(() => import("./pages/console"));

const TITLES: Record<string, string> = {
  "/": "Ruko: a voice check that stops payment scams",
  "/demo": "Sandbox payment · Ruko",
  "/check": "Is this a scam? · Ruko",
  "/console": "Ruko Console",
};

export function App() {
  const path = usePath();
  useEffect(() => {
    const key = Object.keys(TITLES).find((k) => (k === "/" ? path === "/" : path.startsWith(k)));
    document.title = key ? TITLES[key] : "Ruko";
  }, [path]);

  let page;
  if (path === "/" || path === "") page = <Landing />;
  else if (path.startsWith("/demo")) page = <DemoPage />;
  else if (path.startsWith("/check")) page = <CheckPage />;
  else if (path.startsWith("/contact/")) page = <ContactPhone />;
  else if (path.startsWith("/console")) page = <ConsolePage />;
  else page = <NotFound />;

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Suspense fallback={<div className="min-h-[100dvh] bg-paper" aria-busy="true" />}>{page}</Suspense>
    </>
  );
}

function NotFound() {
  return (
    <main id="main" className="grid min-h-[100dvh] place-items-center bg-paper px-6 text-center">
      <div>
        <p className="t-eyebrow">404</p>
        <h1 className="t-h2 mt-3">Nothing here.</h1>
        <p className="t-lead mt-3">
          Try the <a className="underline" href="/demo">sandbox payment</a> or the <a className="underline" href="/">home page</a>.
        </p>
      </div>
    </main>
  );
}
