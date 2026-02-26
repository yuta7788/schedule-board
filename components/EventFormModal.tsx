"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase/client";
import type { DisplayEvent } from "@/hooks/useEvents";
import type { LocationRow } from "@/lib/types/database";
import { LocationCombobox } from "@/components/LocationCombobox";
import { useStudentNames } from "@/hooks/useStudentNames";
import { StudentNameCombobox } from "@/components/StudentNameCombobox";

const COLOR_OPTIONS = [
  "bg-blue-200",
  "bg-green-200",
  "bg-red-200",
  "bg-yellow-200",
  "bg-purple-200",
  "bg-pink-200",
  "bg-gray-200",
] as const;

interface EventFormModalProps {
  mode: "add" | "edit";
  event: DisplayEvent | null;
  locations: LocationRow[];
  startDate: Date;
  dayCount: number;
  existingEvents: DisplayEvent[];
  onClose: () => void;
  onSuccess: () => void;
}

export function EventFormModal({
  mode,
  event,
  locations,
  startDate,
  dayCount,
  existingEvents,
  onClose,
  onSuccess,
}: EventFormModalProps) {
  const { names: studentNameSuggestions } = useStudentNames();
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [studentName, setStudentName] = useState("");
  const [locationId, setLocationId] = useState("");
  const [locationName, setLocationName] = useState("");
  const [address, setAddress] = useState("");
  const [selectedColor, setSelectedColor] = useState<string>(COLOR_OPTIONS[0]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode === "edit" && event) {
      setDate(event.date);
      setStartTime(event.startTime);
      setEndTime(event.endTime);
      setStudentName(event.student_name ?? event.studentInitials);
      setLocationId(event.locationId);
      setLocationName(event.locationName);
      setAddress(event.address);
      const eventColor = event.locations?.color ?? event.locationColor ?? "";
      setSelectedColor(
        COLOR_OPTIONS.includes(eventColor as (typeof COLOR_OPTIONS)[number])
          ? eventColor
          : COLOR_OPTIONS[0]
      );
    } else {
      setDate(format(startDate, "yyyy-MM-dd"));
      setStartTime("09:00");
      setEndTime("10:00");
      setStudentName("");
      setLocationId("");
      setLocationName("");
      setAddress("");
      setSelectedColor(COLOR_OPTIONS[0]);
    }
  }, [mode, event, startDate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedStudentName = studentName.trim();
    if (!trimmedStudentName) {
      setError("Student name is required.");
      return;
    }

    const start = startTime.slice(0, 5);
    const end = endTime.slice(0, 5);
    if (start >= end) {
      setError("End time must be after start time.");
      return;
    }

    const nameToUse = locationName.trim();
    if (!nameToUse) {
      setError("Location is required.");
      return;
    }

    const startDateTime = new Date(`${date}T${start}:00`);
    const endDateTime = new Date(`${date}T${end}:00`);
    const startIso = startDateTime.toISOString();
    const endIso = endDateTime.toISOString();

    setLoading(true);
    try {
      // STEP 1: Resolve location_id (existing or insert new)
      let resolvedLocationId: string;

      const { data: existing } = await supabase
        .from("locations")
        .select("id")
        .eq("name", nameToUse)
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        resolvedLocationId = existing.id;
        await supabase
          .from("locations")
          .update({
            last_used_at: new Date().toISOString(),
            address: address.trim() || null,
            color: selectedColor,
          })
          .eq("id", resolvedLocationId);
      } else {
        const { data: inserted, error: insertLocErr } = await supabase
          .from("locations")
          .insert({
            name: nameToUse,
            address: address.trim() || null,
            color: selectedColor,
            last_used_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (insertLocErr) {
          console.error("Save error:", insertLocErr);
          throw insertLocErr;
        }
        if (!inserted?.id) {
          throw new Error("Failed to create location");
        }
        resolvedLocationId = inserted.id;
      }

      // STEP 2: Overlap check using existing events (Array.some)
      const newStartMs = startDateTime.getTime();
      const newEndMs = endDateTime.getTime();
      const hasOverlap = existingEvents.some((e) => {
        if (mode === "edit" && event && e.id === event.id) return false;
        const existingStartMs = new Date(e.startIso).getTime();
        const existingEndMs = new Date(e.endIso).getTime();
        return newStartMs < existingEndMs && newEndMs > existingStartMs;
      });
      if (hasOverlap) {
        alert("Time slot taken");
        setLoading(false);
        return;
      }

      // STEP 3: Save event (events table: id, start_time, end_time, student_name, location_id)
      const payload = {
        start_time: startIso,
        end_time: endIso,
        student_name: trimmedStudentName,
        location_id: resolvedLocationId,
      };

      if (mode === "edit" && event) {
        const { error: updateErr } = await supabase
          .from("events")
          .update(payload)
          .eq("id", event.id);
        if (updateErr) {
          console.error("Save error:", updateErr);
          throw updateErr;
        }
      } else {
        const { error: insertErr } = await supabase.from("events").insert(payload);
        if (insertErr) {
          console.error("Save error:", insertErr);
          throw insertErr;
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error("Save error:", err);
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to save";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (mode !== "edit" || !event) return;
    if (!confirm("Delete this event?")) return;
    setLoading(true);
    try {
      const { error: err } = await supabase.from("events").delete().eq("id", event.id);
      if (err) throw err;
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Delete error:", err);
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Failed to delete";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const title = mode === "add" ? "Add Event" : "Edit Event";
  const minDate = format(startDate, "yyyy-MM-dd");
  const maxDate = format(
    new Date(startDate.getTime() + (dayCount - 1) * 24 * 60 * 60 * 1000),
    "yyyy-MM-dd"
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-form-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="event-form-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <div>
            <label htmlFor="event-date" className="block text-sm font-medium text-slate-700">
              Date
            </label>
            <input
              id="event-date"
              type="date"
              value={date}
              min={minDate}
              max={maxDate}
              onChange={(e) => setDate(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="event-start" className="block text-sm font-medium text-slate-700">
                Start Time
              </label>
              <input
                id="event-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="event-end" className="block text-sm font-medium text-slate-700">
                End Time
              </label>
              <input
                id="event-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="event-student-name" className="block text-sm font-medium text-slate-700">
              Student Name
            </label>
            <div className="mt-1">
              <StudentNameCombobox
                id="event-student-name"
                suggestions={studentNameSuggestions}
                value={studentName}
                onChange={setStudentName}
                placeholder="Type or select student name"
                aria-label="Student name"
              />
            </div>
          </div>

          <div>
            <label htmlFor="event-location" className="block text-sm font-medium text-slate-700">
              Location
            </label>
            <div className="mt-1">
              <LocationCombobox
                id="event-location"
                locations={locations}
                value={locationName}
                onSelect={(loc) => {
                  if (loc) {
                    setLocationId(loc.id);
                    setLocationName(loc.name);
                    setAddress(loc.address ?? "");
                    setSelectedColor(loc.color || COLOR_OPTIONS[0]);
                  } else {
                    setLocationId("");
                    setLocationName("");
                    setAddress("");
                  }
                }}
                placeholder="Type or select location"
                aria-label="Location"
              />
            </div>
          </div>

          <div>
            <label htmlFor="event-address" className="block text-sm font-medium text-slate-700">
              Address (optional)
            </label>
            <input
              id="event-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Address or Google Maps link"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <p className="block text-sm font-medium text-slate-700">Color</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((colorClass) => (
                <button
                  key={colorClass}
                  type="button"
                  onClick={() => setSelectedColor(colorClass)}
                  className={`h-8 w-8 rounded-full ${colorClass} transition focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${
                    selectedColor === colorClass
                      ? "ring-2 ring-offset-2 ring-slate-700"
                      : "hover:opacity-90"
                  }`}
                  aria-label={`Select color ${colorClass}`}
                  aria-pressed={selectedColor === colorClass}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            {mode === "edit" && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Delete
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
