import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Send, Bot, Terminal, Code2, Sparkles, Box, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";

const AGENT_TYPES = [
  { id: "openclaw", name: "OpenClaw", icon: Cpu, color: "#8b5cf6", desc: "Autonomous Fleet Orchestrator" },
  { id: "claude", name: "Claude Code", icon: Sparkles, color: "#f59e0b", desc: "Advanced reasoning & coding" },
  { id: "cursor", name: "Cursor", icon: Code2, color: "#3b82f6", desc: "Context-aware editor agent" },
  { id: "opencode", name: "OpenCode", icon: Box, color: "#10b981", desc: "Open source code assistant" },
  { id: "codex", name: "Codex", icon: Terminal, color: "#6366f1", desc: "Command line & scripts" },
  { id: "pi", name: "Pi", icon: Bot, color: "#ec4899", desc: "Personal assistant" },
];

export function Chat() {
  const { t } = useTranslation();
  const [selectedAgentId, setSelectedAgentId] = useState("openclaw");
  const [messages, setMessages] = useState<{role: 'user'|'agent', content: string}[]>([
    { role: 'agent', content: "Hello! I am connected to the telemetry loop. How can I assist with your autonomous fleet today?" }
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if(!input.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    const currentInput = input;
    setInput("");
    
    // Simulate agent response
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'agent', content: `Echo from ${AGENT_TYPES.find(a=>a.id===selectedAgentId)?.name}: I am processing your request regarding "${currentInput}".` }]);
    }, 1000);
  };

  const selectedAgent = AGENT_TYPES.find(a => a.id === selectedAgentId);
  const Icon = selectedAgent?.icon || Bot;

  return (
    <div className="flex h-full flex-col md:flex-row gap-4 p-2 md:p-4">
      
      {/* Sidebar de Agentes */}
      <div className="w-full md:w-64 bg-white/5 border border-white/10 rounded-xl flex flex-col shrink-0 overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest m-0">Multi-Agent Hub</h3>
          <p className="text-[10px] text-slate-500 mt-1">Select an active agent</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 scrollbar-auto-hide">
          {AGENT_TYPES.map(agent => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgentId(agent.id)}
              className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all ${selectedAgentId === agent.id ? 'bg-white/10 border-white/20' : 'hover:bg-white/5 border-transparent'} border`}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${agent.color}20`, color: agent.color }}>
                <agent.icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold text-slate-200 truncate">{agent.name}</div>
                <div className="text-[10px] text-slate-500 truncate">{agent.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 bg-white/5 border border-white/10 rounded-xl flex flex-col min-w-0">
        
        {/* Chat Header */}
        <div className="h-14 border-b border-white/10 flex items-center px-4 shrink-0 gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${selectedAgent?.color}20`, color: selectedAgent?.color }}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[13px] font-bold text-slate-100">{selectedAgent?.name}</div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse"></span>
              Online & Ready
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scrollbar-auto-hide">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                  : 'bg-white/10 text-slate-200 rounded-tl-sm border border-white/5'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-white/10 shrink-0">
          <div className="relative">
            <textarea 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={`Message ${selectedAgent?.name}...`}
              className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-[13px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-primary/50 resize-none h-[52px] scrollbar-auto-hide"
              rows={1}
            />
            <Button 
              size="icon-sm"
              className="absolute right-2 top-2 rounded-full w-9 h-9 bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleSend}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="text-[9px] text-slate-500 text-center mt-2">
            AI responses may be inaccurate. Multi-Agent routing powered by IApex Gateway.
          </div>
        </div>

      </div>

    </div>
  );
}
