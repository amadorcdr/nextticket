import { useState } from 'react';
import { OrganizerLayout } from '../OrganizerLayout';
import { OrganizerTopbar } from '../OrganizerTopbar';
import { OrganizerTable } from '../OrganizerTable';
import { IcoChevronDown, IcoSeat, IcoEye, IcoSearch, IcoFilter } from '../icons';
import { colors } from '../theme';
import { EVENTOS_SELECT, ZONAS, TOTAL_VENDIDOS, VENTAS } from './data';
import { COLUMNS } from './columns';
import { StatCard } from './StatCard';
import { DonutChart } from './DonutChart';

export function SalesEventView() {
  const [selectedEvent, setSelectedEvent] = useState(EVENTOS_SELECT[0]);
  const [search, setSearch] = useState('');

  const filteredVentas = VENTAS.filter((v) =>
    v.folio.toLowerCase().includes(search.toLowerCase()) ||
    v.cliente.toLowerCase().includes(search.toLowerCase()) ||
    v.zona.toLowerCase().includes(search.toLowerCase())
  );

  const centerSlot = (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <select
        value={selectedEvent}
        onChange={(e) => setSelectedEvent(e.target.value)}
        style={{ appearance: 'none', background: colors.surfaceContainerLow, border: '1px solid rgba(74,68,85,0.5)', borderRadius: 10, color: colors.onBackground, fontSize: 13, fontWeight: 600, padding: '6px 30px 6px 12px', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}
      >
        {EVENTOS_SELECT.map((e) => <option key={e} value={e} style={{ background: colors.surfaceContainerLow }}>{e}</option>)}
      </select>
      <span style={{ position: 'absolute', right: 8, pointerEvents: 'none', color: colors.onSurfaceFaint, display: 'flex' }}>
        <IcoChevronDown />
      </span>
    </div>
  );

  return (
    <OrganizerLayout
      activeRoute="/organizer/salesEvent"
      topbar={(sidebar) => (
        <OrganizerTopbar
          onMenuToggle={sidebar.onToggle}
          showSearch={false}
          centerSlot={centerSlot}
        />
      )}
    >
      {/* Título */}
      <div>
        <h2 style={{ fontWeight: 900, fontSize: '1.75rem', letterSpacing: '-0.02em', color: colors.onBackground, margin: 0 }}>
          Ventas por Evento
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(204,195,216,0.55)', marginTop: 4 }}>
          {selectedEvent} — resumen de boletos y transacciones
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard label="Boletos Vendidos" value="1.2k" sub="+12%" icon={<span>🎫</span>} />
        <StatCard label="Ventas Totales" value="$150k" sub="+8%" icon={<span>💳</span>} />
        <StatCard label="Zona Más Vendida" value="VIP Gold" sub="65% cap." subColor={colors.primary} icon={<IcoSeat />} />
        <StatCard label="Asientos Disponibles" value="450" sub="Low stock" subColor={colors.error} icon={<span>🪑</span>} highlight />
      </div>

      {/* Bento: donut + tabla */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 12 }}>

        {/* Donut */}
        <div style={{ borderRadius: 12, background: colors.surfaceContainer, border: '1px solid rgba(74,68,85,0.28)', padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <p style={{ color: colors.onBackground, fontWeight: 700, fontSize: 14, margin: 0 }}>Ventas por Zona</p>
            <button title="Ver detalle" style={{ width: 28, height: 28, borderRadius: 6, background: colors.surfaceContainerHigh, border: 'none', cursor: 'pointer', color: colors.onSurfaceFaint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = colors.surfaceVariant; (e.currentTarget as HTMLElement).style.color = colors.primary; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = colors.surfaceContainerHigh; (e.currentTarget as HTMLElement).style.color = colors.onSurfaceFaint; }}
            ><IcoEye /></button>
          </div>
          <DonutChart zonas={ZONAS} total={TOTAL_VENDIDOS} />
        </div>

        {/* Tabla de ventas recientes */}
        <div style={{ borderRadius: 12, background: colors.surfaceContainer, border: '1px solid rgba(74,68,85,0.28)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* Card header con buscador */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(74,68,85,0.2)', flexShrink: 0 }}>
            <p style={{ color: colors.onBackground, fontWeight: 700, fontSize: 14, margin: 0 }}>Ventas Recientes</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: colors.surfaceContainerHigh, border: '1px solid rgba(74,68,85,0.4)', borderRadius: 8, padding: '4px 10px', height: 30 }}>
                <span style={{ color: colors.onSurfaceFaintAlt, display: 'flex', flexShrink: 0 }}><IcoSearch /></span>
                <input
                  placeholder="Buscar folio, cliente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ background: 'none', border: 'none', outline: 'none', color: colors.onBackground, fontSize: 12, width: 140 }}
                />
              </div>
              <button title="Filtros" style={{ width: 30, height: 30, borderRadius: 8, background: colors.surfaceContainerHigh, border: '1px solid rgba(74,68,85,0.4)', cursor: 'pointer', color: colors.onSurfaceVariant, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = colors.surfaceVariant; (e.currentTarget as HTMLElement).style.color = colors.primary; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = colors.surfaceContainerHigh; (e.currentTarget as HTMLElement).style.color = colors.onSurfaceVariant; }}
              ><IcoFilter /></button>
            </div>
          </div>

          {/* Tabla reutilizable */}
          <OrganizerTable
            columns={COLUMNS}
            data={filteredVentas}
            rowKey="folio"
            rowLabel="ventas"
            emptyMessage="Sin resultados para esa búsqueda."
            footerRight={
              <button style={{ fontSize: 11, fontWeight: 600, color: colors.primary, background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
              >Ver todas las ventas →</button>
            }
          />
        </div>
      </div>
    </OrganizerLayout>
  );
}
