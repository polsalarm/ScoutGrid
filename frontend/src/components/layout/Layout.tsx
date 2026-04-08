import { useState } from 'react';
import { Navbar } from './Navbar';
import { AIChatbot } from '../ui/AIChatbot';

interface LayoutProps {
  children: (page: 'marketplace' | 'roster' | 'achievements', setPage: (p: 'marketplace' | 'roster' | 'achievements') => void) => React.ReactNode;
}

/**
 * Flat technical blueprint grid — matches the 2D graph-paper style.
 * Fills the entire background with faint, repeating squares.
 */
function FlatGridBackground() {
  // Size of each grid square in pixels
  const gridSize = 40;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden="true"
    >
      {/* A very faint radial glow to give the background some slight depth */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 30%, rgba(0, 240, 255, 0.04), transparent 60%)'
        }}
      />

      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="blueprint-grid"
            width={gridSize}
            height={gridSize}
            patternUnits="userSpaceOnUse"
          >
            {/* Draws the top and left line of the square. When repeated, it forms a perfect grid. */}
            <path
              d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
              fill="none"
              stroke="rgba(0, 240, 255, 0.08)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#blueprint-grid)" />
      </svg>
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  const [page, setPage] = useState<'marketplace' | 'roster' | 'achievements'>('marketplace');

  return (
    <div className="min-h-screen text-slate-300 font-sans relative" style={{ backgroundColor: '#050B14' }}>
      <FlatGridBackground />
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar page={page} onNavigate={setPage} />
        <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
          {children(page, setPage)}
        </main>
      </div>
      <div className="relative z-50">
        <AIChatbot />
      </div>
    </div>
  );
}