// El panel de organizador construye su UI con `style={{}}` inline (no clases
// de Tailwind), así que estas constantes son el equivalente en JS de los
// mismos tokens definidos en `tailwind.config.ts` — una sola fuente de
// verdad para los colores, aunque el mecanismo de aplicarlos sea distinto.
export const colors = {
  background: '#101415',
  onBackground: '#e0e3e5',
  onSurfaceVariant: '#ccc3d8',
  onSurfaceFaint: '#6b6080',
  onSurfaceFaintAlt: '#5a5270',
  onSurfaceDim: '#4a4060',
  outlineVariant: '#4a4455',
  primary: '#d2bbff',
  primaryContainer: '#7c3aed',
  primaryContainerDark: '#5b21b6',
  onPrimaryContainer: '#ede0ff',
  accent: '#a78bfa',
  accentSecondary: '#4f35c7',
  surfaceContainer: '#1d2022',
  surfaceContainerLow: '#191c1e',
  surfaceContainerLowest: '#0b0f10',
  surfaceContainerHigh: '#272a2c',
  surfaceVariant: '#323537',
  secondary: '#b4c5ff',
  secondaryContainer: '#0053db',
  error: '#ffb4ab',
  errorContainer: '#93000a',
  errorContainerBright: '#c0392b',
  success: '#4ade80',
  white: '#ffffff',
} as const;
