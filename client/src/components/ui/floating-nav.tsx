import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';

export type FloatingNavItem = {
  id: string;
  icon: ReactNode;
  label: string;
  badge?: number;
};

type FloatingNavProps = {
  items: FloatingNavItem[];
  active: string;
  onSelect: (id: string) => void;
};

export default function FloatingNav({ items, active, onSelect }: FloatingNavProps) {
  const [indicator, setIndicator] = useState({ width: 0, x: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Keep the sliding indicator on the active button, including after a resize.
  useEffect(() => {
    const updateIndicator = () => {
      const button = buttonRefs.current[active];
      const container = containerRef.current;
      if (!button || !container) return;
      const buttonRect = button.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setIndicator({ width: buttonRect.width, x: buttonRect.left - containerRect.left });
    };

    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [active]);

  return (
    <nav className="floating-nav" aria-label="Main navigation">
      <div ref={containerRef} className="floating-nav-bar">
        <motion.div
          className="floating-nav-indicator"
          initial={false}
          animate={indicator}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
        {items.map((item) => (
          <button
            key={item.id}
            ref={(element) => { buttonRefs.current[item.id] = element; }}
            className={item.id === active ? 'floating-nav-button active' : 'floating-nav-button'}
            aria-label={item.badge ? `${item.label}, ${item.badge} in your order` : item.label}
            aria-current={item.id === active ? 'true' : undefined}
            onClick={() => onSelect(item.id)}
          >
            <span className="floating-nav-icon">
              {item.icon}
              {Boolean(item.badge) && <b>{item.badge}</b>}
            </span>
            {/* Labels are hidden on small screens, as in the original component. */}
            <span className="floating-nav-label">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
