import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { AnimatePresence, animate, motion, useReducedMotion } from 'motion/react';
import { Icon, type IconName } from './Icon';
import { initials } from '../lib/format';

/* ------------------------------------------------------------------ */
/* Mouvement — valeurs de référence du skill Apple Design              */
/* ------------------------------------------------------------------ */

/** Ressort critique par défaut : aucun rebond, arrivée rapide (0.4 s). */
export const spring = { type: 'spring' as const, bounce: 0, duration: 0.4 };
/** Ressort légèrement sous-amorti, réservé aux gestes porteurs d'élan. */
export const springMomentum = { type: 'spring' as const, bounce: 0.18, duration: 0.42 };

/* ------------------------------------------------------------------ */
/* Boutons                                                             */
/* ------------------------------------------------------------------ */

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  size?: 'md' | 'sm';
  icon?: IconName;
  trailingIcon?: IconName;
  children?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  trailingIcon,
  children,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn--${variant} btn--${size} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} />}
      {children && <span>{children}</span>}
      {trailingIcon && <Icon name={trailingIcon} size={size === 'sm' ? 15 : 17} />}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: IconName;
  size?: number;
}

export function IconButton({ label, icon, size = 18, className = '', ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-btn ${className}`}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Badges & pastilles                                                  */
/* ------------------------------------------------------------------ */

export function Badge({
  tone = 'slate',
  children,
  dot = false,
}: {
  tone?: string;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span className={`badge badge--${tone}`}>
      {dot && <span className="badge__dot" />}
      {children}
    </span>
  );
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`avatar avatar--${size}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Contrôle segmenté (pilule animée partagée)                          */
/* ------------------------------------------------------------------ */

interface SegmentedProps<T extends string> {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  layoutId: string;
  label: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  layoutId,
  label,
}: SegmentedProps<T>) {
  const reduce = useReducedMotion();
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`segmented__item${active ? ' is-active' : ''}`}
            onClick={() => onChange(option.value)}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="segmented__pill"
                transition={reduce ? { duration: 0 } : spring}
              />
            )}
            <span className="segmented__label">{option.label}</span>
            {typeof option.count === 'number' && (
              <span className="segmented__count">{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Champs de formulaire                                                */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label className="field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      <AnimatePresence initial={false}>
        {(error || hint) && (
          <motion.p
            key={error ?? hint}
            className={`field__hint${error ? ' field__hint--error' : ''}`}
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {error ?? hint}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export function TextInput({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${className}`} {...rest} />;
}

export function TextArea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`input input--area ${className}`} {...rest} />;
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="select">
      <select className={`input input--select ${className}`} {...rest}>
        {children}
      </select>
      <Icon name="chevronDown" size={16} className="select__chevron" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fenêtres et panneaux                                                */
/* ------------------------------------------------------------------ */

function useDialogBehaviour(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 560,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useDialogBehaviour(open, onClose);
  const reduce = useReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <div className="overlay" role="presentation">
          <motion.div
            className="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.12 : 0.24 }}
            onClick={onClose}
          />
          <motion.div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            style={{ maxWidth: width }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
            transition={reduce ? { duration: 0.16 } : spring}
          >
            <header className="modal__head">
              <div>
                <h2 className="modal__title">{title}</h2>
                {description && <p className="modal__desc">{description}</p>}
              </div>
              <IconButton label="Fermer" icon="close" size={18} onClick={onClose} />
            </header>
            <div className="modal__body">{children}</div>
            {footer && <footer className="modal__foot">{footer}</footer>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/**
 * Panneau latéral : glisse depuis le bord, suit le doigt et se referme
 * sur un geste (avec report de la vitesse, cf. handoff du skill).
 */
export function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  side = 'right',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  side?: 'left' | 'right';
}) {
  useDialogBehaviour(open, onClose);
  const reduce = useReducedMotion();
  const direction = side === 'right' ? 1 : -1;
  const panelRef = useRef<HTMLDivElement>(null);

  return (
    <AnimatePresence>
      {open && (
        <div className="overlay" role="presentation">
          <motion.div
            className="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          <motion.aside
            ref={panelRef}
            className={`drawer drawer--${side}`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            drag={reduce ? false : 'x'}
            dragDirectionLock
            dragElastic={0.16}
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(_, info) => {
              const travelled = info.offset.x * direction;
              const flicked = info.velocity.x * direction;
              if (travelled > 96 || flicked > 520) onClose();
            }}
            initial={reduce ? { opacity: 0 } : { x: 48 * direction, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { x: 56 * direction, opacity: 0 }}
            transition={reduce ? { duration: 0.16 } : springMomentum}
          >
            <header className="drawer__head">
              <div className="drawer__heading">
                {eyebrow && <p className="eyebrow">{eyebrow}</p>}
                <h2 className="drawer__title">{title}</h2>
              </div>
              <IconButton label="Fermer le panneau" icon="close" onClick={onClose} />
            </header>
            <div className="drawer__body">{children}</div>
            {footer && <footer className="drawer__foot">{footer}</footer>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* Données animées                                                     */
/* ------------------------------------------------------------------ */

export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toString(),
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(value);
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce) {
      node.textContent = format(value);
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration: 0.85,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        node.textContent = format(latest);
      },
    });
    from.current = value;
    return () => controls.stop();
  }, [value, format, reduce]);

  return <span ref={ref}>{format(value)}</span>;
}

export function Sparkline({ data, tone = 'accent' }: { data: number[]; tone?: string }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const points = data
    .map((value, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * 100;
      const y = 100 - ((value - min) / span) * 96 - 2;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg
      className={`spark spark--${tone}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty__mark">
        <Icon name="sparkle" size={22} />
      </span>
      <h3 className="empty__title">{title}</h3>
      <p className="empty__text">{message}</p>
      {action}
    </div>
  );
}

export function Progress({ value, tone = 'accent' }: { value: number; tone?: string }) {
  const reduce = useReducedMotion();
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.span
        className={`progress__fill progress__fill--${tone}`}
        initial={false}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={reduce ? { duration: 0 } : spring}
      />
    </div>
  );
}
