import type { ComponentType } from "react";

interface StatCardProps {
    label: string;
    value: string;
    icon?: ComponentType<{ className?: string }>;
}

export function StatCard({ label, value, icon: StatIcon }: StatCardProps) {
    return (
        <div className="bg-surface border border-border rounded-[10px] p-3 flex items-center gap-3">
            {StatIcon && (
                <div className="shrink-0 size-9 rounded-[10px] bg-accent/10 text-accent flex items-center justify-center">
                    <StatIcon className="size-4" />
                </div>
            )}
            <div className="min-w-0">
                <p className="text-muted text-[11px] font-semibold uppercase tracking-wide mb-1 truncate">{label}</p>
                <p className="text-foreground text-lg font-bold truncate">{value}</p>
            </div>
        </div>
    );
}
