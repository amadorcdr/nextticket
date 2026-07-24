import { Link } from 'react-router-dom';
import { OrganizerLayout } from '../OrganizerLayout';
import { OrganizerTopbar } from '../OrganizerTopbar';
import { OrganizerTable, TablePagination } from '../OrganizerTable';
import { IcoPlus } from '../icons';
import { colors } from '../theme';
import { StatCard } from './StatCard';
import { ChartSection } from './ChartSection';
import { InsightSection } from './InsightSection';
import { EVENTS, EVENT_COLUMNS } from './columns';

export function DashboardView() {
  return (
    <OrganizerLayout
      activeRoute="/organizer/dashboard"
      topbar={(sidebar) => <OrganizerTopbar onMenuToggle={sidebar.onToggle} showSearch={false} />}
    >
      {/* Título + acciones */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontWeight: 900, fontSize: '1.75rem', letterSpacing: '-0.02em', color: colors.onBackground, margin: 0 }}>
            Resumen de Gestión
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(204,195,216,0.55)', marginTop: 4 }}>
            Monitorea el rendimiento de tus producciones en tiempo real.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, background: `linear-gradient(135deg,${colors.primaryContainer} 0%,${colors.primaryContainerDark} 100%)`, border: 'none', color: colors.onPrimaryContainer, fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.1)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ''; }}
          >
            <IcoPlus /> Nuevo Evento
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard label="Total Eventos" value="12" emoji="🗓" valueColor={colors.primary} />
        <StatCard label="Eventos Activos" value="8" emoji="⚡" valueColor={colors.success} />
        <StatCard label="Boletos Vendidos" value="2,450" emoji="🎫" valueColor={colors.secondary} />
        <StatCard label="Ventas Totales" value="$120,400" emoji="💳" valueColor={colors.primary} />
      </div>

      {/* Bento: chart + insight */}
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: 12, height: 320 }}>
        <ChartSection />
        <InsightSection topEvent={EVENTS[0]} />
      </div>

      {/* Tabla */}
      <div>
        {/* Card header manual (título + link "ver todos") */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0,
          borderRadius: '12px 12px 0 0', background: colors.surfaceContainer, border: '1px solid rgba(74,68,85,0.28)',
          borderBottom: 'none', padding: '14px 20px',
        }}>
          <p style={{ color: colors.onBackground, fontWeight: 700, fontSize: 14 }}>Próximos Eventos</p>
          <Link to="/organizer/myEvents"
            style={{ color: colors.primary, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
          >
            Ver todos los eventos
          </Link>
        </div>

        <OrganizerTable<typeof EVENTS[number]>
          columns={EVENT_COLUMNS}
          data={EVENTS}
          rowKey="name"
          rowLabel="eventos"
          footerRight={<TablePagination totalPages={1} />}
        />
      </div>
    </OrganizerLayout>
  );
}
