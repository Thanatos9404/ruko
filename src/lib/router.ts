import { useEffect, useState } from "react";

/** A ~30-line path router: enough for five pages, no dependency. */
export function navigate(to: string, replace = false) {
  if (to === window.location.pathname + window.location.search) return;
  if (replace) window.history.replaceState(null, "", to);
  else window.history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
  const hash = to.split("#")[1];
  if (hash) setTimeout(() => document.getElementById(hash)?.scrollIntoView({ block: "start" }), 120);
  else window.scrollTo({ top: 0 });
}

export function usePath(): string {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const on = () => setPath(window.location.pathname);
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  return path;
}

/** Intercepts same-origin <a href="/..."> clicks so pages switch without a reload. */
export function installLinkInterceptor() {
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement).closest("a");
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
    const href = a.getAttribute("href");
    if (!href || !href.startsWith("/") || href.startsWith("//") || href.startsWith("/v1/") || href.startsWith("/api/") || href.startsWith("/eval/")) return;
    // Same-page anchors ("/#how" on "/"): let the browser jump to the section.
    const [p, hash] = href.split("#");
    if (hash !== undefined && (p || "/") === window.location.pathname) return;
    e.preventDefault();
    navigate(href);
  });
}
