import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import { issuesApi } from "../api/issues";
import { heartbeatsApi } from "../api/heartbeats";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import {
  ChevronLeft, ChevronRight, CalendarDays, List, Clock,
  ExternalLink, Zap, CircleDot, RefreshCw, LogIn,
} from "lucide-react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
type CalView = "week" | "day" | "agenda";

interface CalEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color: string;
  source: "issue" | "run" | "google";
  href?: string;
  assignee?: string;
  priority?: string;
  status?: string;
}

// ─── Google Calendar OAuth ────────────────────────────────────────────────────
const GOOGLE_SCOPES = "https://www.googleapis.com/auth/calendar.readonly";
const GCAL_API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const GCal_CLIENT_ID: string = (window as any).__GOOGLE_CLIENT_ID__ ?? (window as any).__VITE_GOOGLE_CLIENT_ID__ ?? "";

function getGoogleToken(): string | null {
  try { return localStorage.getItem("gcal_token"); } catch { return null; }
}
function saveGoogleToken(t: string) {
  try { localStorage.setItem("gcal_token", t); } catch {}
}
function clearGoogleToken() {
  try { localStorage.removeItem("gcal_token"); } catch {}
}

// Priority → color
const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#ef4444", high: "#f97316", medium: "#eab308", low: "#6b7280",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

// ─── Mini Month Navigator ─────────────────────────────────────────────────────
function MiniMonth({
  current,
  onChange,
  events,
}: {
  current: Date;
  onChange: (d: Date) => void;
  events: CalEvent[];
}) {
  const [nav, setNav] = useState(() => {
    const d = new Date(current); d.setDate(1); return d;
  });

  const daysInMonth = new Date(nav.getFullYear(), nav.getMonth() + 1, 0).getDate();
  const firstDow = new Date(nav.getFullYear(), nav.getMonth(), 1).getDay();

  const eventDays = useMemo(() => {
    const s = new Set<string>();
    events.forEach(e => { if (e.start.getMonth() === nav.getMonth()) s.add(e.start.getDate().toString()); });
    return s;
  }, [events, nav]);

  return (
    <div className="p-3 select-none">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => { const d = new Date(nav); d.setMonth(d.getMonth() - 1); setNav(d); }}
          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-[11px] font-bold text-slate-300 tracking-wide">
          {nav.toLocaleDateString([], { month: "long", year: "numeric" })}
        </span>
        <button onClick={() => { const d = new Date(nav); d.setMonth(d.getMonth() + 1); setNav(d); }}
          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {["D","L","M","X","J","V","S"].map(d => (
          <div key={d} className="text-[9px] text-center text-slate-600 font-bold">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const d = new Date(nav.getFullYear(), nav.getMonth(), day);
          const isToday = isSameDay(d, new Date());
          const isSel = isSameDay(d, current);
          const hasEv = eventDays.has(day.toString());
          return (
            <button key={day} onClick={() => onChange(d)}
              className={cn(
                "w-6 h-6 text-[10px] rounded flex flex-col items-center justify-center transition-all",
                isToday && "font-bold",
                isSel ? "bg-violet-600 text-white" : "text-slate-400 hover:bg-white/10 hover:text-slate-200",
                isToday && !isSel && "text-violet-400",
              )}>
              {day}
              {hasEv && !isSel && <span className="w-1 h-1 rounded-full bg-violet-400 mt-0.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Event Pill ───────────────────────────────────────────────────────────────
function EventPill({ event, compact = false }: { event: CalEvent; compact?: boolean }) {
  const inner = (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded px-2 py-1 cursor-pointer hover:opacity-90 transition-opacity overflow-hidden",
        compact ? "py-0.5" : "py-1.5",
      )}
      style={{ background: `${event.color}22`, border: `1px solid ${event.color}55` }}
    >
      {event.source === "run" && <Zap className="w-2.5 h-2.5 shrink-0" style={{ color: event.color }} />}
      {event.source === "issue" && <CircleDot className="w-2.5 h-2.5 shrink-0" style={{ color: event.color }} />}
      {event.source === "google" && <CalendarDays className="w-2.5 h-2.5 shrink-0" style={{ color: event.color }} />}
      <span className="text-[10px] font-medium truncate" style={{ color: event.color }}>{event.title}</span>
      {!compact && <span className="text-[9px] shrink-0 ml-auto font-mono" style={{ color: `${event.color}99` }}>{formatTime(event.start)}</span>}
    </div>
  );

  if (event.href) return <Link to={event.href} style={{ textDecoration: "none" }}>{inner}</Link>;
  return inner;
}

// ─── Week View ────────────────────────────────────────────────────────────────
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_HEIGHT = 1440; // 1px per minute

function WeekView({ weekStart, events, today }: { weekStart: Date; events: CalEvent[]; today: Date }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalEvent[]>();
    days.forEach((d, i) => {
      map.set(i, events.filter(e => isSameDay(e.start, d)));
    });
    return map;
  }, [events, weekStart]);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Time gutter */}
      <div className="w-14 shrink-0 border-r border-white/5 relative" style={{ height: DAY_HEIGHT }}>
        {HOURS.map(h => (
          <div key={h} style={{ position: "absolute", top: h * 60, left: 0, width: "100%" }}>
            <span className="text-[9px] text-slate-600 font-mono px-1 leading-none">
              {h === 0 ? "" : `${h.toString().padStart(2, "0")}:00`}
            </span>
          </div>
        ))}
      </div>

      {/* Day columns */}
      <div className="flex flex-1 min-w-0 overflow-x-auto">
        {days.map((day, di) => {
          const isToday = isSameDay(day, today);
          const dayEvents = eventsByDay.get(di) ?? [];
          return (
            <div key={di} className="flex-1 min-w-[100px] border-r border-white/5 relative" style={{ height: DAY_HEIGHT }}>
              {/* Hour lines */}
              {HOURS.map(h => (
                <div key={h} className="absolute left-0 right-0 border-t border-white/5"
                  style={{ top: h * 60 }} />
              ))}

              {/* Now line */}
              {isToday && (
                <div className="absolute left-0 right-0 flex items-center z-20" style={{ top: nowMinutes }}>
                  <div className="w-2 h-2 rounded-full bg-red-400 -ml-1 shrink-0" />
                  <div className="flex-1 h-px bg-red-400/60" />
                </div>
              )}

              {/* Events */}
              {dayEvents.map(ev => {
                const startMin = ev.start.getHours() * 60 + ev.start.getMinutes();
                const endMin = ev.end.getHours() * 60 + ev.end.getMinutes();
                const duration = Math.max(endMin - startMin, 30);
                return (
                  <div key={ev.id} className="absolute left-1 right-1 z-10"
                    style={{ top: startMin, height: duration }}>
                    <div className="h-full rounded overflow-hidden"
                      style={{ background: `${ev.color}20`, borderLeft: `3px solid ${ev.color}` }}>
                      {ev.href ? (
                        <Link to={ev.href} style={{ textDecoration: "none" }} className="block h-full px-1.5 py-1">
                          <div className="text-[9px] font-semibold truncate" style={{ color: ev.color }}>{ev.title}</div>
                          {duration > 40 && <div className="text-[8px] font-mono" style={{ color: `${ev.color}99` }}>{formatTime(ev.start)}</div>}
                        </Link>
                      ) : (
                        <div className="px-1.5 py-1">
                          <div className="text-[9px] font-semibold truncate" style={{ color: ev.color }}>{ev.title}</div>
                          {duration > 40 && <div className="text-[8px] font-mono" style={{ color: `${ev.color}99` }}>{formatTime(ev.start)}</div>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────────
function DayView({ day, events }: { day: Date; events: CalEvent[] }) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isToday = isSameDay(day, now);
  const dayEvents = events.filter(e => isSameDay(e.start, day));

  return (
    <div className="flex flex-1 min-h-0 overflow-y-auto">
      <div className="w-14 shrink-0 border-r border-white/5 relative" style={{ height: DAY_HEIGHT }}>
        {HOURS.map(h => (
          <div key={h} style={{ position: "absolute", top: h * 60 }}>
            <span className="text-[9px] text-slate-600 font-mono px-1">{h === 0 ? "" : `${h.toString().padStart(2,"0")}:00`}</span>
          </div>
        ))}
      </div>
      <div className="flex-1 relative" style={{ height: DAY_HEIGHT }}>
        {HOURS.map(h => <div key={h} className="absolute left-0 right-0 border-t border-white/5" style={{ top: h * 60 }} />)}
        {isToday && (
          <div className="absolute left-0 right-0 flex items-center z-20" style={{ top: nowMinutes }}>
            <div className="w-2 h-2 rounded-full bg-red-400 -ml-1 shrink-0" />
            <div className="flex-1 h-px bg-red-400/60" />
          </div>
        )}
        {dayEvents.map(ev => {
          const startMin = ev.start.getHours() * 60 + ev.start.getMinutes();
          const duration = Math.max((ev.end.getTime() - ev.start.getTime()) / 60000, 30);
          return (
            <div key={ev.id} className="absolute left-2 right-2 z-10 rounded overflow-hidden"
              style={{ top: startMin, height: duration, background: `${ev.color}20`, borderLeft: `3px solid ${ev.color}` }}>
              {ev.href
                ? <Link to={ev.href} style={{ textDecoration: "none" }} className="block h-full px-2 py-1">
                    <div className="text-[10px] font-semibold truncate" style={{ color: ev.color }}>{ev.title}</div>
                    <div className="text-[9px] font-mono" style={{ color: `${ev.color}80` }}>{formatTime(ev.start)} – {formatTime(ev.end)}</div>
                    {ev.assignee && <div className="text-[9px] text-slate-500 mt-0.5">{ev.assignee}</div>}
                  </Link>
                : <div className="px-2 py-1">
                    <div className="text-[10px] font-semibold truncate" style={{ color: ev.color }}>{ev.title}</div>
                    <div className="text-[9px] font-mono" style={{ color: `${ev.color}80` }}>{formatTime(ev.start)}</div>
                  </div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Agenda View ──────────────────────────────────────────────────────────────
function AgendaView({ events, today }: { events: CalEvent[]; today: Date }) {
  const sorted = useMemo(() =>
    [...events].sort((a, b) => a.start.getTime() - b.start.getTime()), [events]);

  const grouped = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    sorted.forEach(ev => {
      const key = ev.start.toDateString();
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    });
    return [...map.entries()];
  }, [sorted]);

  if (grouped.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-slate-500">
          <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No events this period</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-4">
      {grouped.map(([dateStr, evs]) => {
        const date = new Date(dateStr);
        const isToday = isSameDay(date, today);
        return (
          <div key={dateStr}>
            {/* Day header */}
            <div className={cn(
              "flex items-center gap-3 mb-2 sticky top-0 py-1.5 px-2 rounded-lg z-10",
              isToday ? "bg-violet-600/20" : "bg-background/80 backdrop-blur",
            )}>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0",
                isToday ? "bg-violet-600 text-white" : "bg-white/10 text-slate-300",
              )}>
                {date.getDate()}
              </div>
              <div>
                <div className={cn("text-[12px] font-semibold", isToday ? "text-violet-300" : "text-slate-300")}>
                  {isToday ? "Hoy" : date.toLocaleDateString([], { weekday: "long" })}
                </div>
                <div className="text-[10px] text-slate-500">{date.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</div>
              </div>
              <div className="ml-auto text-[9px] text-slate-600">{evs.length} event{evs.length > 1 ? "s" : ""}</div>
            </div>

            {/* Events */}
            <div className="flex flex-col gap-1.5 ml-4 border-l border-white/5 pl-4">
              {evs.map(ev => (
                <div key={ev.id} className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
                  style={{ borderLeft: `3px solid ${ev.color}` }}>
                  <div className="shrink-0 pt-0.5 w-14 text-right">
                    <span className="text-[10px] font-mono" style={{ color: ev.color }}>{formatTime(ev.start)}</span>
                    <div className="text-[9px] text-slate-600 font-mono">{formatTime(ev.end)}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {ev.source === "run" && <Zap className="w-3 h-3 shrink-0" style={{ color: ev.color }} />}
                      {ev.source === "issue" && <CircleDot className="w-3 h-3 shrink-0" style={{ color: ev.color }} />}
                      {ev.source === "google" && <CalendarDays className="w-3 h-3 shrink-0" style={{ color: ev.color }} />}
                      {ev.href
                        ? <Link to={ev.href} className="text-[12px] font-semibold hover:underline" style={{ color: ev.color, textDecoration: "none" }}>{ev.title}</Link>
                        : <span className="text-[12px] font-semibold" style={{ color: ev.color }}>{ev.title}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {ev.assignee && <span className="text-[9px] text-slate-500">👤 {ev.assignee}</span>}
                      {ev.priority && <span className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                        style={{ background: `${PRIORITY_COLOR[ev.priority] ?? "#6b7280"}20`, color: PRIORITY_COLOR[ev.priority] ?? "#6b7280" }}>
                        {ev.priority}
                      </span>}
                      {ev.status && <span className="text-[9px] text-slate-600">{ev.status}</span>}
                      {ev.source === "run" && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                          Live
                        </span>
                      )}
                    </div>
                  </div>
                  {ev.href && (
                    <Link to={ev.href} className="shrink-0 text-slate-600 hover:text-slate-300 transition-colors pt-1" style={{ textDecoration: "none" }}>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── MAIN CALENDAR ────────────────────────────────────────────────────────────
export function Calendar() {
  const { selectedCompanyId } = useCompany();
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [view, setView] = useState<CalView>("week");
  const [current, setCurrent] = useState<Date>(today);
  const [gcalToken, setGcalToken] = useState<string | null>(getGoogleToken);
  const [gcalEvents, setGcalEvents] = useState<CalEvent[]>([]);
  const [gcalLoading, setGcalLoading] = useState(false);

  const weekStart = useMemo(() => view === "week" ? startOfWeek(current) : current, [current, view]);

  // Date range for queries
  const rangeStart = view === "week" ? weekStart : current;
  const rangeEnd = view === "week" ? addDays(weekStart, 7) : addDays(current, 1);

  // ── Data queries ─────────────────────────────────────────────────────────
  const { data: issues } = useQuery({
    queryKey: ["calendar-issues", selectedCompanyId],
    queryFn: () => issuesApi.list(selectedCompanyId!, { status: "in_progress" }),
    enabled: !!selectedCompanyId,
    refetchInterval: 30_000,
  });

  const { data: allIssues } = useQuery({
    queryKey: ["calendar-all-issues", selectedCompanyId],
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 60_000,
  });

  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentById = useMemo(() => new Map((agents ?? []).map(a => [a.id, a])), [agents]);

  // ── Build events ──────────────────────────────────────────────────────────
  const iapexEvents = useMemo<CalEvent[]>(() => {
    const evs: CalEvent[] = [];

    // Issues with dueDate
    const issuePool = [...(issues ?? []), ...(allIssues ?? [])];
    const seen = new Set<string>();
    issuePool.forEach(issue => {
      if (seen.has(issue.id)) return;
      seen.add(issue.id);
      const due = (issue as any).dueDate ?? (issue as any).prioritizedDate;
      if (!due) return;
      const start = new Date(due);
      const end = new Date(start.getTime() + 60 * 60 * 1000); // 1h block
      const priority = (issue as any).priority as string | undefined;
      const assignee = agentById.get((issue as any).assigneeAgentId ?? "")?.name;
      evs.push({
        id: `issue-${issue.id}`,
        title: issue.title,
        start,
        end,
        color: PRIORITY_COLOR[priority ?? ""] ?? "#8b5cf6",
        source: "issue",
        href: `/issues/${issue.id}`,
        assignee,
        priority,
        status: (issue as any).status,
      });
    });

    // Live runs → appear as events starting now
    (liveRuns ?? []).forEach(run => {
      if (!run.startedAt) return;
      const start = new Date(run.startedAt);
      const end = new Date(); // still running
      const agent = agentById.get(run.agentId);
      evs.push({
        id: `run-${run.id}`,
        title: `${agent?.name ?? run.agentName ?? "Agent"} — Running`,
        start,
        end,
        color: "#22c55e",
        source: "run",
        assignee: agent?.name,
      });
    });

    return evs;
  }, [issues, allIssues, liveRuns, agentById]);

  const allEvents = useMemo(() => [...iapexEvents, ...gcalEvents], [iapexEvents, gcalEvents]);

  // Events visible in current range
  const visibleEvents = useMemo(() =>
    allEvents.filter(e => e.start < rangeEnd && e.end > rangeStart),
    [allEvents, rangeStart, rangeEnd]);

  // ── Google Calendar ───────────────────────────────────────────────────────
  const connectGoogle = useCallback(() => {
    if (!GCal_CLIENT_ID) {
      alert("Configura VITE_GOOGLE_CLIENT_ID en tu .env para conectar Google Calendar");
      return;
    }
    const params = new URLSearchParams({
      client_id: GCal_CLIENT_ID,
      redirect_uri: window.location.origin + "/calendar",
      response_type: "token",
      scope: GOOGLE_SCOPES,
      prompt: "consent",
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }, []);

  // Handle OAuth redirect back with token in fragment
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("access_token")) return;
    const params = new URLSearchParams(hash.slice(1));
    const token = params.get("access_token");
    if (token) {
      saveGoogleToken(token);
      setGcalToken(token);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  // Fetch Google Calendar events when token is available
  useEffect(() => {
    if (!gcalToken) return;
    setGcalLoading(true);
    const timeMin = new Date(Date.now() - 30 * 86400000).toISOString();
    const timeMax = new Date(Date.now() + 90 * 86400000).toISOString();
    fetch(`${GCAL_API}?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=250`, {
      headers: { Authorization: `Bearer ${gcalToken}` },
    })
      .then(r => { if (r.status === 401) { clearGoogleToken(); setGcalToken(null); throw new Error("auth"); } return r.json(); })
      .then(data => {
        const evs: CalEvent[] = (data.items ?? []).map((item: any) => {
          const start = new Date(item.start.dateTime ?? item.start.date);
          const end = new Date(item.end.dateTime ?? item.end.date);
          return {
            id: `gcal-${item.id}`,
            title: item.summary ?? "Google event",
            start, end,
            color: "#4285f4",
            source: "google" as const,
            href: item.htmlLink,
          };
        });
        setGcalEvents(evs);
      })
      .catch(() => {})
      .finally(() => setGcalLoading(false));
  }, [gcalToken]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const navigate = useCallback((dir: -1 | 1) => {
    setCurrent(prev => {
      if (view === "week") return addDays(prev, dir * 7);
      if (view === "day") return addDays(prev, dir);
      return addDays(prev, dir * 30);
    });
  }, [view]);

  const headerLabel = useMemo(() => {
    if (view === "day") return formatDate(current);
    if (view === "week") {
      const end = addDays(weekStart, 6);
      return `${weekStart.toLocaleDateString([], { month: "short", day: "numeric" })} – ${end.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return current.toLocaleDateString([], { month: "long", year: "numeric" });
  }, [current, view, weekStart]);

  // Week day headers
  const weekDays = useMemo(() => view === "week"
    ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    : [], [weekStart, view]);

  return (
    <div className="flex h-full min-h-0" style={{ background: "#080c14" }}>
      <style>{`
        @keyframes ping { 75%,100%{transform:scale(2);opacity:0} }
      `}</style>

      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      <div className="w-[220px] shrink-0 border-r border-white/5 flex flex-col bg-[#060a10]">
        <MiniMonth current={current} onChange={d => { setCurrent(d); setView("day"); }} events={allEvents} />

        {/* Legend */}
        <div className="px-4 py-3 border-t border-white/5">
          <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">Sources</div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <CircleDot className="w-3 h-3 text-violet-400" />
              <span className="text-[11px] text-slate-400">Issues with deadline</span>
              <span className="ml-auto text-[10px] font-mono text-slate-600">
                {iapexEvents.filter(e => e.source === "issue").length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-3 h-3 text-green-400" />
              <span className="text-[11px] text-slate-400">Live runs</span>
              <span className="ml-auto text-[10px] font-mono text-slate-600">
                {iapexEvents.filter(e => e.source === "run").length}
              </span>
            </div>
            {gcalToken && (
              <div className="flex items-center gap-2">
                <CalendarDays className="w-3 h-3 text-blue-400" />
                <span className="text-[11px] text-slate-400">Google Calendar</span>
                <span className="ml-auto text-[10px] font-mono text-slate-600">{gcalEvents.length}</span>
              </div>
            )}
          </div>
        </div>

        {/* Google Calendar connect */}
        <div className="px-3 py-3 border-t border-white/5 mt-auto">
          {gcalToken ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[11px] text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                Google conectado
                {gcalLoading && <RefreshCw className="w-3 h-3 animate-spin ml-auto" />}
              </div>
              <button
                onClick={() => { clearGoogleToken(); setGcalToken(null); setGcalEvents([]); }}
                className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors text-left"
              >
                Desconectar
              </button>
            </div>
          ) : (
            <button
              onClick={connectGoogle}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-[11px] font-medium transition-all"
            >
              <LogIn className="w-3.5 h-3.5" />
              Conectar Google Cal
            </button>
          )}
        </div>
      </div>

      {/* ── Main calendar area ────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-h-0 min-w-0">

        {/* ── Toolbar ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 shrink-0 bg-[#060a10]">
          {/* Nav buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrent(today)}
              className="px-3 py-1 rounded-lg text-[11px] font-medium border border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-colors"
            >
              Hoy
            </button>
            <button
              onClick={() => navigate(1)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-[14px] font-bold text-slate-200 flex-1">{headerLabel}</h2>

          {/* View switcher */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/8">
            {([
              { v: "day" as CalView, icon: Clock, label: "Día" },
              { v: "week" as CalView, icon: CalendarDays, label: "Semana" },
              { v: "agenda" as CalView, icon: List, label: "Agenda" },
            ] as const).map(({ v, icon: Icon, label }) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium transition-all",
                  view === v
                    ? "bg-violet-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/10",
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Week day headers ──────────────────────────────────────────── */}
        {view === "week" && (
          <div className="flex border-b border-white/5 shrink-0 bg-[#060a10]">
            <div className="w-14 shrink-0" /> {/* gutter */}
            {weekDays.map((day, i) => {
              const isToday = isSameDay(day, today);
              return (
                <button
                  key={i}
                  onClick={() => { setCurrent(day); setView("day"); }}
                  className={cn(
                    "flex-1 min-w-[100px] py-2 flex flex-col items-center gap-0.5 transition-colors hover:bg-white/5",
                    isToday && "text-violet-400",
                  )}
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600">
                    {["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][day.getDay()]}
                  </span>
                  <span className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold",
                    isToday ? "bg-violet-600 text-white" : "text-slate-300",
                  )}>
                    {day.getDate()}
                  </span>
                  {visibleEvents.filter(e => isSameDay(e.start, day)).length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Calendar body ─────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {view === "week" && <WeekView weekStart={weekStart} events={visibleEvents} today={today} />}
          {view === "day" && <DayView day={current} events={visibleEvents} />}
          {view === "agenda" && <AgendaView events={allEvents} today={today} />}
        </div>
      </div>
    </div>
  );
}
