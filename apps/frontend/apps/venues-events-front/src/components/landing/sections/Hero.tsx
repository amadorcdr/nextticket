import fondo1 from '../../../assets/fondo1.png';

export function Hero() {
  return (
    <section className="relative h-[620px] w-full overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div
          className="w-full h-full bg-cover"
          style={{
            backgroundImage: `url(${fondo1})`,
            backgroundPosition: 'center 60%',
            backgroundRepeat: 'no-repeat',
          }}
        />

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full max-w-[1280px] mx-auto px-6 flex flex-col justify-start items-start pt-28">
        <span className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-semibold tracking-wider mb-6 backdrop-blur-sm">
          PRÓXIMAMENTE EN TU CIUDAD
        </span>

        <h1 className="font-extrabold text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tight text-white max-w-2xl mb-6">
          Vive los Mejores Eventos
        </h1>

        <p className="text-on-surface-variant text-lg leading-relaxed max-w-xl mb-16">
          Accede a las experiencias más exclusivas, desde conciertos de talla
          mundial hasta los partidos más emocionantes. Asegura tu lugar en
          primera fila.
        </p>

        <div className="flex flex-wrap gap-4">
          <button
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-base text-white transition-all duration-300 hover:brightness-110 hover:shadow-[0_0_16px_rgba(124,58,237,0.3)] active:scale-95"
            style={{
              background: 'linear-gradient(135deg,#7c3aed 0%,#0053db 100%)',
            }}
          >
            Explorar Eventos
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </button>

          <a
            href="https://www.cultura.cdmx.gob.mx/recintos/tcei"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center px-5 py-3 rounded-xl border border-outline text-on-background font-bold text-base transition-all duration-300 hover:text-white hover:bg-gradient-to-r hover:from-primary-container hover:to-secondary-container hover:border-transparent"
          >
            Ver Recintos
          </a>
        </div>
      </div>
    </section>
  );
}
