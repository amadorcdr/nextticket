import type { SalesByEvent } from "../../mocks/dashboardMocks";

export function SalesSummary({ items }: { items: SalesByEvent[] }) {
    return (
        <div className="flex flex-col gap-2">
            {items.map(({ label, projected, revenue }) => (
                <div key={label} className="flex flex-col gap-1">
                    <div className="flex justify-between text-[11px]">
                        <span className="text-muted truncate">{label}</span>
                        <span className="text-foreground font-medium shrink-0">{revenue}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-default overflow-hidden relative">
                        <div className="h-full rounded-full bg-muted/40 absolute inset-y-0 left-0" style={{ width: `${projected}%` }} />
                        <div className="h-full rounded-full bg-accent absolute inset-y-0 left-0" style={{ width: `${revenue}%` }} />
                    </div>
                </div>
            ))}
        </div>
    );
}
