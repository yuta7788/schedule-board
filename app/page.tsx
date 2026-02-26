"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { addDays, format, startOfDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useEvents, type DisplayEvent } from "@/hooks/useEvents";
import { useLocations } from "@/hooks/useLocations";
import { LoginModal } from "@/components/LoginModal";
import { EventDetailsModal } from "@/components/EventDetailsModal";
import { EventFormModal } from "@/components/EventFormModal";
import { Fab } from "@/components/Fab";

const GRID_START_HOUR = 9;
const GRID_END_HOUR = 19;
const TOTAL_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60;
const GRID_HEIGHT_PX = 600;
const MINUTES_PER_PX = TOTAL_MINUTES / GRID_HEIGHT_PX;
const HOUR_ROW_HEIGHT_PX = GRID_HEIGHT_PX / (GRID_END_HOUR - GRID_START_HOUR);
const MAX_DAYS_AHEAD = 14;

function timeToMinutesFromStart(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  const startMinutes = GRID_START_HOUR * 60;
  return (h * 60 + m) - startMinutes;
}

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

/** Format hour for display: 9→"9:00", 13→"1:00", 19→"7:00" (no AM/PM) */
function formatHourLabel(hour: number): string {
  const h = hour > 12 ? hour - 12 : hour;
  return `${h}:00`;
}

function EventBlock({
  event,
  onClick,
}: {
  event: DisplayEvent;
  onClick: () => void;
}) {
  const topMinutes = timeToMinutesFromStart(event.startTime);
  const startM = parseTimeToMinutes(event.startTime);
  const endM = parseTimeToMinutes(event.endTime);
  const durationMinutes = Math.max(1, endM - startM);

  const topPx = topMinutes / MINUTES_PER_PX;
  const heightPx = durationMinutes / MINUTES_PER_PX;
  const rawColor = event.locations?.color ?? event.locationColor ?? "";
  const isLightBg =
    rawColor === "bg-blue-200" ||
    rawColor === "bg-green-200" ||
    rawColor === "bg-red-200" ||
    rawColor === "bg-yellow-200" ||
    rawColor === "bg-purple-200" ||
    rawColor === "bg-pink-200" ||
    rawColor === "bg-gray-200";
  const bgClass =
    rawColor === "bg-emerald-500/90"
      ? "bg-emerald-500/90"
      : rawColor === "bg-blue-500/90"
        ? "bg-blue-500/90"
        : rawColor === "bg-amber-500/90"
          ? "bg-amber-500/90"
          : rawColor === "bg-violet-500/90"
            ? "bg-violet-500/90"
            : rawColor === "bg-blue-200"
              ? "bg-blue-200"
              : rawColor === "bg-green-200"
                ? "bg-green-200"
                : rawColor === "bg-red-200"
                  ? "bg-red-200"
                  : rawColor === "bg-yellow-200"
                    ? "bg-yellow-200"
                    : rawColor === "bg-purple-200"
                      ? "bg-purple-200"
                      : rawColor === "bg-pink-200"
                        ? "bg-pink-200"
                        : rawColor === "bg-gray-200"
                          ? "bg-gray-200"
                          : "bg-slate-500/90";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`absolute left-0.5 right-0.5 rounded shadow-sm transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-offset-1 ${bgClass} ${isLightBg ? "text-slate-900" : "text-white"}`}
      style={{
        top: `${topPx}px`,
        height: `${heightPx}px`,
        minHeight: "28px",
      }}
    >
      <div className="flex h-full flex-col items-center justify-center overflow-hidden px-0.5 py-0.5 text-center text-xs sm:text-[13px]">
        <span className="shrink-0 font-mono">
          {event.startTime}-{event.endTime}
        </span>
        <span className="shrink-0 font-bold">
          {event.student_name ?? event.studentInitials}
        </span>
        <span className="truncate shrink-0 opacity-95">
          {event.locations?.name ?? event.locationName}
        </span>
      </div>
    </button>
  );
}

export default function ScheduleBoardPage() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const { isLoggedIn, signIn, signOut } = useAuth();
  const { events, refetch: refetchEvents } = useEvents(today, MAX_DAYS_AHEAD);
  const { locations, refetch: refetchLocations } = useLocations();

  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<DisplayEvent | null>(null);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => today);
  const [formInitialDate, setFormInitialDate] = useState(() =>
    format(today, "yyyy-MM-dd")
  );
  const [formInitialStartTime, setFormInitialStartTime] = useState("09:00");
  const [formInitialEndTime, setFormInitialEndTime] = useState("10:00");

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const timeColumnRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);

  const weekDates = useMemo(
    () => Array.from({ length: MAX_DAYS_AHEAD }, (_, i) => addDays(today, i)),
    [today]
  );

  const hours = useMemo(
    () =>
      Array.from(
        { length: GRID_END_HOUR - GRID_START_HOUR },
        (_, i) => GRID_START_HOUR + i
      ),
    []
  );

  const updateMonthFromScroll = useCallback(() => {
    const timeEl = timeColumnRef.current;
    const containerEl = scrollContainerRef.current;
    if (!timeEl || !containerEl) return;

    const baseline = timeEl.getBoundingClientRect().right;
    const columns = containerEl.querySelectorAll<HTMLElement>("[data-day-column]");

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const r = col.getBoundingClientRect();
      const dateStr = col.getAttribute("data-date");
      if (!dateStr) continue;
      const date = new Date(dateStr);

      if (r.left <= baseline && baseline < r.right) {
        setCurrentMonthDate(date);
        return;
      }
      if (r.left >= baseline) {
        setCurrentMonthDate(date);
        return;
      }
    }
    const last = columns[columns.length - 1];
    if (last) {
      const dateStr = last.getAttribute("data-date");
      if (dateStr) setCurrentMonthDate(new Date(dateStr));
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      updateMonthFromScroll();
    });
  }, [updateMonthFromScroll]);

  const monthLabel = format(currentMonthDate, "MMMM yyyy", { locale: enUS });

  function openAddEvent() {
    setFormInitialDate(format(today, "yyyy-MM-dd"));
    setFormInitialStartTime("09:00");
    setFormInitialEndTime("10:00");
    setSelectedEvent(null);
    setEventFormOpen(true);
  }

  function openAddEventForDate(date: Date, offsetY: number) {
    if (!isLoggedIn) return;
    // クリック位置から開始・終了時刻を計算（30分単位、デフォルト1時間枠）
    const clampedY = Math.max(0, Math.min(GRID_HEIGHT_PX, offsetY));
    const minutesFromStart = (clampedY / GRID_HEIGHT_PX) * TOTAL_MINUTES;
    const startTotalMinutes = GRID_START_HOUR * 60 + minutesFromStart;
    const roundedStart = Math.floor(startTotalMinutes / 30) * 30;
    const roundedEnd = Math.min(roundedStart + 60, GRID_END_HOUR * 60);

    const startHour = Math.floor(roundedStart / 60);
    const startMin = roundedStart % 60;
    const endHour = Math.floor(roundedEnd / 60);
    const endMin = roundedEnd % 60;

    const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

    setFormInitialDate(format(date, "yyyy-MM-dd"));
    setFormInitialStartTime(`${pad(startHour)}:${pad(startMin)}`);
    setFormInitialEndTime(`${pad(endHour)}:${pad(endMin)}`);
    setSelectedEvent(null);
    setEventFormOpen(true);
  }

  function openEditEvent(event: DisplayEvent) {
    setSelectedEvent(event);
    setFormInitialDate(event.date);
    setFormInitialStartTime(event.startTime);
    setFormInitialEndTime(event.endTime);
    setEventFormOpen(true);
  }

  function openEventDetails(event: DisplayEvent) {
    setSelectedEvent(event);
  }

  const showDetailsModal = !!selectedEvent && !eventFormOpen;

  return (
    <div className="min-h-screen max-w-[100vw] overflow-x-hidden bg-slate-50">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
        <span className="text-lg font-semibold text-slate-800 sm:text-xl">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={() => (isLoggedIn ? signOut() : setLoginModalOpen(true))}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          {isLoggedIn ? "Logout" : "Login"}
        </button>
      </header>

      <div
        ref={scrollContainerRef}
        className="w-full overflow-x-auto overflow-y-hidden"
        style={{ maxWidth: "100vw" }}
        onScroll={handleScroll}
      >
        <div className="flex min-w-max">
          <div
            ref={timeColumnRef}
            className="sticky left-0 z-20 flex shrink-0 flex-col border-r border-slate-200 bg-white shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
            style={{ width: "56px" }}
          >
            <div
              className="border-b border-slate-200 bg-slate-50/90"
              style={{ height: "52px", minHeight: "52px" }}
            />
            <div className="relative bg-white" style={{ height: GRID_HEIGHT_PX }}>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="absolute right-0 pr-2 text-xs font-medium text-slate-500 -translate-y-1/2"
                  style={{
                    top: (hour - GRID_START_HOUR) * HOUR_ROW_HEIGHT_PX,
                  }}
                >
                  {formatHourLabel(hour)}
                </div>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 border-l-0">
            {weekDates.map((d, dayIndex) => (
              <div
                key={d.toISOString()}
                className="flex w-[120px] min-w-[120px] flex-col shrink-0 border-r border-slate-200 bg-white md:w-[150px] md:min-w-[150px]"
                data-day-column
                data-date={d.toISOString()}
              >
                <div
                  className="flex flex-col items-center justify-center border-b border-slate-200 bg-slate-50/90 py-1.5 text-center"
                  style={{ height: "52px", minHeight: "52px" }}
                >
                  <span className="text-xs font-medium text-slate-600">
                    {format(d, "EEE", { locale: enUS })}
                  </span>
                  <span className="text-sm font-medium text-slate-800">
                    {format(d, "d")}
                  </span>
                </div>
                <div
                  className="relative"
                  style={{ height: GRID_HEIGHT_PX }}
                onClick={(e) => {
                  if (!isLoggedIn) return;
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const offsetY = e.clientY - rect.top;
                  openAddEventForDate(d, offsetY);
                }}
                >
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="border-b border-slate-200"
                      style={{ height: HOUR_ROW_HEIGHT_PX }}
                    />
                  ))}
                  <div className="absolute inset-0">
                    {events
                      .filter((e) => e.dayIndex === dayIndex)
                      .map((event) => (
                        <EventBlock
                          key={event.id}
                          event={event}
                          onClick={() => openEventDetails(event)}
                        />
                      ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isLoggedIn && <Fab onClick={openAddEvent} ariaLabel="Add event" />}

      {loginModalOpen && (
        <LoginModal
          onClose={() => setLoginModalOpen(false)}
          onSuccess={() => setLoginModalOpen(false)}
          signIn={signIn}
        />
      )}

      {showDetailsModal && (
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          isLoggedIn={isLoggedIn}
          onEdit={() => setEventFormOpen(true)}
        />
      )}

      {isLoggedIn && eventFormOpen && selectedEvent && (
        <EventFormModal
          mode="edit"
          event={selectedEvent}
          locations={locations}
          initialDate={formInitialDate}
          initialStartTime={formInitialStartTime}
          initialEndTime={formInitialEndTime}
          startDate={today}
          dayCount={MAX_DAYS_AHEAD}
          existingEvents={events}
          onClose={() => {
            setEventFormOpen(false);
            setSelectedEvent(null);
          }}
          onSuccess={() => {
            refetchEvents();
            refetchLocations();
          }}
        />
      )}

      {isLoggedIn && eventFormOpen && !selectedEvent && (
        <EventFormModal
          mode="add"
          event={null}
          locations={locations}
          initialDate={formInitialDate}
          initialStartTime={formInitialStartTime}
          initialEndTime={formInitialEndTime}
          startDate={today}
          dayCount={MAX_DAYS_AHEAD}
          existingEvents={events}
          onClose={() => setEventFormOpen(false)}
          onSuccess={() => {
            refetchEvents();
            refetchLocations();
          }}
        />
      )}
    </div>
  );
}
