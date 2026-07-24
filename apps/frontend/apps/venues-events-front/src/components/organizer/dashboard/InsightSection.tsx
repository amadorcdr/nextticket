import fondo1 from '../../../assets/fondo1.png';
import { colors } from '../theme';
import type { EventRow } from './columns';

export function InsightSection({ topEvent }: { topEvent: EventRow }) {
  const revenue = topEvent.sold * 20;
  return (
    <div style={{ height: '100%', borderRadius: 12, overflow: 'hidden', position: 'relative', border: '1px solid rgba(74,68,85,0.28)' }}>
      <img src={fondo1} alt="fondo"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(rgba(16,20,21,0.5),rgba(16,20,21,0.5))' }} />
      <div style={{ position: 'relative', zIndex: 1, padding: 22, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.primary }}>
          Top Evento (Revenue)
        </span>
        <h3 style={{ margin: '6px 0 0', fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>{topEvent.name}</h3>
        <p style={{ margin: '8px 0', fontSize: '1.8rem', fontWeight: 900, color: '#fff' }}>${revenue.toLocaleString()}</p>
        <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>{topEvent.venue} · {topEvent.date}</p>
      </div>
    </div>
  );
}
