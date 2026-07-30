"use client";

import { Description, Label, Radio, RadioGroup, Skeleton, useTheme } from '@heroui/react';
import { Moon, Settings, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

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
      title: 'Por defecto',
      description: 'Usa el tema predeterminado del sistema operativo',
      value: 'system',
      icon: <Settings />,
    },
    {
      title: 'Oscuro',
      description:
        'Tema oscuro que reduce la fatiga visual y optimiza el consumo de batería en condiciones de poca luz.',
      value: 'dark',
      icon: <Moon />,
    },
  ];

  return (
    <RadioGroup name="theme" variant="secondary" value={theme} onChange={setTheme}>
      <Label>Tema</Label>
      <div className="grid gap-x-6">
        {themeOptions.map(option => (
          <Radio key={option.value} value={option.value} className="flex flex-col">
            {option.value === 'system' ? (
              <div className="flex w-full rounded-3xl overflow-hidden">
                <div className="w-1/2 bg-surface p-6 space-y-6 light">
                  <Skeleton className="h-20 rounded-lg" />
                  <div className="w-full space-y-3">
                    <Skeleton className="h-3 w-3/5 rounded-lg" />
                    <Skeleton className="h-3 w-4/5 rounded-lg" />
                    <Skeleton className="h-3 w-2/5 rounded-lg" />
                  </div>
                </div>
                <div className="w-1/2 bg-surface p-6 space-y-6 dark">
                  <Skeleton className="h-20 rounded-lg" />
                  <div className="w-full space-y-3">
                    <Skeleton className="h-3 w-3/5 rounded-lg" />
                    <Skeleton className="h-3 w-4/5 rounded-lg" />
                    <Skeleton className="h-3 w-2/5 rounded-lg" />
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={
                  'bg-surface w-full rounded-3xl p-6 space-y-6 ' +
                  (option.value === 'light' ? 'light' : 'dark')
                }
              >
                <Skeleton className="h-20 rounded-lg" />
                <div className="w-full space-y-3">
                  <Skeleton className="h-3 w-3/5 rounded-lg" />
                  <Skeleton className="h-3 w-4/5 rounded-lg" />
                  <Skeleton className="h-3 w-2/5 rounded-lg" />
                </div>
              </div>
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
