import { useEffect, useState } from "react";
import { ApiError, Button, Icon, Router, toast, useApi } from "@nextticket-frontend/commons";
import { VenueEditForm } from "../components/VenueEditForm";
import { toVenueDto, toVenueFromDetail, type ApiVenueDetail } from "../api";
import type { Venue, VenueFormValues } from "../types/venue";

function toDraft(v: Venue): VenueFormValues {
    return {
        name: v.name,
        address: v.address,
        city: v.city,
        state: v.state,
        total_capacity: v.total_capacity,
        status: v.status,
        description: v.description,
    };
}

export function VenueEditView() {
    const { id } = Router.useParams<{ id: string }>();
    const navigate = Router.useNavigate();
    const api = useApi();

    const [venue, setVenue] = useState<Venue | null>(null);
    const [floorsCount, setFloorsCount] = useState(0);
    const [sectionsCount, setSectionsCount] = useState(0);
    const [draft, setDraft] = useState<VenueFormValues | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        setNotFound(false);
        api
            .get<ApiVenueDetail>(`/venues/${id}`)
            .then((res) => {
                const mapped = toVenueFromDetail(res);
                setVenue(mapped);
                setFloorsCount(mapped.floorsCount);
                setSectionsCount(mapped.sectionsCount);
                setDraft(toDraft(mapped));
            })
            .catch((err) => {
                if (err instanceof ApiError && err.status === 404) {
                    setNotFound(true);
                } else {
                    toast.danger(err instanceof ApiError ? err.message : "No se pudo cargar el recinto");
                }
            })
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    if (loading) {
        return <p className="text-muted text-xs py-16 text-center">Cargando recinto...</p>;
    }

    if (notFound || !venue || !draft) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <p className="text-foreground font-semibold">Recinto no encontrado</p>
                <Button size="sm" variant="secondary" onPress={() => navigate("/venues")}>
                    <Icon.ArrowLeft />
                    Volver a Recintos
                </Button>
            </div>
        );
    }

    const handleSave = async () => {
        if (!id) return;
        setSaving(true);
        try {
            await api.patch(`/venues/${id}`, toVenueDto(draft));
            toast.success("Recinto actualizado");
            navigate("/venues");
        } catch (err) {
            toast.danger(err instanceof ApiError ? err.message : "No se pudo guardar el recinto");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-500">
            <div className="flex items-center gap-3">
                <Button size="sm" variant="ghost" isIconOnly onPress={() => navigate("/venues")}>
                    <Icon.ArrowLeft />
                </Button>
                <div>
                    <h3>Editar recinto</h3>
                    <p className="text-muted text-xs mt-0.5">{venue.name}</p>
                </div>
            </div>

            <VenueEditForm
                draft={draft}
                onChange={setDraft}
                floorsCount={floorsCount}
                sectionsCount={sectionsCount}
                onEditZones={() => navigate(`/venues/${id}/canvas`)}
            />

            <div className="flex gap-2 justify-end sticky bottom-0 bg-background border-t border-border pt-3 pb-1">
                <Button size="sm" variant="secondary" onPress={() => navigate("/venues")} isDisabled={saving}>
                    Cancelar
                </Button>
                <Button size="sm" onPress={handleSave} isDisabled={saving}>
                    <Icon.Check />
                    {saving ? "Guardando..." : "Guardar cambios"}
                </Button>
            </div>
        </div>
    );
}
