const DRAFT_PREFIX = "kigalirent_admin_draft:";
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export type AdminDraftEnvelope<T> = {
  savedAt: string;
  data: T;
};

function storageKey(key: string) {
  return `${DRAFT_PREFIX}${key}`;
}

export function saveAdminDraft<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const envelope: AdminDraftEnvelope<T> = {
      savedAt: new Date().toISOString(),
      data,
    };
    localStorage.setItem(storageKey(key), JSON.stringify(envelope));
  } catch {
    // Quota or private mode — ignore
  }
}

export function loadAdminDraft<T>(key: string): AdminDraftEnvelope<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminDraftEnvelope<T>;
    if (!parsed?.savedAt || parsed.data === undefined) {
      clearAdminDraft(key);
      return null;
    }
    const age = Date.now() - new Date(parsed.savedAt).getTime();
    if (Number.isNaN(age) || age > MAX_AGE_MS) {
      clearAdminDraft(key);
      return null;
    }
    return parsed;
  } catch {
    clearAdminDraft(key);
    return null;
  }
}

export function clearAdminDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey(key));
  } catch {
    // ignore
  }
}

export function formatDraftSavedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/** True when a form has enough content worth preserving. */
export function draftHasContent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") {
    const t = value.trim();
    return t.length > 0 && t !== "<p></p>";
  }
  if (typeof value === "number") return true;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.some(draftHasContent);
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(draftHasContent);
  }
  return false;
}
