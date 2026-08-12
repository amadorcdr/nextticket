"use client";

import { Moon, Sparkles, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAppTheme } from '../../providers/ThemeProvider';

const THEME_OPTIONS = [
  { title: 'Claro', value: 'light', icon: Sun },
  { title: 'Oscuro', value: 'dark', icon: Moon },
  { title: 'Nextticket', value: 'nextticket', icon: Sparkles },
];

export function ThemeSwitcher() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useAppTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {THEME_OPTIONS.map(({ title, value, icon: OptionIcon }) => {
        const isActive = theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-95 border ${
              isActive
                ? "border-transparent bg-accent text-accent-foreground"
                : "border-border bg-surface-secondary text-muted hover:text-foreground"
            }`}
          >
            <OptionIcon className="w-4 h-4" />
            <span>{title}</span>
          </button>
        );
      })}
    </div>
  );
}
