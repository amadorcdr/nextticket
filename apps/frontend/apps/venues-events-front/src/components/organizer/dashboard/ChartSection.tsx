import { useState } from 'react';
import { colors } from '../theme';

const CHART = [
  { label: 'Rock Rev.', proj: 70, rev: 85 },
  { label: 'Jazz Night', proj: 90, rev: 60 },
  { label: 'Techno Fest', proj: 50, rev: 95 },
  { label: 'Art Expo', proj: 65, rev: 45 },
  { label: 'Gala Dinner', proj: 80, rev: 75 },
];

export function ChartSection() {
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <div style={{ borderRadius: 12, background: colors.surfaceContainer, border: '1px solid rgba(74,68,85,0.28)', padding: '18px 20px', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <p style={{ color: colors.onBackground, fontWeight: 700, fontSize: 14 }}>Ventas por Evento</p>
          <p style={{ color: 'rgba(204,195,216,0.55)', fontSize: 11, marginTop: 2 }}>Revenue vs Proyección Estimada</p>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {[{ c: colors.primary, l: 'Revenue' }, { c: colors.surfaceVariant, l: 'Proyección' }].map(({ c, l }) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(204,195,216,0.65)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />{l}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, height: 180, padding: '0 4px' }}>
        {CHART.map(({ label, proj, rev }) => (
          <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}
            onMouseEnter={() => setHovered(label)} onMouseLeave={() => setHovered(null)}>
            <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, position: 'relative' }}>
              {hovered === label && (
                <div style={{ position: 'absolute', top: -26, left: '50%', transform: 'translateX(-50%)', background: colors.onBackground, color: colors.background, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, whiteSpace: 'nowrap', zIndex: 10 }}>
                  ${Math.floor(rev * 1.2)}k
                </div>
              )}
              <div style={{ width: 10, borderRadius: '3px 3px 0 0', background: colors.surfaceVariant, height: `${proj}%` }} />
              <div style={{
                width: 10, borderRadius: '3px 3px 0 0', height: `${rev}%`, transition: 'all 0.2s',
                background: hovered === label ? `linear-gradient(180deg,${colors.accent},${colors.primaryContainer})` : `linear-gradient(180deg,${colors.primary},${colors.primaryContainer})`,
              }} />
            </div>
            <span style={{ fontSize: 10, color: 'rgba(204,195,216,0.55)', marginTop: 8, whiteSpace: 'nowrap' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
