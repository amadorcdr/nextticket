import type { ColumnDef } from '../OrganizerTable';
import { ActionBtn } from '../ActionBtn';
import { IcoEdit, IcoEye, IcoMusic, IcoTheater, IcoDraw } from '../icons';
import { colors } from '../theme';

export interface EventRow {
  name: string;
  venue: string;
  date: string;
  sold: number;
  total: number;
  pct: number;
  status: string;
  active: boolean;
  icon: React.ReactNode;
}

export const EVENTS: EventRow[] = [
  { name: 'Rock Revolution Tour', venue: 'Arena Stadium', date: 'Nov 15, 2024', sold: 1200, total: 1500, pct: 80, status: 'Activo', active: true, icon: <IcoMusic /> },
  { name: 'Standup Night Live', venue: 'Teatro Rex', date: 'Nov 22, 2024', sold: 450, total: 500, pct: 90, status: 'Activo', active: true, icon: <IcoTheater /> },
  { name: 'Electronic Beach Party', venue: 'Playa del Sol', date: 'Dec 05, 2024', sold: 0, total: 2000, pct: 0, status: 'Draft', active: false, icon: <IcoDraw /> },
];

export const EVENT_COLUMNS: ColumnDef<EventRow>[] = [
  {
    header: 'Evento',
    accessor: (ev) => (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: colors.surfaceVariant, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: colors.white }}>
          {ev.icon}
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: colors.white, fontSize: 13, fontWeight: 700 }}>{ev.name}</p>
          <p style={{ color: colors.onSurfaceVariant, fontSize: 11 }}>{ev.venue}</p>
        </div>
      </div>
    ),
  },
  {
    header: 'Fecha',
    accessor: 'date',
  },
  {
    header: 'Boletos Vendidos',
    accessor: (ev) => (
      <div style={{ width: 160, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ color: colors.white, fontSize: 11, fontFamily: 'monospace' }}>
            {ev.sold.toLocaleString()} / {ev.total.toLocaleString()}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: ev.active ? colors.success : colors.onSurfaceVariant }}>{ev.pct}%</span>
        </div>
        <div style={{ height: 4, borderRadius: 9999, background: colors.surfaceVariant, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 9999, width: `${ev.pct}%`, background: ev.active ? colors.success : colors.onSurfaceDim }} />
        </div>
      </div>
    ),
  },
  {
    header: 'Estado',
    accessor: (ev) => (
      <span style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 600,
        color: ev.status === 'Activo' ? colors.success : colors.onSurfaceVariant,
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: ev.status === 'Activo' ? colors.success : colors.onSurfaceVariant,
        }} />
        {ev.status}
      </span>
    ),
  },
  {
    header: 'Acciones',
    align: 'right',
    accessor: () => (
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
        <ActionBtn icon={<IcoEdit />} tip="Editar" />
        <ActionBtn icon={<IcoEye />} tip="Ver" />
      </div>
    ),
  },
];
