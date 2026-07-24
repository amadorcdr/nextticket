import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IcoCalendar, IcoScanner, IcoPerson, IcoLogout } from './icons';
import { colors } from './theme';

// ─── Nav config ───────────────────────────────────────────────────────────────

export type ValidatorRoute = '/validator/events' | '/validator';

const NAV_MAIN: { label: string; icon: React.ReactNode; href: ValidatorRoute }[] = [
  { label: 'Mis Eventos', icon: <IcoCalendar />, href: '/validator/events' },
  { label: 'Validación de boletos', icon: <IcoScanner />, href: '/validator' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface ValidatorSidebarProps {
  /** Current active route — highlights the matching nav item */
  activeRoute: ValidatorRoute;
  /** Controlled open state */
  open: boolean;
  /** Called when the user requests to close the sidebar */
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ValidatorSidebar({ activeRoute, open, onClose }: ValidatorSidebarProps) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={onClose}
          aria-label="Cerrar menú del validador"
        />
      )}

      <aside
        className="fixed left-0 top-0 z-50 h-full"
        style={{
          width: open ? 240 : 0,
          overflow: 'hidden',
          transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1)',
          background: colors.surfaceContainerLowest,
          borderRight: open ? `1px solid ${colors.outlineVariant}` : 'none',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ width: 240, minWidth: 240, display: 'flex', flexDirection: 'column', height: '100%', padding: '20px 0' }}>
          {/* Brand */}
          <div style={{ padding: '0 20px 24px', borderBottom: `1px solid ${colors.outlineVariant}`, marginBottom: 12 }}>
            <p style={{ color: colors.primary, fontWeight: 900, fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Validador
            </p>
            <p style={{ color: colors.onSurfaceVariant, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', marginTop: 2 }}>
              Control de boletos
            </p>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: '0 12px', overflow: 'hidden' }}>
            {NAV_MAIN.map(({ label, icon, href }) => {
              const active = href === activeRoute;
              return (
                <Link
                  key={href}
                  to={href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    marginBottom: 2,
                    background: active ? 'rgba(124,58,237,0.35)' : 'transparent',
                    color: active ? colors.white : colors.onSurfaceVariant,
                    borderRight: `2px solid ${colors.primaryContainer}`,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = colors.surfaceContainerHigh;
                      e.currentTarget.style.color = colors.onSurfaceVariant;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = colors.onSurfaceVariant;
                    }
                  }}
                >
                  <span style={{ color: active ? colors.white : colors.onSurfaceVariant, flexShrink: 0 }}>{icon}</span>
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Perfil + Cerrar sesión + User */}
          <div style={{ padding: '12px 12px 0', borderTop: `1px solid ${colors.outlineVariant}` }}>
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10,
                fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', marginBottom: 2,
                color: colors.onSurfaceVariant, background: 'transparent', border: 'none', cursor: 'pointer',
                transition: 'all 0.15s', width: '100%',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = colors.surfaceContainerHigh; e.currentTarget.style.color = colors.onSurfaceVariant; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(204,195,216,0.6)'; }}
            >
              <span style={{ color: colors.onSurfaceVariant, flexShrink: 0 }}><IcoPerson /></span>
              <span>Perfil</span>
            </button>

            <Link
              to="/"
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10,
                fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', marginBottom: 2,
                color: colors.error, transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(147,0,10,0.12)'; e.currentTarget.style.color = colors.error; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,180,171,0.8)'; }}
            >
              <span style={{ color: colors.error, flexShrink: 0 }}><IcoLogout /></span>
              <span>Cerrar Sesión</span>
            </Link>

            {/* User info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px 4px' }}>
              <div
                style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: `linear-gradient(135deg,${colors.primaryContainer} 0%,${colors.primaryContainerDark} 100%)`,
                  outline: '2px solid rgba(124,58,237,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: colors.white, fontSize: 13, fontWeight: 800, letterSpacing: '-0.01em', userSelect: 'none',
                }}
              >
                V
              </div>
              <div>
                <p style={{ color: colors.onBackground, fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>Validator User</p>
                <p style={{ color: colors.onSurfaceVariant, fontSize: 10, lineHeight: 1.3 }}>Rol Validador</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Perfil — modal simple, sin necesidad de un componente aparte */}
      {profileOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
          <button
            type="button"
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.55)' }}
            onClick={() => setProfileOpen(false)}
            aria-label="Cerrar perfil"
          />
          <div
            style={{
              width: '100%', maxWidth: 420, borderRadius: 16,
              background: colors.surfaceContainer, border: `1px solid ${colors.outlineVariant}`,
              padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.35)', position: 'relative',
            }}
          >
            <p style={{ color: colors.primary, fontSize: 18, fontWeight: 900, marginBottom: 4 }}>
              Perfil del Validador
            </p>
            <p style={{ color: colors.onSurfaceVariant, fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
              Vista temporal del perfil para el rol encargado de validar boletos en eventos.
            </p>
            <button
              type="button"
              onClick={() => setProfileOpen(false)}
              style={{
                width: '100%', borderRadius: 10, background: colors.primaryContainer, color: colors.white,
                padding: '10px 12px', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Hook — sidebar open/close state ─────────────────────────────────────────

export function useSidebar(initialOpen = true) {
  const [open, setOpen] = useState(initialOpen);
  return {
    open,
    onClose: () => setOpen(false),
    onToggle: () => setOpen((v) => !v),
  };
}
