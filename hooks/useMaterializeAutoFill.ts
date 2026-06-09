"use client";

import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase/client";
import type { DisplayEvent } from "@/hooks/useEvents";
import { isAutoFillSuppressed } from "@/lib/autoFillSuppression";

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

function getProcessedDates(windowKey: string): Set<string> {
  const store = loadProcessedStore();
  return new Set(store[windowKey] ?? []);
}

function markDateProcessed(windowKey: string, dateStr: string) {
  const store = loadProcessedStore();
  const dates = new Set(store[windowKey] ?? []);
  dates.add(dateStr);
  store[windowKey] = [...dates];
  saveProcessedStore(store);
}

function indexEventsByFetchedDay(events: DisplayEvent[]): Map<number, DisplayEvent[]> {
  const byFetchedDay = new Map<number, DisplayEvent[]>();
  for (const ev of events) {
    const arr = byFetchedDay.get(ev.dayIndex) ?? [];
    arr.push(ev);
    byFetchedDay.set(ev.dayIndex, arr);
  }
  return byFetchedDay;
}

interface UseMaterializeAutoFillOptions {
  isLoggedIn: boolean;
  weekDates: Date[];
  fetchedEvents: DisplayEvent[];
  newDaysStartIndex: number;
  maxDaysAhead: number;
  fetchedOffset: number;
  refetchEvents: () => Promise<void> | void;
}

/**
 * 後半週の空き日に 1〜2 週前の予定を、手入力と同じ INSERT で DB 化する。
 * 以降は通常の実予定として編集・削除できる（isCopied 表示枠は使わない）。
 */
export function useMaterializeAutoFill({
  isLoggedIn,
  weekDates,
  fetchedEvents,
  newDaysStartIndex,
  maxDaysAhead,
  fetchedOffset,
  refetchEvents,
}: UseMaterializeAutoFillOptions) {
  const materializingRef = useRef(false);

  useEffect(() => {
    if (!isLoggedIn || materializingRef.current || weekDates.length === 0) return;

    const windowKey = format(weekDates[0], "yyyy-MM-dd");
    const processedDates = getProcessedDates(windowKey);
    const byFetchedDay = indexEventsByFetchedDay(fetchedEvents);

    type PendingInsert = {
      destDateStr: string;
      payloads: {
        start_time: string;
        end_time: string;
        student_name: string;
        location_id: string;
      }[];
    };

    const pending: PendingInsert[] = [];

    for (let destDayIndex = newDaysStartIndex; destDayIndex < maxDaysAhead; destDayIndex++) {
      const destDateStr = format(weekDates[destDayIndex], "yyyy-MM-dd");
      if (processedDates.has(destDateStr)) continue;
      if (isAutoFillSuppressed(destDateStr)) {
        markDateProcessed(windowKey, destDateStr);
        continue;
      }

      const destFetchedDayIndex = destDayIndex + fetchedOffset;
      const destEvents = byFetchedDay.get(destFetchedDayIndex) ?? [];

      if (destEvents.length > 0) {
        markDateProcessed(windowKey, destDateStr);
        continue;
      }

      const oneWeekEvents = byFetchedDay.get(destFetchedDayIndex - 7) ?? [];
      const source =
        oneWeekEvents.length > 0
          ? oneWeekEvents
          : (byFetchedDay.get(destFetchedDayIndex - 14) ?? []);

      if (source.length === 0) {
        markDateProcessed(windowKey, destDateStr);
        continue;
      }

      pending.push({
        destDateStr,
        payloads: source.map((ev) => ({
          start_time: new Date(`${destDateStr}T${ev.startTime}:00`).toISOString(),
          end_time: new Date(`${destDateStr}T${ev.endTime}:00`).toISOString(),
          student_name: ev.student_name,
          location_id: ev.location_id,
        })),
      });
    }

    if (pending.length === 0) return;

    materializingRef.current = true;

    void (async () => {
      try {
        let anyInserted = false;
        for (const { destDateStr, payloads } of pending) {
          const { error } = await supabase.from("events").insert(payloads);
          if (error) {
            console.error("Auto-fill materialize failed:", destDateStr, error);
            continue;
          }
          markDateProcessed(windowKey, destDateStr);
          anyInserted = true;
        }
        if (anyInserted) await refetchEvents();
      } finally {
        materializingRef.current = false;
      }
    })();
  }, [
    isLoggedIn,
    weekDates,
    fetchedEvents,
    newDaysStartIndex,
    maxDaysAhead,
    fetchedOffset,
    refetchEvents,
  ]);
}
