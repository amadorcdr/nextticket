import { useState } from 'react';
import type { ReactNode } from 'react';
import { colors } from './theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ColumnDef<T> {
  /** Column header label */
  header: string;
  /** Key of the row object, or a render function for custom cells */
  accessor: keyof T | ((row: T) => ReactNode);
  /** Optional fixed width */
  width?: number | string;
  /** Align cell content. Default: "center" */
  align?: 'left' | 'center' | 'right';
}

export interface OrganizerTableProps<T> {
  /** Column definitions */
  columns: ColumnDef<T>[];
  /** Row data */
  data: T[];
  /** Unique key per row */
  rowKey: keyof T | ((row: T) => string | number);
  /** Optional label shown in the left footer (e.g. "eventos", "ventas") */
  rowLabel?: string;
  /** Optional right-side footer content (e.g. a pagination row) */
  footerRight?: ReactNode;
  /** Empty state message */
  emptyMessage?: string;
  /** Optional max-height for the scroll container */
  maxHeight?: number | string;
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const S = {
  wrapper: {
    borderRadius: 12,
    background: colors.surfaceContainer,
    border: '1px solid rgba(74,68,85,0.28)',
    overflow: 'hidden',
  } as React.CSSProperties,

  scrollArea: {
    overflowX: 'auto' as const,
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },

  thead: {
    background: colors.surfaceContainerHigh,
    borderBottom: '1px solid rgba(74,68,85,0.3)',
  },

  th: (align: 'left' | 'center' | 'right'): React.CSSProperties => ({
    padding: '10px 20px',
    textAlign: align,
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: colors.onSurfaceVariant,
    opacity: 0.65,
    whiteSpace: 'nowrap',
  }),

  td: (align: 'left' | 'center' | 'right'): React.CSSProperties => ({
    padding: '12px 20px',
    textAlign: align,
    fontSize: 13,
    color: colors.onBackground,
    verticalAlign: 'middle',
  }),

  row: {
    borderBottom: '1px solid rgba(74,68,85,0.12)',
    transition: 'background 0.15s',
    cursor: 'default',
  } as React.CSSProperties,

  emptyCell: {
    padding: '40px 20px',
    textAlign: 'center' as const,
    color: 'rgba(204,195,216,0.4)',
    fontSize: 14,
  },

  footer: {
    padding: '10px 20px',
    borderTop: '1px solid rgba(74,68,85,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as React.CSSProperties,

  footerText: {
    color: 'rgba(204,195,216,0.45)',
    fontSize: 12,
  } as React.CSSProperties,
};

// ─── Default pagination (1 page, reusable footerRight) ────────────────────────

export function TablePagination({
  currentPage = 1,
  totalPages = 1,
  onChange,
}: {
  currentPage?: number;
  totalPages?: number;
  onChange?: (page: number) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          onClick={() => onChange?.(n)}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            background: n === currentPage
              ? 'rgba(124,58,237,0.2)'
              : 'transparent',
            border: n === currentPage
              ? '1px solid rgba(124,58,237,0.4)'
              : '1px solid rgba(74,68,85,0.3)',
            color: n === currentPage ? colors.primary : colors.onSurfaceFaint,
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OrganizerTable<T extends object>({
  columns,
  data,
  rowKey,
  rowLabel = 'filas',
  footerRight,
  emptyMessage = 'No se encontraron resultados.',
  maxHeight,
}: OrganizerTableProps<T>) {
  const getKey = (row: T): string | number =>
    typeof rowKey === 'function' ? rowKey(row) : (row[rowKey] as string | number);

  const getCellContent = (row: T, col: ColumnDef<T>): ReactNode =>
    typeof col.accessor === 'function'
      ? col.accessor(row)
      : (row[col.accessor] as ReactNode);

  return (
    <div style={S.wrapper}>
      <div style={{ ...S.scrollArea, maxHeight }}>
        <table style={S.table}>

          {/* ── Header ── */}
          <thead>
            <tr style={S.thead}>
              {columns.map((col, i) => (
                <th
                  key={i}
                  style={{
                    ...S.th(col.align ?? 'center'),
                    width: col.width,
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          {/* ── Body ── */}
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={S.emptyCell}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <HoverRow key={getKey(row)} columns={columns} row={row} getCellContent={getCellContent} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer ── */}
      <div style={S.footer}>
        <p style={S.footerText}>
          Mostrando{' '}
          <strong style={{ color: colors.onSurfaceVariant }}>{data.length}</strong>{' '}
          {rowLabel}
        </p>
        {footerRight ?? <TablePagination />}
      </div>
    </div>
  );
}

// ─── Row with hover (needs internal state so it's a sub-component) ────────────

function HoverRow<T extends object>({
  row,
  columns,
  getCellContent,
}: {
  row: T;
  columns: ColumnDef<T>[];
  getCellContent: (row: T, col: ColumnDef<T>) => ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <tr
      style={{
        ...S.row,
        background: hovered ? 'rgba(39,42,44,0.55)' : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {columns.map((col, i) => (
        <td
          key={i}
          style={{
            ...S.td(col.align ?? 'center'),
            width: col.width,
          }}
        >
          {getCellContent(row, col)}
        </td>
      ))}
    </tr>
  );
}
