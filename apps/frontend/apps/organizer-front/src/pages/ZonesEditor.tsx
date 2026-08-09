import { useState } from "react";
import { CommercialEditor } from "@nextticket-frontend/commons";

/*
 * Recinto de ejemplo con secciones y asientos reales para poder probar el
 * editor comercial (asignar secciones a zonas, deshabilitar asientos, etc.)
 * sin depender de un recinto guardado — todavía no hay persistencia de
 * recintos físicos conectada a este editor.
 */
function createSampleVenue() {
  const rows = ["A", "B"];
  const seats = rows.flatMap((row, rowIndex) =>
    Array.from({ length: 5 }, (_, i) => ({
      id: `seat-vip-${row}${i + 1}`,
      sectionId: "section-vip",
      row,
      number: String(i + 1),
      type: "VIP" as const,
      coordinateX: 130 + i * 45,
      coordinateY: 150 + rowIndex * 45,
      rotationDegrees: 0,
      status: "AVAILABLE" as const,
    }))
  );

  return {
    venue: {
      id: "venue-sample",
      name: "Recinto de ejemplo",
      address: "",
      city: "",
      addressState: null,
      country: "Mexico",
      totalCapacity: 210,
      description: null,
      status: "DRAFT" as const,
    },
    floors: [{ id: "floor-1", venueId: "venue-sample", name: "Piso 1", levelIndex: 0 }],
    sections: [
      {
        id: "section-vip",
        venueId: "venue-sample",
        floorId: "floor-1",
        name: "VIP",
        description: null,
        capacity: 10,
        status: "ACTIVE" as const,
        color: "#a855f7",
        prefix: "VIP",
        coordinateX: 100,
        coordinateY: 100,
        width: 300,
        height: 150,
        rotationDegrees: 0,
        isEllipse: false,
        points: [],
        rowSeatCounts: [5, 5],
        rowNames: rows,
      },
      {
        id: "section-general",
        venueId: "venue-sample",
        floorId: "floor-1",
        name: "General",
        description: null,
        capacity: 200,
        status: "ACTIVE" as const,
        color: "#38bdf8",
        prefix: "GEN",
        coordinateX: 450,
        coordinateY: 100,
        width: 250,
        height: 150,
        rotationDegrees: 0,
        isEllipse: false,
        points: [],
        rowSeatCounts: [],
        rowNames: [],
      },
    ],
    seats,
    canvasElements: [],
  };
}

export function ZonesEditor() {
  const [physical] = useState(createSampleVenue);

  return (
    <div className="h-full w-full">
      <CommercialEditor physical={physical} />
    </div>
  );
}
