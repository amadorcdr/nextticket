import type { ReactNode } from 'react';
import { colors } from './theme';

interface ActionBtnProps {
  icon: ReactNode;
  tip: string;
  danger?: boolean;
  onClick?: () => void;
}

export function ActionBtn({ icon, tip, danger = false, onClick }: ActionBtnProps) {
  return (
    <button
      title={tip}
      onClick={onClick}
      style={{ width: 30, height: 30, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: colors.onSurfaceFaint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = colors.surfaceVariant; (e.currentTarget as HTMLElement).style.color = danger ? colors.error : colors.primary; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = colors.onSurfaceFaint; }}
    >
      {icon}
    </button>
  );
}
