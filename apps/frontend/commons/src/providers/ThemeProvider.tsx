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
