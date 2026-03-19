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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-details-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="event-details-title" className="text-lg font-semibold text-slate-900">
            Event Details
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
        <p className="mt-2 font-mono text-slate-600">
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
          {isLoggedIn && onEdit && !event?.isCopied && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Edit
            </button>
          )}
          {event.address && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-700"
            >
              Open in Google Maps
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
