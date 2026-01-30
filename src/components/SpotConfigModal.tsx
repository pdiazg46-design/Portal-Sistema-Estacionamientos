
"use client";

import { useState, useEffect } from "react";
import { getSpotCounts, updateSpotCounts } from "@/lib/actions";

export default function SpotConfigModal({ onClose }: { onClose: () => void }) {
    const [selectedTower, setSelectedTower] = useState("T1");
    const [towerValues, setTowerValues] = useState<Record<string, number>>({
        "T1": 0,
        "T2": 0,
        "T3": 0
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        async function loadInitial() {
            setLoading(true);
            const countsT1 = await getSpotCounts("T1");
            const countsT2 = await getSpotCounts("T2");
            const countsT3 = await getSpotCounts("T3");
            setTowerValues({
                "T1": countsT1.total || 0,
                "T2": countsT2.total || 0,
                "T3": countsT3.total || 0
            });
            setLoading(false);
        }
        loadInitial();
    }, []);

    const formatValue = (val: number) => {
        if (val === 0) return "0";
        return val.toLocaleString("es-CL");
    };

    const handleTotalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\./g, "");
        const numValue = parseInt(rawValue);
        if (!isNaN(numValue) || rawValue === "") {
            setTowerValues(prev => ({ ...prev, [selectedTower]: numValue || 0 }));
        }
    };

    async function handleSave() {
        setSaving(true);
        try {
            // Guardar todas las torres que tengan valores
            await updateSpotCounts(towerValues["T1"], "T1");
            await updateSpotCounts(towerValues["T2"], "T2");
            await updateSpotCounts(towerValues["T3"], "T3");

            alert(`Inventario de todas las torres actualizado exitosamente.`);
            onClose();
            window.location.reload();
        } catch (e) {
            console.error(e);
            alert("Error al actualizar la capacidad.");
        } finally {
            setSaving(false);
        }
    }

    if (loading) return (
        <div style={{ ...styles.overlay, zIndex: 20000 }}>
            <div style={{ color: "white", fontWeight: "800" }}>Cargando configuración...</div>
        </div>
    );

    const currentTotal = towerValues[selectedTower];

    return (
        <div style={styles.overlay}>
            <div style={{
                background: "white",
                padding: "35px",
                borderRadius: "24px",
                width: "100%",
                maxWidth: "450px",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
            }} className="animate-scale-in">
                <h2 style={{ margin: "0 0 10px 0", color: "var(--primary)", fontSize: "24px", fontWeight: "900" }}>
                    ⚙️ Inventario Multi-Torre
                </h2>
                <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "25px" }}>
                    Configura la capacidad de cada torre. Los cambios se guardarán al presionar el botón final.
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
                                onClick={() => setTowerValues(prev => ({ ...prev, [selectedTower]: Math.max(0, prev[selectedTower] - 1) }))}
                                style={styles.counterBtn}
                            >-</button>
                            <input
                                type="text"
                                value={formatValue(currentTotal)}
                                onChange={handleTotalChange}
                                style={styles.input}
                                placeholder="0"
                            />
                            <button
                                onClick={() => setTowerValues(prev => ({ ...prev, [selectedTower]: prev[selectedTower] + 1 }))}
                                style={styles.counterBtn}
                            >+</button>
                        </div>
                    </div>

                    <div style={{ fontSize: "12px", color: "#64748b", background: "#f1f5f9", padding: "12px", borderRadius: "8px", lineHeight: "1.4" }}>
                        💡 <strong>Lógica de Guardado:</strong><br />
                        Puedes navegar entre las torres y ajustar sus números. Solo al hacer clic en <strong>Aplicar Cambios</strong> se actualizarán todas simultáneamente en la base de datos.
                    </div>
                </div>

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
                        {saving ? "Procesando Lote..." : "Aplicar Cambios"}
                    </button>
                </div>
            </div>
        </div>
    );
}

const styles = {
    overlay: {
        position: "fixed" as const,
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
    },
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
