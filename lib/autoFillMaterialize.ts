import { format } from "date-fns";
import { supabase } from "@/lib/supabase/client";
import type { DisplayEvent } from "@/hooks/useEvents";

const AUTOFILL_PROCESSED_STORAGE_KEY = "schedule-board:autofill-processed:v1";

type ProcessedStore = Record<string, string[]>;

function loadProcessedStore(): ProcessedStore {
  try {
    const raw = window.localStorage.getItem(AUTOFILL_PROCESSED_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed == null || typeof parsed !== "object") return {};
    return parsed as ProcessedStore;
  } catch {
    return {};
  }
}

function saveProcessedStore(store: ProcessedStore) {
  window.localStorage.setItem(AUTOFILL_PROCESSED_STORAGE_KEY, JSON.stringify(store));
}

export function getProcessedAutoFillDates(windowKey: string): Set<string> {
  const store = loadProcessedStore();
  return new Set(store[windowKey] ?? []);
}

export function markAutoFillDateProcessed(windowKey: string, dateStr: string) {
  const store = loadProcessedStore();
  const dates = new Set(store[windowKey] ?? []);
  dates.add(dateStr);
  store[windowKey] = [...dates];
  saveProcessedStore(store);
}

export function getAutoFillSourceEvents(
  byFetchedDay: Map<number, DisplayEvent[]>,
  destFetchedDayIndex: number
): DisplayEvent[] {
  const oneWeekEvents = byFetchedDay.get(destFetchedDayIndex - 7) ?? [];
  if (oneWeekEvents.length > 0) return oneWeekEvents;
  return byFetchedDay.get(destFetchedDayIndex - 14) ?? [];
}

export function buildMaterializePayloads(
  destDateStr: string,
  sourceEvents: DisplayEvent[]
) {
  return sourceEvents.map((ev) => ({
    start_time: new Date(`${destDateStr}T${ev.startTime}:00`).toISOString(),
    end_time: new Date(`${destDateStr}T${ev.endTime}:00`).toISOString(),
    student_name: ev.student_name,
    location_id: ev.location_id,
  }));
}

export async function insertMaterializedEvents(
  destDateStr: string,
  sourceEvents: DisplayEvent[]
): Promise<void> {
  const { error } = await supabase
    .from("events")
    .insert(buildMaterializePayloads(destDateStr, sourceEvents));
  if (error) throw error;
}

export function toVisibleDayEvent(
  ev: DisplayEvent,
  destDayIndex: number,
  destDateStr: string
): DisplayEvent {
  const startIso = new Date(`${destDateStr}T${ev.startTime}:00`).toISOString();
  const endIso = new Date(`${destDateStr}T${ev.endTime}:00`).toISOString();
  return {
    ...ev,
    date: destDateStr,
    dayIndex: destDayIndex,
    startIso,
    endIso,
    isPreviewOnly: false,
  };
}

export function matchesPreviewEvent(
  preview: DisplayEvent,
  candidate: DisplayEvent
): boolean {
  return (
    candidate.startTime === preview.startTime &&
    candidate.endTime === preview.endTime &&
    candidate.student_name === preview.student_name
  );
}

export function findPersistedMatch(
  preview: DisplayEvent,
  fetchedEvents: DisplayEvent[],
  destDayIndex: number,
  fetchedOffset: number
): DisplayEvent | null {
  const destFetchedDayIndex = destDayIndex + fetchedOffset;
  for (const ev of fetchedEvents) {
    if (ev.dayIndex !== destFetchedDayIndex) continue;
    if (matchesPreviewEvent(preview, ev)) {
      return toVisibleDayEvent(ev, destDayIndex, preview.date);
    }
  }
  return null;
}

export function getAutoFillWindowKey(weekStartDate: Date): string {
  return format(weekStartDate, "yyyy-MM-dd");
}
