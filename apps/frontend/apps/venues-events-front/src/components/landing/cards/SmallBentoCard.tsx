import { BentoCard } from '../types';

interface Props {
  event: BentoCard;
}

export function SmallBentoCard({ event }: Props) {
  return (
    <div className="group relative overflow-hidden rounded-xl h-[238px] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_32px_110px_rgba(124,58,237,0.24)]">
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110 group-hover:brightness-110"
        style={{
          backgroundImage: `url('${event.image}')`,
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      <div className="absolute bottom-0 left-0 p-6">
        <span className="text-primary text-sm font-semibold uppercase tracking-widest block mb-1">
          {event.category}
        </span>

        <h4 className="font-bold text-2xl text-white">{event.title}</h4>
      </div>
    </div>
  );
}
