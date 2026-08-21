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
    <div className="flex items-center gap-1 p-1 bg-surface border border-border rounded-lg">
      {THEME_OPTIONS.map(({ title, value, icon: OptionIcon }) => {
        const isActive = theme === value;
        return (
          <button
            key={value}
            type="button"
            title={title}
            onClick={() => setTheme(value)}
            className={`flex items-center justify-center p-2 rounded-md transition-all duration-150 active:scale-95 ${
              isActive
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted hover:text-foreground hover:bg-surface-secondary"
            }`}
          >
            <OptionIcon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}
