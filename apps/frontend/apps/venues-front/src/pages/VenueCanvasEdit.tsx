import { useEffect, useRef, useState } from "react";
import {
    ApiError,
    PhysicalEditor,
    Router,
    toast,
    useApi,
    type CanvasElementModel,
    type PhysicalVenueState,
    type Section,
    type Seat,
    Button,
    Icon,
} from "@nextticket-frontend/commons";
import { toPhysicalVenueState, type ApiVenueTree } from "../api";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** El editor genera ids tipo "floor_abc123_1" para lo nuevo; lo ya persistido
 *  siempre trae un UUID real del backend. Así se distingue crear vs actualizar. */
const isPersisted = (id: string) => UUID_RE.test(id);

const sameJSON = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * No hay endpoint para "reemplazar el árbol completo" de un recinto: hay que
 * comparar lo que había (original) contra lo que quedó (state) y mandar,
 * entidad por entidad, los DELETE/PATCH/POST que correspondan. El orden
 * importa: primero se borra (así lo eliminado no estorba), luego se
 * actualiza lo existente, y al final se crea lo nuevo (para poder resolver
 * los ids reales de padres recién creados antes de crear a sus hijos).
 */
export function VenueCanvasEdit() {
    const { id } = Router.useParams<{ id: string }>();
    const api = useApi();
    const navigate = Router.useNavigate();

    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [saving, setSaving] = useState(false);
    // Ver VenueCanvasCreate.tsx: candado síncrono aparte del estado, para que
    // un doble clic no dispare dos veces la cascada de PATCH/POST antes de
    // que React alcance a deshabilitar el botón.
    const savingRef = useRef(false);

    const [original, setOriginal] = useState<PhysicalVenueState | null>(null);
    const [current, setCurrent] = useState<PhysicalVenueState | null>(null);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        setNotFound(false);
        api
            .get<ApiVenueTree>(`/venues/${id}`)
            .then((res) => {
                const mapped = toPhysicalVenueState(res);
                setOriginal(mapped);
                setCurrent(mapped);
            })
            .catch((err) => {
                if (err instanceof ApiError && err.status === 404) setNotFound(true);
                else toast.danger(err instanceof ApiError ? err.message : "No se pudo cargar el recinto");
            })
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const handleSave = async (state: PhysicalVenueState) => {
        if (!id || !original || savingRef.current) return;
        
        savingRef.current = true;
        setSaving(true);
        try {
            // ── FLOORS ──────────────────────────────────────────────────
            const currentFloorIds = new Set(state.floors.map((f) => f.id));
            const deletedFloors = original.floors.filter((f) => !currentFloorIds.has(f.id));
            for (const floor of deletedFloors) {
                await api.del(`/venues/${id}/floors/${floor.id}`);
            }
            const deletedFloorIds = new Set(deletedFloors.map((f) => f.id));

            const originalFloorsById = new Map(original.floors.map((f) => [f.id, f]));
            for (const floor of state.floors) {
                if (!isPersisted(floor.id)) continue;
                const before = originalFloorsById.get(floor.id);
                const patch = { name: floor.name, levelIndex: floor.levelIndex };
                if (before && sameJSON({ name: before.name, levelIndex: before.levelIndex }, patch)) continue;
                await api.patch(`/venues/${id}/floors/${floor.id}`, patch);
            }

            const floorIdMap = new Map<string, string>();
            for (const floor of state.floors) {
                if (isPersisted(floor.id)) continue;
                const created = await api.post<{ id: string }>(`/venues/${id}/floors`, {
                    name: floor.name,
                    levelIndex: floor.levelIndex,
                });
                floorIdMap.set(floor.id, created.id);
            }
            const resolveFloorId = (floorId: string) => floorIdMap.get(floorId) ?? floorId;

            // ── SECTIONS ────────────────────────────────────────────────
            const currentSectionIds = new Set(state.sections.map((s) => s.id));
            const deletedSections = original.sections.filter(
                (s) => !currentSectionIds.has(s.id) && !deletedFloorIds.has(s.floorId),
            );
            for (const section of deletedSections) {
                await api.del(`/venues/${id}/floors/${section.floorId}/sections/${section.id}`);
            }
            const deletedSectionIds = new Set(deletedSections.map((s) => s.id));

            const sectionPatchBody = (s: Section) => ({
                name: s.name,
                description: s.description ?? undefined,
                capacity: Math.round(s.capacity),
                status: s.status,
                color: s.color ?? undefined,
                prefix: s.prefix ?? undefined,
                coordinateX: s.coordinateX != null ? Math.round(s.coordinateX) : undefined,
                coordinateY: s.coordinateY != null ? Math.round(s.coordinateY) : undefined,
                width: s.width != null ? Math.round(s.width) : undefined,
                height: s.height != null ? Math.round(s.height) : undefined,
                rotationDegrees: s.rotationDegrees,
                isEllipse: s.isEllipse,
                geometryPoints: s.points,
            });

            const originalSectionsById = new Map(original.sections.map((s) => [s.id, s]));
            for (const section of state.sections) {
                if (!isPersisted(section.id)) continue;
                const before = originalSectionsById.get(section.id);
                const patch = sectionPatchBody(section);
                if (before && sameJSON(sectionPatchBody(before), patch)) continue;
                await api.patch(`/venues/${id}/floors/${resolveFloorId(section.floorId)}/sections/${section.id}`, patch);
            }

            const sectionIdMap = new Map<string, string>();
            for (const section of state.sections) {
                if (isPersisted(section.id)) continue;
                const created = await api.post<{ id: string }>(
                    `/venues/${id}/floors/${resolveFloorId(section.floorId)}/sections`,
                    sectionPatchBody(section),
                );
                sectionIdMap.set(section.id, created.id);
            }
            const resolveSectionId = (sectionId: string) => sectionIdMap.get(sectionId) ?? sectionId;

            // ── SEATS ───────────────────────────────────────────────────
            const currentSeatIds = new Set(state.seats.map((s) => s.id));
            const deletedSeats = original.seats.filter((seat) => {
                if (currentSeatIds.has(seat.id)) return false;
                if (deletedSectionIds.has(seat.sectionId)) return false;
                const parentFloorId = originalSectionsById.get(seat.sectionId)?.floorId;
                if (parentFloorId && deletedFloorIds.has(parentFloorId)) return false;
                return true;
            });
            for (const seat of deletedSeats) {
                const section = originalSectionsById.get(seat.sectionId);
                if (!section) continue;
                await api.del(`/venues/${id}/floors/${section.floorId}/sections/${seat.sectionId}/seats/${seat.id}`);
            }

            const seatPatchBody = (s: Seat) => ({
                row: s.row,
                number: s.number,
                type: s.type,
                coordinateX: s.coordinateX != null ? Math.round(s.coordinateX) : undefined,
                coordinateY: s.coordinateY != null ? Math.round(s.coordinateY) : undefined,
                status: s.status,
            });

            const originalSeatsById = new Map(original.seats.map((s) => [s.id, s]));
            for (const seat of state.seats) {
                if (!isPersisted(seat.id)) continue;
                const section = state.sections.find((s) => s.id === seat.sectionId);
                if (!section) continue;
                const before = originalSeatsById.get(seat.id);
                const patch = seatPatchBody(seat);
                if (before && sameJSON(seatPatchBody(before), patch)) continue;
                await api.patch(
                    `/venues/${id}/floors/${resolveFloorId(section.floorId)}/sections/${resolveSectionId(seat.sectionId)}/seats/${seat.id}`,
                    patch,
                );
            }

            for (const seat of state.seats) {
                if (isPersisted(seat.id)) continue;
                const section = state.sections.find((s) => s.id === seat.sectionId);
                if (!section) continue;
                await api.post(
                    `/venues/${id}/floors/${resolveFloorId(section.floorId)}/sections/${resolveSectionId(seat.sectionId)}/seats`,
                    seatPatchBody(seat),
                );
            }

            // ── CANVAS ELEMENTS ─────────────────────────────────────────
            const currentElementIds = new Set(state.canvasElements.map((e) => e.id));
            const deletedElements = original.canvasElements.filter(
                (e) => !currentElementIds.has(e.id) && !deletedFloorIds.has(e.floorId),
            );
            for (const element of deletedElements) {
                await api.del(`/venues/${id}/floors/${element.floorId}/canvas-elements/${element.id}`);
            }

            const elementPatchBody = (e: CanvasElementModel) => ({
                elementType: e.elementType,
                name: e.name,
                status: e.status,
                color: e.color ?? undefined,
                coordinateX: Math.round(e.coordinateX),
                coordinateY: Math.round(e.coordinateY),
                width: e.width != null ? Math.round(e.width) : undefined,
                height: e.height != null ? Math.round(e.height) : undefined,
                rotationDegrees: e.rotationDegrees,
                isEllipse: e.isEllipse,
                geometryPoints: e.points,
            });

            const originalElementsById = new Map(original.canvasElements.map((e) => [e.id, e]));
            for (const element of state.canvasElements) {
                if (!isPersisted(element.id)) continue;
                const before = originalElementsById.get(element.id);
                const patch = elementPatchBody(element);
                if (before && sameJSON(elementPatchBody(before), patch)) continue;
                await api.patch(`/venues/${id}/floors/${resolveFloorId(element.floorId)}/canvas-elements/${element.id}`, patch);
            }

            for (const element of state.canvasElements) {
                if (isPersisted(element.id)) continue;
                await api.post(`/venues/${id}/floors/${resolveFloorId(element.floorId)}/canvas-elements`, elementPatchBody(element));
            }

            // La capacidad del recinto ya no se edita a mano: se recalcula
            // cada vez que cambian las secciones, para que nunca quede
            // desfasada de lo que en verdad hay en el canvas.
            const totalCapacity = state.sections.reduce((sum, s) => sum + (s.capacity || 0), 0);
            if (totalCapacity > 0) {
                await api.patch(`/venues/${id}`, { totalCapacity });
            }

            toast.success("Distribución del recinto actualizada");
            navigate(`/venues/${id}/edit`);
        } catch (err) {
            toast.danger(err instanceof ApiError ? err.message : "No se pudo guardar la distribución del recinto");
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    if (loading) {
        return <p className="text-muted text-xs py-16 text-center">Cargando recinto...</p>;
    }

    if (notFound || !current || !id) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <p className="text-foreground font-semibold">Recinto no encontrado</p>
                <p className="text-muted text-xs">Usa las migas de pan de arriba para volver a Recintos.</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-2">
            <div className="flex items-center justify-between px-3 py-2 border border-border rounded-[10px] bg-surface shrink-0">
                <div className="min-w-0">
                    <p className="text-foreground font-semibold text-sm truncate">{current.venue.name}</p>
                    <p className="text-muted text-xs truncate">Editando distribución de zonas</p>
                </div>
                <Button size="sm" variant="ghost" onPress={() => navigate(`/venues/${id}/edit`)} isDisabled={saving}>
                    <Icon.Pencil />
                    Editar datos generales
                </Button>
            </div>
            <div className="flex-1 min-h-0">
                <PhysicalEditor
                    initialState={current}
                    onChange={setCurrent}
                    mode="update"
                    onSave={handleSave}
                    saving={saving}
                    onCancel={() => navigate("/venues")}
                />
            </div>
        </div>
    );
}
