"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

export function useStudentNames() {
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchNames = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from("events")
        .select("student_name, start_time")
        .not("student_name", "is", null)
        .order("start_time", { ascending: false });

      if (e) {
        console.error("Fetch student names error:", e);
        throw e;
      }

      type Row = { student_name: string | null; start_time: string | null };
      const byName = new Map<
        string,
        { displayName: string; lastUsedAt: string }
      >();

      for (const row of (data ?? []) as Row[]) {
        const raw = row.student_name?.trim();
        if (!raw) continue;
        const key = raw.toLowerCase();
        const ts = row.start_time ?? "";
        const existing = byName.get(key);
        if (!existing || ts > existing.lastUsedAt) {
          byName.set(key, { displayName: raw, lastUsedAt: ts });
        }
      }

      const list = Array.from(byName.values())
        .sort((a, b) => {
          if (a.lastUsedAt === b.lastUsedAt) return 0;
          return a.lastUsedAt < b.lastUsedAt ? 1 : -1;
        })
        .map((v) => v.displayName);

      setNames(list);
    } catch (err) {
      console.error("Fetch student names error:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setNames([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNames();
  }, [fetchNames]);

  return { names, loading, error, refetch: fetchNames };
}

