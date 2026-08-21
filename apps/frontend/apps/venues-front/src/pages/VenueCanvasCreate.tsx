import { useRef, useState } from "react";
import {
    ApiError,
    Button,
    createEmptyPhysicalVenue,
    Icon,
    Input,
    Label,
    PhysicalEditor,
    Router,
    TextField,
    toast,
    useApi,
    type PhysicalVenueState,
} from "@nextticket-frontend/commons";

interface CreatedEntity {
    id: string;
}

const MEXICAN_STATES = [
    "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua",
    "Ciudad de México", "Coahuila", "Colima", "Durango", "Estado de México", "Guanajuato",
    "Guerrero", "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca",
    "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco",
    "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas",
];

type Step = "info" | "canvas";

/**
 * No existe un endpoint para "guardar el árbol completo" del recinto: el
 * backend es CRUD granular por entidad (venue → floors → sections → seats /
 * canvas-elements). Este wrapper hace la cascada de POSTs en orden, mapeando
 * los ids locales que genera el editor (no son UUID) a los ids reales que
 * devuelve cada creación, para poder anidar correctamente lo siguiente.
 *
 * El editor de canvas (PhysicalEditor) solo maneja geometría — pisos,
 * secciones, asientos — nunca tuvo forma de capturar nombre/dirección/ciudad/
 * capacidad del recinto. Por eso este componente antepone un paso de "datos
 * generales" antes de mostrar el canvas.
 */
export function VenueCanvasCreate() {
    const api = useApi();
    const navigate = Router.useNavigate();
    const [step, setStep] = useState<Step>("info");
    const [venueState, setVenueState] = useState<PhysicalVenueState>(() => createEmptyPhysicalVenue());
    const [saving, setSaving] = useState(false);
    // Candado síncrono aparte del estado: dos clics muy seguidos pueden
    // disparar dos onPress antes de que React re-renderice el botón como
    // deshabilitado (el estado "saving" todavía no se refleja en el DOM),
    // y como /venues no es idempotente, cada llamada de más crea otro
    // recinto duplicado. Esta ref se lee/escribe de forma inmediata, sin
    // esperar a un render, así que sí corta la segunda llamada a tiempo.
    const savingRef = useRef(false);

    const setVenueField = <K extends keyof PhysicalVenueState["venue"]>(
        key: K,
        value: PhysicalVenueState["venue"][K],
    ) => {
        setVenueState((prev) => ({ ...prev, venue: { ...prev.venue, [key]: value } }));
    };

    const canContinue =
        venueState.venue.name.trim().length > 0 &&
        venueState.venue.address.trim().length > 0 &&
        venueState.venue.city.trim().length > 0;

    const handleSave = async (state: PhysicalVenueState) => {
        if (savingRef.current) return;

        if (!state.venue.name.trim() || !state.venue.address.trim() || !state.venue.city.trim()) {
            toast.danger("Completa nombre, dirección y ciudad del recinto antes de guardar.");
            setStep("info");
            return;
        }

        // La capacidad ya no se captura a mano: es la suma de la capacidad de
        // cada sección que el usuario acomodó en el canvas.
        const totalCapacity = state.sections.reduce((sum, s) => sum + (s.capacity || 0), 0);
        if (totalCapacity < 1) {
            toast.danger("Agrega al menos una sección con capacidad en el canvas antes de guardar.");
            return;
        }

        savingRef.current = true;
        setSaving(true);
        let createdVenueId: string | null = null;

        try {
            const venue = await api.post<CreatedEntity>("/venues", {
                name: state.venue.name,
                address: state.venue.address,
                city: state.venue.city,
                state: state.venue.addressState || undefined,
                country: state.venue.country || undefined,
                totalCapacity,
                description: state.venue.description || undefined,
                status: state.venue.status,
            });
            createdVenueId = venue.id;

            const floorIdMap = new Map<string, string>();
            for (const floor of state.floors) {
                const created = await api.post<CreatedEntity>(`/venues/${venue.id}/floors`, {
                    name: floor.name,
                    levelIndex: floor.levelIndex,
                });
                floorIdMap.set(floor.id, created.id);
            }

            const sectionIdMap = new Map<string, string>();
            for (const section of state.sections) {
                const newFloorId = floorIdMap.get(section.floorId);
                if (!newFloorId) continue;

                const created = await api.post<CreatedEntity>(`/venues/${venue.id}/floors/${newFloorId}/sections`, {
                    name: section.name,
                    description: section.description ?? undefined,
                    capacity: Math.round(section.capacity),
                    status: section.status,
                    color: section.color ?? undefined,
                    prefix: section.prefix ?? undefined,
                    coordinateX: section.coordinateX != null ? Math.round(section.coordinateX) : undefined,
                    coordinateY: section.coordinateY != null ? Math.round(section.coordinateY) : undefined,
                    width: section.width != null ? Math.round(section.width) : undefined,
                    height: section.height != null ? Math.round(section.height) : undefined,
                    rotationDegrees: section.rotationDegrees,
                    isEllipse: section.isEllipse,
                    geometryPoints: section.points,
                });
                sectionIdMap.set(section.id, created.id);
            }

            for (const seat of state.seats) {
                const section = state.sections.find((s) => s.id === seat.sectionId);
                const newSectionId = sectionIdMap.get(seat.sectionId);
                const newFloorId = section ? floorIdMap.get(section.floorId) : undefined;
                if (!newSectionId || !newFloorId) continue;

                await api.post(`/venues/${venue.id}/floors/${newFloorId}/sections/${newSectionId}/seats`, {
                    row: seat.row,
                    number: seat.number,
                    type: seat.type,
                    coordinateX: seat.coordinateX != null ? Math.round(seat.coordinateX) : undefined,
                    coordinateY: seat.coordinateY != null ? Math.round(seat.coordinateY) : undefined,
                    status: seat.status,
                });
            }

            for (const element of state.canvasElements) {
                const newFloorId = floorIdMap.get(element.floorId);
                if (!newFloorId) continue;

                await api.post(`/venues/${venue.id}/floors/${newFloorId}/canvas-elements`, {
                    elementType: element.elementType,
                    name: element.name,
                    status: element.status,
                    color: element.color ?? undefined,
                    coordinateX: Math.round(element.coordinateX),
                    coordinateY: Math.round(element.coordinateY),
                    width: element.width != null ? Math.round(element.width) : undefined,
                    height: element.height != null ? Math.round(element.height) : undefined,
                    rotationDegrees: element.rotationDegrees,
                    isEllipse: element.isEllipse,
                    geometryPoints: element.points,
                });
            }

            toast.success(`Recinto "${state.venue.name}" creado`);
            navigate("/venues");
        } catch (err) {
            toast.danger(err instanceof ApiError ? err.message : "No se pudo guardar el recinto");

            // El venue ya se creó pero algo más falló a medio camino: se
            // intenta limpiar para no dejar un recinto a medias en la lista.
            if (createdVenueId) {
                api.del(`/venues/${createdVenueId}`).catch(() => {});
            }
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    if (step === "info") {
        return (
            <div className="flex flex-col gap-4 animate-in fade-in duration-500">
                <div>
                    <h3>Crear recinto</h3>
                    <p className="text-muted text-xs mt-0.5">Datos generales, antes de diseñar pisos y zonas.</p>
                </div>

                <section className="bg-surface border border-border rounded-[10px] p-4 flex flex-col gap-3">
                    <p className="text-foreground font-bold text-sm">Información general</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                        <TextField isRequired className="sm:col-span-2">
                            <Label>Nombre</Label>
                            <Input value={venueState.venue.name} onChange={(e) => setVenueField("name", e.target.value)} />
                        </TextField>
                        <TextField className="sm:col-span-2">
                            <Label>Descripción</Label>
                            <Input
                                value={venueState.venue.description ?? ""}
                                onChange={(e) => setVenueField("description", e.target.value)}
                            />
                        </TextField>
                    </div>
                </section>

                <section className="bg-surface border border-border rounded-[10px] p-4 flex flex-col gap-3">
                    <p className="text-foreground font-bold text-sm">Ubicación</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                        <TextField isRequired className="sm:col-span-2">
                            <Label>Dirección</Label>
                            <Input value={venueState.venue.address} onChange={(e) => setVenueField("address", e.target.value)} />
                        </TextField>
                        <TextField isRequired>
                            <Label>Ciudad</Label>
                            <Input value={venueState.venue.city} onChange={(e) => setVenueField("city", e.target.value)} />
                        </TextField>
                        <div>
                            <Label>Estado</Label>
                            <select
                                value={venueState.venue.addressState ?? ""}
                                onChange={(e) => setVenueField("addressState", e.target.value || null)}
                                className="mt-1 w-full bg-background border border-border rounded-[10px] text-foreground text-xs px-2.5 py-1.5 outline-none cursor-pointer"
                            >
                                <option value="">Selecciona un estado</option>
                                {MEXICAN_STATES.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </section>

                <div className="flex gap-2 justify-end border-t border-border pt-3 pb-1">
                    <Button size="sm" variant="secondary" onPress={() => navigate("/venues")}>
                        Cancelar
                    </Button>
                    <Button size="sm" onPress={() => setStep("canvas")} isDisabled={!canContinue}>
                        Continuar al editor de zonas
                        <Icon.ArrowRight />
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-2">
            <div className="flex items-center justify-between px-3 py-2 border border-border rounded-[10px] bg-surface shrink-0">
                <div className="min-w-0">
                    <p className="text-foreground font-semibold text-sm truncate">{venueState.venue.name}</p>
                    <p className="text-muted text-xs truncate">
                        {venueState.venue.address}, {venueState.venue.city}
                    </p>
                </div>
                <Button size="sm" variant="ghost" onPress={() => setStep("info")} isDisabled={saving}>
                    <Icon.Pencil />
                    Editar datos generales
                </Button>
            </div>
            <div className="flex-1 min-h-0">
                <PhysicalEditor
                    initialState={venueState}
                    onChange={setVenueState}
                    mode="create"
                    onSave={handleSave}
                    saving={saving}
                    onCancel={() => navigate("/venues")}
                />
            </div>
        </div>
    );
}
