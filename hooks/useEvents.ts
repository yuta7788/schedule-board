"use client";

import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/lib/supabase/client";
import type { EventRow, LocationJoin } from "@/lib/types/database";

/** Supabase からの join 結果（locations がオブジェクト or 配列 or null） */
type EventRowWithJoin = EventRow & {
  locations?: LocationJoin | LocationJoin[] | null;
  location?: LocationJoin | LocationJoin[] | null;
};

/** Supabase join can return locations as object or array. Normalize to one object. */
function normalizeLocations(row: EventRowWithJoin): LocationJoin | null {
  const loc = row.locations ?? row.location;
  if (loc == null) return null;
  if (Array.isArray(loc)) return loc[0] ?? null;
  return loc;
}

/** Event with raw data preserved (including locations) and added display fields */
export interface DisplayEvent {
  id: string;
  start_time: string;
  end_time: string;
  student_name: string;
  location_id: string;
  /** Join した locations をそのまま保持（正規化済み） */
  locations: LocationJoin | null;
  date: string;
  dayIndex: number;
  startTime: string;
  endTime: string;
  startIso: string;
  endIso: string;
  /** モーダル用の平坦化フィールド（locations から導出） */
  locationName: string;
  locationColor: string;
  address: string;
  locationId: string;
  studentInitials: string;
}

function toDisplayEvent(row: EventRowWithJoin, dayIndex: number): DisplayEvent {
  const startDate = parseISO(row.start_time);
  const loc = normalizeLocations(row);
  const startTime = format(startDate, "HH:mm");
  const endTime = format(parseISO(row.end_time), "HH:mm");
  const date = format(startDate, "yyyy-MM-dd");
  const initials =
    row.student_name && row.student_name.length >= 2
      ? row.student_name.slice(0, 2).toUpperCase()
      : (row.student_name ?? "").toUpperCase();

  return {
    ...row,
    locations: loc,
    date,
    dayIndex,
    startTime,
    endTime,
    startIso: row.start_time,
    endIso: row.end_time,
    locationName: loc?.name ?? "Unknown",
    locationColor: loc?.color ?? "bg-slate-500/90",
    address: typeof loc?.address === "string" ? loc.address : "",
    locationId: row.location_id,
    studentInitials: initials,
  };
}

export function useEvents(startDate: Date, dayCount: number) {
  const [events, setEvents] = useState<DisplayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from("events")
        .select(
          "id, start_time, end_time, student_name, location_id, locations(id, name, color, address)"
        );

      if (e) {
        console.error("Fetch error:", e);
        throw e;
      }

      type Row = EventRowWithJoin;
      const rows = (data as Row[]) ?? [];
      const startMs = startDate.getTime();
      const endMs =
        startDate.getTime() + dayCount * 24 * 60 * 60 * 1000;

      const display: DisplayEvent[] = [];

      for (const row of rows) {
        const startDateParsed = parseISO(row.start_time);
        const eventStartMs = startDateParsed.getTime();
        if (eventStartMs < startMs || eventStartMs >= endMs) continue;

        const dayIndex = Math.floor(
          (eventStartMs - startMs) / (24 * 60 * 60 * 1000)
        );
        if (dayIndex < 0 || dayIndex >= dayCount) continue;

        display.push(toDisplayEvent(row, dayIndex));
      }

      display.sort(
        (a, b) =>
          new Date(a.startIso).getTime() - new Date(b.startIso).getTime()
      );
      setEvents(display);
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [startDate.toISOString(), dayCount]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, error, refetch: fetchEvents };
}
