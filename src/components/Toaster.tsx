import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Icon } from './Icon';

type Tone = 'success' | 'info' | 'error';
interface ToastItem {
  id: string;
  message: string;
  tone: Tone;
}

let push: ((item: ToastItem) => void) | null = null;

/** Confirmation brève d'une action (règle « feedback » du skill). */
export function toast(message: string, tone: Tone = 'success') {
  push?.({ id: crypto.randomUUID(), message, tone });
}

export default function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const reduce = useReducedMotion();

  useEffect(() => {
    push = (item) => {
      setItems((current) => [...current.slice(-2), item]);
      window.setTimeout(() => {
        setItems((current) => current.filter((entry) => entry.id !== item.id));
      }, 3400);
    };
    return () => {
      push = null;
    };
  }, []);

  return (
    <div className="toaster" role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.div
            key={item.id}
            className={`toast toast--${item.tone}`}
            layout
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={reduce ? { duration: 0.15 } : { type: 'spring', bounce: 0, duration: 0.4 }}
          >
            <span className="toast__icon">
              <Icon name={item.tone === 'error' ? 'close' : 'check'} size={14} strokeWidth={2.4} />
            </span>
            <span>{item.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
