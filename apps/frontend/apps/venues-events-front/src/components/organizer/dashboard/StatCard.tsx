import { colors } from '../theme';

interface StatCardProps {
  label: string;
  value: string;
  emoji: string;
  highlight?: boolean;
  sub?: string;
  valueColor?: string;
}

export function StatCard({ label, value, emoji, highlight, sub, valueColor }: StatCardProps) {
  return (
    <div
      className="relative overflow-hidden group"
      style={{
        borderRadius: 12, padding: '16px 18px',
        background: highlight ? `linear-gradient(135deg,${colors.primaryContainer} 0%,${colors.accentSecondary} 100%)` : colors.surfaceContainer,
        border: highlight ? 'none' : '1px solid rgba(74,68,85,0.25)',
        borderLeft: highlight ? 'none' : `2px solid ${colors.primaryContainer}`,
        boxShadow: highlight ? '0 4px 20px rgba(124,58,237,0.28)' : 'none',
      }}
    >
      <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: highlight ? 'rgba(237,224,255,0.65)' : colors.white, marginBottom: 6 }}>
        {label}
      </p>
      <p style={{ fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em', color: highlight ? '#fff' : (valueColor ?? colors.onBackground), fontSize: highlight ? '1.2rem' : '1.65rem' }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 11, marginTop: 4, color: highlight ? 'rgba(237,224,255,0.6)' : 'rgba(204,195,216,0.55)' }}>{sub}</p>}
      <span
        className="absolute select-none opacity-[0.06] group-hover:opacity-[0.12] transition-opacity"
        style={{ fontSize: 60, color: highlight ? '#fff' : colors.primary, right: -6, bottom: -6, pointerEvents: 'none' }}
      >
        {emoji}
      </span>
    </div>
  );
}
