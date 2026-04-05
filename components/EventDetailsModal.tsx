"use client";

import { X } from "lucide-react";
import type { DisplayEvent } from "@/hooks/useEvents";

interface EventDetailsModalProps {
  event: DisplayEvent | null;
  onClose: () => void;
  isLoggedIn?: boolean;
  onEdit?: () => void;
}

export function EventDetailsModal({ event, onClose, isLoggedIn, onEdit }: EventDetailsModalProps) {
  if (!event) return null;

  const mapsUrl = event.address.startsWith("http")
    ? event.address
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-details-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white/80 p-6 shadow-lg ring-1 ring-slate-900/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="event-details-title" className="text-base font-semibold text-slate-900 sm:text-lg">
            Event Details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:ring-offset-2"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 font-mono text-sm text-slate-600">
          {event.startTime} – {event.endTime}
        </p>
        <div className="mt-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Student
          </p>
          <p className="mt-1 text-base font-semibold text-slate-900">
            {event.student_name ?? event.studentInitials}
          </p>
        </div>
        {event.address && (
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Address
            </p>
            <p className="mt-1 break-all text-sm text-slate-800">{event.address}</p>
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          {isLoggedIn && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-200 active:translate-y-px"
            >
              Edit
            </button>
          )}
          {event.address && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-indigo-500 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-600 active:translate-y-px"
            >
              Open in Google Maps
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:translate-y-px"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
