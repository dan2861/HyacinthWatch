import { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, Info, AlertCircle } from 'lucide-react';

let toastIdCounter = 0;
const toastListeners = [];
let toasts = [];

function notify() {
  toastListeners.forEach((listener) => listener([...toasts]));
}

export function showToast(message, type = 'info', duration) {
  const id = String(++toastIdCounter);
  const toast = { id, message, type, duration };
  toasts = [...toasts, toast];
  notify();
}

export function dismissToast(id) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export function useToast() {
  const [toastList, setToastList] = useState([]);

  useEffect(() => {
    const listener = (newToasts) => {
      setToastList(newToasts);
    };
    toastListeners.push(listener);
    listener(toasts);

    return () => {
      const index = toastListeners.indexOf(listener);
      if (index > -1) {
        toastListeners.splice(index, 1);
      }
    };
  }, []);

  return { toasts: toastList, showToast, dismissToast };
}

export function ToastComponent({ toast, onDismiss }) {
  useEffect(() => {
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onDismiss]);

  const icons = {
    success: CheckCircle,
    error: XCircle,
    info: Info,
    warning: AlertCircle,
  };

  const colors = {
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200',
  };

  const Icon = icons[toast.type];

  return (
    <div
      className={`${colors[toast.type]} border rounded-lg shadow-lg p-4 flex items-start gap-3 min-w-[300px] max-w-md`}
      role="alert"
      aria-live="polite"
    >
      <Icon size={20} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 text-sm">{toast.message}</div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 text-current opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 flex flex-col items-end">
      {toasts.map((toast) => (
        <ToastComponent key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

