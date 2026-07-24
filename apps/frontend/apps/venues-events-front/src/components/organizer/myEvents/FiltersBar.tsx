import { IcoCalendar, IcoFilter } from '../icons';
import { colors } from '../theme';
import { Select } from './Select';
import { ALL_STATUSES, ALL_VENUES } from './data';

export interface Filters { status: string; venue: string; }

interface FiltersBarProps {
  filters: Filters;
  onChange: (f: Partial<Filters>) => void;
  onClear: () => void;
  onApply: () => void;
}

export function FiltersBar({ filters, onChange, onClear, onApply }: FiltersBarProps) {
  return (
    <div style={{ borderRadius: 12, background: colors.surfaceContainer, padding: '14px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: colors.white, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Estado</label>
          <Select value={filters.status} onChange={(v) => onChange({ status: v })} options={['Todos', ...ALL_STATUSES]} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: colors.white, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fecha</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: colors.surfaceContainer, border: '1px solid rgba(74,68,85,0.5)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
            <span style={{ color: colors.onSurfaceFaint, display: 'flex' }}><IcoCalendar /></span>
            <span style={{ color: colors.onSurfaceVariant, fontSize: 12, fontWeight: 600 }}>Seleccionar Rango</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: colors.white, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recinto</label>
          <Select value={filters.venue} onChange={(v) => onChange({ venue: v })} options={ALL_VENUES} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center' }}>
          <button
            onClick={onClear}
            style={{ display: 'flex', alignItems: 'center', padding: '6px 14px', borderRadius: 8, background: 'none', border: '1px solid rgba(74,68,85,0.5)', color: 'rgba(204,195,216,0.6)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = colors.onSurfaceVariant; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(74,68,85,0.9)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(204,195,216,0.6)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(74,68,85,0.5)'; }}
          >Limpiar</button>
          <button
            onClick={onApply}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, background: `linear-gradient(135deg,${colors.primaryContainer} 0%,${colors.primaryContainerDark} 100%)`, border: 'none', color: colors.white, fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.1)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ''; }}
          ><IcoFilter /> Aplicar Filtros</button>
        </div>
      </div>
    </div>
  );
}
