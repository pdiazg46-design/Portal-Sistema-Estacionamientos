
"use client";

import { useState, useEffect } from "react";

export default function DigitalClock() {
    const [time, setTime] = useState<Date | null>(null);

    useEffect(() => {
        setTime(new Date());
        const timer = setInterval(() => {
            setTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    if (!time) return null; // Prevent hydration mismatch

    const dateStr = time.toLocaleDateString('es-CL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });

    const timeStr = time.toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });

    return (
        <div style={{ textAlign: "right", color: "#64748b", flexShrink: 0 }}>
            <div style={{ fontSize: "14px", fontWeight: "700", textTransform: "capitalize" }}>
                {dateStr} de {time.getFullYear()}
            </div>
            <div style={{ fontSize: "28px", fontWeight: "900", color: "var(--primary)", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
                {timeStr}
            </div>
        </div>
    );
}
