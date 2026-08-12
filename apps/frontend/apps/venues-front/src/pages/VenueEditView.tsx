import { useEffect, useState } from "react";
import { Button, Icon, Router } from "@nextticket-frontend/commons";
import { VenueEditForm } from "../components/VenueEditForm";
import { VENUES } from "../mocks/venues";
import type { Venue } from "../types/venue";

export function VenueEditView() {
    const { id } = Router.useParams<{ id: string }>();
    const navigate = Router.useNavigate();

    const venue = VENUES.find((v) => v.id === id);

    const toDraft = (v: Venue): Omit<Venue, "images"> => {
        const { images, ...rest } = v;
        return rest;
    };

    const [draft, setDraft] = useState<Omit<Venue, "images"> | null>(venue ? toDraft(venue) : null);

    useEffect(() => {
        if (venue) setDraft(toDraft(venue));
    }, [id]);

    if (!venue || !draft) {
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

    const handleSave = () => {
        console.log("Guardado:", draft);
        navigate("/venues");
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

            <VenueEditForm draft={draft} onChange={setDraft} />

            <div className="flex gap-2 justify-end sticky bottom-2">
                <Button size="sm" variant="secondary" onPress={() => navigate("/venues")}>
                    Cancelar
                </Button>
                <Button size="sm" onPress={handleSave}>
                    <Icon.Check />
                    Guardar cambios
                </Button>
            </div>
        </div>
    );
}
