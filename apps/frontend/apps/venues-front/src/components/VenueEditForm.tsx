import { Button, Icon, Input, Label, Router, TextField } from "@nextticket-frontend/commons";
import { VENUE_STATUS_OPTIONS, type Venue, type VenueStatus } from "../types/venue";

interface VenueEditFormProps {
    draft: Omit<Venue, "images">;
    onChange: (draft: Omit<Venue, "images">) => void;
}

const MEXICAN_STATES = [
    "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua",
    "Ciudad de México", "Coahuila", "Colima", "Durango", "Estado de México", "Guanajuato",
    "Guerrero", "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca",
    "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco",
    "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas", "CDMX",
];

export function VenueEditForm({ draft, onChange }: VenueEditFormProps) {
    const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => onChange({ ...draft, [key]: value });

    return (
        <div className="flex flex-col gap-4">
            <section className="bg-surface border border-border rounded-[10px] p-4 flex flex-col gap-3">
                <p className="text-foreground font-bold text-sm">Información general</p>
                <div className="grid sm:grid-cols-2 gap-3">
                    <TextField isRequired className="sm:col-span-2">
                        <Label>Nombre</Label>
                        <Input value={draft.name} onChange={(e) => set("name", e.target.value)} />
                    </TextField>
                    <TextField className="sm:col-span-2">
                        <Label>Descripción</Label>
                        <Input value={draft.description ?? ""} onChange={(e) => set("description", e.target.value)} />
                    </TextField>
                </div>
            </section>

            <section className="bg-surface border border-border rounded-[10px] p-4 flex flex-col gap-3">
                <p className="text-foreground font-bold text-sm">Ubicación</p>
                <div className="grid sm:grid-cols-2 gap-3">
                    <TextField isRequired className="sm:col-span-2">
                        <Label>Dirección</Label>
                        <Input value={draft.address} onChange={(e) => set("address", e.target.value)} />
                    </TextField>
                    <TextField isRequired>
                        <Label>Ciudad</Label>
                        <Input value={draft.city} onChange={(e) => set("city", e.target.value)} />
                    </TextField>
                    <div>
                        <Label>Estado</Label>
                        <select
                            value={draft.state}
                            onChange={(e) => set("state", e.target.value)}
                            className="mt-1 w-full bg-background border border-border rounded-[10px] text-foreground text-xs px-2.5 py-1.5 outline-none cursor-pointer"
                        >
                            {MEXICAN_STATES.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </section>

            <section className="bg-surface border border-border rounded-[10px] p-4 flex flex-col gap-3">
                <p className="text-foreground font-bold text-sm">Información operativa</p>
                <div className="grid sm:grid-cols-2 gap-3">
                    <TextField isRequired type="number">
                        <Label>Capacidad</Label>
                        <Input
                            type="number"
                            value={draft.total_capacity.toString()}
                            onChange={(e) => set("total_capacity", Number(e.target.value) || 0)}
                        />
                    </TextField>
                    <div>
                        <Label>Estado del recinto</Label>
                        <select
                            value={draft.status}
                            onChange={(e) => set("status", e.target.value as VenueStatus)}
                            className="mt-1 w-full bg-background border border-border rounded-[10px] text-foreground text-xs px-2.5 py-1.5 outline-none cursor-pointer"
                        >
                            {VENUE_STATUS_OPTIONS.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </section>

            <section className="bg-surface border border-border rounded-[10px] p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <p className="text-foreground font-bold text-sm">Distribución del recinto</p>
                    <Icon.LayoutGrid className="size-4 text-muted" />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                    <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-surface-secondary text-muted border border-border">
                        7 Pisos
                    </span>
                    <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-surface-secondary text-muted border border-border">
                        28 Secciones
                    </span>
                    <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-surface-secondary text-muted border border-border">
                        20 Elementos
                    </span>
                </div>
                <p className="text-muted text-xs">
                    Consulta o modifica los pisos, secciones y asientos de este recinto en el editor de zonas.
                </p>
                <Button
                    size="sm"
                    variant="secondary"
                    fullWidth
                    render={(domProps: any) => <Router.Link to="/venues/canvas" {...domProps} />}
                >
                    <Icon.LayoutGrid />
                    Editar distribución de zonas
                </Button>
            </section>
        </div>
    );
}
