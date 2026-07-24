import { Link } from 'react-router-dom';

type NavbarProps = {
  scrolled: boolean;
  /** Header reducido para pantallas fuera del flujo público (login, registro):
   *  oculta los links de navegación y las acciones, y el logo pasa a ser el
   *  regreso a la landing. */
  minimal?: boolean;
};

export function Navbar({ scrolled, minimal = false }: NavbarProps) {
  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 h-16 transition-all duration-300 bg-background/80 backdrop-blur-md ${
        scrolled ? 'shadow-lg' : 'shadow-sm'
      }`}
    >
      <nav className="w-full h-full px-0 flex justify-between items-center">
        <div className="flex items-center gap-16 pl-4">
          {minimal ? (
            <Link to="/" className="text-primary font-bold text-lg tracking-tight hover:text-navbar-hover transition-colors">
              Next-Ticket
            </Link>
          ) : (
            <span className="text-primary font-bold text-lg tracking-tight">
              Next-Ticket
            </span>
          )}

          {!minimal && (
            <div className="hidden md:flex items-center gap-6">
              <Link
                to="/"
                className="text-primary font-semibold border-b-2 border-primary pb-0.5 text-sm"
              >
                Eventos
              </Link>
              <a
                href="#"
                className="text-on-surface-variant hover:text-on-background transition-colors text-sm"
              >
                Espacios
              </a>
              <a
                href="#"
                className="text-on-surface-variant hover:text-on-background transition-colors text-sm"
              >
                Mis tickets
              </a>
            </div>
          )}
        </div>

        {!minimal && (
          <div className="flex items-center gap-6 pr-4">
            <div className="relative hidden lg:block">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Buscar eventos..."
                className="bg-surface-variant border-none rounded-full py-1.5 pl-10 pr-4 text-sm text-on-background focus:ring-2 focus:ring-primary w-64 outline-none"
              />
            </div>
            <Link to="/login">
              <button className="px-4 py-2 bg-primary-container text-on-primary-container rounded-lg text-sm font-semibold active:scale-95 transition-transform">
                Login
              </button>
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
