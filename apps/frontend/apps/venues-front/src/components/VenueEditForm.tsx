import { Button, Icon, Input, Label, TextField } from "@nextticket-frontend/commons";
import type { VenueFormValues } from "../types/venue";

interface VenueEditFormProps {
    draft: VenueFormValues;
    onChange: (draft: VenueFormValues) => void;
    floorsCount: number;
    sectionsCount: number;
    onEditZones: () => void;
}

const MEXICAN_STATES = [
    "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua",
    "Ciudad de México", "Coahuila", "Colima", "Durango", "Estado de México", "Guanajuato",
    "Guerrero", "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca",
    "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco",
    "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas", "CDMX",
];

export function VenueEditForm({ draft, onChange, floorsCount, sectionsCount, onEditZones }: VenueEditFormProps) {
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
                    <TextField isDisabled>
                        <Label>Capacidad</Label>
                        <Input value={`${draft.total_capacity.toLocaleString("es-MX")} lugares`} />
                    </TextField>
                </div>
                <p className="text-muted text-[11px] -mt-1">
                    Se calcula sola a partir de las secciones que agregues en el editor de zonas.
                </p>
            </section>

            <section className="bg-surface border border-border rounded-[10px] p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <p className="text-foreground font-bold text-sm">Distribución del recinto</p>
                    <Icon.LayoutGrid className="size-4 text-muted" />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                    <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-surface-secondary text-muted border border-border">
                        {floorsCount} {floorsCount === 1 ? "Piso" : "Pisos"}
                    </span>
                    <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-surface-secondary text-muted border border-border">
                        {sectionsCount} Secciones
                    </span>
                </div>
                <p className="text-muted text-xs">
                    Agrega, mueve o elimina pisos, secciones y asientos de este recinto en el editor de zonas.
                </p>
                <Button size="sm" variant="secondary" fullWidth onPress={onEditZones}>
                    <Icon.LayoutGrid />
                    Editar distribución de zonas
                </Button>
            </section>
        </div>
    );
}
