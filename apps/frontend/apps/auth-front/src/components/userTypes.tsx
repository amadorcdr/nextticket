import type { ReactNode } from 'react';
import { IconUser, IconAdmin, IconQr } from './icons';

export type UserType = 'organizador' | 'admin' | 'validador';

export const USER_TYPES: { key: UserType; label: string; icon: ReactNode }[] = [
  { key: 'organizador', label: 'Organizador', icon: <IconUser /> },
  { key: 'admin', label: 'Admin', icon: <IconAdmin /> },
  { key: 'validador', label: 'Validador', icon: <IconQr /> },
];
