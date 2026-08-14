import type { EventOccupancy } from "../../types/dashboard";

export function SalesSummary({ items }: { items: EventOccupancy[] }) {
    return (
        <div className="flex flex-col gap-2">
            {items.map(({ label, occupancyPercentage }) => (
                <div key={label} className="flex flex-col gap-1">
                    <div className="flex justify-between text-[11px]">
                        <span className="text-muted truncate">{label}</span>
                        <span className="text-foreground font-medium shrink-0">{occupancyPercentage}% ocupado</span>
                    </div>
                    <div className="h-1 rounded-full bg-default overflow-hidden relative">
                        <div className="h-full rounded-full bg-accent absolute inset-y-0 left-0" style={{ width: `${occupancyPercentage}%` }} />
                    </div>
                </div>
            ))}
        </div>
    );
}
