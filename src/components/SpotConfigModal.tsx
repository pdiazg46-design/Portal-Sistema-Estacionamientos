
"use client";

import { useState, useEffect } from "react";
import { getSpotCounts, updateSpotCounts } from "@/lib/actions";

export default function SpotConfigModal({ onClose }: { onClose: () => void }) {
    const [selectedTower, setSelectedTower] = useState("T1");
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        async function load() {
            setLoading(true);
            const counts = await getSpotCounts(selectedTower);
            setTotal(counts.total || 0);
            setLoading(false);
        }
        load();
    }, [selectedTower]);

    const formatValue = (val: number | string) => {
        if (val === "" || val === 0) return "";
        const num = typeof val === "string" ? parseInt(val.replace(/\./g, "")) : val;
        if (isNaN(num)) return "";
        return num.toLocaleString("es-CL");
    };

    const handleTotalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\./g, "");
        const numValue = parseInt(rawValue);
        if (!isNaN(numValue) || rawValue === "") {
            setTotal(numValue || 0);
        }
    };

    async function handleSave() {
        setSaving(true);
        try {
            await updateSpotCounts(total, selectedTower);
            alert(`Capacidad de la ${selectedTower} actualizada exitosamente.`);
            onClose();
            window.location.reload();
        } catch (e) {
            console.error(e);
            alert("Error al actualizar la capacidad.");
        } finally {
            setSaving(false);
        }
    }

    if (loading) return null;

    return (
        <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20000
        }}>
            <div style={{
                background: "white",
                padding: "35px",
                borderRadius: "24px",
                width: "100%",
                maxWidth: "450px",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
            }} className="animate-scale-in">
                <h2 style={{ margin: "0 0 10px 0", color: "var(--primary)", fontSize: "24px", fontWeight: "900" }}>
                    ⚙️ Configuración de Inventario
                </h2>
                <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "25px" }}>
                    Selecciona la torre y define su capacidad de estacionamientos de forma independiente.
                </p>

                <div style={{ display: "flex", gap: "10px", marginBottom: "25px" }}>
                    {["T1", "T2", "T3"].map(t => (
                        <button
                            key={t}
                            onClick={() => setSelectedTower(t)}
                            style={{
                                flex: 1,
                                padding: "10px",
                                borderRadius: "10px",
                                border: selectedTower === t ? "2px solid var(--primary)" : "2px solid #e2e8f0",
                                background: selectedTower === t ? "#eff6ff" : "white",
                                color: selectedTower === t ? "var(--primary)" : "#64748b",
                                fontWeight: "800",
                                fontSize: "14px",
                                cursor: "pointer",
                                transition: "all 0.2s"
                            }}
                        >
                            Torre {t.slice(1)}
                        </button>
                    ))}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <div style={{ background: "#f8fafc", padding: "18px", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <label style={{ fontWeight: "800", color: "#1e293b", fontSize: "14px" }}>
                                Sitios en {selectedTower === "T1" ? "Torre 1" : selectedTower === "T2" ? "Torre 2" : "Torre 3"}
                            </label>
                            <span style={{ fontSize: "20px" }}>🅿️</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <button
                                onClick={() => setTotal(Math.max(0, total - 1))}
                                style={styles.counterBtn}
                            >-</button>
                            <input
                                type="text"
                                value={formatValue(total)}
                                onChange={handleTotalChange}
                                style={styles.input}
                                placeholder="0"
                            />
                            <button
                                onClick={() => setTotal(total + 1)}
                                style={styles.counterBtn}
                            >+</button>
                        </div>
                    </div>

                    <div style={{ fontSize: "12px", color: "#64748b", background: "#f1f5f9", padding: "12px", borderRadius: "8px", lineHeight: "1.4" }}>
                        💡 <strong>Lógica Multi-Torre:</strong><br />
                        Los sitios de la <strong>{selectedTower}</strong> se numerarán automáticamente como {selectedTower}-01, {selectedTower}-02, etc. Esto no afectará el inventario de las demás torres.
                    </div>
                </div>

                <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "15px", fontStyle: "italic" }}>
                    * Nota: No se eliminarán sitios que estén actualmente ocupados por un vehículo.
                </p>

                <div style={{ display: "flex", gap: "12px", marginTop: "30px" }}>
                    <button
                        onClick={onClose}
                        style={{ ...styles.actionBtn, background: "#f1f5f9", color: "#64748b" }}
                    >Cancelar</button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{ ...styles.actionBtn, background: "var(--primary)", color: "white", flex: 2 }}
                    >
                        {saving ? "Guardando..." : "Aplicar Cambios"}
                    </button>
                </div>
            </div>
        </div>
    );
}

const styles = {
    counterBtn: {
        width: "36px",
        height: "36px",
        borderRadius: "10px",
        border: "none",
        background: "white",
        color: "var(--primary)",
        fontWeight: "900",
        fontSize: "18px",
        cursor: "pointer",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
    },
    input: {
        flex: 1,
        border: "none",
        background: "transparent",
        textAlign: "center" as const,
        fontSize: "24px",
        fontWeight: "900",
        color: "#1e293b",
        outline: "none"
    },
    actionBtn: {
        flex: 1,
        padding: "14px",
        borderRadius: "12px",
        border: "none",
        fontWeight: "800",
        fontSize: "15px",
        cursor: "pointer",
        transition: "all 0.2s"
    }
};
