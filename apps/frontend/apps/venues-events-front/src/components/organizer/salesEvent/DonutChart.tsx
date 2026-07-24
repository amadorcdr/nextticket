import { colors } from '../theme';
import type { ZonaData } from './data';

export function DonutChart({ zonas, total }: { zonas: ZonaData[]; total: number }) {
  const R = 60; const STROKE = 22; const C = 80;
  const circumference = 2 * Math.PI * R;

  // Build slices immutably — no mutable variable during render
  const slices = zonas.reduce<{ label: string; count: number; color: string; dash: number; offset: number }[]>(
    (acc, z) => {
      const prevOffset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0;
      const dash = (z.count / total) * circumference;
      return [...acc, { ...z, dash, offset: prevOffset }];
    },
    []
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', width: 160, height: 160 }}>
        <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={C} cy={C} r={R} fill="none" stroke={colors.surfaceContainerHigh} strokeWidth={STROKE} />
          {slices.map((s) => (
            <circle key={s.label} cx={C} cy={C} r={R} fill="none"
              stroke={s.color} strokeWidth={STROKE}
              strokeDasharray={`${s.dash} ${circumference - s.dash}`}
              strokeDashoffset={-s.offset} strokeLinecap="butt"
            />
          ))}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(204,195,216,0.5)', margin: 0 }}>Total</p>
          <p style={{ fontSize: 22, fontWeight: 900, color: colors.onBackground, lineHeight: 1.1, margin: 0 }}>{total.toLocaleString()}</p>
        </div>
      </div>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {slices.map((s) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: colors.onSurfaceVariant }}>{s.label}</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: colors.onBackground }}>{s.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
