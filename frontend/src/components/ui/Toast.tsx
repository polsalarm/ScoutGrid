import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

// ─── Global toast controller ──────────────────────────────────────────────────
let toastListeners: Array<(toast: ToastData) => void> = [];

export function showToast(type: ToastType, title: string, message?: string, duration = 4000) {
  const toast: ToastData = { id: crypto.randomUUID(), type, title, message, duration };
  toastListeners.forEach(fn => fn(toast));
}

// ─── Single Toast Item ────────────────────────────────────────────────────────
function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onDismiss, 300);
    }, toast.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [toast.duration, onDismiss]);

  const icons = {
    success: <CheckCircle2 size={16} className="text-[#39ff14] flex-shrink-0" />,
    error: <XCircle size={16} className="text-pink-400 flex-shrink-0" />,
    info: <Info size={16} className="text-electric flex-shrink-0" />,
  };

  const borders = {
    success: 'border-[#39ff14]/40',
    error: 'border-pink-500/40',
    info: 'border-electric/40',
  };

  const glows = {
    success: '0 0 20px rgba(57,255,20,0.15)',
    error: '0 0 20px rgba(236,72,153,0.15)',
    info: '0 0 20px rgba(0,243,255,0.15)',
  };

  return (
    <div
      className={`flex items-start space-x-3 bg-[#0a0f1b]/95 backdrop-blur-xl border ${borders[toast.type]} px-4 py-3 min-w-[300px] max-w-[420px] transition-all duration-300 ${
        isVisible && !isExiting
          ? 'opacity-100 translate-x-0'
          : 'opacity-0 translate-x-[30px]'
      }`}
      style={{ boxShadow: glows[toast.type] }}
    >
      <div className="mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <div className="text-white font-bold text-xs uppercase tracking-widest">{toast.title}</div>
        {toast.message && (
          <div className="text-slate-400 font-mono text-[10px] mt-1 leading-relaxed break-all">
            {toast.message}
          </div>
        )}
      </div>
      <button onClick={() => { setIsExiting(true); setTimeout(onDismiss, 300); }} className="text-slate-600 hover:text-slate-300 transition-colors flex-shrink-0">
        <X size={12} />
      </button>
    </div>
  );
}

// ─── Toast Container (mount once in App) ──────────────────────────────────────
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    const handler = (toast: ToastData) => {
      setToasts(prev => [...prev, toast]);
    };
    toastListeners.push(handler);
    return () => {
      toastListeners = toastListeners.filter(fn => fn !== handler);
    };
  }, []);

  const dismiss = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return createPortal(
    <div className="fixed top-20 right-4 z-[99999] flex flex-col space-y-2">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
      ))}
    </div>,
    document.body
  );
}
