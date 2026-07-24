import type { ReactNode } from 'react';
import { OrganizerSidebar, useSidebar, type OrganizerRoute } from './OrganizerSidebar';
import { colors } from './theme';

interface OrganizerLayoutProps {
  /** Current active route — highlights the matching sidebar item */
  activeRoute: OrganizerRoute;
  /** Render prop so the page can configure its own OrganizerTopbar (search, centerSlot, etc.) with access to sidebar state */
  topbar: (sidebar: ReturnType<typeof useSidebar>) => ReactNode;
  children: ReactNode;
}

// Shell compartido por las 3 vistas del organizador: glow decorativo de
// fondo + sidebar + wrapper con el margin-left animado. Antes cada página
// repetía este mismo bloque.
export function OrganizerLayout({ activeRoute, topbar, children }: OrganizerLayoutProps) {
  const sidebar = useSidebar();

  return (
    <div style={{ minHeight: '100vh', background: colors.background, color: colors.onBackground, fontFamily: 'Inter, system-ui, sans-serif', display: 'flex' }}>

      {/* Glow */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: -1, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: 450, height: 450, borderRadius: '50%', background: 'rgba(210,187,255,0.04)', filter: 'blur(110px)' }} />
        <div style={{ position: 'absolute', bottom: '-10%', left: '10%', width: 350, height: 350, borderRadius: '50%', background: 'rgba(190,198,224,0.04)', filter: 'blur(90px)' }} />
      </div>

      <OrganizerSidebar activeRoute={activeRoute} open={sidebar.open} onClose={sidebar.onClose} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', marginLeft: sidebar.open ? 240 : 0, transition: 'margin-left 0.28s cubic-bezier(0.4,0,0.2,1)' }}>
        {topbar(sidebar)}

        <main style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
