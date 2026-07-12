"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { getSpotCounts, updateSpotCounts, getAllTowers, getAccesses, renameTower } from "@/lib/actions";

type LevelConfig = Record<string, number>;

export default function SpotConfigModal({ onClose }: { onClose: () => void }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);
    const [selectedTower, setSelectedTower] = useState("T1");
    const [renamedTowers, setRenamedTowers] = useState<Record<string, string>>({});
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameInput, setRenameInput] = useState("");

    useEffect(() => {
        setIsRenaming(false);
        setRenameInput(selectedTower);
    }, [selectedTower]);
    const [towers, setTowers] = useState<string[]>(["T1", "T2", "T3"]);
    const [towerGates, setTowerGates] = useState<Record<string, string>>({});
    const [towerLevels, setTowerLevels] = useState<Record<string, LevelConfig>>({
        "T1": { "-1": 0, "-2": 0, "-3": 0 },
        "T2": { "-1": 0, "-2": 0, "-3": 0 },
        "T3": { "-1": 0, "-2": 0, "-3": 0 }
    });
    const [availableGates, setAvailableGates] = useState<{ id: string; name: string }[]>([]);
    
    // Add Tower UI State
    const [isAddingTower, setIsAddingTower] = useState(false);
    const [newTowerName, setNewTowerName] = useState("");
    const [newTowerGateId, setNewTowerGateId] = useState("");

    // Add Level UI State
    const [newLevelName, setNewLevelName] = useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        async function loadInitial() {
            setLoading(true);
            try {
                // Fetch accesses/gates
                const gatesData = await getAccesses();
                setAvailableGates(gatesData || []);
                if (gatesData && gatesData.length > 0) {
                    setNewTowerGateId(gatesData[0].id);
                }

                // Fetch dynamic towers
                const dbTowers = await getAllTowers();
                setTowerGates(dbTowers);
                
                const uniqueTowerList = Object.keys(dbTowers);
                setTowers(uniqueTowerList);

                // Fetch levels for each tower
                const levelsMap: Record<string, LevelConfig> = {};
                for (const t of uniqueTowerList) {
                    const counts = await getSpotCounts(t);
                    levelsMap[t] = counts.levels || { "-1": 0, "-2": 0, "-3": 0 };
                }
                setTowerLevels(levelsMap);
                
                if (uniqueTowerList.length > 0) {
                    setSelectedTower(uniqueTowerList[0]);
                }
            } catch (e) {
                console.error("Error loading towers configuration:", e);
            } finally {
                setLoading(false);
            }
        }
        loadInitial();
    }, []);

    const currentLevels = towerLevels[selectedTower] || {};
    const sortedLevelKeys = Object.keys(currentLevels).sort((a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        if (!isNaN(numA) && !isNaN(numB)) {
            return numB - numA; // Descending
        }
        return a.localeCompare(b);
    });

    const currentTotal = Object.values(currentLevels).reduce((sum, val) => sum + val, 0);

    const handleLevelChange = (lvl: string, val: string) => {
        const rawValue = val.replace(/\./g, "");
        const numValue = parseInt(rawValue);
        setTowerLevels(prev => ({
            ...prev,
            [selectedTower]: {
                ...prev[selectedTower],
                [lvl]: isNaN(numValue) ? 0 : Math.max(0, numValue)
            }
        }));
    };

    const handleIncrement = (lvl: string, amount: number) => {
        setTowerLevels(prev => ({
            ...prev,
            [selectedTower]: {
                ...prev[selectedTower],
                [lvl]: Math.max(0, (prev[selectedTower]?.[lvl] || 0) + amount)
            }
        }));
    };

    // Towers CRUD
    const handleAddTower = () => {
        const cleanedName = newTowerName.trim().toUpperCase();
        if (!cleanedName) return alert("Ingresa un nombre para la torre");
        if (towers.includes(cleanedName)) return alert("Esta torre ya existe");

        setTowers(prev => [...prev, cleanedName]);
        setTowerGates(prev => ({ ...prev, [cleanedName]: "" }));
        setTowerLevels(prev => ({
            ...prev,
            [cleanedName]: { "-1": 0, "-2": 0, "-3": 0 }
        }));
        setSelectedTower(cleanedName);
        
        // Reset state
        setNewTowerName("");
        setIsAddingTower(false);
    };

    const handleRenameSave = () => {
        const cleaned = renameInput.trim().toUpperCase();
        if (!cleaned) return alert("El nombre no puede estar vacío");
        if (cleaned === selectedTower) {
            setIsRenaming(false);
            return;
        }
        if (towers.includes(cleaned)) return alert("Ese nombre de torre ya existe");

        setTowers(prev => prev.map(t => t === selectedTower ? cleaned : t));
        setTowerLevels(prev => {
            const copy = { ...prev };
            if (selectedTower in copy) {
                copy[cleaned] = copy[selectedTower];
                delete copy[selectedTower];
            }
            return copy;
        });
        setTowerGates(prev => {
            const copy = { ...prev };
            if (selectedTower in copy) {
                copy[cleaned] = copy[selectedTower];
                delete copy[selectedTower];
            }
            return copy;
        });

        setRenamedTowers(prev => {
            const originalSource = Object.keys(prev).find(key => prev[key] === selectedTower) || selectedTower;
            return {
                ...prev,
                [originalSource]: cleaned
            };
        });

        setSelectedTower(cleaned);
        setIsRenaming(false);
    };

    const handleDeleteTower = async () => {
        if (!await confirm(`¿Estás seguro de eliminar completamente la ${selectedTower === "T1" ? "Torre 1" : selectedTower === "T2" ? "Torre 2" : selectedTower === "T3" ? "Torre 3" : selectedTower}? Se eliminarán todos sus casilleros.`)) {
            return;
        }

        // Set all levels count to 0 (which deletes all spots on save)
        const clearedLevels: LevelConfig = {};
        for (const k of Object.keys(currentLevels)) {
            clearedLevels[k] = 0;
        }

        setTowerLevels(prev => ({
            ...prev,
            [selectedTower]: clearedLevels
        }));

        // Remove from list
        const nextTowers = towers.filter(t => t !== selectedTower);
        setTowers(nextTowers);
        if (nextTowers.length > 0) {
            setSelectedTower(nextTowers[0]);
        }
    };

    // Levels CRUD
    const handleAddLevel = () => {
        const cleanedLvl = newLevelName.trim();
        if (!cleanedLvl) return alert("Ingresa el nombre del nivel");
        if (Object.keys(currentLevels).includes(cleanedLvl)) return alert("Este nivel ya existe en esta torre");

        setTowerLevels(prev => ({
            ...prev,
            [selectedTower]: {
                ...prev[selectedTower],
                [cleanedLvl]: 0
            }
        }));
        setNewLevelName("");
    };

    const handleDeleteLevel = async (lvl: string) => {
        if (currentLevels[lvl] > 0) {
            if (!await confirm(`El nivel ${lvl} tiene ${currentLevels[lvl]} sitios configurados. Si lo eliminas, estos sitios serán borrados. ¿Confirmar?`)) {
                return;
            }
        }

        setTowerLevels(prev => {
            const nextLvs = { ...prev[selectedTower] };
            delete nextLvs[lvl];
            return {
                ...prev,
                [selectedTower]: nextLvs
            };
        });
    };

    async function handleSave() {
        setSaving(true);
        try {
            // First, process any renames
            for (const [oldName, newName] of Object.entries(renamedTowers)) {
                await renameTower(oldName, newName);
            }

            // Get all towers configured (even deleted ones need to be sent with empty config to remove spots)
            const allConfiguredTowers = Array.from(new Set([...towers, ...Object.keys(towerLevels)]));
            
            for (const t of allConfiguredTowers) {
                const isDeleted = !towers.includes(t);
                const levelsConfig = isDeleted ? {} : (towerLevels[t] || {});
                const gateId = towerGates[t];
                
                await updateSpotCounts(levelsConfig, t, gateId);
            }

            await alert(`Configuración de Torres y Niveles guardada exitosamente.`);
            onClose();
            window.location.reload();
        } catch (e) {
            console.error(e);
            alert("Error al actualizar la capacidad de los niveles.");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        if (!mounted) return null;
        return createPortal(
            <div style={{ ...styles.overlay, zIndex: 20000 }}>
                <div style={{ color: "white", fontWeight: "800" }}>Cargando configuración...</div>
            </div>,
            document.body
        );
    }

    if (!mounted) return null;

    return createPortal(
        <div style={styles.overlay}>
            <div style={{
                background: "white",
                padding: "35px",
                borderRadius: "24px",
                width: "100%",
                maxWidth: "500px",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                maxHeight: "85vh",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "20px"
            }} className="animate-scale-in">
                
                <div>
                    <h2 style={{ margin: "0 0 5px 0", color: "var(--primary)", fontSize: "22px", fontWeight: "900" }}>
                        ⚙️ Inventario de Torres y Niveles
                    </h2>
                    <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>
                        Gestiona torres, niveles y la capacidad de estacionamientos de cada sector.
                    </p>
                </div>

                {/* Tab Selector & Add Tower Button */}
                <div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
                        {towers.map(t => (
                            <button
                                key={t}
                                onClick={() => {
                                    setSelectedTower(t);
                                    setIsAddingTower(false);
                                }}
                                style={{
                                    padding: "8px 16px",
                                    borderRadius: "8px",
                                    border: selectedTower === t && !isAddingTower ? "2px solid var(--primary)" : "2px solid #e2e8f0",
                                    background: selectedTower === t && !isAddingTower ? "#eff6ff" : "white",
                                    color: selectedTower === t && !isAddingTower ? "var(--primary)" : "#64748b",
                                    fontWeight: "800",
                                    fontSize: "13px",
                                    cursor: "pointer",
                                    transition: "all 0.2s"
                                }}
                                type="button"
                            >
                                {t === "T1" ? "Torre 1" : t === "T2" ? "Torre 2" : t === "T3" ? "Torre 3" : t}
                            </button>
                        ))}
                        <button
                            onClick={() => setIsAddingTower(true)}
                            style={{
                                padding: "8px 16px",
                                borderRadius: "8px",
                                border: isAddingTower ? "2px solid var(--success)" : "2px dashed #cbd5e1",
                                background: isAddingTower ? "#f0fdf4" : "white",
                                color: isAddingTower ? "var(--success)" : "#64748b",
                                fontWeight: "800",
                                fontSize: "13px",
                                cursor: "pointer",
                                transition: "all 0.2s"
                            }}
                            type="button"
                        >
                            ➕ Nueva Torre
                        </button>
                    </div>
                </div>

                {isAddingTower ? (
                    /* Add Tower Box */
                    <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "18px", borderRadius: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <span style={{ fontWeight: "800", color: "#166534", fontSize: "14px" }}>Crear Nueva Torre</span>
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{ fontSize: "12px", color: "#166534", fontWeight: "700" }}>Identificador de Torre (ej: T4, Torre Norte):</label>
                            <input
                                type="text"
                                value={newTowerName}
                                onChange={(e) => setNewTowerName(e.target.value)}
                                style={{ padding: "8px 12px", border: "1px solid #bbf7d0", borderRadius: "8px", outline: "none", fontSize: "14px", fontWeight: "700" }}
                                placeholder="T4"
                            />
                        </div>



                        <div style={{ display: "flex", gap: "10px", marginTop: "5px" }}>
                            <button
                                onClick={() => setIsAddingTower(false)}
                                style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#e2e8f0", color: "#475569", fontWeight: "700", cursor: "pointer", fontSize: "12px" }}
                                type="button"
                            >Cancelar</button>
                            <button
                                onClick={handleAddTower}
                                style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "var(--success)", color: "white", fontWeight: "800", cursor: "pointer", fontSize: "12px", flex: 1 }}
                                type="button"
                            >Crear Torre</button>
                        </div>
                    </div>
                ) : (
                    /* Levels Form */
                    <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                                {isRenaming ? (
                                    <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                                        <input
                                            type="text"
                                            value={renameInput}
                                            onChange={(e) => setRenameInput(e.target.value)}
                                            style={{
                                                padding: "4px 8px",
                                                border: "2px solid var(--primary)",
                                                borderRadius: "6px",
                                                fontWeight: "800",
                                                fontSize: "13px",
                                                outline: "none",
                                                width: "140px"
                                            }}
                                        />
                                        <button
                                            onClick={handleRenameSave}
                                            style={{ padding: "4px 8px", background: "var(--success)", color: "white", border: "none", borderRadius: "6px", fontWeight: "800", cursor: "pointer", fontSize: "12px" }}
                                            type="button"
                                        >💾</button>
                                        <button
                                            onClick={() => setIsRenaming(false)}
                                            style={{ padding: "4px 8px", background: "#cbd5e1", color: "#475569", border: "none", borderRadius: "6px", fontWeight: "800", cursor: "pointer", fontSize: "12px" }}
                                            type="button"
                                        >❌</button>
                                    </div>
                                ) : (
                                    <span style={{ fontSize: "15px", fontWeight: "800", color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
                                        Configurando: {selectedTower === "T1" ? "Torre 1" : selectedTower === "T2" ? "Torre 2" : selectedTower === "T3" ? "Torre 3" : selectedTower}
                                        <button
                                            onClick={() => {
                                                setRenameInput(selectedTower);
                                                setIsRenaming(true);
                                            }}
                                            style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, fontSize: "12px", opacity: 0.6 }}
                                            title="Renombrar esta torre"
                                            type="button"
                                            onMouseOver={(e) => e.currentTarget.style.opacity = "1"}
                                            onMouseOut={(e) => e.currentTarget.style.opacity = "0.6"}
                                        >
                                            ✏️
                                        </button>
                                    </span>
                                )}
                                <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600" }}>
                                    Puerta asociada: {
                                        availableGates.find(g => g.id === towerGates[selectedTower])?.name || 
                                        (selectedTower === "T1" ? "Puerta 1" : 
                                         selectedTower === "T2" ? "Puerta 2" : 
                                         selectedTower === "T3" ? "Puerta 3" : 
                                         "Sin restringir (Acceso Universal)")
                                    }
                                </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "13px", fontWeight: "800", color: "var(--primary)", background: "#dbeafe", padding: "4px 10px", borderRadius: "10px" }}>
                                    Total: {currentTotal} sitios
                                </span>
                                <button
                                    onClick={handleDeleteTower}
                                    style={{ padding: "6px", background: "#fef2f2", color: "#ef4444", border: "none", borderRadius: "6px", cursor: "pointer" }}
                                    title="Eliminar esta Torre"
                                    type="button"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>

                        {/* Level Inputs */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "250px", overflowY: "auto", paddingRight: "5px" }}>
                            {sortedLevelKeys.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "20px", color: "#94a3b8", fontSize: "13px", background: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
                                    No hay niveles creados para esta torre. ¡Agrega uno abajo!
                                </div>
                            ) : (
                                sortedLevelKeys.map(lvl => (
                                    <div key={lvl} style={{ background: "#f8fafc", padding: "10px 15px", borderRadius: "14px", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            <button
                                                onClick={() => handleDeleteLevel(lvl)}
                                                style={{ border: "none", background: "transparent", cursor: "pointer", padding: "2px", opacity: 0.5 }}
                                                title="Eliminar este Nivel"
                                                type="button"
                                                onMouseOver={(e) => e.currentTarget.style.opacity = "1"}
                                                onMouseOut={(e) => e.currentTarget.style.opacity = "0.5"}
                                            >
                                                ❌
                                            </button>
                                            <span style={{ fontWeight: "700", color: "#475569", fontSize: "14px" }}>
                                                Nivel {lvl}
                                            </span>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <button
                                                onClick={() => handleIncrement(lvl, -1)}
                                                style={styles.counterBtn}
                                                type="button"
                                            >-</button>
                                            <input
                                                type="text"
                                                value={currentLevels[lvl]}
                                                onChange={(e) => handleLevelChange(lvl, e.target.value)}
                                                style={styles.input}
                                                placeholder="0"
                                            />
                                            <button
                                                onClick={() => handleIncrement(lvl, 1)}
                                                style={styles.counterBtn}
                                                type="button"
                                            >+</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Add Level Form */}
                        <div style={{ display: "flex", gap: "10px", background: "#f1f5f9", padding: "10px", borderRadius: "12px", alignItems: "center" }}>
                            <input
                                type="text"
                                value={newLevelName}
                                onChange={(e) => setNewLevelName(e.target.value)}
                                placeholder="Nivel (ej: -4, 1, 2)"
                                style={{ flex: 1, padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "13px", outline: "none" }}
                            />
                            <button
                                onClick={handleAddLevel}
                                style={{ padding: "8px 16px", background: "var(--primary)", color: "white", border: "none", borderRadius: "8px", fontWeight: "800", cursor: "pointer", fontSize: "13px" }}
                                type="button"
                            >
                                ➕ Nivel
                            </button>
                        </div>
                    </div>
                )}

                <div style={{ fontSize: "12px", color: "#64748b", background: "#f8fafc", padding: "12px", borderRadius: "8px", lineHeight: "1.4" }}>
                    💡 <strong>Lógica de Guardado:</strong><br />
                    Puedes configurar múltiples torres y niveles en memoria. Al presionar <strong>Aplicar Cambios</strong> se guardará y sincronizará la base de datos de forma segura.
                </div>

                {/* Bottom Buttons */}
                <div style={{ display: "flex", gap: "12px", marginTop: "10px" }}>
                    <button
                        onClick={onClose}
                        style={{ ...styles.actionBtn, background: "#f1f5f9", color: "#64748b" }}
                        type="button"
                    >Cancelar</button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{ ...styles.actionBtn, background: "var(--primary)", color: "white", flex: 2 }}
                        type="button"
                    >
                        {saving ? "Guardando Cambios..." : "Aplicar Cambios"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
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
        zIndex: 20000,
        padding: "40px 20px",
        overflowY: "auto" as const
    },
    counterBtn: {
        width: "32px",
        height: "32px",
        borderRadius: "8px",
        border: "none",
        background: "white",
        color: "var(--primary)",
        fontWeight: "900",
        fontSize: "16px",
        cursor: "pointer",
        boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
    },
    input: {
        width: "50px",
        border: "none",
        background: "transparent",
        textAlign: "center" as const,
        fontSize: "18px",
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
