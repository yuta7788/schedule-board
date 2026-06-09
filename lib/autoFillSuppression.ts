const STORAGE_KEY = "schedule-board:autofill-suppressed:v1";

/** セッション内 + localStorage。ユーザーが意図的に空にした日は自動コピーしない */
const suppressedDates = new Set<string>();
let loaded = false;

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return;
    for (const d of parsed) {
      if (typeof d === "string") suppressedDates.add(d);
    }
  } catch {
    // ignore
  }
}

function persist() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...suppressedDates]));
}

export function isAutoFillSuppressed(dateStr: string): boolean {
  ensureLoaded();
  return suppressedDates.has(dateStr);
}

/** 削除などでその日を空にしたあと、自動 materialize しない */
export function suppressAutoFillForDate(dateStr: string) {
  ensureLoaded();
  if (suppressedDates.has(dateStr)) return;
  suppressedDates.add(dateStr);
  persist();
}

export function pruneSuppressedDates(validDateStrs: Set<string>) {
  ensureLoaded();
  let changed = false;
  for (const d of suppressedDates) {
    if (!validDateStrs.has(d)) {
      suppressedDates.delete(d);
      changed = true;
    }
  }
  if (changed) persist();
}
