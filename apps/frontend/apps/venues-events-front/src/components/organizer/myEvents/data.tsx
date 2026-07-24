import { IcoMusic, IcoMic, IcoDrum, IcoStar } from '../icons';
import { colors } from '../theme';

export type EventStatus = 'Activo' | 'Agotado' | 'Draft' | 'Cancelado';

export interface EventRow {
  id: string;
  name: string;
  venue: string;
  date: string;
  time: string;
  sold: number;
  total: number;
  status: EventStatus;
  active: boolean;
  icon: React.ReactNode;
  img: string;
}

export const STATUS_STYLES: Record<EventStatus, { bg: string; color: string }> = {
  Activo: { bg: 'rgba(74,222,128,0.1)', color: colors.success },
  Agotado: { bg: 'rgba(255,180,171,0.12)', color: colors.error },
  Draft: { bg: 'rgba(74,68,85,0.35)', color: colors.onSurfaceVariant },
  Cancelado: { bg: 'rgba(147,0,10,0.18)', color: colors.error },
};

export const ALL_STATUSES: EventStatus[] = ['Activo', 'Agotado', 'Draft', 'Cancelado'];
export const ALL_VENUES = ['Todos los recintos', 'Arena Movistar', 'Teatro Nacional', 'Estadio Olímpico', 'Playa del Sol'];

export const EVENTOS: EventRow[] = [
  { id: 'EV-8829', name: 'Neon Nights Festival 2024', venue: 'Arena Movistar', date: '15 Oct, 2024', time: '21:00 hrs', sold: 850, total: 1200, status: 'Activo', active: true, icon: <IcoMusic />, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCyHFOrttTGvwHhytSaUjcNHdOO0C7mZ3Wy6k6ICULeKZ98fUdQwDwdReb2xloneXrcLeJebc0WHqliA_Cj5OK0bfCSmVJNabfhAuy82Ux7v6QWU3ZkGkUZ99cBjQNvcNJSiEqVySiISfLbAAXkZCvdUHYu6fK3kVyYK_XbW8V5JCxYIENMA7IbHnVEnUwcixa9nNym89cffAUH3dGwbZ1bdU68VIoAdD5hsLLRoDDORdhrfbhv_NzK3PwBKHu4mONeadyiEPlqZP6f' },
  { id: 'EV-9012', name: 'Clásicos de Otoño: Orquesta', venue: 'Teatro Nacional', date: '22 Oct, 2024', time: '19:30 hrs', sold: 500, total: 500, status: 'Agotado', active: false, icon: <IcoMic />, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA-7Y6ZubgZKc2mkiBPvSBi01KZuTEQtOMec9QUcImhnLTcjNO_WzVwYEPk-Njci_96akaVmnRPQPI8Zk4IqHd9hK5NSeAJA2_Hh9jajbl4OwWwXG5i7dCHTWpagU7yTYBlRCqrC0ncRETvMX0lY9uKF09oxJ0lxoUCFM-AzV_DIOdTkqSE6DvMtBaF0Qd0pjdvSG2BM4Wr42bxgtbiSikdoPZVKSDu6aGVPzVcsXTE_50_SaQ3SMQnrJdst9H0rb0_UMIW2o0PX43' },
  { id: 'EV-9103', name: 'Rock Revolution Tour', venue: 'Estadio Olímpico', date: '05 Nov, 2024', time: '20:00 hrs', sold: 1200, total: 1500, status: 'Activo', active: true, icon: <IcoDrum />, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBnrcFFRGxvUgZq-VEl8NmcN5VQmiC1wBjLA40aax81S1hMM_yQNj27PsVcPgIKEhj2m4m9zSLvabomBg1-8zq37a4jWjJl21zQBo26Ae0p3-zXPKz7vHqdbLP9XBYd-M92-yYIIN7TH51xwec6MuIKBe794W5Ew99bHtmuT02mJLHRwSEmO7CrAUFNjUdBVCm9PHofJJlg2d-bpqaJPhabAvkrprkBnvHxmzwH2eiMrHpHktUnoIc9nWPhieJ3tlYJ3CTrB_kQRE0d' },
  { id: 'EV-9247', name: 'Electronic Beach Party', venue: 'Playa del Sol', date: '15 Nov, 2024', time: '18:00 hrs', sold: 0, total: 2000, status: 'Draft', active: false, icon: <IcoStar />, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD2cpWLCZoXLS705NWiWcYYnIR9ZXq5QeUmiy48SCpDfRXeHMJXzi0TRTzNXy3bGZTTkiHU665wRhJjJLjQwcYPdQIK1zXfYKKWEpZmrRttg9nKPHAJzPSEOYZqT9Rpk98CCY06mFUrIslh5U7buZnqUoU4-HlycDGMkczEF3on4vhDyitiraePJvt9pRwb83j54pXY9_f9uMDj64Dr0_Vkzsp9MtjaWX-KOPIjMQuHJ4_GRCsryVodIhA1Ah-3ve-cFkIk5w3-0t5v' },
];
