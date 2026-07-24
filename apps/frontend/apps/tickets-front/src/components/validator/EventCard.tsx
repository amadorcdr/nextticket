import { Link } from 'react-router-dom';
import type { ValidatorEvent } from './data';

export function EventCard({ event }: { event: ValidatorEvent }) {
  const progressWidth = `${event.metric.progress}%`;

  return (
    <article className="group flex min-h-[510px] flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container shadow-sm transition-all hover:border-primary/50">
      <div className="relative h-48 w-full overflow-hidden">
        <div
          className="h-full w-full bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
          style={{ backgroundImage: `url("${event.imageUrl}")` }}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-surface-container via-transparent to-transparent" />

        {event.badge && (
          <div
            className={[
              'absolute left-4 top-4 rounded-full border px-4 py-2 text-sm font-semibold backdrop-blur-md',
              event.badge.tone === 'primary'
                ? 'border-primary/30 bg-primary/20 text-primary'
                : 'border-secondary/30 bg-secondary-container/50 text-on-secondary-container',
            ].join(' ')}
          >
            {event.badge.label}
          </div>
        )}
      </div>

      <div className="flex flex-grow flex-col p-6">
        <h3 className="mb-3 text-xl font-bold text-on-background">
          {event.title}
        </h3>

        <div className="mb-2 flex items-center gap-2 text-on-surface-variant">
          <span className="text-sm">⌖</span>
          <span className="text-sm font-semibold tracking-wide">{event.venue}</span>
        </div>

        <div className="mb-6 flex items-center gap-2 text-on-surface-variant">
          <span className="text-sm">◷</span>
          <span className="text-sm font-semibold tracking-wide">{event.dateLabel}</span>
        </div>

        <div className={['mt-auto border-t border-outline-variant pt-6', !event.metric.enabled ? 'opacity-60' : ''].join(' ')}>
          <div className="mb-3 flex items-end justify-between gap-4">
            <span className="text-sm font-semibold tracking-wide text-on-surface-variant">
              {event.metric.label}
            </span>

            <span className={['font-mono text-sm', event.metric.enabled ? 'text-primary' : 'text-on-background'].join(' ')}>
              {event.metric.value}
            </span>
          </div>

          <div className="mb-8 h-2 w-full overflow-hidden rounded-full bg-surface-variant">
            <div
              className={['h-full rounded-full', event.metric.enabled ? 'bg-primary' : 'bg-primary/30'].join(' ')}
              style={{ width: progressWidth }}
            />
          </div>

          {event.metric.enabled ? (
            <Link
              to="/validator"
              className={[
                'flex w-full items-center justify-center gap-4 rounded-lg py-4 text-sm font-semibold transition-all active:scale-95',
                event.status === 'in-progress'
                  ? 'bg-primary text-on-primary hover:brightness-110'
                  : 'bg-surface-variant text-on-background hover:bg-primary hover:text-on-primary',
              ].join(' ')}
            >
              <span>⌗</span>
              <span>{event.metric.buttonLabel}</span>
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="flex w-full cursor-not-allowed items-center justify-center gap-4 rounded-lg bg-surface-variant py-4 text-sm font-semibold text-on-surface-variant"
            >
              <span>▣</span>
              <span>{event.metric.buttonLabel}</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
