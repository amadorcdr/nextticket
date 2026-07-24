import { colors } from '../theme';

export const EVENTOS_SELECT = [
  'Neon Nights Festival 2024',
  'Clásicos de Otoño: Orquesta',
  'Rock Revolution Tour',
  'Electronic Beach Party',
];

export interface ZonaData { label: string; count: number; color: string; }

export const ZONAS: ZonaData[] = [
  { label: 'VIP Gold', count: 561, color: colors.primary },
  { label: 'General A', count: 312, color: colors.primaryContainer },
  { label: 'General B', count: 187, color: colors.secondaryContainer },
  { label: 'Palcos', count: 188, color: colors.secondary },
];

export const TOTAL_VENDIDOS = ZONAS.reduce((s, z) => s + z.count, 0);

export const ZONA_COLOR: Record<string, string> = {
  'VIP Gold': colors.primary,
  'General A': colors.primaryContainer,
  'General B': colors.secondaryContainer,
  'Palcos': colors.secondary,
};

export interface VentaRow {
  folio: string;
  zona: string;
  asiento: string;
  cliente: string;
  fecha: string;
  hora: string;
  monto: number;
}

export const VENTAS: VentaRow[] = [
  { folio: '#TK-9872', zona: 'VIP Gold', asiento: 'B-12', cliente: 'Juan Pérez', fecha: '26 Oct', hora: '14:20', monto: 2500 },
  { folio: '#TK-9871', zona: 'General A', asiento: 'C-08', cliente: 'María García', fecha: '26 Oct', hora: '13:45', monto: 800 },
  { folio: '#TK-9870', zona: 'VIP Gold', asiento: 'A-01', cliente: 'Carlos Slim', fecha: '26 Oct', hora: '12:30', monto: 2500 },
  { folio: '#TK-9869', zona: 'Palcos', asiento: 'P-04', cliente: 'Lucía Méndez', fecha: '26 Oct', hora: '11:15', monto: 3800 },
  { folio: '#TK-9868', zona: 'General B', asiento: 'F-22', cliente: 'Roberto Gómez', fecha: '26 Oct', hora: '10:50', monto: 600 },
  { folio: '#TK-9867', zona: 'General A', asiento: 'D-11', cliente: 'Elena Poniatowska', fecha: '26 Oct', hora: '09:12', monto: 800 },
  { folio: '#TK-9866', zona: 'VIP Gold', asiento: 'B-02', cliente: 'Diego Luna', fecha: '25 Oct', hora: '22:05', monto: 2500 },
];
