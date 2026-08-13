import { Icon } from "@nextticket-frontend/commons";
import type { ActivityType, RecentActivityItem } from "../../types/dashboard";

const ACTIVITY_META: Record<ActivityType, { icon: typeof Icon.Circle; className: string }> = {
    compra: { icon: Icon.ShoppingCart, className: "bg-success/10 text-success" },
    evento_creado: { icon: Icon.CalendarPlus, className: "bg-accent/10 text-accent" },
    usuario_registrado: { icon: Icon.UserPlus, className: "bg-default text-muted" },
    evento_actualizado: { icon: Icon.Pencil, className: "bg-warning/10 text-warning" },
};

export function RecentActivityList({ items }: { items: RecentActivityItem[] }) {
    return (
        <div className="flex flex-col gap-2">
            {items.map((item) => {
                const meta = ACTIVITY_META[item.type];
                const ActivityIcon = meta.icon;
                return (
                    <div key={item.id} className="flex items-start gap-2.5">
                        <div className={`shrink-0 size-7 rounded-full flex items-center justify-center ${meta.className}`}>
                            <ActivityIcon className="size-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-foreground text-xs leading-snug">{item.description}</p>
                            <p className="text-muted text-[11px] mt-0.5">{item.date}</p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
