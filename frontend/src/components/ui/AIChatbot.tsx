import React, { useState } from 'react';
import { MessageSquare, Bot, X, Send, Maximize2, Minimize2, Terminal, Shield } from 'lucide-react';
import { useScoutStore } from '../../lib/store';
import { askNova } from '../../lib/ai-service';
import ReactMarkdown from 'react-markdown';

export function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<{ role: 'ai' | 'user', content: string | React.ReactNode }[]>([
    { role: 'ai', content: 'NOVA Command Center online. Soroban link stable. I am scanning 100% of the registry. What scouting intel do you need?' }
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const { players } = useScoutStore();

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);

    setIsThinking(true);
    try {
      const response = await askNova(userMsg, players);
      setMessages(prev => [...prev, { role: 'ai', content: response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', content: "INTEL SEVERED. Grid interference detected in the 3.1-Flash layer." }]);
    } finally {
      setIsThinking(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-[#0a0f1b]/80 text-electric p-4 rounded-full border border-electric/40 hover:bg-electric hover:shadow-[0_0_20px_#00f3ff] hover:text-slate-900 transition-all z-50 group"
      >
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#39ff14] rounded-full border-2 border-slate-900 animate-pulse" />
        <MessageSquare size={24} className="group-hover:scale-110 transition-transform" />
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 ${isExpanded ? 'w-[500px] h-[600px]' : 'w-80 h-[450px]'} bg-[#0a0f1b]/95 backdrop-blur-xl border border-electric/30 shadow-[0_0_40px_rgba(0,243,255,0.1)] flex flex-col z-50 transition-all duration-300 overflow-hidden`}>

      {/* HUD Header */}
      <div className="bg-slate-950/80 border-b border-electric/20 p-4 flex justify-between items-center overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-electric/50 to-transparent" />

        <div className="flex items-center space-x-3">
          <div className="relative">
            <Bot size={20} className="text-electric animate-slow-pulse" />
            <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-[#39ff14] rounded-full border border-slate-900" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-[10px] tracking-[0.2em] uppercase text-white leading-none">NOVA COMMAND</span>
            <span className="text-[8px] text-[#39ff14] font-mono uppercase tracking-widest mt-1 opacity-80 flex items-center">
              <span className="w-1 h-1 bg-[#39ff14] rounded-full mr-1 animate-pulse" />
              LIVE LINK STABLE
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-500 hover:text-electric transition-colors"
            title={isExpanded ? "Restore" : "Maximize"}
          >
            {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Grid Scanline Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/grid-me.png')]" />

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs scrollbar-thin scrollbar-thumb-electric/20 scrollbar-track-transparent">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`relative max-w-[90%] p-3 ${msg.role === 'user'
                ? 'bg-electric/10 border-electric/20 text-electric rounded-tl-lg rounded-bl-lg rounded-tr-sm'
                : 'bg-slate-900/50 border-slate-800 text-slate-300 rounded-tr-lg rounded-br-lg rounded-tl-sm'
              } border shadow-[0_2px_10px_rgba(0,0,0,0.3)]`}>

              {msg.role === 'ai' && (
                <div className="absolute -top-2 -left-2 text-electric/40 bg-slate-950 p-0.5 border border-electric/20">
                  <Terminal size={10} />
                </div>
              )}

              <div className="prose prose-invert prose-xs max-w-none">
                {typeof msg.content === 'string' ? (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed font-mono">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                      li: ({ children }) => <li className="text-[10px]">{children}</li>,
                      h3: ({ children }) => <h3 className="text-electric font-black uppercase tracking-tighter text-sm mb-2 mt-4 first:mt-0">{children}</h3>,
                      strong: ({ children }) => <strong className="text-white font-bold">{children}</strong>
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start animate-pulse">
            <div className="bg-slate-900/50 border-electric/20 text-electric/80 border p-3 flex items-center space-x-3 rounded-tr-lg rounded-br-lg rounded-tl-sm shadow-[0_0_15px_rgba(0,243,255,0.05)]">
              <RefreshCw size={14} className="animate-spin" />
              <span className="tracking-widest uppercase text-[10px] font-bold">Scanning Grid...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Terminal */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-slate-950/80 flex flex-col">
        <div className="flex items-center space-x-2 bg-slate-900/50 border border-slate-800 px-3 py-2 group focus-within:border-electric/50 transition-all">
          <Shield size={14} className="text-slate-600 group-focus-within:text-electric transition-colors" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isThinking}
            placeholder={isThinking ? "SYSCAP: BUSY..." : "Input scouting query..."}
            className="flex-1 bg-transparent text-slate-200 text-xs font-mono outline-none placeholder:text-slate-700 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isThinking || !input.trim()}
            className="text-slate-600 hover:text-electric disabled:opacity-20 transition-all"
          >
            <Send size={18} />
          </button>
        </div>
        <div className="mt-2 flex justify-between items-center px-1">
          <div className="text-[7px] text-slate-600 uppercase font-mono tracking-tighter">Gemini 2.5 Flash v1.02</div>
          <div className="text-[7px] text-slate-600 uppercase font-mono tracking-tighter italic">Encrypted Connection</div>
        </div>
      </form>
    </div>
  );
}

function RefreshCw(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  )
}
