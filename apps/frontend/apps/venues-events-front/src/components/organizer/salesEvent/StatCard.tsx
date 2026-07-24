import type { ReactNode } from 'react';
import { IcoTrendUp } from '../icons';
import { colors } from '../theme';

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
  icon: ReactNode;
  highlight?: boolean;
}

export function StatCard({ label, value, sub, subColor, icon, highlight }: StatCardProps) {
  return (
    <div style={{
      borderRadius: 12, padding: '16px 18px', position: 'relative', overflow: 'hidden',
      background: highlight ? `linear-gradient(135deg,${colors.primaryContainer} 0%,${colors.accentSecondary} 100%)` : colors.surfaceContainer,
      border: highlight ? 'none' : '1px solid rgba(74,68,85,0.25)',
      borderLeft: highlight ? 'none' : `2px solid ${colors.primaryContainer}`,
      boxShadow: highlight ? '0 4px 20px rgba(124,58,237,0.28)' : 'none',
    }}>
      <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: highlight ? 'rgba(237,224,255,0.65)' : 'rgba(204,195,216,0.55)', marginBottom: 6 }}>
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <p style={{ fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em', color: highlight ? '#fff' : colors.onBackground, fontSize: '1.65rem', margin: 0 }}>
          {value}
        </p>
        {sub && (
          <span style={{ fontSize: 11, fontWeight: 700, color: subColor ?? colors.success, display: 'flex', alignItems: 'center', gap: 2 }}>
            <IcoTrendUp /> {sub}
          </span>
        )}
      </div>
      <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: highlight ? 'rgba(255,255,255,0.1)' : 'rgba(210,187,255,0.07)', fontSize: 40 }}>
        {icon}
      </div>
    </div>
  );
}
