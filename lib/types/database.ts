export interface LocationRow {
  id: string;
  name: string;
  color: string;
  address: string | null;
  last_used_at: string | null;
}

/** Nested object returned by Supabase join: locations(id, name, color, address) */
export interface LocationJoin {
  id?: string;
  name: string;
  color: string;
  address?: string | null;
}

/** events table: id, start_time (timestamp), end_time (timestamp), student_name, location_id */
export interface EventRow {
  id: string;
  start_time: string;
  end_time: string;
  student_name: string;
  location_id: string;
}

/**
 * Event with joined location. Supabase returns the relation as an object (or sometimes array).
 * Use getLocationFromEvent() to read safely.
 */
export interface EventWithLocation extends EventRow {
  locations: LocationJoin | null;
}
