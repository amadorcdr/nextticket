import { Button, Chip, Icon } from "@nextticket-frontend/commons";
import type { OrganizerEventRow, OrganizerEventStatus } from "../api";

const FALLBACK_IMAGE_URL = "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop";

const STATUS_META: Record<OrganizerEventStatus, { label: string; color: "success" | "danger" }> = {
  Activo: { label: "Activo", color: "success" },
  Inactivo: { label: "Inactivo", color: "danger" },
};

interface OrganizerEventCardProps {
  event: OrganizerEventRow;
  onEdit: (event: OrganizerEventRow) => void;
  onCancel: (event: OrganizerEventRow) => void;
}

export function OrganizerEventCard({ event, onEdit, onCancel }: OrganizerEventCardProps) {
  const status = STATUS_META[event.status];
  const pct = event.total > 0 ? Math.round((event.sold / event.total) * 100) : 0;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[10px] bg-surface shadow-surface transition-shadow hover:shadow-overlay">
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={event.imageUrl || FALLBACK_IMAGE_URL}
          alt={event.name}
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 rounded-full bg-surface/85 backdrop-blur-sm">
          <Chip variant="soft" size="sm">
            {event.categoryName || "Sin categoría"}
          </Chip>
        </div>
        <div className="absolute right-3 top-3 rounded-full bg-surface/85 backdrop-blur-sm">
          <Chip variant="soft" size="sm" color={status.color}>
            {status.label}
          </Chip>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <h4 className="line-clamp-2">{event.name}</h4>
          <p className="flex items-center gap-2 text-muted md:text-sm text-xs">
            <Icon.Calendar className="size-4 shrink-0" />
            <span className="truncate">
              {event.date} • {event.time}
            </span>
          </p>
          <p className="flex items-center gap-2 text-muted md:text-sm text-xs">
            <Icon.MapPin className="size-4 shrink-0" />
            <span className="truncate">{event.venue}</span>
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-muted font-mono">
              {event.sold.toLocaleString()} / {event.total.toLocaleString()}
            </span>
            <span className="text-foreground font-medium">{pct}%</span>
          </div>
          <div className="h-1 rounded-full bg-default overflow-hidden">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="mt-auto flex items-center gap-2 pt-2">
          <Button size="sm" variant="secondary" fullWidth onPress={() => onEdit(event)}>
            <Icon.Pencil />
            Editar
          </Button>
          {event.status === "Activo" && (
            <Button size="sm" variant="secondary" color="danger" isIconOnly onPress={() => onCancel(event)}>
              <Icon.CalendarX2 />
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
