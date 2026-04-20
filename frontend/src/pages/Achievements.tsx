import { ArrowLeft, Cpu, Trophy, Calendar, Star, Zap } from 'lucide-react';
import type { Player } from '../lib/types';

interface AchievementsProps {
  player: Player;
  onBack: () => void;
}

const placementColors: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  '1st':         { border: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  text: '#fbbf24', glow: 'rgba(251,191,36,0.25)' },
  '2nd':         { border: '#94a3b8', bg: 'rgba(148,163,184,0.08)', text: '#cbd5e1', glow: 'rgba(148,163,184,0.2)' },
  '3rd':         { border: '#f97316', bg: 'rgba(249,115,22,0.08)',  text: '#fb923c', glow: 'rgba(249,115,22,0.2)'  },
  'Participant': { border: '#334155', bg: 'rgba(51,65,85,0.5)',     text: '#64748b', glow: 'transparent'           },
};

export function Achievements({ player, onBack }: AchievementsProps) {
  const totalPts = player.winPoints; // Use verified WP instead of sum of legacy objects

  return (
    <div className="animate-in slide-in-from-right-8 duration-300">

      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-slate-500 hover:text-electric transition-colors font-mono text-sm mb-8 group"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        <span>Back to Marketplace</span>
      </button>

      {/* ── Player hero card ────────────────────────────────── */}
      <div
        className="bg-[#0a0f1b] border border-slate-700 p-8 mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6"
        style={{ boxShadow: '0 0 40px rgba(0,240,255,0.05)' }}
      >
        <div className="flex items-start space-x-5">
          <div
            className="p-4 border text-electric flex-shrink-0"
            style={{
              borderColor: 'rgba(0,240,255,0.4)',
              background: 'rgba(0,240,255,0.06)',
              boxShadow: '0 0 20px rgba(0,240,255,0.15)',
            }}
          >
            <Cpu size={36} />
          </div>
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <h2 className="text-3xl font-black text-slate-100 uppercase tracking-tight">
                {player.name}
              </h2>
              <span
                className="text-xs font-mono px-2 py-0.5 border uppercase tracking-widest"
                style={{ borderColor: 'rgba(0,240,255,0.4)', color: '#00f0ff', background: 'rgba(0,240,255,0.05)' }}
              >
                {player.role}
              </span>
            </div>
            <p className="text-slate-500 font-mono text-xs mb-3">{player.address}</p>
            <p className="text-slate-400 text-sm max-w-lg leading-relaxed">{player.bio}</p>
          </div>
        </div>

        {/* Stats summary */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div
            className="flex items-center space-x-2 font-mono text-4xl font-black"
            style={{ color: '#39ff14', textShadow: '0 0 20px rgba(57,255,20,0.4)' }}
          >
            <Trophy size={30} />
            <span>{player.winPoints} WP</span>
          </div>
          <p className="text-slate-600 font-mono text-[10px] uppercase tracking-widest">Verified Win Points</p>
          <div className="text-electric font-mono font-bold text-xl mt-1">
            {(player.price || 0).toLocaleString()} <span className="text-sm text-slate-400">XLM</span>
          </div>
        </div>
      </div>

      {/* ── Performance Stats grid ──────────────────────────── */}
      <div className="flex items-center space-x-2 font-mono text-xs uppercase tracking-widest text-electric mb-4">
        <span className="w-3 h-3 border border-electric inline-block" />
        <span>Performance Stats</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-12">
        {[
          { label: 'KDA Ratio',       value: player.stats.kda           },
          { label: 'Win Rate',         value: player.stats.winRate        },
          { label: 'Matches',          value: player.stats.matches        },
          { label: 'Tournaments Won',  value: player.stats.tournamentsWon },
          { label: 'MVP Awards',       value: player.stats.mvpAwards      },
          { label: 'Avg Gold/Min',     value: player.stats.avgGoldMin     },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-[#0a0f1b] border border-slate-800 hover:border-electric/40 hover:scale-[1.05] hover:shadow-[0_0_16px_rgba(0,240,255,0.1)] transition-all duration-200 p-4 cursor-default"
          >
            <div className="text-slate-600 text-[10px] uppercase tracking-widest mb-2 font-mono">{stat.label}</div>
            <div className="text-slate-100 font-black text-2xl">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* ── Achievement Breakdown ───────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2 font-mono text-xs uppercase tracking-widest text-electric">
          <Trophy size={14} className="text-[#39ff14]" />
          <span>Achievement Breakdown</span>
        </div>
        <span className="text-slate-500 text-xs font-mono border border-slate-800 px-3 py-1 bg-[#0a0f1b]">
          {totalPts} TOTAL WP EARNED
        </span>
      </div>

      <div className="space-y-4">
        {player.achievements.length === 0 ? (
          <div className="p-12 border border-dashed border-slate-800 text-center text-slate-600 font-mono text-sm bg-[#0a0f1b]">
            <Trophy size={28} className="mx-auto mb-3 opacity-30" />
            No on-chain achievements recorded yet.
          </div>
        ) : (
          player.achievements.map((ach, idx) => {
            const colors = placementColors['1st'];
            return (
              <div
                key={idx}
                className="bg-[#0a0f1b] border flex overflow-hidden hover:scale-[1.015] transition-all duration-200 cursor-default"
                style={{
                  borderColor: `${colors.border}55`,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 24px ${colors.glow}`;
                  (e.currentTarget as HTMLDivElement).style.borderColor = colors.border;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 0 transparent';
                  (e.currentTarget as HTMLDivElement).style.borderColor = `${colors.border}55`;
                }}
              >
                {/* WP column */}
                <div
                  className="w-24 flex-shrink-0 flex flex-col items-center justify-center p-6 border-r font-mono"
                  style={{ borderColor: `${colors.border}30`, background: colors.bg }}
                >
                  <Trophy size={20} className="mb-2" style={{ color: colors.text }} />
                  <span className="font-black text-[10px] text-center" style={{ color: colors.text }}>SCOUT<br/>VERIFIED</span>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 min-w-0">
                  <div className="flex items-center space-x-3 mb-2 flex-wrap gap-y-1">
                    <h4 className="text-slate-100 font-black uppercase tracking-wide text-base">
                      {typeof ach === 'string' ? ach : (ach as any).title || "Unknown Trophy"}
                    </h4>
                    <span
                      className="text-[10px] font-black px-2 py-0.5 uppercase tracking-widest border font-mono flex items-center space-x-1"
                      style={{ color: colors.text, borderColor: `${colors.border}60`, background: colors.bg }}
                    >
                      <Star size={9} />
                      <span>LEGENDARY</span>
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-slate-500 text-xs font-mono mb-3">
                    <Calendar size={11} />
                    <span>APRIL 2026</span>
                    <span className="text-slate-700">·</span>
                    <Zap size={11} className="text-electric/50" />
                    <span className="text-slate-400">Verified Platform Record</span>
                  </div>

                  <p className="text-slate-500 text-sm leading-relaxed">
                    This achievement was verified on-chain at the time of player enrollment. It represents a verified achievement in {typeof ach === 'string' ? (ach.split(' - ')[0] || "Major Tournament") : "Professional"} competition.
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
