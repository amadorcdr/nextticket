import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ValidatorLayout } from './ValidatorLayout';
import { ValidatorTopbar } from './ValidatorTopbar';
import { EventCard } from './EventCard';
import { EventFilters } from './EventFilters';
import { colors } from './theme';
import { validatorEvents, type ValidatorEventFilter } from './data';

export function ValidatorEventsPage() {
  const [activeFilter, setActiveFilter] = useState<ValidatorEventFilter>('today');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEvents = useMemo(() => {
    return validatorEvents.filter((event) => {
      const matchesFilter = activeFilter === 'all' || event.filter === activeFilter;
      const normalizedSearch = searchTerm.trim().toLowerCase();
      const matchesSearch =
        normalizedSearch.length === 0 ||
        event.title.toLowerCase().includes(normalizedSearch) ||
        event.venue.toLowerCase().includes(normalizedSearch);
      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, searchTerm]);

  return (
    <ValidatorLayout
      activeRoute="/validator/events"
      topbar={(sidebar) => (
        <ValidatorTopbar
          onMenuToggle={sidebar.onToggle}
          showSearch
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar evento por nombre..."
        />
      )}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: 0, color: colors.onBackground, fontSize: '1.85rem', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Selección del evento
          </h1>
          <p style={{ marginTop: 8, color: 'rgba(204,195,216,0.55)', fontSize: 13, lineHeight: '22px' }}>
            Selecciona un evento para empezar a validar boletos
          </p>
        </div>
      </div>

      <EventFilters activeFilter={activeFilter} onFilterChange={setActiveFilter} />

      {/* Grid de eventos (o estado vacío) */}
      {filteredEvents.length === 0 ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container p-10 text-center">
          <h3 className="text-xl font-bold text-on-background">No se encontraron eventos</h3>
          <p className="mt-2 text-on-surface-variant">Intenta cambiar el filtro o buscar con otro nombre.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {/* Acceso rápido al escáner — solo en mobile */}
      <Link
        to="/validator"
        aria-label="Ir al escáner de boletos"
        className="fixed bottom-10 right-10 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-3xl text-on-primary shadow-lg transition-transform active:scale-90 md:hidden"
      >
        ⌗
      </Link>

      <style>{`
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: ${colors.surfaceContainerLow}; }
        ::-webkit-scrollbar-thumb { background: ${colors.surfaceVariant}; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: ${colors.outlineVariant}; }
      `}</style>
    </ValidatorLayout>
  );
}
