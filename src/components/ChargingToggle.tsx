"use client";

import { useState } from "react";
import { setChargingEnabled } from "@/lib/actions";

export default function ChargingToggle({ enabled }: { enabled: boolean }) {
    const [isOn, setIsOn] = useState(enabled);
    const [loading, setLoading] = useState(false);

    async function handleToggle() {
        const nextState = !isOn;
        setLoading(true);
        try {
            await setChargingEnabled(nextState);
            setIsOn(nextState);
        } catch (e) {
            console.error(e);
            alert("Error al cambiar modo");
        } finally {
            setLoading(false);
        }
    }

    const styles = {
        container: {
            display: "flex",
            alignItems: "center",
            cursor: loading ? "wait" : "pointer",
            position: "relative" as const,
            width: "44px",
            height: "22px",
            borderRadius: "20px",
            background: isOn ? "var(--success)" : "#cbd5e1",
            transition: "background 0.3s ease",
            padding: "2px",
            opacity: loading ? 0.6 : 1
        },
        toggle: {
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            background: "white",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            transform: isOn ? "translateX(22px)" : "translateX(0)"
        }
    };

    return (
        <div onClick={!loading ? handleToggle : undefined} style={styles.container}>
            <div style={styles.toggle} />
        </div>
    );
}
