import { useEffect, useState, useMemo } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { dashboardApi } from "../api/dashboard";
import { activityApi } from "../api/activity";
import { agentsApi } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import {
  Bot, Sparkles, Terminal, Code2, Cpu, Box,
  Clock, Zap, CheckCircle2, AlertCircle, PauseCircle,
  ArrowRight, TrendingUp, GripHorizontal, LayoutGrid, Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Constants & Helpers ────────────────────────────────────────────────────────
const StatusDot = ({ status, pulse }: { status: string; pulse?: boolean }) => {
  const clr: Record<string, string> = {
    active: "#22c55e", running: "#22c55e", pending: "#eab308",
    error: "#ef4444", idle: "#6b7280", paused: "#64748b", terminated: "#334155",
  };
  const color = clr[status] ?? clr.idle;
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      {pulse && (status === "active" || status === "running") && (
        <span style={{ position: "absolute", width: 12, height: 12, borderRadius: "50%", background: color, opacity: 0.35, animation: "ping 1.5s infinite" }} />
      )}
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", position: "relative" }} />
    </span>
  );
};

function formatDuration(startedAt: string | null): string {
  if (!startedAt) return "";
  const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}

const AGENT_ICONS: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  openclaw_gateway: { icon: Cpu, color: "#8b5cf6", label: "OpenClaw" },
  openclaw: { icon: Cpu, color: "#8b5cf6", label: "OpenClaw" },
  claude: { icon: Sparkles, color: "#f59e0b", label: "Claude" },
  cursor: { icon: Code2, color: "#3b82f6", label: "Cursor" },
  opencode: { icon: Box, color: "#10b981", label: "OpenCode" },
  codex: { icon: Terminal, color: "#6366f1", label: "Codex" },
  gemini: { icon: Sparkles, color: "#ec4899", label: "Gemini" },
};

const getAgentDisplay = (adapterType?: string) => {
  if (!adapterType) return { icon: Bot, color: "#94a3b8", label: "Agent" };
  const t = adapterType.toLowerCase();
  for (const key in AGENT_ICONS) {
    if (t.includes(key)) return AGENT_ICONS[key]!;
  }
  return { icon: Bot, color: "#94a3b8", label: "Agent" };
};

const agentStatusLabel: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  running: { label: "Running", icon: Zap, color: "#22c55e" },
  active: { label: "Active", icon: CheckCircle2, color: "#22c55e" },
  paused: { label: "Paused", icon: PauseCircle, color: "#64748b" },
  error: { label: "Error", icon: AlertCircle, color: "#ef4444" },
  idle: { label: "Idle", icon: Clock, color: "#6b7280" },
  terminated: { label: "Terminated", icon: AlertCircle, color: "#334155" },
};

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3.5 mt-0">{children}</h3>
);

// ─── Sortable Widget Wrapper ────────────────────────────────────────────────────
function SortableWidget({
  id,
  isEditing,
  className,
  children,
}: {
  id: string;
  isEditing: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative rounded-xl border flex flex-col min-h-0 bg-white/5 overflow-hidden",
        isEditing ? "border-dashed border-white/20 select-none shadow-lg" : "border-white/10",
        isDragging && "scale-[1.02] border-blue-500/50 shadow-blue-500/10 opacity-90",
        className
      )}
    >
      {/* Editing Overlay Handle */}
      {isEditing && (
        <div
          {...attributes}
          {...listeners}
          className="absolute inset-x-0 top-0 h-8 bg-black/40 backdrop-blur-sm z-10 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-black/60 transition-colors border-b border-white/10"
        >
          <GripHorizontal className="w-4 h-4 text-white/50" />
        </div>
      )}
      <div className={cn("p-4 flex-1 overflow-auto scrollbar-auto-hide", isEditing && "pointer-events-none pt-10")}>
        {children}
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
const DEFAULT_WIDGETS = ["metrics", "agents", "overview", "activity"];

export function Dashboard() {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();
  const [time, setTime] = useState(new Date());
  const [tick, setTick] = useState(0);
  const [isEditing, setIsEditing] = useState(false);

  // Load layout from localStorage or default
  const storageKey = `IApex.dashboardLayout_${selectedCompanyId}`;
  const [widgetOrder, setWidgetOrder] = useState<string[]>([]);

  useEffect(() => {
    if (!selectedCompanyId) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // ensure all defaults exist
          const merged = [...new Set([...parsed, ...DEFAULT_WIDGETS])].filter(w => DEFAULT_WIDGETS.includes(w));
          setWidgetOrder(merged);
          return;
        }
      }
    } catch { /* ignore */ }
    setWidgetOrder(DEFAULT_WIDGETS);
  }, [selectedCompanyId, storageKey]);

  useEffect(() => {
    const timer = setInterval(() => { setTime(new Date()); setTick(c => c + 1); }, 1000);
    return () => clearInterval(timer);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setWidgetOrder((items) => {
        const oldIndex = items.indexOf(String(active.id));
        const newIndex = items.indexOf(String(over.id));
        const newArray = arrayMove(items, oldIndex, newIndex);
        localStorage.setItem(storageKey, JSON.stringify(newArray));
        return newArray;
      });
    }
  };

  // Queries
  const { data: dashboard, isLoading: isDashboardLoading } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents, isLoading: isAgentsLoading } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
  });

  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 5_000,
  });

  const { data: activity, isLoading: isActivityLoading } = useQuery({
    queryKey: queryKeys.activity(selectedCompanyId!),
    queryFn: () => activityApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
  });
  
  const { data: issuesList } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) return <div className="p-8 text-center text-slate-400">Select a company</div>;
  if (isDashboardLoading || isAgentsLoading || isActivityLoading) return <PageSkeleton variant="dashboard" />;

  // Computed data
  const liveRunByAgentId = new Map((liveRuns ?? []).map(r => [r.agentId, r]));
  const runningCount = liveRunByAgentId.size;
  const totalCostMonth = dashboard?.costs.monthSpendCents ? dashboard.costs.monthSpendCents / 100 : 0;
  const recentActivity = activity?.slice(0, 15) ?? [];
  
  // Issue Stats
  const issues = issuesList ?? [];
  const todoCount = issues.filter((i: any) => i.status === "to_do").length;
  const inProgCount = issues.filter((i: any) => i.status === "in_progress").length;
  const doneCount = issues.filter((i: any) => i.status === "done").length;
  const totalIssues = todoCount + inProgCount + doneCount;
  const pTodo = totalIssues ? (todoCount / totalIssues) * 100 : 0;
  const pInProg = totalIssues ? (inProgCount / totalIssues) * 100 : 0;
  const pDone = totalIssues ? (doneCount / totalIssues) * 100 : 0;

  // Renderers para cada tipo de widget
  const RENDERERS: Record<string, () => React.ReactNode> = {
    metrics: () => (
      <>
        <SectionTitle>Global Metrics</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Agents Active", value: agents?.filter(a => (a as any).status !== "terminated").length ?? 0, sub: `${runningCount} running now`, accent: "#8b5cf6", icon: Zap },
            { label: "Pending Approvals", value: dashboard?.pendingApprovals ?? 0, sub: "action required", accent: "#f59e0b", icon: AlertCircle },
            { label: "Issues In Progress", value: dashboard?.tasks.inProgress ?? 0, sub: `${dashboard?.tasks.open ?? 0} open`, accent: "#06b6d4", icon: TrendingUp },
            { label: "Month Spend", value: `$${totalCostMonth.toFixed(2)}`, sub: "USD total", accent: "#22c55e", icon: CheckCircle2 },
          ].map(m => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-1" style={{ borderLeft: `2px solid ${m.accent}` }}>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-slate-400 uppercase tracking-widest">{m.label}</div>
                  <Icon className="w-3.5 h-3.5" style={{ color: m.accent, opacity: 0.5 }} />
                </div>
                <div className="text-2xl font-bold font-mono" style={{ color: m.accent }}>{m.value}</div>
                <div className="text-[9px] text-slate-500">{m.sub}</div>
              </div>
            );
          })}
        </div>
      </>
    ),
    agents: () => (
      <>
        <SectionTitle>{t("agents")} Fleet</SectionTitle>
        <div className="flex gap-3 flex-wrap">
          {agents?.map(ag => {
            const display = getAgentDisplay((ag as any).adapterType);
            const Icon = display.icon;
            const liveRun = liveRunByAgentId.get(ag.id);
            const isRunning = !!liveRun;
            const agStatus = isRunning ? "running" : ((ag as any).status ?? "idle");
            const statusInfo = agentStatusLabel[agStatus] ?? agentStatusLabel.idle!;
            const StatusIcon = statusInfo.icon;
            const elapsed = isRunning ? formatDuration(liveRun.startedAt) : null;
            void tick; // tie elapsed time to tick

            return (
              <Link
                key={ag.id}
                to={`/agents/${ag.id}`}
                className="flex flex-col gap-2 bg-[#0a0f1a] rounded-xl py-3 px-4 outline outline-1 transition-all min-w-[170px] flex-1 max-w-[300px]"
                style={{
                  outlineColor: isRunning ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.08)",
                  boxShadow: isRunning ? "0 0 10px rgba(34,197,94,0.15)" : undefined,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${display.color}20`, color: display.color }}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold text-slate-200 truncate">{ag.name}</div>
                    <div className="text-[9px] text-slate-500 font-mono truncate">{display.label}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-1.5">
                    <StatusDot status={agStatus} pulse={isRunning} />
                    <span className="text-[10px] font-semibold" style={{ color: statusInfo.color }}>{statusInfo.label}</span>
                  </div>
                  {isRunning && elapsed && (
                    <span className="text-[9px] font-mono text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">{elapsed}</span>
                  )}
                </div>
                {isRunning && liveRun.issueId && (
                  <div className="text-[9px] text-slate-500 truncate border-t border-white/5 pt-1.5 flex items-center gap-1 mt-1">
                    <ArrowRight className="w-2.5 h-2.5 shrink-0 text-slate-600" />
                    {"#" + liveRun.issueId.slice(-6)}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </>
    ),
    overview: () => (
      <>
        <SectionTitle>Work Overview</SectionTitle>
        <div className="flex flex-col gap-5 justify-center h-full pt-2 px-2 pb-4">
          <div className="flex items-end justify-between">
             <div className="text-4xl font-bold font-mono text-slate-200">{totalIssues}</div>
             <div className="text-[11px] text-slate-500 uppercase tracking-widest mb-1">Total Issues</div>
          </div>
          <div className="h-6 flex rounded-full overflow-hidden bg-white/5 w-full">
            {pDone > 0 && <div style={{ width: `${pDone}%` }} className="h-full bg-emerald-500/80 transition-all duration-500" title={`Done: ${doneCount}`} />}
            {pInProg > 0 && <div style={{ width: `${pInProg}%` }} className="h-full bg-cyan-500/80 transition-all duration-500" title={`In Progress: ${inProgCount}`} />}
            {pTodo > 0 && <div style={{ width: `${pTodo}%` }} className="h-full bg-slate-600/80 transition-all duration-500" title={`To Do: ${todoCount}`} />}
          </div>
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500/80" />
              <span className="text-[11px] text-slate-400">Done ({doneCount})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500/80" />
              <span className="text-[11px] text-slate-400">WIP ({inProgCount})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-600/80" />
              <span className="text-[11px] text-slate-400">To Do ({todoCount})</span>
            </div>
          </div>
        </div>
      </>
    ),
    activity: () => (
      <>
        <div className="flex justify-between items-center mb-3.5">
          <SectionTitle>{t("activity")} Feed</SectionTitle>
          <span className="text-[9px] text-green-400/60 font-mono tracking-wider flex items-center gap-1 mt-[-14px]">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {recentActivity.map((act, i) => (
            <div
              key={act.id}
              className="flex items-center gap-3 py-2 px-3 rounded-lg text-sm"
              style={{
                borderLeft: `2px solid ${i === 0 ? "#8b5cf6" : "transparent"}`,
                background: i === 0 ? "rgba(139,92,246,0.06)" : "transparent",
              }}
            >
              <StatusDot status="active" pulse={i === 0} />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-slate-300 truncate">
                  {((act as any).message || (act as any).description || "Activity")}
                </div>
              </div>
              <span className="text-[9px] text-slate-500 uppercase tracking-wider bg-white/5 px-1.5 py-0.5 rounded">
                {(act as any).topic || "general"}
              </span>
              <span className="text-[9px] text-slate-500 font-mono whitespace-nowrap">
                {new Date(act.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
          {recentActivity.length === 0 && (
            <div className="text-[10px] text-slate-500 p-2 italic">No recent activity on this instance.</div>
          )}
        </div>
      </>
    ),
  };

  return (
    <div className="flex flex-col gap-6 p-4 h-full relative overflow-y-auto overflow-x-hidden scrollbar-auto-hide bg-[#06080d]">
      <style>{`
        @keyframes ping { 75%,100%{transform:scale(2);opacity:0} }
      `}</style>

      {/* Header */}
      <div className="flex justify-between items-end flex-wrap gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 m-0 flex items-center gap-2">
             <LayoutGrid className="w-5 h-5 text-indigo-400" />
             {t("dashboard")}
          </h2>
          <p className="text-[11px] text-slate-500 mt-1 font-mono uppercase tracking-widest">
            {time.toLocaleDateString()} · {time.toLocaleTimeString()}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {runningCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-green-500/20 bg-green-500/5">
              <StatusDot status="running" pulse />
              <span className="text-[11px] font-semibold text-green-400">{runningCount} active</span>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className={cn(
              "text-[11px] uppercase tracking-wider h-8 transition-colors",
              isEditing ? "bg-indigo-500 hover:bg-indigo-600 text-white border-transparent" : "border-white/10 text-slate-400 hover:text-slate-200"
            )}
          >
            <Settings2 className="w-3.5 h-3.5 mr-2" />
            {isEditing ? "Done Editing" : "Edit Layout"}
          </Button>
        </div>
      </div>

      {/* Drag & Drop Grid */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={widgetOrder} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 lg:grid-cols-12 auto-rows-min gap-4 pb-12 items-start">
            {widgetOrder.map((id) => {
              // Custom span sizes for each widget type
              const colSpan = id === "metrics" ? "lg:col-span-12" 
                          : id === "agents" ? "lg:col-span-8"
                          : id === "overview" ? "lg:col-span-4"
                          : id === "activity" ? "lg:col-span-12"
                          : "lg:col-span-12";
                          
              return (
                <SortableWidget key={id} id={id} isEditing={isEditing} className={colSpan}>
                  {RENDERERS[id] ? RENDERERS[id]() : <div>Unknown Widget: {id}</div>}
                </SortableWidget>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
