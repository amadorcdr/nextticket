import { SmallBentoCard } from '../cards/SmallBentoCard';
import { bentoEvents } from '../data';

export function BentoGrid() {
  return (
    <section className="py-8 max-w-[1360px] mx-auto px-2 sm:px-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-primary font-bold text-2xl">
            Próximos Eventos
          </h2>
        </div>

        <button className="text-primary hover:underline flex items-center gap-1 text-sm font-semibold">
          Ver todos
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
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </button>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Tarjeta principal */}
        <div className="md:col-span-2 md:row-span-2 group relative overflow-hidden rounded-xl h-[500px] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_32px_110px_rgba(124,58,237,0.24)]">
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110 group-hover:brightness-110"
            style={{
              backgroundImage: `url('${bentoEvents[0].image}')`,
            }}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

          <div className="absolute bottom-0 left-0 p-10 w-full">
            <div className="flex gap-4 mb-4">
              <span className="bg-primary text-on-primary px-3 py-1 rounded text-sm font-semibold">
                {bentoEvents[0].category}
              </span>

              <span className="bg-white/10 backdrop-blur-md text-white px-3 py-1 rounded text-sm font-semibold">
                {bentoEvents[0].date}
              </span>
            </div>

            <h3 className="font-extrabold text-[2rem] leading-10 tracking-tight text-white mb-2">
              {bentoEvents[0].title}
            </h3>

            <p className="text-on-surface-variant line-clamp-2">
              {bentoEvents[0].description}
            </p>
          </div>
        </div>

        {/* Deportes */}
        <SmallBentoCard event={bentoEvents[1]} />

        {/* Teatro */}
        <SmallBentoCard event={bentoEvents[2]} />

        {/* Tarjeta horizontal */}
        <div className="md:col-span-2 group relative overflow-hidden rounded-xl h-[238px] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_32px_110px_rgba(124,58,237,0.24)]">
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110 group-hover:brightness-110"
            style={{
              backgroundImage: `url('${bentoEvents[3].image}')`,
            }}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

          <div className="absolute bottom-0 left-0 p-6">
            <span className="text-primary text-sm font-semibold uppercase tracking-widest block mb-1">
              {bentoEvents[3].category}
            </span>

            <h4 className="font-bold text-2xl text-white">
              {bentoEvents[3].title}
            </h4>
          </div>
        </div>
      </div>
    </section>
  );
}
