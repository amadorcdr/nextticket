import { useState, useEffect } from "react";

export function useBreakpoint(minWidth: number = 1024) {
    const [isMatch, setIsMatch] = useState(
        () => typeof window !== "undefined" ? window.innerWidth >= minWidth : true
    );
    
    useEffect(() => {
        const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
        const handler = (e: MediaQueryListEvent) => setIsMatch(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, [minWidth]);
    
    return isMatch;
}
