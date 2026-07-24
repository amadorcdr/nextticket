import { useState } from 'react';
import { OrganizerLayout } from '../OrganizerLayout';
import { OrganizerTopbar } from '../OrganizerTopbar';
import { OrganizerTable, TablePagination, type ColumnDef } from '../OrganizerTable';
import { ActionBtn } from '../ActionBtn';
import { ModalEvent } from '../ModalEvent';
import { ModalEditEvent, type EventData } from '../ModalEditEvent';
import { ModalDeleteEvent } from '../ModalDeleteEvent';
import { IcoPlus, IcoEdit, IcoTrash } from '../icons';
import { colors } from '../theme';
import { EVENTOS, type EventRow } from './data';
import { COLUMNS } from './columns';
import { FiltersBar, type Filters } from './FiltersBar';

const EMPTY: Filters = { status: 'Todos', venue: 'Todos los recintos' };

export function MyEventsView() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<EventData | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteName, setDeleteName] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);

  const openEdit = (ev: EventRow) => {
    setEditEvent({
      nombre: ev.name,
      fecha: ev.date,
      hora: ev.time,
      descripcion: '',
      recinto: ev.venue,
      zonas: [],
      img: ev.img,
    });
    setEditOpen(true);
  };

  const dynColumns: ColumnDef<EventRow>[] = [
    ...COLUMNS.slice(0, -1),
    {
      header: 'Acciones',
      align: 'right',
      accessor: (ev) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
          <ActionBtn icon={<IcoEdit />} tip="Editar" onClick={() => openEdit(ev)} />
          <ActionBtn icon={<IcoTrash />} tip="Eliminar" danger onClick={() => { setDeleteName(ev.name); setDeleteOpen(true); }} />
        </div>
      ),
    },
  ];

  const filtered = EVENTOS.filter((ev) => {
    const okStatus = applied.status === 'Todos' || ev.status === applied.status;
    const okVenue = applied.venue === 'Todos los recintos' || ev.venue === applied.venue;
    return okStatus && okVenue;
  });

  return (
    <OrganizerLayout
      activeRoute="/organizer/myEvents"
      topbar={(sidebar) => (
        <OrganizerTopbar
          onMenuToggle={sidebar.onToggle}
          searchPlaceholder="Buscar eventos por nombre..."
        />
      )}
    >
      {/* Título + botón */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontWeight: 900, fontSize: '1.75rem', letterSpacing: '-0.02em', color: colors.onBackground, margin: 0 }}>Mis Eventos</h2>
          <p style={{ fontSize: 13, color: 'rgba(204,195,216,0.55)', marginTop: 4 }}>
            Gestiona y monitorea el rendimiento de tus producciones activas.
          </p>
        </div>
        <button
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, background: `linear-gradient(135deg,${colors.primaryContainer} 0%,${colors.primaryContainerDark} 100%)`, border: 'none', color: colors.white, fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}
          onClick={() => setModalOpen(true)}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.1)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ''; }}
        >
          <IcoPlus /> Crear Evento
        </button>
      </div>

      {/* Filtros */}
      <FiltersBar
        filters={filters}
        onChange={(f) => setFilters((prev) => ({ ...prev, ...f }))}
        onClear={() => { setFilters(EMPTY); setApplied(EMPTY); }}
        onApply={() => setApplied(filters)}
      />

      {/* Tabla */}
      <OrganizerTable<EventRow>
        columns={dynColumns}
        data={filtered}
        rowKey="id"
        rowLabel="eventos"
        emptyMessage="No se encontraron eventos con los filtros aplicados."
        footerRight={<TablePagination totalPages={1} />}
      />

      <ModalEvent open={modalOpen} onClose={() => setModalOpen(false)} />
      <ModalEditEvent open={editOpen} onClose={() => setEditOpen(false)} event={editEvent} onSave={(data) => console.log('Guardado:', data)} />
      <ModalDeleteEvent open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={() => console.log('Eliminado:', deleteName)} eventName={deleteName} />
    </OrganizerLayout>
  );
}
