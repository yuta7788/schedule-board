"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import type { LocationRow } from "@/lib/types/database";

export function useLocations() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from("locations")
        .select("*")
        .order("last_used_at", { ascending: false, nullsFirst: false })
        .order("name");
      if (e) throw e;
      const rows = (data as LocationRow[]) ?? [];
      // 同じ name のロケーションは一番新しいものだけ残す（last_used_at desc の並びを利用）
      const seen = new Set<string>();
      const deduped: LocationRow[] = [];
      for (const loc of rows) {
        const key = loc.name.trim().toLowerCase();
        if (!key) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(loc);
      }
      setLocations(deduped);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  return { locations, loading, error, refetch: fetchLocations };
}
