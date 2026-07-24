import type { Config } from 'tailwindcss';

// Design system compartido (Material 3) — ver README.md §1 "Tailwind CSS 4.x".
// El `content` cubre todos los microfrontends del workspace para que Tailwind
// detecte las clases usadas dentro de los paquetes que el webshell compila.
const config: Config = {
    content: [
        './apps/*/index.html',
        './apps/*/src/**/*.{ts,tsx}',
        './commons/src/**/*.{ts,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                'surface-container-lowest': '#0b0f10',
                'primary': '#d2bbff',
                'tertiary': '#bec6e0',
                'error-container': '#93000a',
                'outline-variant': '#4a4455',
                'on-secondary-fixed-variant': '#003ea8',
                'tertiary-fixed-dim': '#bec6e0',
                'on-primary': '#3f008e',
                'on-secondary-container': '#cdd7ff',
                'surface-container-low': '#191c1e',
                'on-error': '#690005',
                'tertiary-fixed': '#dae2fd',
                'error': '#ffb4ab',
                'surface-container-highest': '#323537',
                'surface-variant': '#323537',
                'on-tertiary-container': '#dee5ff',
                'secondary-fixed': '#dbe1ff',
                'inverse-surface': '#e0e3e5',
                'on-surface-variant': '#ccc3d8',
                'surface-tint': '#d2bbff',
                'on-tertiary': '#283044',
                'on-primary-fixed': '#25005a',
                'on-secondary': '#002a78',
                'secondary': '#b4c5ff',
                'surface-container-high': '#272a2c',
                'background': '#101415',
                'inverse-on-surface': '#2d3133',
                'outline': '#958da1',
                'on-primary-fixed-variant': '#5a00c6',
                'primary-container': '#7c3aed',
                'surface-bright': '#363a3b',
                'on-primary-container': '#ede0ff',
                'on-background': '#e0e3e5',
                'on-secondary-fixed': '#00174b',
                'tertiary-container': '#5e667d',
                'surface': '#101415',
                'inverse-primary': '#732ee4',
                'surface-dim': '#101415',
                'primary-fixed-dim': '#d2bbff',
                'on-surface': '#e0e3e5',
                'primary-fixed': '#eaddff',
                'on-tertiary-fixed-variant': '#3f465c',
                'secondary-fixed-dim': '#b4c5ff',
                'secondary-container': '#0053db',
                'on-tertiary-fixed': '#131b2e',
                'on-error-container': '#ffdad6',
                'surface-container': '#1d2022',

                // Colores adicionales usados en el flujo de auth y en secciones
                // puntuales de la landing (no forman parte del set Material 3
                // de arriba, pero sí se usan en el código real).
                'on-surface-muted': '#8a8496',
                'on-surface-faint': '#6b6080',
                'on-surface-subtle': '#5a5068',
                'on-surface-dim': '#4a4060',
                'input-placeholder': '#3d3650',
                'accent': '#a78bfa',
                'accent-muted': '#7c5cbf',
                'accent-secondary': '#4f35c7',
                'navbar-hover': '#e0d4ff',
                'surface-alt': '#121417',
                'surface-card': '#11151b',
                'meta-text': '#cbd5e1',
                'newsletter-from': '#2f33a6',
                'newsletter-via': '#1f2335',
                'newsletter-text': '#c3cbf7',

                // Estado positivo (activo / tendencia al alza) — usado en el
                // panel de organizador.
                'success': '#4ade80',
            },
            borderRadius: {
                'DEFAULT': '0.25rem',
                'lg': '0.5rem',
                'xl': '0.75rem',
                'full': '9999px',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                'headline-md': ['Inter'],
                'body-md': ['Inter'],
                'label-sm': ['Inter'],
                'display-lg-mobile': ['Inter'],
                'code-mono': ['JetBrains Mono'],
                'body-lg': ['Inter'],
                'display-lg': ['Inter'],
            },
            fontSize: {
                'headline-md': ['24px', { lineHeight: '32px', letterSpacing: '-0.01em', fontWeight: '700' }],
                'body-md': ['16px', { lineHeight: '24px', fontWeight: '400' }],
                'label-sm': ['14px', { lineHeight: '20px', letterSpacing: '0.05em', fontWeight: '600' }],
                'display-lg-mobile': ['32px', { lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '800' }],
                'code-mono': ['14px', { lineHeight: '20px', fontWeight: '400' }],
                'body-lg': ['18px', { lineHeight: '28px', fontWeight: '400' }],
                'display-lg': ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '800' }],
            },
        },
    },
    plugins: [],
};

export default config;
