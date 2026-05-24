import { useEffect } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

export default function Toast({ toasts, onRemove }: ToastProps) {
  useEffect(() => {
    toasts.forEach((t) => {
      const timer = setTimeout(() => onRemove(t.id), 3000);
      return () => clearTimeout(timer);
    });
  }, [toasts, onRemove]);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all
            ${t.type === 'success' ? 'bg-green-600' : 'bg-red-500'}`}>
          {t.type === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
          <span>{t.message}</span>
          <button onClick={() => onRemove(t.id)} className="ml-1 opacity-75 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
