"use client";

import { Description, Label, Radio, RadioGroup, useTheme } from '@heroui/react';
import { Moon, Settings, Sparkles, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Mini mockup de una interfaz para previsualizar cómo luce cada tema
 * (fondo, superficie, texto y color de acento) antes de aplicarlo.
 */
function ThemeMock({ className = '' }: { className?: string }) {
  return (
    <div
      className={
        'h-24 w-full rounded-xl overflow-hidden flex flex-col border border-border bg-background ' +
        className
      }
    >
      <div className="flex items-center gap-1.5 px-3 py-2 bg-surface border-b border-border">
        <span className="size-2 rounded-full bg-danger" />
        <span className="size-2 rounded-full bg-warning" />
        <span className="size-2 rounded-full bg-success" />
      </div>
      <div className="flex flex-1 items-center gap-3 px-3">
        <div className="flex-1 space-y-1.5">
          <div className="h-2 w-3/5 rounded-full bg-foreground/70" />
          <div className="h-2 w-4/5 rounded-full bg-muted/50" />
          <div className="h-2 w-2/5 rounded-full bg-muted/30" />
        </div>
        <div className="h-6 w-12 shrink-0 rounded-full bg-accent flex items-center justify-center">
          <span className="h-1.5 w-6 rounded-full bg-accent-foreground/70" />
        </div>
      </div>
    </div>
  );
}

export function ThemeSwitcher() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  const themeOptions = [
    {
      title: 'Claro',
      description:
        'Tema claro que ofrece una interfaz brillante y fácil de leer, ideal para entornos luminosos.',
      value: 'light',
      icon: <Sun />,
    },
    {
      title: 'Oscuro',
      description:
        'Tema oscuro que reduce la fatiga visual y optimiza el consumo de batería en condiciones de poca luz.',
      value: 'dark',
      icon: <Moon />,
    },
    {
      title: 'Predeterminado',
      description: 'Usa el tema predeterminado del sistema operativo.',
      value: 'system',
      icon: <Settings />,
    },
    {
      title: 'Nextticket theme',
      description: 'La paleta de marca de Nextticket: fondo profundo con acentos violeta.',
      value: 'nextticket',
      icon: <Sparkles />,
    },
  ];

  return (
    <RadioGroup name="theme" variant="secondary" value={theme} onChange={setTheme}>
      <Label>Tema</Label>
      <div className="grid gap-y-4 gap-x-6">
        {themeOptions.map(option => (
          <Radio key={option.value} value={option.value} className="flex flex-col">
            {option.value === 'system' ? (
              <div className="flex w-full gap-2 rounded-xl overflow-hidden">
                <ThemeMock className="light w-1/2" />
                <ThemeMock className="dark w-1/2" />
              </div>
            ) : (
              <ThemeMock className={option.value} />
            )}
            <div className="flex gap-3 w-full">
              <Radio.Content className="flex-1 flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <div className="flex gap-2 items-center">
                    {option.icon}
                    <Label>{option.title}</Label>
                  </div>
                  <Description>{option.description}</Description>
                </div>
              </Radio.Content>
              <Radio.Control className="shrink-0">
                <Radio.Indicator />
              </Radio.Control>
            </div>
          </Radio>
        ))}
      </div>
    </RadioGroup>
  );
}
