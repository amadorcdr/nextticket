import type { ReactNode } from 'react';
import { IcoSearch, IcoMenu } from './icons';
import { colors } from './theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ValidatorTopbarProps {
  /** Called when the hamburger button is pressed */
  onMenuToggle: () => void;
  /** Show the search bar. Default: true. */
  showSearch?: boolean;
  /** Placeholder for the search input */
  searchPlaceholder?: string;
  /** Current value for controlled search */
  searchValue?: string;
  /** Called when the search input changes */
  onSearchChange?: (value: string) => void;
  /** Extra content between the search bar and the right actions */
  centerSlot?: ReactNode;
  /** Extra buttons rendered on the right */
  actionSlot?: ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ValidatorTopbar({
  onMenuToggle,
  showSearch = true,
  searchPlaceholder = 'Buscar eventos, boletos, folios...',
  searchValue,
  onSearchChange,
  centerSlot,
  actionSlot,
}: ValidatorTopbarProps) {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
        {/* Hamburger */}
        <button
          type="button"
          onClick={onMenuToggle}
          style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: colors.surfaceContainerHigh, border: 'none', cursor: 'pointer', color: colors.onSurfaceVariant, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = colors.surfaceVariant; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = colors.surfaceContainerHigh; }}
          aria-label="Abrir menú del validador"
        >
          <IcoMenu />
        </button>

        {/* Search */}
        {showSearch && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: colors.surfaceContainerLow, border: `1px solid ${colors.outlineVariant}`, borderRadius: 10, padding: '0 12px', height: 34, maxWidth: 340, flex: 1 }}>
            <span style={{ color: colors.onSurfaceFaintAlt, flexShrink: 0, display: 'flex' }}>
              <IcoSearch />
            </span>
            <input
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={searchPlaceholder}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: colors.onBackground, fontSize: 13 }}
            />
          </div>
        )}

        {centerSlot}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {actionSlot}
      </div>
    </header>
  );
}
