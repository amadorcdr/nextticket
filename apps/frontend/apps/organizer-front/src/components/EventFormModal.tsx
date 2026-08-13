import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Icon, Input, Label, TextField } from "@nextticket-frontend/commons";
import type { ApiEventCategory, ApiVenue, OrganizerEventRow } from "../api";

export type EventFormMode = "create" | "edit";

export interface EventFormValues {
    nombre: string;
    venueId: string;
    categoryId: string;
    fecha: string;
    horaInicio: string;
    horaFin: string;
    descripcion: string;
    /** Archivo nuevo elegido en esta sesión de edición; null = no se cambió la imagen. */
    imageFile: File | null;
}

interface EventFormModalProps {
    open: boolean;
    mode: EventFormMode;
    event: OrganizerEventRow | null;
    venues: ApiVenue[];
    categories: ApiEventCategory[];
    saving: boolean;
    onClose: () => void;
    onSave: (data: EventFormValues) => void;
}

const EMPTY: Omit<EventFormValues, "imageFile"> = {
    nombre: "",
    venueId: "",
    categoryId: "",
    fecha: "",
    horaInicio: "",
    horaFin: "",
    descripcion: "",
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function toDateInput(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTimeInput(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EventFormModal({ open, mode, event, venues, categories, saving, onClose, onSave }: EventFormModalProps) {
    const [draft, setDraft] = useState(EMPTY);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>("");
    const [imageError, setImageError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setImageFile(null);
        setImageError(null);
        setDraft(
            event
                ? {
                      nombre: event.name,
                      venueId: event.venueId,
                      categoryId: event.categoryId,
                      fecha: toDateInput(event.startsAt),
                      horaInicio: toTimeInput(event.startsAt),
                      horaFin: toTimeInput(event.endsAt),
                      descripcion: event.description,
                  }
                : EMPTY,
        );
        setImagePreview(event?.imageUrl ?? "");
    }, [open, event]);

    // Libera el blob URL anterior cuando se elige otra imagen o se cierra el modal.
    useEffect(() => {
        if (!imageFile) return;
        const url = URL.createObjectURL(imageFile);
        setImagePreview(url);
        return () => URL.revokeObjectURL(url);
    }, [imageFile]);

    if (!open) return null;

    const isCreate = mode === "create";
    const title = isCreate ? "Crear Nuevo Evento" : "Editar Evento";
    const subtitle = isCreate ? "Configura los detalles de tu próximo gran evento." : "Modifica los detalles de tu evento.";

    const set = (k: "nombre" | "fecha" | "horaInicio" | "horaFin" | "descripcion") => (e: React.ChangeEvent<HTMLInputElement>) =>
        setDraft((p) => ({ ...p, [k]: e.target.value }));

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setImageError("Elige un archivo de imagen (JPEG, PNG, WEBP o GIF).");
            return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
            setImageError("La imagen no puede pesar más de 5 MB.");
            return;
        }
        setImageError(null);
        setImageFile(file);
    };

    const datesValid = Boolean(draft.fecha && draft.horaInicio && draft.horaFin) && draft.horaFin > draft.horaInicio;
    const canSave = draft.nombre.trim() && draft.venueId && datesValid;

    const handleSave = () => {
        if (!canSave) return;
        onSave({ ...draft, imageFile });
    };

    return createPortal(
        <>
            {/* Backdrop */}
            <div onClick={onClose} className="fixed inset-0 z-60 backdrop-blur-md" style={{ background: "var(--backdrop)" }} />

            {/* Panel — slides in from right */}
            <aside className="fixed top-0 right-0 h-full w-full max-w-100 z-70 flex flex-col bg-surface border-l border-border rounded-l-2xl shadow-overlay">
                {/* Header */}
                <div className="flex justify-between items-start px-5 py-4 border-b border-border shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                            {isCreate ? <Icon.CalendarPlus className="size-5" /> : <Icon.CalendarCog className="size-5" />}
                        </div>
                        <div>
                            <h4 className="text-foreground font-bold">{title}</h4>
                            <p className="text-muted text-xs mt-0.5">{subtitle}</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" isIconOnly onPress={onClose}>
                        <Icon.X />
                    </Button>
                </div>

                {/* Form body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
                    {/* Imagen */}
                    <div>
                        <Label>Imagen del Evento</Label>
                        <label
                            htmlFor="event-image-input"
                            className="mt-1 flex flex-col items-center justify-center gap-1.5 h-28 rounded-xl border-2 border-dashed border-border bg-background cursor-pointer overflow-hidden relative hover:border-foreground transition-colors"
                        >
                            {imagePreview ? (
                                <img src={imagePreview} alt="preview" className="w-full h-full object-cover absolute inset-0" />
                            ) : (
                                <>
                                    <Icon.Upload className="text-muted size-5" />
                                    <span className="text-muted text-[11px]">Sube una imagen (JPEG, PNG, WEBP o GIF, máx. 5MB)</span>
                                </>
                            )}
                        </label>
                        <input id="event-image-input" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                        {imageError && <p className="text-danger text-[11px] mt-1">{imageError}</p>}
                    </div>

                    <TextField isRequired name="nombre">
                        <Label>Nombre del Evento</Label>
                        <Input placeholder="Ej: Festival de Verano 2024" value={draft.nombre} onChange={set("nombre")} />
                    </TextField>

                    <div>
                        <Label>Recinto</Label>
                        <select
                            value={draft.venueId}
                            onChange={(e) => setDraft((p) => ({ ...p, venueId: e.target.value }))}
                            className="mt-1 w-full bg-background border border-border rounded-[10px] text-foreground text-xs px-2.5 py-1.5 outline-none cursor-pointer"
                        >
                            <option value="">Selecciona un recinto</option>
                            {venues.map((v) => (
                                <option key={v.id} value={v.id}>
                                    {v.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <Label>Categoría</Label>
                        <select
                            value={draft.categoryId}
                            onChange={(e) => setDraft((p) => ({ ...p, categoryId: e.target.value }))}
                            className="mt-1 w-full bg-background border border-border rounded-[10px] text-foreground text-xs px-2.5 py-1.5 outline-none cursor-pointer"
                        >
                            <option value="">Sin categoría</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <TextField isRequired name="fecha" type="date">
                        <Label>Fecha</Label>
                        <Input value={draft.fecha} onChange={set("fecha")} />
                    </TextField>

                    <div className="grid grid-cols-2 gap-2">
                        <TextField isRequired name="horaInicio" type="time">
                            <Label>Hora de inicio</Label>
                            <Input value={draft.horaInicio} onChange={set("horaInicio")} />
                        </TextField>
                        <TextField isRequired name="horaFin" type="time">
                            <Label>Hora de fin</Label>
                            <Input value={draft.horaFin} onChange={set("horaFin")} />
                        </TextField>
                    </div>
                    {draft.horaInicio && draft.horaFin && !datesValid && (
                        <p className="text-danger text-[11px] -mt-2">La hora de fin debe ser posterior a la hora de inicio.</p>
                    )}

                    <TextField name="descripcion">
                        <Label>Descripción</Label>
                        <Input placeholder="Describe los puntos clave del evento..." value={draft.descripcion} onChange={set("descripcion")} />
                    </TextField>
                </div>

                {/* Footer */}
                <div className="flex gap-2 px-5 py-3 border-t border-border shrink-0">
                    <Button size="sm" variant="secondary" fullWidth onPress={onClose} isDisabled={saving}>
                        Cancelar
                    </Button>
                    <Button size="sm" fullWidth onPress={handleSave} isDisabled={!canSave || saving}>
                        {saving ? "Guardando..." : isCreate ? "Crear Evento" : "Guardar Cambios"}
                    </Button>
                </div>
            </aside>
        </>,
        document.body,
    );
}
