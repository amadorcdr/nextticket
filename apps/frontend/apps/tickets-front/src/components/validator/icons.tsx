interface IconProps {
  className?: string;
}

export function IcoCalendar({ className = 'w-4 h-4' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
}

export function IcoScanner({ className = 'w-4 h-4' }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M4 7V5a2 2 0 012-2h2" />
      <path d="M16 3h2a2 2 0 012 2v2" />
      <path d="M20 17v2a2 2 0 01-2 2h-2" />
      <path d="M8 21H6a2 2 0 01-2-2v-2" />
      <path d="M8 8h3v3H8z" />
      <path d="M13 8h3v3h-3z" />
      <path d="M8 13h3v3H8z" />
      <path d="M13 13h3v3h-3z" />
    </svg>
  );
}

export function IcoPerson({ className = 'w-4 h-4' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>;
}

export function IcoLogout({ className = 'w-4 h-4' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>;
}

export function IcoSearch({ className = 'w-4 h-4' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>;
}

export function IcoMenu({ className = 'w-4 h-4' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18" /></svg>;
}
