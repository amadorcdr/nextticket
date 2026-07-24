function IconTwitterX() {
  return (
    <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function IconInstagram() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconFacebook() {
  return (
    <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

const SOCIALS = [
  { label: 'X / Twitter', icon: <IconTwitterX />, href: '#' },
  { label: 'Instagram', icon: <IconInstagram />, href: '#' },
  { label: 'Facebook', icon: <IconFacebook />, href: '#' },
];

export function Footer() {
  return (
    <footer className="bg-surface-container-lowest border-t border-outline-variant">
      <div className="flex items-center justify-center gap-5 py-3">
        {SOCIALS.map(({ label, icon, href }) => (
          <a
            key={label}
            href={href}
            aria-label={label}
            className="text-on-surface-dim hover:text-on-surface-variant transition-colors duration-150"
          >
            {icon}
          </a>
        ))}
      </div>
    </footer>
  );
}
