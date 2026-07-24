import { colors } from './theme';
import type { ValidatorEventFilter } from './data';

interface EventFiltersProps {
  activeFilter: ValidatorEventFilter;
  onFilterChange: (filter: ValidatorEventFilter) => void;
}

const FILTERS: { label: string; value: ValidatorEventFilter }[] = [
  { label: 'Hoy', value: 'today' },
  { label: 'Mañana', value: 'tomorrow' },
  { label: 'Todos los eventos', value: 'all' },
];

export function EventFilters({ activeFilter, onFilterChange }: EventFiltersProps) {
  return (
    <div style={{ borderRadius: 12, background: colors.surfaceContainer, padding: '14px 20px', marginTop: 18, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: colors.white, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Fecha
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {FILTERS.map((filter) => {
              const active = activeFilter === filter.value;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => onFilterChange(filter.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px 14px',
                    borderRadius: 8,
                    background: active ? `linear-gradient(135deg,${colors.primaryContainer} 0%,${colors.primaryContainerDark} 100%)` : 'none',
                    border: active ? 'none' : '1px solid rgba(74,68,85,0.5)',
                    color: active ? colors.white : 'rgba(204,195,216,0.6)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: active ? '0 4px 14px rgba(124,58,237,0.3)' : 'none',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (active) { e.currentTarget.style.filter = 'brightness(1.1)'; return; }
                    e.currentTarget.style.color = colors.onSurfaceVariant;
                    e.currentTarget.style.borderColor = 'rgba(74,68,85,0.9)';
                  }}
                  onMouseLeave={(e) => {
                    if (active) { e.currentTarget.style.filter = ''; return; }
                    e.currentTarget.style.color = 'rgba(204,195,216,0.6)';
                    e.currentTarget.style.borderColor = 'rgba(74,68,85,0.5)';
                  }}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
