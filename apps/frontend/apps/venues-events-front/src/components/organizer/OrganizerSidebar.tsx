import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IcoDash, IcoCalendar, IcoPayments, IcoPerson, IcoLogout } from './icons';
import { ModalProfile } from './ModalProfile';
import { colors } from './theme';

// ─── Nav config ───────────────────────────────────────────────────────────────

export type OrganizerRoute =
  | '/organizer/dashboard'
  | '/organizer/myEvents'
  | '/organizer/salesEvent';

const NAV_MAIN: { label: string; icon: React.ReactNode; href: OrganizerRoute }[] = [
  { label: 'Dashboard', icon: <IcoDash />, href: '/organizer/dashboard' },
  { label: 'Mis Eventos', icon: <IcoCalendar />, href: '/organizer/myEvents' },
  { label: 'Ventas', icon: <IcoPayments />, href: '/organizer/salesEvent' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface OrganizerSidebarProps {
  /** Current active route — highlights the matching nav item */
  activeRoute: OrganizerRoute;
  /** Controlled open state */
  open: boolean;
  /** Called when the user requests to close the sidebar */
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OrganizerSidebar({ activeRoute, open, onClose }: OrganizerSidebarProps) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={onClose}
        />
      )}

      <aside
        className="fixed left-0 top-0 h-full z-50"
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
        {/* Inner — always 240px wide so content doesn't squeeze during animation */}
        <div
          style={{
            width: 240,
            minWidth: 240,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            padding: '20px 0',
          }}
        >
          {/* ── Brand ── */}
          <div style={{ padding: '0 20px 24px', borderBottom: `1px solid ${colors.outlineVariant}`, marginBottom: 12 }}>
            <p style={{ color: colors.primary, fontWeight: 900, fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Organizador
            </p>
            <p style={{ color: colors.onSurfaceVariant, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', marginTop: 2 }}>
              Manager de eventos
            </p>
          </div>

          {/* ── Main nav ── */}
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
                      (e.currentTarget as HTMLElement).style.background = colors.surfaceContainerHigh;
                      (e.currentTarget as HTMLElement).style.color = colors.onSurfaceVariant;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = colors.onSurfaceVariant;
                    }
                  }}
                >
                  <span style={{ color: active ? colors.white : colors.onSurfaceVariant, flexShrink: 0 }}>
                    {icon}
                  </span>
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* ── Bottom: Perfil + Cerrar sesión + User ── */}
          <div
            style={{
              padding: '12px 12px 0',
              borderTop: `1px solid ${colors.outlineVariant}`,
            }}
          >
            {[
              { label: 'Perfil', icon: <IcoPerson />, danger: false, href: '#' },
              { label: 'Cerrar Sesión', icon: <IcoLogout />, danger: true, href: '/' },
            ].map(({ label, icon, danger, href }) => (
              <Link
                key={label}
                to={href}
                onClick={label === 'Perfil' ? (e) => { e.preventDefault(); setProfileOpen(true); } : undefined}
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
                  color: danger ? colors.error : colors.onSurfaceVariant,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = danger
                    ? 'rgba(147,0,10,0.12)'
                    : colors.surfaceContainerHigh;
                  (e.currentTarget as HTMLElement).style.color = danger ? colors.error : colors.onSurfaceVariant;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = danger
                    ? 'rgba(255,180,171,0.8)'
                    : 'rgba(204,195,216,0.6)';
                }}
              >
                <span style={{ color: danger ? colors.error : colors.onSurfaceVariant, flexShrink: 0 }}>
                  {icon}
                </span>
                {label}
              </Link>
            ))}

            {/* User info */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px 4px',
              }}
            >
              {/* Avatar — first letter of name */}
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  flexShrink: 0,
                  background: `linear-gradient(135deg,${colors.primaryContainer} 0%,${colors.primaryContainerDark} 100%)`,
                  outline: '2px solid rgba(124,58,237,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: colors.white,
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: '-0.01em',
                  userSelect: 'none',
                }}
              >
                A
              </div>
              <div>
                <p style={{ color: colors.onBackground, fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>
                  Alex Rivera
                </p>
                <p style={{ color: colors.onSurfaceVariant, fontSize: 10, lineHeight: 1.3 }}>
                  Admin Premium
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
      <ModalProfile open={profileOpen} onClose={() => setProfileOpen(false)} />
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
