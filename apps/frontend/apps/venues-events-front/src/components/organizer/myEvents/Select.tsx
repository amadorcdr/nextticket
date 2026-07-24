import { IcoChevronDown } from '../icons';
import { colors } from '../theme';

export function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ appearance: 'none', background: colors.surfaceContainer, border: '1px solid rgba(74,68,85,0.5)', borderRadius: 8, color: colors.onBackground, fontSize: 12, fontWeight: 600, padding: '6px 28px 6px 12px', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}>
        {options.map((o) => <option key={o} value={o} style={{ background: colors.surfaceContainer }}>{o}</option>)}
      </select>
      <span style={{ position: 'absolute', right: 8, pointerEvents: 'none', color: colors.onSurfaceFaint, display: 'flex' }}><IcoChevronDown /></span>
    </div>
  );
}
