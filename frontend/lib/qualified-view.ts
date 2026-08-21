const SESSION_KEY = "kigalirent_view_session";
const DWELL_MS = 5000;

function getViewSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `anon-${Date.now()}`;
  }
}

function alreadyCounted(kind: "property" | "blog", slug: string): boolean {
  try {
    return sessionStorage.getItem(`viewed:${kind}:${slug}`) === "1";
  } catch {
    return false;
  }
}

function markCounted(kind: "property" | "blog", slug: string) {
  try {
    sessionStorage.setItem(`viewed:${kind}:${slug}`, "1");
  } catch {
    // ignore
  }
}

/** Record a qualified view after the visitor actually stays on the page. */
export function scheduleQualifiedView(kind: "property" | "blog", slug: string) {
  if (typeof window === "undefined" || !slug) return () => undefined;
  if (alreadyCounted(kind, slug)) return () => undefined;

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  const path =
    kind === "property"
      ? `${apiBase}/properties/${encodeURIComponent(slug)}/view`
      : `${apiBase}/blog/${encodeURIComponent(slug)}/view`;

  let cancelled = false;
  const timer = window.setTimeout(() => {
    if (cancelled || document.visibilityState === "hidden") return;
    const sessionId = getViewSessionId();
    fetch(path, {
      method: "POST",
      headers: {
        "X-View-Session": sessionId,
      },
      keepalive: true,
    })
      .then((res) => {
        if (res.ok || res.status === 204) markCounted(kind, slug);
      })
      .catch(() => undefined);
  }, DWELL_MS);

  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}
