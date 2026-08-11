import type { ClientEvent } from "../types/client";

/**
 * Datos simulados del catálogo, migrados del repositorio anterior.
 * Se reemplazan por GET /events cuando se conecte el backend.
 */
export const CLIENT_EVENTS: ClientEvent[] = [
    {
        id: "neon-genesis-live-tour",
        title: "Neon Genesis Live Tour",
        category: "Concierto",
        venue: "Arena Digital",
        city: "Ciudad de México",
        date: "15 de Octubre, 2026",
        time: "20:00",
        imageUrl:
            "https://images.unsplash.com/photo-1506157786151-b8491531f063?q=80&w=1200&auto=format&fit=crop",
        description:
            "Una experiencia audiovisual inmersiva con luces neón, música electrónica y una producción escénica de alto impacto.",
        status: "available",
        minPrice: 850,
        currency: "MXN",
        availableSeats: 350,
        totalSeats: 1200,
    },
    {
        id: "midnight-jazz-collective",
        title: "Midnight Jazz Collective",
        category: "Jazz",
        venue: "The Blue Note Venue",
        city: "Ciudad de México",
        date: "02 de Septiembre, 2026",
        time: "21:30",
        imageUrl:
            "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?q=80&w=1200&auto=format&fit=crop",
        description:
            "Una noche íntima de jazz contemporáneo con una selección especial de artistas nacionales e invitados.",
        status: "soon",
        minPrice: 620,
        currency: "MXN",
        availableSeats: 180,
        totalSeats: 500,
    },
    {
        id: "tech-summit-2026",
        title: "Tech Summit 2026",
        category: "Conferencia",
        venue: "Convention Center X",
        city: "Ciudad de México",
        date: "20 de Agosto, 2026",
        time: "10:00",
        imageUrl:
            "https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=1200&auto=format&fit=crop",
        description:
            "Dos días de conferencias sobre inteligencia artificial, arquitectura de software y producto digital.",
        status: "sold-out",
        minPrice: 1200,
        currency: "MXN",
        availableSeats: 0,
        totalSeats: 900,
    },
    {
        id: "final-cup-2026",
        title: "Final Cup 2026",
        category: "Deportivo",
        venue: "Estadio Nacional",
        city: "Ciudad de México",
        date: "12 de Noviembre, 2026",
        time: "19:00",
        imageUrl:
            "https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?q=80&w=1200&auto=format&fit=crop",
        description:
            "La final del torneo nacional, con transmisión en pantallas gigantes y zona de food trucks.",
        status: "available",
        minPrice: 450,
        currency: "MXN",
        availableSeats: 820,
        totalSeats: 3000,
    },
    {
        id: "stand-up-night",
        title: "Stand Up Night: Sin Filtro",
        category: "Comedia",
        venue: "Teatro Metropólitan",
        city: "Ciudad de México",
        date: "28 de Septiembre, 2026",
        time: "21:00",
        imageUrl:
            "https://images.unsplash.com/photo-1585699324551-f6c309eedeca?q=80&w=1200&auto=format&fit=crop",
        description:
            "Cuatro comediantes, una noche y cero temas prohibidos. Show para mayores de 18 años.",
        status: "available",
        minPrice: 380,
        currency: "MXN",
        availableSeats: 210,
        totalSeats: 800,
    },
    {
        id: "clasico-de-otono",
        title: "Clásico de Otoño",
        category: "Teatro",
        venue: "Auditorio Nacional",
        city: "Ciudad de México",
        date: "05 de Octubre, 2026",
        time: "18:00",
        imageUrl:
            "https://images.unsplash.com/photo-1503095396549-807759245b35?q=80&w=1200&auto=format&fit=crop",
        description:
            "Una puesta en escena contemporánea de un clásico del teatro, con orquesta en vivo.",
        status: "soon",
        minPrice: 540,
        currency: "MXN",
        availableSeats: 640,
        totalSeats: 2400,
    },
    {
        id: "electronic-sunset",
        title: "Electronic Sunset",
        category: "Concierto",
        venue: "Foro Sol",
        city: "Ciudad de México",
        date: "22 de Noviembre, 2026",
        time: "17:00",
        imageUrl:
            "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop",
        description:
            "Festival de música electrónica al aire libre con seis escenarios y artistas internacionales.",
        status: "available",
        minPrice: 1450,
        currency: "MXN",
        availableSeats: 4200,
        totalSeats: 65000,
    },
    {
        id: "maraton-monterrey",
        title: "Maratón Monterrey",
        category: "Deportivo",
        venue: "Parque Fundidora",
        city: "Monterrey",
        date: "08 de Diciembre, 2026",
        time: "06:30",
        imageUrl:
            "https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?q=80&w=1200&auto=format&fit=crop",
        description:
            "Carrera de 42 kilómetros por el centro de la ciudad, con categorías libre y máster.",
        status: "available",
        minPrice: 300,
        currency: "MXN",
        availableSeats: 1500,
        totalSeats: 5000,
    },
];
