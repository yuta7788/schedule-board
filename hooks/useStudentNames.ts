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

      const seen = new Set<string>();
      const list: string[] = [];
      for (const row of data ?? []) {
        const name = (row as { student_name: string | null }).student_name?.trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        list.push(name);
      }
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

