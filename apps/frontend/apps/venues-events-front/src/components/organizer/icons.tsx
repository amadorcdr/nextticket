// Set de íconos del panel de organizador. Consolidado desde los distintos
// archivos originales (cada uno redeclaraba los mismos SVGs).

interface IconProps {
  className?: string;
}

export function IcoDownload({ className = 'w-4 h-4' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>;
}

export function IcoPlus({ className = 'w-4 h-4' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>;
}

export function IcoEdit({ className = 'w-4 h-4' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
}

export function IcoEye({ className = 'w-4 h-4' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></svg>;
}

export function IcoTrash({ className = 'w-4 h-4' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>;
}

export function IcoFilter({ className = 'w-4 h-4' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>;
}

export function IcoChevronDown({ className = 'w-3.5 h-3.5' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>;
}

export function IcoMusic({ className = 'w-5 h-5' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>;
}

export function IcoTheater({ className = 'w-5 h-5' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12z" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></svg>;
}

export function IcoDraw({ className = 'w-5 h-5' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>;
}

export function IcoMic({ className = 'w-5 h-5' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" /></svg>;
}

export function IcoDrum({ className = 'w-5 h-5' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><ellipse cx="12" cy="7" rx="10" ry="4" /><path d="M2 7v10c0 2.2 4.5 4 10 4s10-1.8 10-4V7" /><path d="M2 12c0 2.2 4.5 4 10 4s10-1.8 10-4" /></svg>;
}

export function IcoStar({ className = 'w-5 h-5' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>;
}

export function IcoCalendar({ className = 'w-4 h-4' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
}

export function IcoTrendUp({ className = 'w-3 h-3' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>;
}

export function IcoSearch({ className = 'w-4 h-4' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>;
}

export function IcoSeat({ className = 'w-4 h-4' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2M6 11V7a6 6 0 0112 0v4" /><rect x="6" y="11" width="12" height="6" rx="1" /></svg>;
}

export function IcoDash({ className = 'w-4 h-4' }: IconProps) {
  return <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M13 3h8v8h-8V3zm0 10h8v8h-8v-8zM3 3h8v8H3V3zm0 10h8v8H3v-8z" /></svg>;
}

export function IcoPayments({ className = 'w-4 h-4' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>;
}

export function IcoPerson({ className = 'w-4 h-4' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>;
}

export function IcoLogout({ className = 'w-4 h-4' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>;
}

export function IcoMenu({ className = 'w-4 h-4' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18" /></svg>;
}

export function IcoX({ className = 'w-4 h-4' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>;
}

export function IcoUpload({ className = 'w-8 h-8' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.4} viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>;
}

export function IcoClock({ className = 'w-4 h-4' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>;
}

export function IcoMail({ className = 'w-4 h-4' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 7l10 7 10-7" /></svg>;
}

export function IcoPhone({ className = 'w-4 h-4' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.5a19.79 19.79 0 01-3-8.59A2 2 0 012.12 1H5a2 2 0 012 1.72c.13 1 .37 1.97.72 2.9a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.18-1.18a2 2 0 012.11-.45c.93.35 1.9.59 2.9.72A2 2 0 0122 16.92z" /></svg>;
}

export function IcoPin({ className = 'w-4 h-4' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>;
}

export function IcoCheck({ className = 'w-4 h-4' }: IconProps) {
  return <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>;
}
