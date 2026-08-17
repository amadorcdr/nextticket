import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";

const THEME_STORAGE_KEY = "heroui-theme";
const DEFAULT_THEME = "dark";
const PREFERS_DARK_MEDIA = "(prefers-color-scheme: dark)";

// Mismo trazo que /favicon.svg (icono de Framework7), solo que aquí se
// recolorea en tiempo real: negro en tema claro, blanco en oscuro/nextticket.
const FAVICON_PATH_D =
    "M7.627 16.697L23.812 5.364a4 4 0 0 1 5.57.982l2.553 3.645q.056.08.107.163zM2.147 29.84L1.04 25.708a4 4 0 0 1 2.83-4.898L44.438 9.94a4 4 0 0 1 4.899 2.828l1.151 4.298a3.2 3.2 0 0 1-1.121 3.35a5.001 5.001 0 0 0 2.433 8.903a3.08 3.08 0 0 1 2.576 2.255l1.172 4.377a4 4 0 0 1-2.828 4.899L12.15 51.72a4 4 0 0 1-4.898-2.828l-1.103-4.118a3.48 3.48 0 0 1 1.16-3.6a5.001 5.001 0 0 0-2.37-8.812a3.46 3.46 0 0 1-2.791-2.52m35.478-6.689a3 3 0 1 0-1.553-5.795a3 3 0 0 0 1.553 5.795m2.07 7.728a3 3 0 1 0-1.552-5.796a3 3 0 0 0 1.553 5.796m2.071 7.727a3 3 0 1 0-1.552-5.795a3 3 0 0 0 1.552 5.795";

function applyFaviconColor(resolvedTheme: string) {
    const color = resolvedTheme === "light" ? "#000000" : "#ffffff";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 56 56"><path fill="${color}" fill-rule="evenodd" d="${FAVICON_PATH_D}"/></svg>`;

    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
    }
    link.type = "image/svg+xml";
    link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

interface AppThemeContextValue {
    theme: string;
    resolvedTheme: string;
    setTheme: (theme: string) => void;
}

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function readStoredTheme(): string {
    try {
        return window.localStorage.getItem(THEME_STORAGE_KEY) ?? DEFAULT_THEME;
    } catch {
        return DEFAULT_THEME;
    }
}

function getSystemPreference(): "light" | "dark" {
    return window.matchMedia?.(PREFERS_DARK_MEDIA).matches ? "dark" : "light";
}

function applyThemeToDOM(resolved: string) {
    const root = document.documentElement;
    // Limpia cualquier clase de tema previa (light/dark/nextticket/...) antes
    // de aplicar la nueva, así nunca quedan dos pisándose a la vez.
    root.classList.remove("light", "dark", "nextticket");
    root.classList.add(resolved);
    root.setAttribute("data-theme", resolved);
}

/**
 * Único punto donde se resuelve y aplica el tema de toda la app: estado y
 * efecto propios, sin depender del hook `useTheme` de HeroUI (cada llamada a
 * ese hook mantiene su propio estado interno; si algo más lo llamaba por su
 * cuenta —como hacía antes `ThemeSwitcher`— competía con esta resolución y el
 * tema terminaba pisado). "dark" es el tema de arranque.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<string>(() =>
        typeof window === "undefined" ? DEFAULT_THEME : readStoredTheme(),
    );
    const [systemPreference, setSystemPreference] = useState<"light" | "dark">(() =>
        typeof window === "undefined" ? "dark" : getSystemPreference(),
    );

    useEffect(() => {
        const media = window.matchMedia(PREFERS_DARK_MEDIA);
        const onChange = () => setSystemPreference(getSystemPreference());
        media.addEventListener("change", onChange);
        return () => media.removeEventListener("change", onChange);
    }, []);

    const resolvedTheme = theme === "system" ? systemPreference : theme;

    useEffect(() => {
        applyThemeToDOM(resolvedTheme);
        applyFaviconColor(resolvedTheme);
    }, [resolvedTheme]);

    const setTheme = useCallback((next: string) => {
        try {
            window.localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
            // Sin storage disponible, el tema solo dura la sesión de la pestaña.
        }
        setThemeState(next);
    }, []);

    const value = useMemo<AppThemeContextValue>(
        () => ({ theme, resolvedTheme, setTheme }),
        [theme, resolvedTheme, setTheme],
    );

    return <AppThemeContext value={value}>{children}</AppThemeContext>;
}

export function useAppTheme(): AppThemeContextValue {
    const context = useContext(AppThemeContext);

    if (!context) {
        throw new Error("useAppTheme debe usarse dentro de <ThemeProvider>");
    }

    return context;
}
