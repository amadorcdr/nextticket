import type { ColumnDef } from '../OrganizerTable';
import { ActionBtn } from '../ActionBtn';
import { IcoEdit, IcoTrash } from '../icons';
import { colors } from '../theme';
import { STATUS_STYLES, type EventRow } from './data';

export const COLUMNS: ColumnDef<EventRow>[] = [
  {
    header: 'Evento',
    accessor: (ev) => (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
          <img src={ev.img} alt={ev.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.white }}>
            {ev.icon}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: colors.white, fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{ev.name}</p>
          <p style={{ color: colors.onSurfaceVariant, fontSize: 11, marginTop: 2 }}>ID: {ev.id}</p>
        </div>
      </div>
    ),
  },
  {
    header: 'Fecha y Hora',
    accessor: (ev) => (
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: colors.white, fontSize: 13, fontWeight: 600 }}>{ev.date}</p>
        <p style={{ color: colors.onSurfaceVariant, fontSize: 11, marginTop: 2 }}>{ev.time}</p>
      </div>
    ),
  },
  {
    header: 'Recinto',
    accessor: 'venue',
  },
  {
    header: 'Estado',
    accessor: (ev) => {
      const s = STATUS_STYLES[ev.status];
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '3px 10px', borderRadius: 9999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: s.bg, color: s.color }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
          {ev.status}
        </span>
      );
    },
  },
  {
    header: 'Boletos Vendidos',
    accessor: (ev) => {
      const pct = ev.total > 0 ? Math.round((ev.sold / ev.total) * 100) : 0;
      return (
        <div style={{ width: 170, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ color: colors.white, fontSize: 11, fontFamily: 'monospace' }}>
              {ev.sold.toLocaleString()} / {ev.total.toLocaleString()}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: pct === 100 ? colors.error : ev.active ? colors.success : colors.onSurfaceVariant }}>
              {pct}%
            </span>
          </div>
          <div style={{ height: 4, borderRadius: 9999, background: colors.surfaceVariant, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 9999, width: `${pct}%`, background: pct === 100 ? colors.error : ev.active ? colors.success : colors.onSurfaceDim }} />
          </div>
        </div>
      );
    },
  },
  {
    header: 'Acciones',
    align: 'right',
    accessor: () => (
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
        <ActionBtn icon={<IcoEdit />} tip="Editar" />
        <ActionBtn icon={<IcoTrash />} tip="Eliminar" danger />
      </div>
    ),
  },
];
