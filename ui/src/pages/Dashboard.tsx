import { useEffect, useState } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard";
import { activityApi } from "../api/activity";
import { agentsApi } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { useTranslation } from "react-i18next";
import {
  Bot, Sparkles, Terminal, Code2, Cpu, Box,
  Clock, Zap, CheckCircle2, AlertCircle, PauseCircle,
  ArrowRight, TrendingUp,
} from "lucide-react";

// ─── Status helpers ───────────────────────────────────────────────────────────
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

// ─── Agent display mapping ────────────────────────────────────────────────────
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

// ─── Sub-components ───────────────────────────────────────────────────────────
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white/5 border border-white/10 rounded-xl p-4 ${className}`}>{children}</div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3.5 mt-0">{children}</h3>
);

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
export function Dashboard() {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();
  const [time, setTime] = useState(new Date());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => { setTime(new Date()); setTick(c => c + 1); }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  if (!selectedCompanyId) return <div className="p-8 text-center text-slate-400">Select a company</div>;
  if (isDashboardLoading || isAgentsLoading || isActivityLoading) return <PageSkeleton variant="dashboard" />;

  // Build live-run lookup: agentId → run
  const liveRunByAgentId = new Map((liveRuns ?? []).map(r => [r.agentId, r]));
  const runningCount = liveRunByAgentId.size;
  const totalCostMonth = dashboard?.costs.monthSpendCents ? dashboard.costs.monthSpendCents / 100 : 0;
  const recentActivity = activity?.slice(0, 10) ?? [];

  return (
    <div className="flex flex-col gap-6 p-2">
      <style>{`
        @keyframes ping { 75%,100%{transform:scale(2);opacity:0} }
        @keyframes runPulse { 0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.35)} 50%{box-shadow:0 0 0 6px rgba(34,197,94,0)} }
      `}</style>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-[22px] font-bold text-slate-100 m-0">{t("dashboard")}</h2>
          <p className="text-[12px] text-slate-500 mt-1 font-mono">
            {time.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} · {time.toLocaleTimeString()}
          </p>
        </div>
        {/* Running indicator */}
        {runningCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-green-500/30 bg-green-500/10">
            <StatusDot status="running" pulse />
            <span className="text-[11px] font-semibold text-green-400">{runningCount} agent{runningCount > 1 ? "s" : ""} running</span>
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Agents Active",
            value: agents?.filter(a => (a as any).status !== "terminated").length ?? 0,
            sub: `${runningCount} running now`,
            accent: "#8b5cf6",
            icon: Zap,
          },
          {
            label: "Pending Approvals",
            value: dashboard?.pendingApprovals ?? 0,
            sub: "action required",
            accent: "#f59e0b",
            icon: AlertCircle,
          },
          {
            label: "Tasks In Progress",
            value: dashboard?.tasks.inProgress ?? 0,
            sub: `${dashboard?.tasks.open ?? 0} open`,
            accent: "#06b6d4",
            icon: TrendingUp,
          },
          {
            label: "Month Spend",
            value: `$${totalCostMonth.toFixed(2)}`,
            sub: "USD total",
            accent: "#22c55e",
            icon: CheckCircle2,
          },
        ].map(m => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-1" style={{ borderTop: `2px solid ${m.accent}` }}>
              <div className="flex items-center justify-between">
                <div className="text-[10px] text-slate-400 uppercase tracking-widest">{m.label}</div>
                <Icon className="w-3.5 h-3.5" style={{ color: m.accent, opacity: 0.6 }} />
              </div>
              <div className="text-[28px] font-bold font-mono" style={{ color: m.accent }}>{m.value}</div>
              <div className="text-[10px] text-slate-500">{m.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Agent Status Cards */}
      <Card>
        <SectionTitle>{t("agents")} Status</SectionTitle>
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
            // Force re-render on tick to update elapsed time
            void tick;

            return (
              <Link
                key={ag.id}
                to={`/agents/${ag.id}`}
                className="flex flex-col gap-2 bg-[#0a0f1a] rounded-xl py-3 px-4 border hover:border-white/20 transition-all min-w-[180px] max-w-[220px]"
                style={{
                  textDecoration: "none",
                  borderColor: isRunning ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.08)",
                  boxShadow: isRunning ? "0 0 0 0 rgba(34,197,94,0)" : undefined,
                  animation: isRunning ? "runPulse 2s infinite" : undefined,
                }}
              >
                {/* Agent icon + name */}
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${display.color}20`, color: display.color }}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold text-slate-200 truncate">{ag.name}</div>
                    <div className="text-[9px] text-slate-500 font-mono truncate">{display.label}</div>
                  </div>
                </div>

                {/* Status row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <StatusDot status={agStatus} pulse={isRunning} />
                    <StatusIcon className="w-3 h-3" style={{ color: statusInfo.color }} />
                    <span className="text-[10px] font-semibold" style={{ color: statusInfo.color }}>{statusInfo.label}</span>
                  </div>
                  {isRunning && elapsed && (
                    <span className="text-[9px] font-mono text-green-400/70 bg-green-500/10 px-1.5 py-0.5 rounded">{elapsed}</span>
                  )}
                </div>

                {/* Running task info */}
                {isRunning && liveRun.issueId && (
                  <div className="text-[9px] text-slate-500 truncate border-t border-white/5 pt-1.5 flex items-center gap-1">
                    <ArrowRight className="w-3 h-3 shrink-0 text-slate-600" />
                    Issue #{liveRun.issueId.slice(-6)}
                  </div>
                )}
              </Link>
            );
          })}
          {(!agents || agents.length === 0) && (
            <div className="text-[11px] text-slate-500 italic p-2">No agents found for this company.</div>
          )}
        </div>
      </Card>

      {/* Live Activity Feed */}
      <Card className="min-h-[200px]">
        <div className="flex justify-between items-center mb-3.5">
          <SectionTitle>{t("activity")} Feed</SectionTitle>
          <span className="text-[9px] text-green-400/60 font-mono tracking-wider flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {recentActivity.map((act, i) => (
            <div
              key={act.id}
              className="flex items-center gap-3 py-2.5 px-3 rounded-lg"
              style={{
                borderLeft: `2px solid ${i === 0 ? "#8b5cf6" : "transparent"}`,
                background: i === 0 ? "rgba(139,92,246,0.06)" : "transparent",
              }}
            >
              <StatusDot status="active" pulse={i === 0} />
              <span className="flex-1 text-[11px] text-slate-300 truncate">
                {(act as any).message || (act as any).description || "Activity"}
              </span>
              <span className="text-[9px] text-slate-500 whitespace-nowrap bg-white/5 px-2 py-0.5 rounded">
                {(act as any).topic || "general"}
              </span>
              <span className="text-[9px] text-slate-500 whitespace-nowrap w-16 text-right font-mono">
                {new Date(act.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
          {recentActivity.length === 0 && (
            <div className="text-[10px] text-slate-500 p-2 italic">No recent activity on this instance.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
