import type { ReactNode } from 'react';
import { IcoSearch, IcoMenu } from './icons';
import { colors } from './theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrganizerTopbarProps {
  /** Called when the hamburger button is pressed */
  onMenuToggle: () => void;
  /**
   * Show the search bar. Default: true.
   * Pass false in pages that don't need it (e.g. Dashboard).
   */
  showSearch?: boolean;
  /** Placeholder for the search input */
  searchPlaceholder?: string;
  /**
   * Extra content between the search bar and the bell icon.
   * Use for page-specific elements like an event selector dropdown.
   */
  centerSlot?: ReactNode;
  /**
   * Extra buttons rendered after the bell icon.
   * Use for page-specific actions like "Exportar Reporte".
   */
  actionSlot?: ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OrganizerTopbar({
  onMenuToggle,
  showSearch = true,
  searchPlaceholder = 'Buscar eventos, órdenes, reportes...',
  centerSlot,
  actionSlot,
}: OrganizerTopbarProps) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        gap: 12,
        background: colors.background,
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(74,68,85,0.2)',
      }}
    >
      {/* ── Left: hamburger + optional search + optional centerSlot ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>

        {/* Hamburger */}
        <button
          onClick={onMenuToggle}
          style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: colors.surfaceContainerHigh, border: 'none', cursor: 'pointer', color: colors.onSurfaceVariant, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = colors.surfaceVariant)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = colors.surfaceContainerHigh)}
        >
          <IcoMenu />
        </button>

        {/* Search — only when showSearch is true */}
        {showSearch && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: colors.surfaceContainerLow, border: `1px solid ${colors.outlineVariant}`, borderRadius: 10, padding: '0 12px', height: 34, maxWidth: 340, flex: 1 }}>
            <span style={{ color: colors.onSurfaceFaintAlt, flexShrink: 0, display: 'flex' }}><IcoSearch /></span>
            <input
              placeholder={searchPlaceholder}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: colors.onBackground, fontSize: 13 }}
            />
          </div>
        )}

        {/* Page-specific center content */}
        {centerSlot}
      </div>

      {/* ── Right: optional actionSlot ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {actionSlot}
      </div>
    </header>
  );
}
