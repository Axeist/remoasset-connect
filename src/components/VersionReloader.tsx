import { useEffect, useRef } from "react";
import { toast } from "sonner";

const POLL_MS = 45_000;

function isEditing(): boolean {
  const el = document.activeElement;
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

async function fetchDeployVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("json")) return null;
    const data = (await res.json()) as { version?: unknown };
    return typeof data.version === "string" && data.version ? data.version : null;
  } catch {
    return null;
  }
}

export function VersionReloader() {
  const reloading = useRef(false);

  useEffect(() => {
    if (import.meta.env.DEV) return;

    const bootVersion = import.meta.env.VITE_APP_VERSION;

    const reload = () => {
      if (reloading.current) return;
      reloading.current = true;
      toast.message("A new version is available. Refreshing…");
      window.setTimeout(() => {
        window.location.reload();
      }, 900);
    };

    const check = async () => {
      if (reloading.current) return;
      const next = await fetchDeployVersion();
      if (!next || !bootVersion || next === bootVersion) return;
      if (document.hidden || !isEditing()) {
        reload();
        return;
      }
    };

    void check();
    const id = window.setInterval(() => void check(), POLL_MS);
    const onVis = () => {
      if (!document.hidden) void check();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, []);

  return null;
}
