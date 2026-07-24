import type { ReactNode } from 'react';
import { ValidatorSidebar, useSidebar, type ValidatorRoute } from './ValidatorSidebar';
import { colors } from './theme';

interface ValidatorLayoutProps {
  /** Current active route — highlights the matching sidebar item */
  activeRoute: ValidatorRoute;
  /** Render prop para que la página configure su propio ValidatorTopbar con acceso al estado del sidebar */
  topbar: (sidebar: ReturnType<typeof useSidebar>) => ReactNode;
  children: ReactNode;
}

// Shell compartido por las 2 vistas del validador: sidebar + wrapper con el
// margin-left animado. Antes cada página repetía este mismo bloque.
export function ValidatorLayout({ activeRoute, topbar, children }: ValidatorLayoutProps) {
  const sidebar = useSidebar();

  return (
    <div style={{ minHeight: '100vh', background: colors.background, color: colors.onBackground, fontFamily: 'Inter, system-ui, sans-serif', display: 'flex' }}>
      <ValidatorSidebar activeRoute={activeRoute} open={sidebar.open} onClose={sidebar.onClose} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', marginLeft: sidebar.open ? 240 : 0, transition: 'margin-left 0.28s cubic-bezier(0.4,0,0.2,1)' }}>
        {topbar(sidebar)}

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: colors.background, overflow: 'hidden' }}>
          <section style={{ width: '100%', padding: '32px 28px 48px', flex: 1 }}>
            {children}
          </section>
        </main>
      </div>
    </div>
  );
}
