import { useEffect, useState } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard";
import { activityApi } from "../api/activity";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { useTranslation } from "react-i18next";
import { Bot, Sparkles, Terminal, Code2, Cpu, Box } from "lucide-react";

// Componentes Premium extraidos de openclaw-dashboard-v2
const StatusDot = ({ status, pulse }: { status: string, pulse?: boolean }) => {
  const clr: Record<string, string> = { active:"#22c55e", pending:"#eab308", error:"#ef4444", idle:"#6b7280" };
  return (
    <span style={{ position:"relative", display:"inline-flex", alignItems:"center" }}>
      {pulse && status==="active" && <span style={{ position:"absolute", width:12, height:12, borderRadius:"50%", background:clr[status], opacity:0.4, animation:"ping 1.5s infinite" }}/>}
      <span style={{ width:8, height:8, borderRadius:"50%", background:clr[status]||clr.idle, display:"inline-block", position:"relative" }}/>
    </span>
  );
};

const Card = ({ children, className="" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-white/5 border border-white/10 rounded-xl p-4 ${className}`}>
    {children}
  </div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3.5 mt-0">{children}</h3>
);

const AGENT_ICONS: Record<string, { icon: any, color: string, label: string }> = {
  openclaw_gateway: { icon: Cpu, color: "#8b5cf6", label: "OpenClaw" },
  claude: { icon: Sparkles, color: "#f59e0b", label: "Claude Code" },
  cursor: { icon: Code2, color: "#3b82f6", label: "Cursor" },
  opencode: { icon: Box, color: "#10b981", label: "OpenCode" },
  codex: { icon: Terminal, color: "#6366f1", label: "Codex" },
  gemini: { icon: Sparkles, color: "#ec4899", label: "Gemini" }
};

const getAgentDisplay = (adapterType?: string) => {
  if (!adapterType) return { icon: Bot, color: "#94a3b8", label: "Agent" };
  const type = adapterType.toLowerCase();
  for (const key in AGENT_ICONS) {
    if (type.includes(key)) return AGENT_ICONS[key];
  }
  return { icon: Bot, color: "#94a3b8", label: "Agent" };
};

export function Dashboard() {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();
  const [time, setTime] = useState(new Date());
  
  useEffect(() => { 
    const timer = setInterval(()=>setTime(new Date()),1000); 
    return ()=>clearInterval(timer); 
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
  });

  const { data: activity, isLoading: isActivityLoading } = useQuery({
    queryKey: queryKeys.activity(selectedCompanyId!),
    queryFn: () => activityApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) return <div className="p-8 text-center text-slate-400">Select a company</div>;
  if (isDashboardLoading || isAgentsLoading || isActivityLoading) return <PageSkeleton variant="dashboard" />;

  const totalCostToday = dashboard?.costs.monthSpendCents ? dashboard.costs.monthSpendCents / 100 : 0;
  const recentActivity = activity?.slice(0, 10) || [];

  return (
    <div className="flex flex-col gap-6 p-2">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-[22px] font-bold text-slate-100 m-0">{t("dashboard")}</h2>
          <p className="text-[12px] text-slate-500 mt-1 font-mono">
            {time.toLocaleDateString(undefined, {weekday:"long",day:"numeric",month:"long"})} · {time.toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Metrics Premium */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Agents Active", value: dashboard?.agents.active || 0, sub: `${dashboard?.agents.running || 0} running`, accent: "#8b5cf6" },
          { label: "Pending Approvals", value: dashboard?.pendingApprovals || 0, sub: "action required", accent: "#f59e0b" },
          { label: "Tasks In Progress", value: dashboard?.tasks.inProgress || 0, sub: `${dashboard?.tasks.open || 0} open`, accent: "#06b6d4" },
          { label: "Month Spend", value: `$${totalCostToday.toFixed(2)}`, sub: "USD total", accent: "#22c55e" },
        ].map(m => (
          <div key={m.label} className="bg-white/5 border border-white/10 rounded-2xl p-4" style={{ borderTop: `2px solid ${m.accent}` }}>
            <div className="text-[10px] text-slate-400 uppercase tracking-widest">{m.label}</div>
            <div className="text-[28px] font-bold font-mono my-1.5" style={{ color: m.accent }}>{m.value}</div>
            <div className="text-[10px] text-slate-500">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* State of Agents */}
      <Card>
        <SectionTitle>{t("agents")} Status</SectionTitle>
        <div className="flex gap-3 flex-wrap">
          {agents?.map(ag => {
            const display = getAgentDisplay((ag as any).adapterType);
            const Icon = display.icon;
            return (
            <Link key={ag.id} to={`/agents/${ag.id}`} className="flex items-center gap-2.5 bg-[#0a0f1a] rounded-lg py-2 px-3 border border-white/10 hover:border-white/20 transition-colors" style={{ textDecoration: 'none' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${display.color}20`, color: display.color }}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 pr-2">
                <div className="text-[11px] font-semibold text-slate-200 truncate max-w-[120px]">{ag.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <StatusDot status="active" pulse={true}/>
                  <span className="text-[9px] text-slate-500">Running · {display.label}</span>
                </div>
              </div>
            </Link>
          )})}
          {(!agents || agents.length === 0) && (
             <div className="text-[11px] text-slate-500 italic p-2">No agents found for this company.</div>
          )}
        </div>
      </Card>

      {/* Live Activity Feed */}
      <Card className="min-h-[200px]">
        <div className="flex justify-between items-center mb-3.5">
          <SectionTitle>{t("activity")} Feed</SectionTitle>
          <span className="text-[9px] text-slate-500 font-mono tracking-wider">LIVE</span>
        </div>
        <div className="flex flex-col gap-1">
          {recentActivity.map((act, i) => (
            <div key={act.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg" style={{ borderLeft: `2px solid ${i===0?"#8b5cf6":"transparent"}`, background: i===0?"rgba(139,92,246,0.06)":"transparent" }}>
              <StatusDot status="active" pulse={i===0}/>
              <span className="flex-1 text-[11px] text-slate-300 truncate">{(act as any).message || (act as any).description || "Activity"}</span>
              <span className="text-[9px] text-slate-500 whitespace-nowrap bg-white/5 px-2 py-0.5 rounded">{(act as any).topic || "general"}</span>
              <span className="text-[9px] text-slate-500 whitespace-nowrap w-16 text-right">{new Date(act.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
          ))}
          {recentActivity.length === 0 && <div className="text-[10px] text-slate-500 p-2">No recent activity on this instance.</div>}
        </div>
      </Card>
    </div>
  );
}
