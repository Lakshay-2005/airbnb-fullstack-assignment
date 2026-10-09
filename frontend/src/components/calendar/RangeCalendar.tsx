"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { addDays, formatLong, formatMonthYear, parseISO, toISO, todayISO } from "@/lib/dates";

interface RangeCalendarProps {
  checkIn: string | null;
  checkOut: string | null;
  onChange: (checkIn: string | null, checkOut: string | null) => void;
  /** Booked *nights* (from the availability API). The check-out day itself stays selectable. */
  unavailable?: ReadonlySet<string>;
  months?: 1 | 2;
  onInvalid?: (message: string) => void;
}

const NO_DATES: ReadonlySet<string> = new Set();
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function monthDays(firstOfMonth: string): (string | null)[] {
  const first = parseISO(firstOfMonth);
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = Array(first.getDay()).fill(null);
  for (let d = 1; d <= count; d += 1) {
    cells.push(toISO(new Date(first.getFullYear(), first.getMonth(), d)));
  }
  return cells;
}

const firstOfMonth = (iso: string) => `${iso.slice(0, 7)}-01`;

function shiftMonth(first: string, delta: number): string {
  const d = parseISO(first);
  return toISO(new Date(d.getFullYear(), d.getMonth() + delta, 1));
}

export function RangeCalendar({
  checkIn,
  checkOut,
  onChange,
  unavailable,
  months = 2,
  onInvalid,
}: RangeCalendarProps) {
  const today = todayISO();
  const [cursor, setCursor] = useState(() => firstOfMonth(checkIn ?? today));
  const [hover, setHover] = useState<string | null>(null);
  const blocked = unavailable ?? NO_DATES;

  const selectingEnd = Boolean(checkIn && !checkOut);

  /** Last day the guest could check out if they start on `checkIn` (first booked night). */
  const maxCheckout = useMemo(() => {
    if (!checkIn) return null;
    let day = checkIn;
    for (let i = 0; i < 400; i += 1) {
      day = addDays(day, 1);
      if (blocked.has(day)) return day;
    }
    return null;
  }, [checkIn, blocked]);

  const isPast = (day: string) => day < today;
  const cannotStart = (day: string) => isPast(day) || blocked.has(day);

  function isDisabled(day: string): boolean {
    if (selectingEnd && checkIn && day > checkIn) {
      return maxCheckout !== null && day > maxCheckout;
    }
    return cannotStart(day);
  }

  function handleSelect(day: string) {
    if (!selectingEnd || !checkIn || day <= checkIn) {
      if (cannotStart(day)) return;
      onChange(day, null);
      return;
    }
    if (isDisabled(day)) {
      onInvalid?.("Those dates include nights that are already booked.");
      return;
    }
    onChange(checkIn, day);
  }

  const previewEnd = selectingEnd && hover && checkIn && hover > checkIn && !isDisabled(hover) ? hover : null;
  const rangeEnd = checkOut ?? previewEnd;
  const canGoBack = cursor > firstOfMonth(today);

  return (
    <div className="relative select-none">
      <div className={cn("flex flex-col gap-8", months === 2 && "md:flex-row")}>
        {Array.from({ length: months }, (_, i) => {
          const monthStart = shiftMonth(cursor, i);
          return (
            <div key={monthStart} className="w-[308px] max-w-full">
              <div className="mb-3 flex h-9 items-center justify-center">
                {i === 0 && (
                  <button
                    type="button"
                    onClick={() => setCursor(shiftMonth(cursor, -1))}
                    disabled={!canGoBack}
                    aria-label="Previous month"
                    className="absolute left-0 flex size-9 items-center justify-center rounded-full transition hover:bg-surface disabled:invisible"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                )}
                <h3 className="text-[15px] font-semibold">{formatMonthYear(monthStart)}</h3>
                {i === months - 1 && (
                  <button
                    type="button"
                    onClick={() => setCursor(shiftMonth(cursor, 1))}
                    aria-label="Next month"
                    className="absolute right-0 flex size-9 items-center justify-center rounded-full transition hover:bg-surface"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-7 text-center text-xs font-medium text-muted" aria-hidden="true">
                {WEEKDAYS.map((d, idx) => (
                  <span key={idx} className="pb-2">
                    {d}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7" role="grid" aria-label={formatMonthYear(monthStart)}>
                {monthDays(monthStart).map((day, idx) =>
                  day === null ? (
                    <span key={`blank-${idx}`} />
                  ) : (
                    <DayCell
                      key={day}
                      day={day}
                      today={today}
                      isStart={day === checkIn}
                      isEnd={day === checkOut}
                      inRange={Boolean(checkIn && rangeEnd && day > checkIn && day < rangeEnd)}
                      hasRange={Boolean(checkIn && rangeEnd)}
                      isPreviewEnd={day === previewEnd}
                      disabled={isDisabled(day)}
                      booked={blocked.has(day) && !(selectingEnd && day === maxCheckout)}
                      past={isPast(day)}
                      onSelect={handleSelect}
                      onHover={setHover}
                    />
                  ),
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DayCellProps {
  day: string;
  today: string;
  isStart: boolean;
  isEnd: boolean;
  isPreviewEnd: boolean;
  inRange: boolean;
  hasRange: boolean;
  disabled: boolean;
  booked: boolean;
  past: boolean;
  onSelect: (day: string) => void;
  onHover: (day: string | null) => void;
}

function DayCell({
  day,
  today,
  isStart,
  isEnd,
  isPreviewEnd,
  inRange,
  hasRange,
  disabled,
  booked,
  past,
  onSelect,
  onHover,
}: DayCellProps) {
  const selected = isStart || isEnd;
  const label = [
    formatLong(day),
    booked ? "booked, unavailable" : past ? "unavailable, in the past" : disabled ? "unavailable" : "",
    isStart ? "check-in date" : isEnd ? "check-out date" : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      role="gridcell"
      className={cn(
        "relative flex h-11 items-center justify-center",
        inRange && "bg-surface",
        isStart && hasRange && "rounded-l-full bg-surface",
        (isEnd || isPreviewEnd) && "rounded-r-full bg-surface",
      )}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-pressed={selected}
        onClick={() => onSelect(day)}
        onMouseEnter={() => onHover(day)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(day)}
        className={cn(
          "relative flex size-11 items-center justify-center rounded-full text-sm font-medium transition",
          selected && "bg-ink text-on-ink",
          !selected && !disabled && "hover:ring-1 hover:ring-ink",
          !selected && disabled && "text-faint",
          booked && !selected && "line-through decoration-faint",
          day === today && !selected && "font-bold underline underline-offset-4",
        )}
      >
        {Number(day.slice(8))}
      </button>
    </div>
  );
}
