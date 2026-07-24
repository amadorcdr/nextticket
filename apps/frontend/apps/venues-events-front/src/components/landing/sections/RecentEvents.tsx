import { recentEvents } from '../data';

export function RecentEvents() {
  return (
    <section className="py-10 bg-surface-alt">
      <div className="max-w-[1360px] mx-auto px-2 sm:px-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
          <div>
            <h2 className="text-primary font-bold text-2xl">
              Eventos Recientes
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

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {recentEvents.map((event) => (
            <article
              key={event.id}
              className="group overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-[0_28px_90px_rgba(0,0,0,0.24)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_32px_110px_rgba(124,58,237,0.24)]"
            >
              <div className="relative h-52 overflow-hidden">
                <img
                  src={event.image}
                  alt={event.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 group-hover:brightness-110"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                <span className="absolute left-4 bottom-4 inline-flex rounded-full bg-primary-container/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                  {event.category}
                </span>
              </div>

              <div className="p-6">
                <h5 className="font-bold text-2xl text-white leading-tight line-clamp-2 mb-3">
                  {event.title}
                </h5>

                <div className="flex items-center gap-1 text-sm text-meta-text font-medium">
                  <svg
                    className="w-3.5 h-3.5 text-primary-container"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3z"
                    />

                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 21s8-4.5 8-10.5S15.523 3 12 3 4 6.5 4 10.5 12 21 12 21z"
                    />
                  </svg>

                  {event.location}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
