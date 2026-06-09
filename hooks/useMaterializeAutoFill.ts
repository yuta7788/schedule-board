"use client";

import { useEffect, useRef } from "react";
import { format } from "date-fns";
import type { DisplayEvent } from "@/hooks/useEvents";
import { isAutoFillSuppressed } from "@/lib/autoFillSuppression";
import {
  getAutoFillSourceEvents,
  getProcessedAutoFillDates,
  insertMaterializedEvents,
  markAutoFillDateProcessed,
} from "@/lib/autoFillMaterialize";

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
  refetchEvents: () => Promise<unknown> | void;
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
    const processedDates = getProcessedAutoFillDates(windowKey);
    const byFetchedDay = indexEventsByFetchedDay(fetchedEvents);

    type PendingInsert = {
      destDateStr: string;
      source: DisplayEvent[];
    };

    const pending: PendingInsert[] = [];

    for (let destDayIndex = newDaysStartIndex; destDayIndex < maxDaysAhead; destDayIndex++) {
      const destDateStr = format(weekDates[destDayIndex], "yyyy-MM-dd");
      if (processedDates.has(destDateStr)) continue;
      if (isAutoFillSuppressed(destDateStr)) {
        markAutoFillDateProcessed(windowKey, destDateStr);
        continue;
      }

      const destFetchedDayIndex = destDayIndex + fetchedOffset;
      const destEvents = byFetchedDay.get(destFetchedDayIndex) ?? [];

      if (destEvents.length > 0) {
        markAutoFillDateProcessed(windowKey, destDateStr);
        continue;
      }

      const source = getAutoFillSourceEvents(byFetchedDay, destFetchedDayIndex);

      if (source.length === 0) {
        markAutoFillDateProcessed(windowKey, destDateStr);
        continue;
      }

      pending.push({ destDateStr, source });
    }

    if (pending.length === 0) return;

    materializingRef.current = true;

    void (async () => {
      try {
        let anyInserted = false;
        for (const { destDateStr, source } of pending) {
          try {
            await insertMaterializedEvents(destDateStr, source);
          } catch (error) {
            console.error("Auto-fill materialize failed:", destDateStr, error);
            continue;
          }
          markAutoFillDateProcessed(windowKey, destDateStr);
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
