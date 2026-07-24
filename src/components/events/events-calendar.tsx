"use client";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, MapPin } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  format,
  addMonths,
} from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EVENTS } from "@/lib/events-data";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Both panels are driven by the same EVENTS array and a single `selectedId`, so
// selecting a day on the calendar highlights its event in the list and vice versa.
export function EventsCalendar() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [month]);

  const monthEvents = useMemo(
    () =>
      EVENTS.filter((e) => isSameMonth(e.date, month)).sort(
        (a, b) => a.date.getTime() - b.date.getTime()
      ),
    [month]
  );

  const selected = selectedId ? EVENTS.find((e) => e.id === selectedId) ?? null : null;
  const eventsOn = (d: Date) => EVENTS.filter((e) => isSameDay(e.date, d));

  function selectDay(d: Date) {
    const list = eventsOn(d);
    if (list.length) setSelectedId(list[0].id);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left panel — calendar */}
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">{format(month, "MMMM yyyy")}</CardTitle>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonth(addMonths(month, -1))}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonth(addMonths(month, 1))}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((d) => {
              const list = eventsOn(d);
              const has = list.length > 0;
              const inMonth = isSameMonth(d, month);
              const isSel = selected ? isSameDay(d, selected.date) : false;
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  disabled={!has}
                  onClick={() => selectDay(d)}
                  className={cn(
                    "relative flex aspect-square flex-col items-center justify-center rounded-md text-sm transition-colors",
                    inMonth ? "text-foreground" : "text-muted-foreground/40",
                    has && !isSel && "hover:bg-muted",
                    !has && "cursor-default",
                    isToday(d) && !isSel && "ring-1 ring-primary",
                    isSel && "bg-primary text-primary-foreground"
                  )}
                >
                  <span>{format(d, "d")}</span>
                  {has && (
                    <span
                      className={cn(
                        "mt-0.5 h-1.5 w-1.5 rounded-full",
                        isSel ? "bg-primary-foreground" : "bg-primary"
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Right panel — event list */}
      <Card className="flex flex-col">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Upcoming events</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col">
          {monthEvents.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-16 text-center">
              <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No events this month.</p>
            </div>
          ) : (
            <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {monthEvents.map((e) => {
                const isSel = e.id === selectedId;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(e.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors border-0 shadow-[0_6px_20px_rgba(0,0,0,0.16)]",
                        isSel ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      )}
                    >
                      <div className="flex w-12 shrink-0 flex-col items-center rounded-md bg-muted px-2 py-1">
                        <span className="text-[10px] font-medium uppercase text-muted-foreground">
                          {format(e.date, "MMM")}
                        </span>
                        <span className="text-lg font-bold leading-none">{format(e.date, "d")}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium leading-tight">{e.title}</div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {e.time}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {e.location}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
