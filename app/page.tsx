"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { addDays, format, startOfDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useEvents, type DisplayEvent } from "@/hooks/useEvents";
import { useLocations } from "@/hooks/useLocations";
import type { LocationJoin } from "@/lib/types/database";
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

const EVENT_COLOR_NORMALIZE_MAP: Record<string, string> = {
  // 旧色（既存データ/旧UI） -> 現行のくすんだパステルへ正規化
  "bg-yellow-200": "bg-indigo-100",
  "bg-sky-200": "bg-indigo-100",
  "bg-blue-200": "bg-blue-100",
  "bg-green-200": "bg-emerald-100",
  "bg-red-200": "bg-rose-100",
  "bg-purple-200": "bg-violet-100",
  "bg-pink-200": "bg-fuchsia-100",
  "bg-gray-200": "bg-stone-100",
  "bg-slate-200": "bg-slate-200",
  // 一部保存値互換
  "bg-emerald-500/90": "bg-emerald-100",
  "bg-blue-500/90": "bg-blue-100",
  "bg-amber-500/90": "bg-stone-100",
  "bg-violet-500/90": "bg-violet-100",
};

const LIGHT_EVENT_BG_CLASSES = new Set([
  "bg-blue-100",
  "bg-emerald-100",
  "bg-rose-100",
  "bg-indigo-100",
  "bg-violet-100",
  "bg-fuchsia-100",
  "bg-stone-100",
  "bg-slate-200",
]);

function normalizeColorClass(rawColor: string): string {
  return EVENT_COLOR_NORMALIZE_MAP[rawColor] ?? rawColor;
}

function timeToMinutesFromStart(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  const startMinutes = GRID_START_HOUR * 60;
  return (h * 60 + m) - startMinutes;
}

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

/** Format hour for display: 8→"8 AM", 13→"1 PM", 19→"7 PM" */
function formatHourLabel(hour: number): string {
  const suffix = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12} ${suffix}`;
}

/** 自動コピー枠用。初回スナップショット以降、コピー元の DB 更新と連動しない */
type FrozenAutoFillTemplate = Pick<
  DisplayEvent,
  | "student_name"
  | "location_id"
  | "startTime"
  | "endTime"
  | "locationName"
  | "locationColor"
  | "address"
  | "locationId"
  | "studentInitials"
> & {
  locations: LocationJoin | null;
};

function toFrozenTemplate(ev: DisplayEvent): FrozenAutoFillTemplate {
  return {
    student_name: ev.student_name,
    location_id: ev.location_id,
    startTime: ev.startTime,
    endTime: ev.endTime,
    locationName: ev.locationName,
    locationColor: ev.locationColor,
    address: ev.address,
    locationId: ev.locationId,
    studentInitials: ev.studentInitials,
    locations: ev.locations ? { ...ev.locations } : null,
  };
}

function displayFromFrozenTemplate(
  t: FrozenAutoFillTemplate,
  destDayIndex: number,
  destDateStr: string,
  slotIndex: number
): DisplayEvent {
  const startIso = new Date(`${destDateStr}T${t.startTime}:00`).toISOString();
  const endIso = new Date(`${destDateStr}T${t.endTime}:00`).toISOString();
  return {
    id: `frozen__${destDateStr}__${slotIndex}`,
    start_time: startIso,
    end_time: endIso,
    student_name: t.student_name,
    location_id: t.location_id,
    locations: t.locations ? { ...t.locations } : null,
    date: destDateStr,
    dayIndex: destDayIndex,
    startTime: t.startTime,
    endTime: t.endTime,
    startIso,
    endIso,
    locationName: t.locationName,
    locationColor: t.locationColor,
    address: t.address,
    locationId: t.locationId,
    studentInitials: t.studentInitials,
    isCopied: true,
  };
}

function indexEventsByFetchedDay(events: DisplayEvent[]): Map<number, DisplayEvent[]> {
  const byFetchedDay = new Map<number, DisplayEvent[]>();
  for (const ev of events) {
    const arr = byFetchedDay.get(ev.dayIndex) ?? [];
    arr.push(ev);
    byFetchedDay.set(ev.dayIndex, arr);
  }
  return byFetchedDay;
}

function formatTimeWithAmPm(timeStr: string, includeSuffix: boolean = true): string {
  // expected: "HH:mm" (e.g. "09:30")
  const [hh, mm] = timeStr.split(":").map(Number);
  const suffix = hh < 12 ? "AM" : "PM";
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

  const timePart = mm === 0 ? `${hour12}` : `${hour12}:${pad(mm)}`;
  if (!includeSuffix) return timePart;
  return `${timePart} ${suffix}`;
}

function EventBlock({
  event,
  onClick,
}: {
  event: DisplayEvent;
  onClick: () => void;
}) {
  const isJobStudent = event.student_name?.toLowerCase() === "job";
  const topMinutes = timeToMinutesFromStart(event.startTime);
  const startM = parseTimeToMinutes(event.startTime);
  const endM = parseTimeToMinutes(event.endTime);
  const durationMinutes = Math.max(1, endM - startM);

  const topPx = topMinutes / MINUTES_PER_PX;
  const heightPx = durationMinutes / MINUTES_PER_PX;
  const locationRawColor = event.locations?.color ?? event.locationColor ?? "";
  // 既存データの旧色も含め、現行パレットへ正規化（見た目のみ）
  const normalizedRawColor = normalizeColorClass(locationRawColor);

  const rawColor = isJobStudent ? "" : normalizedRawColor;
  const isLightBg = isJobStudent ? true : LIGHT_EVENT_BG_CLASSES.has(rawColor);

  const bgClass = isJobStudent
    ? // job は主張を弱める（他の予定のパステルと同じくらい控えめなグレー）
      "bg-slate-200/70"
    : LIGHT_EVENT_BG_CLASSES.has(rawColor)
      ? rawColor
      : "bg-slate-500/90";

  const jobVisualClass = isJobStudent ? "shadow-sm shadow-slate-900/3 opacity-95" : "";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`absolute left-0.5 right-0.5 rounded-2xl ring-1 ring-slate-900/5 shadow-md shadow-slate-900/5 transition hover:opacity-96 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:ring-offset-2 ${bgClass} ${
        isLightBg ? "text-slate-900" : "text-white"
      } ${jobVisualClass}`}
      style={{
        top: `${topPx}px`,
        height: `${heightPx}px`,
        minHeight: "28px",
      }}
    >
      <div className="flex h-full flex-col items-center justify-center overflow-hidden px-0.5 py-0.5 text-center leading-tight text-[11px]">
        <span
          className={`shrink-0 font-mono text-[10px] sm:text-[11px] ${
            isJobStudent ? "font-semibold text-opacity-80" : "font-semibold text-opacity-95"
          }`}
        >
          {(() => {
            const startSuffix = event.startTime.split(":").map(Number)[0] < 12 ? "AM" : "PM";
            const endSuffix = event.endTime.split(":").map(Number)[0] < 12 ? "AM" : "PM";
            const startStr =
              startSuffix === endSuffix
                ? formatTimeWithAmPm(event.startTime, false)
                : formatTimeWithAmPm(event.startTime, true);
            const endStr = formatTimeWithAmPm(event.endTime, true);
            return `${startStr}-${endStr}`;
          })()}
        </span>
        <span
          className={`shrink-0 text-[12px] sm:text-[13px] ${
            isJobStudent ? "font-bold opacity-90" : "font-extrabold"
          }`}
        >
          {event.student_name ?? event.studentInitials}
        </span>
        <span
          className={`truncate shrink-0 text-[10px] font-semibold sm:text-[11px] ${
            isJobStudent ? "opacity-75" : "opacity-95"
          }`}
        >
          {event.locations?.name ?? event.locationName}
        </span>
      </div>
    </button>
  );
}

export default function ScheduleBoardPage() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const fetchStartDate = useMemo(
    () => addDays(today, -MAX_DAYS_AHEAD),
    [today]
  );
  const fetchDayCount = MAX_DAYS_AHEAD * 2;
  const { isLoggedIn, signIn, signOut } = useAuth();
  const { events: fetchedEvents, refetch: refetchEvents } = useEvents(
    fetchStartDate,
    fetchDayCount
  );
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
  /** 表示日付 → 自動コピー枠のスナップショット（コピー元更新と非連動） */
  const frozenAutoFillRef = useRef<Map<string, FrozenAutoFillTemplate[]>>(new Map());
  const [autoFillFrozenVersion, setAutoFillFrozenVersion] = useState(0);

  const weekDates = useMemo(
    () => Array.from({ length: MAX_DAYS_AHEAD }, (_, i) => addDays(today, i)),
    [today]
  );

  const NEW_DAYS_START_INDEX = Math.floor(MAX_DAYS_AHEAD / 2); // 7
  const fetchedOffset = MAX_DAYS_AHEAD; // destination dayIndex k => fetched dayIndex k+14

  // 後半週の空き日について、まだスナップショットが無ければ 1〜2 週前の内容を凍結（以降コピー元と連動しない）
  useEffect(() => {
    const byFetchedDay = indexEventsByFetchedDay(fetchedEvents);
    const windowDates = new Set(weekDates.map((d) => format(d, "yyyy-MM-dd")));
    let mutated = false;

    for (const key of [...frozenAutoFillRef.current.keys()]) {
      if (!windowDates.has(key)) {
        frozenAutoFillRef.current.delete(key);
        mutated = true;
      }
    }

    for (let destDayIndex = NEW_DAYS_START_INDEX; destDayIndex < MAX_DAYS_AHEAD; destDayIndex++) {
      const destDateStr = format(weekDates[destDayIndex], "yyyy-MM-dd");
      const destFetchedDayIndex = destDayIndex + fetchedOffset;
      const destEvents = byFetchedDay.get(destFetchedDayIndex) ?? [];

      if (destEvents.length > 0) {
        if (frozenAutoFillRef.current.has(destDateStr)) {
          frozenAutoFillRef.current.delete(destDateStr);
          mutated = true;
        }
        continue;
      }

      if (frozenAutoFillRef.current.has(destDateStr)) continue;

      const destFetched = destFetchedDayIndex;
      const oneWeekEvents = byFetchedDay.get(destFetched - 7) ?? [];
      const source = oneWeekEvents.length > 0 ? oneWeekEvents : (byFetchedDay.get(destFetched - 14) ?? []);
      if (source.length === 0) continue;

      frozenAutoFillRef.current.set(destDateStr, source.map(toFrozenTemplate));
      mutated = true;
    }

    if (mutated) setAutoFillFrozenVersion((v) => v + 1);
  }, [fetchedEvents, weekDates]);

  // 表示する 2 週間分のイベントを作る
  // - 新しく増えた週（後半 7 日）で空白になっている日だけ、1 週間前→2 週間前の同曜日をコピーして表示
  // - 自動コピーは初回だけ実データから取り、以降は frozenAutoFillRef のスナップショット（非連動）
  const visibleEvents = useMemo(() => {
    const byFetchedDay = indexEventsByFetchedDay(fetchedEvents);

    const copyDateAndTime = (
      source: DisplayEvent,
      destDayIndex: number,
      destDateStr: string
    ): DisplayEvent => {
      const startIso = new Date(`${destDateStr}T${source.startTime}:00`).toISOString();
      const endIso = new Date(`${destDateStr}T${source.endTime}:00`).toISOString();
      return {
        ...source,
        date: destDateStr,
        dayIndex: destDayIndex,
        startIso,
        endIso,
      };
    };

    const result: DisplayEvent[] = [];

    for (let destDayIndex = 0; destDayIndex < MAX_DAYS_AHEAD; destDayIndex++) {
      const destDate = weekDates[destDayIndex];
      const destDateStr = format(destDate, "yyyy-MM-dd");

      const destFetchedDayIndex = destDayIndex + fetchedOffset;
      const destEvents = byFetchedDay.get(destFetchedDayIndex) ?? [];

      // 新しく増えた週の前半はそのまま表示（空白は空白のまま）
      if (destDayIndex < NEW_DAYS_START_INDEX) {
        for (const ev of destEvents) result.push(copyDateAndTime(ev, destDayIndex, destDateStr));
        continue;
      }

      if (destEvents.length > 0) {
        for (const ev of destEvents) result.push(copyDateAndTime(ev, destDayIndex, destDateStr));
        continue;
      }

      const frozenList = frozenAutoFillRef.current.get(destDateStr);
      if (frozenList && frozenList.length > 0) {
        for (let i = 0; i < frozenList.length; i++) {
          result.push(displayFromFrozenTemplate(frozenList[i], destDayIndex, destDateStr, i));
        }
        continue;
      }

      const oneWeekFetchedDayIndex = destFetchedDayIndex - 7;
      const oneWeekEvents = byFetchedDay.get(oneWeekFetchedDayIndex) ?? [];
      if (oneWeekEvents.length > 0) {
        for (const ev of oneWeekEvents) {
          const copied = copyDateAndTime(ev, destDayIndex, destDateStr);
          copied.isCopied = true;
          copied.id = `${ev.id}__copy__d${destDayIndex}`;
          result.push(copied);
        }
        continue;
      }

      const twoWeeksFetchedDayIndex = destFetchedDayIndex - 14;
      const twoWeeksEvents = byFetchedDay.get(twoWeeksFetchedDayIndex) ?? [];
      if (twoWeeksEvents.length > 0) {
        for (const ev of twoWeeksEvents) {
          const copied = copyDateAndTime(ev, destDayIndex, destDateStr);
          copied.isCopied = true;
          copied.id = `${ev.id}__copy__d${destDayIndex}`;
          result.push(copied);
        }
        continue;
      }
      // 1週前も2週前も空なら空白のまま
    }

    result.sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime());
    return result;
  }, [fetchedEvents, weekDates, autoFillFrozenVersion]);

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

  function openEventDetails(event: DisplayEvent) {
    setSelectedEvent(event);
  }

  const showDetailsModal = !!selectedEvent && !eventFormOpen;

  return (
    <div className="min-h-screen max-w-[100vw] overflow-x-hidden bg-gradient-to-b from-slate-50 via-zinc-50 to-zinc-50">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200/70 bg-white/60 px-3 py-2 backdrop-blur">
        <span className="text-[13px] font-bold text-slate-800 sm:text-[14px]">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={() => (isLoggedIn ? signOut() : setLoginModalOpen(true))}
          className="rounded-xl border border-slate-200 bg-white/70 px-3 py-1.5 text-[12px] font-bold text-slate-700 shadow-sm hover:bg-slate-50 active:translate-y-px focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
            className="sticky left-0 z-20 flex shrink-0 flex-col border-r border-slate-200/70 bg-white/60 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] backdrop-blur"
            style={{ width: "56px" }}
          >
            <div
              className="border-b border-slate-200 bg-slate-50/70"
              style={{ height: "52px", minHeight: "52px" }}
            />
            <div className="relative bg-white/40" style={{ height: GRID_HEIGHT_PX }}>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="absolute right-0 pr-2 text-[11px] font-bold text-slate-500 -translate-y-1/2"
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
                className="flex w-[120px] min-w-[120px] flex-col shrink-0 border-r border-slate-200/70 bg-white/60 md:w-[150px] md:min-w-[150px]"
                data-day-column
                data-date={d.toISOString()}
              >
                <div
                  className="flex flex-col items-center justify-center border-b border-slate-200 bg-slate-50/60 py-1.5 text-center"
                  style={{ height: "52px", minHeight: "52px" }}
                >
                  <span className="text-[11px] font-bold text-slate-600">
                    {format(d, "EEE", { locale: enUS })}
                  </span>
                  <span className="text-[13px] font-bold text-slate-800">
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
                      className="border-b border-slate-200/80"
                      style={{ height: HOUR_ROW_HEIGHT_PX }}
                    />
                  ))}
                  <div className="absolute inset-0">
                    {visibleEvents
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
          existingEvents={visibleEvents}
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
          existingEvents={visibleEvents}
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
