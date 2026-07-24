import type { ColumnDef } from '../OrganizerTable';
import { colors } from '../theme';
import { ZONA_COLOR, type VentaRow } from './data';

export const COLUMNS: ColumnDef<VentaRow>[] = [
  {
    header: 'Folio',
    accessor: (v) => (
      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: colors.primary }}>
        {v.folio}
      </span>
    ),
  },
  {
    header: 'Zona',
    accessor: (v) => (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 700,
        background: `${ZONA_COLOR[v.zona]}18`, color: ZONA_COLOR[v.zona],
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: ZONA_COLOR[v.zona] }} />
        {v.zona}
      </span>
    ),
  },
  {
    header: 'Asiento',
    accessor: (v) => (
      <span style={{ color: colors.onBackground, fontSize: 13, fontWeight: 600 }}>{v.asiento}</span>
    ),
  },
  {
    header: 'Cliente',
    accessor: 'cliente',
  },
  {
    header: 'Fecha',
    accessor: (v) => (
      <div>
        <p style={{ color: colors.onSurfaceVariant, fontSize: 12, margin: 0 }}>{v.fecha}</p>
        <p style={{ color: 'rgba(204,195,216,0.4)', fontSize: 10, margin: '2px 0 0' }}>{v.hora}</p>
      </div>
    ),
  },
  {
    header: 'Monto',
    align: 'right',
    accessor: (v) => (
      <span style={{ fontSize: 13, fontWeight: 700, color: colors.success }}>
        ${v.monto.toLocaleString()}
      </span>
    ),
  },
];
