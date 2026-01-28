
"use client";

import { useState } from "react";
import { processVehicleEntry, processVehicleExit, AccessResult, occupySpot, freeSpot, updateSpotAssignment, removeSpotAssignment } from "@/lib/actions";
import { useRouter as useNextRouter } from "next/navigation";
import ReservationModal from "@/components/ReservationModal";
import AssignmentModal from "@/components/AssignmentModal";
import ReleaseModal from "@/components/ReleaseModal";
import SpotAdminModal from "@/components/SpotAdminModal";
import { useAuth } from "@/lib/AuthContext";

type Spot = {
    id: number;
    code: string;
    type: "RESERVED" | "GENERAL";
    isOccupied: boolean;
    ownerPlate?: string;
    ownerName?: string;
    ownerPhone?: string;
    vacationStart?: string;
    vacationEnd?: string;
    currentPlate?: string;
    entryTime?: string;
    monthlyFee?: number;
    accessId?: string;
};

type Gate = {
    id: string;
    name: string;
};

type Activity = {
    id: string;
    licensePlate: string;
    entryTime: Date;
    exitTime: Date | null;
    spotId: number | null;
    entryType: string;
    cost?: number | null;
    spotCode?: string | null;
}

export default function ParkingGrid({
    initialSpots,
    recentActivity,
    chargingEnabled,
    todayStats,
    gates
}: {
    initialSpots: Spot[],
    recentActivity: Activity[],
    chargingEnabled: boolean,
    todayStats: { revenue: number, pending: number, count: number },
    gates: Gate[]
}) {
    const [spots, setSpots] = useState(initialSpots);

    // Entry Simulation State
    const [plateInput, setPlateInput] = useState("");
    const [message, setMessage] = useState("");

    // Exit Simulation State
    const [exitPlateInput, setExitPlateInput] = useState("");
    const [exitMessage, setExitMessage] = useState("");

    const [loading, setLoading] = useState(false);
    const [editingSpot, setEditingSpot] = useState<Spot | null>(null);

    // New state for General Assignment Modal
    const [assignmentSpot, setAssignmentSpot] = useState<Spot | null>(null);

    // New state for Release Modal
    const [releasingSpot, setReleasingSpot] = useState<Spot | null>(null);

    const [activityDetail, setActivityDetail] = useState<Activity | null>(null);
    const [isMapExpanded, setIsMapExpanded] = useState(false);
    const [hasMovement, setHasMovement] = useState(false); // Track changes for refresh

    const [filter, setFilter] = useState<"ALL" | "FREE" | "OCCUPIED" | "RESERVED">("ALL");
    const [adminEditingSpot, setAdminEditingSpot] = useState<Spot | null>(null);

    const { isAdmin, assignedAccessId, isSuperAdmin } = useAuth();
    const [selectedAccessId, setSelectedAccessId] = useState<string | "ALL">(assignedAccessId || "ALL");

    const router = useNextRouter();

    async function handleSimulateEntry() {
        if (!plateInput) return;
        setLoading(true);
        setMessage("Procesando...");
        try {
            const actualAccessId = selectedAccessId === "ALL" ? (assignedAccessId || "gate-a") : selectedAccessId;
            const result: AccessResult = await processVehicleEntry(plateInput, actualAccessId);
            if (result.allowed && result.entryType === "AUTOMATIC" && result.spot) {
                setMessage(result.message);
                updateSpotStatus(result.spot.id, true, plateInput);
                window.location.reload();
            } else {
                setMessage(result.message);
            }
        } catch (e: any) {
            console.error("Entry Error:", e);
            setMessage(`Error: ${e.message || "Desconocido"}`);
        }
        setLoading(false);
    }

    async function handleSimulateExit() {
        if (!exitPlateInput) return;
        setLoading(true);
        setExitMessage("Procesando Salida...");
        try {
            const actualAccessId = selectedAccessId === "ALL" ? (assignedAccessId || "gate-a") : selectedAccessId;
            const result = await processVehicleExit(exitPlateInput, actualAccessId);
            if (result.success) {
                let summaryMsg = "";
                const duration = result.durationSeconds || 0;
                const h = Math.floor(duration / 3600);
                const m = Math.floor((duration % 3600) / 60);
                const s = Math.floor(duration % 60);
                const timeStr = `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm ' : ''}${s}s`;

                if (chargingEnabled && result.cost && result.cost > 0) {
                    summaryMsg = ` | TIEMPO: ${timeStr} | TOTAL: $${result.cost.toLocaleString('es-CL')}`;
                } else if (duration > 0) {
                    summaryMsg = ` | TIEMPO DE ESTADÍA: ${timeStr}`;
                }

                setExitMessage(result.message + summaryMsg);
                setTimeout(() => window.location.reload(), 2000);
            } else {
                setExitMessage(result.message);
            }
        } catch (e: any) {
            console.error("Exit Error:", e);
            setExitMessage(`Error: ${e.message || "Desconocido"}`);
        }
        setLoading(false);
    }

    async function handleSpotClick(spot: Spot) {
        if (isAdmin) {
            setAdminEditingSpot(spot);
            return;
        }

        if (spot.isOccupied) {
            setReleasingSpot(spot);
        } else {
            // Empty Spot Logic
            if (spot.type === "RESERVED") {
                // Open Modal for Assignment/Edit
                setEditingSpot(spot);
            } else {
                // General Spot - Simple Visit Assignment
                setAssignmentSpot(spot);
            }
        }
    }
    async function handleActivityClick(activity: Activity) {
        if (activity.cost || activity.exitTime) {
            setActivityDetail(activity);
        }
    }

    async function handleRelease() {
        if (!releasingSpot) return { success: false, cost: 0, durationInSeconds: 0 };
        try {
            const result = await freeSpot(releasingSpot.id);
            if (result.success) {
                updateSpotStatus(releasingSpot.id, false);
                setHasMovement(true);
                // We don't reload here, we wait for the modal to be closed via its Result view
                return result;
            }
            return { success: false, cost: 0, durationInSeconds: 0 };
        } catch (e) {
            console.error(e);
            alert("Error liberando sitio");
            return { success: false, cost: 0, durationInSeconds: 0 };
        }
    }

    async function handleSaveReservation(data: { name: string; plate: string; phone: string; vacationStart?: Date | null; vacationEnd?: Date | null }) {
        if (!editingSpot) return;

        try {
            await updateSpotAssignment(editingSpot.id, data);
            window.location.reload();
        } catch (e) {
            console.error(e);
            alert("Error actualizando reserva.");
        } finally {
            setEditingSpot(null);
        }
    }

    async function handleDeleteAssignment() {
        if (!editingSpot) return;
        try {
            await removeSpotAssignment(editingSpot.id);
            window.location.reload();
        } catch (e) {
            console.error(e);
            alert("Error eliminando asignación");
        } finally {
            setEditingSpot(null);
        }
    }

    async function handleAssignVisitor(plate: string) {
        if (!editingSpot) return;
        try {
            await occupySpot(editingSpot.id, plate, "MANUAL");
            updateSpotStatus(editingSpot.id, true, plate);
            window.location.reload();
        } catch (e) {
            console.error(e);
            alert("Error asignando visita");
        } finally {
            setEditingSpot(null);
        }
    }

    async function handleGeneralAssignment(plate: string) {
        if (!assignmentSpot) return;
        const finalPlate = plate || "VISITA";
        try {
            await occupySpot(assignmentSpot.id, finalPlate, "MANUAL");
            updateSpotStatus(assignmentSpot.id, true, finalPlate);
            window.location.reload();
        } catch (e) {
            console.error(e);
            alert("Error asignando sitio general");
        } finally {
            setAssignmentSpot(null);
        }
    }

    function updateSpotStatus(id: number, occupied: boolean, plate?: string) {
        setSpots(prev => prev.map(s => s.id === id ? {
            ...s,
            isOccupied: occupied,
            currentPlate: occupied ? plate : undefined,
            entryTime: occupied ? new Date().toISOString() : undefined
        } : s));
    }

    // filtering logic
    const gateFilteredSpots = selectedAccessId === "ALL"
        ? spots
        : spots.filter(s => s.accessId === selectedAccessId);

    const filteredSpots = gateFilteredSpots.filter(s => {
        if (filter === "FREE") return !s.isOccupied;
        if (filter === "OCCUPIED") return s.isOccupied;
        if (filter === "RESERVED") return s.type === "RESERVED";
        return true;
    });

    const styles = {
        mainContainer: {
            display: "grid",
            gridTemplateColumns: "1fr 350px",
            gap: "30px",
            alignItems: "start"
        },
        controlPanel: {
            padding: "24px",
            background: "white",
            borderRadius: "var(--border-radius)",
            boxShadow: "var(--shadow)",
            marginBottom: "30px"
        },
        panelTitle: {
            fontSize: "18px",
            fontWeight: "700",
            color: "var(--primary)",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "10px"
        },
        input: {
            padding: "12px 16px",
            borderRadius: "8px",
            border: "2px solid #e2e8f0",
            fontSize: "16px",
            marginBottom: "12px",
            width: "100%",
            outline: "none",
            transition: "border-color 0.2s",
            fontFamily: "monospace",
            fontWeight: "700",
            letterSpacing: "2px",
            textTransform: "uppercase" as const
        },
        button: (color: string) => ({
            padding: "12px",
            background: color,
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "15px",
            fontWeight: "600",
            width: "100%",
            transition: "transform 0.1s, opacity 0.2s",
            boxShadow: "0 4px 0 rgba(0,0,0,0.1)"
        }),
        grid: {
            display: "grid",
            gridTemplateColumns: "repeat(10, 1fr)",
            gap: "10px",
            background: "#f8fafc",
            padding: "20px",
            borderRadius: "var(--border-radius)",
            border: "1px solid #e2e8f0"
        },
        spot: (isOccupied: boolean, type: string) => {
            let bgColor = "white";
            let color = "var(--primary)";
            let borderColor = "#e2e8f0";

            if (isOccupied) {
                bgColor = "#fee2e2";
                color = "#991b1b";
                borderColor = "#fecaca";
            } else if (type === "RESERVED") {
                bgColor = "#e0f2fe";
                color = "#075985";
                borderColor = "#bae6fd";
            } else {
                bgColor = "#f0fdf4";
                color = "#166534";
                borderColor = "#bbf7d0";
            }

            return {
                height: "100px",
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                justifyContent: "center",
                border: `2px solid ${borderColor}`,
                borderRadius: "12px",
                fontSize: "12px",
                fontWeight: "700",
                backgroundColor: bgColor,
                color: color,
                cursor: "pointer",
                textAlign: "center" as const,
                padding: "8px",
                transition: "all 0.2s ease",
                position: "relative" as const,
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
            };
        },
        legendItem: (color: string) => ({
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
            fontWeight: "600",
            color: "#64748b"
        }),
        legendColor: (color: string) => ({
            width: "16px",
            height: "16px",
            borderRadius: "4px",
            backgroundColor: color,
            border: "1px solid rgba(0,0,0,0.1)"
        })
    };

    return (
        <div style={styles.mainContainer}>

            {/* Left Column: Grid and Legend */}
            <div>
                <div style={{ ...styles.controlPanel, marginBottom: "20px" }}>
                    <div style={{ ...styles.panelTitle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span>🗺️</span> Layout de Estacionamientos
                            {isAdmin && (
                                <select
                                    value={selectedAccessId}
                                    onChange={(e) => setSelectedAccessId(e.target.value)}
                                    style={{
                                        marginLeft: "15px",
                                        padding: "4px 8px",
                                        borderRadius: "6px",
                                        border: "2px solid #e2e8f0",
                                        fontSize: "13px",
                                        fontWeight: "700",
                                        color: "var(--primary)"
                                    }}
                                >
                                    {isSuperAdmin && <option value="ALL">TODOS LOS ACCESOS</option>}
                                    {gates.map(g => (
                                        <option key={g.id} value={g.id}>{g.name.toUpperCase()}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <button
                            onClick={() => setIsMapExpanded(true)}
                            style={{
                                padding: "6px 12px",
                                background: "var(--primary)",
                                color: "white",
                                border: "none",
                                borderRadius: "8px",
                                fontSize: "11px",
                                fontWeight: "800",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                transition: "transform 0.2s"
                            }}
                            onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.05)"}
                            onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
                        >
                            🔍 Vista General
                        </button>
                    </div>

                    {/* Filter Bar */}
                    <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
                        <FilterButton label="Todos" active={filter === "ALL"} onClick={() => setFilter("ALL")} count={gateFilteredSpots.length} />
                        <FilterButton label="Libres" active={filter === "FREE"} onClick={() => setFilter("FREE")} count={gateFilteredSpots.filter(s => !s.isOccupied).length} />
                        <FilterButton label="Ocupados" active={filter === "OCCUPIED"} onClick={() => setFilter("OCCUPIED")} count={gateFilteredSpots.filter(s => s.isOccupied).length} />
                        <FilterButton label="Reservados" active={filter === "RESERVED"} onClick={() => setFilter("RESERVED")} count={gateFilteredSpots.filter(s => s.type === "RESERVED").length} />
                    </div>

                    <div style={styles.grid}>
                        {filteredSpots.map((spot) => (
                            <div
                                key={spot.id}
                                style={styles.spot(spot.isOccupied, spot.type)}
                                className="spot-card"
                                onClick={() => handleSpotClick(spot)}
                                title={spot.type === "RESERVED" ? "Click para editar reserva o liberar" : "Click para asignar visita"}
                            >
                                <div style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: "6px",
                                    background: spot.type === "RESERVED" ? "#0ea5e9" : "#22c55e",
                                    borderRadius: "10px 10px 0 0"
                                }} />

                                <div style={{ position: "absolute", top: "10px", left: "8px", opacity: 0.5, fontSize: "10px" }}>
                                    {spot.type === "RESERVED" ? "R" : "G"}
                                </div>

                                <span style={{ fontSize: "18px", fontWeight: "900", marginBottom: "4px", marginTop: "8px" }}>{spot.code}</span>

                                {spot.isOccupied ? (
                                    <>
                                        <div style={{
                                            background: "#ef4444",
                                            color: "white",
                                            padding: "2px 6px",
                                            borderRadius: "4px",
                                            fontSize: "11px",
                                            fontWeight: "800"
                                        }}>
                                            {spot.currentPlate || "???"}
                                        </div>

                                        <div style={{
                                            fontSize: "9px",
                                            marginTop: "4px",
                                            fontWeight: "800",
                                            color: "#991b1b",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "3px"
                                        }}>
                                            ⏱️ {spot.entryTime ? formatTimeElapsed(spot.entryTime) : "???"}
                                        </div>

                                        {spot.type === "RESERVED" && spot.ownerName && (
                                            <span style={{ fontSize: "10px", marginTop: "4px", opacity: 0.8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                                                {spot.ownerName.split(' ')[0]}
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                        {spot.type === "RESERVED" ? (
                                            <>
                                                <span style={{ fontSize: "10px", opacity: 0.7 }}>{spot.ownerName ? spot.ownerPlate : "LIBRE"}</span>
                                                {spot.vacationStart && spot.vacationEnd && (
                                                    (() => {
                                                        const now = new Date();
                                                        const start = new Date(spot.vacationStart);
                                                        const end = new Date(spot.vacationEnd);
                                                        if (now >= start && now <= end) {
                                                            return <span style={{ fontSize: "8px", background: "#f97316", color: "white", padding: "1px 4px", borderRadius: "3px", marginTop: "2px" }}>VACACIONES</span>;
                                                        }
                                                        return null;
                                                    })()
                                                )}
                                            </>
                                        ) : (
                                            <span style={{ fontSize: "10px", opacity: 0.5, fontWeight: "500" }}>Disponible</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Legend */}
                    <div style={{ display: "flex", gap: "20px", marginTop: "20px", padding: "10px", borderTop: "1px solid #f1f5f9" }}>
                        <div style={styles.legendItem("")}>
                            <div style={styles.legendColor("#f0fdf4")}></div>
                            <span>General</span>
                        </div>
                        <div style={styles.legendItem("")}>
                            <div style={styles.legendColor("#e0f2fe")}></div>
                            <span>Abonado</span>
                        </div>
                        <div style={styles.legendItem("")}>
                            <div style={styles.legendColor("#fee2e2")}></div>
                            <span>Ocupado</span>
                        </div>
                        <div style={styles.legendItem("")}>
                            <div style={styles.legendColor("#f97316")}></div>
                            <span>Vacaciones</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column: Controls and Activity */}
            <aside>
                {/* Live Statistics Widget */}
                <div style={{
                    ...styles.controlPanel,
                    background: "linear-gradient(135deg, var(--primary) 0%, #1e40af 100%)",
                    color: "white",
                    padding: "20px"
                }}>
                    <div style={{ ...styles.panelTitle, color: "white", borderBottom: "1px solid rgba(255,255,255,0.2)", paddingBottom: "10px", marginBottom: "15px" }}>
                        <span>⚡</span> {chargingEnabled ? "Rendimiento Hoy" : "Actividad Logística Hoy"}
                    </div>
                    {chargingEnabled ? (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                            <div>
                                <div style={{ fontSize: "11px", opacity: 0.8, fontWeight: "700", textTransform: "uppercase" }}>Recaudado</div>
                                <div style={{ fontSize: "20px", fontWeight: "900" }}>${todayStats.revenue.toLocaleString('es-CL')}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: "11px", opacity: 0.8, fontWeight: "700", textTransform: "uppercase" }}>En Tránsito</div>
                                <div style={{ fontSize: "20px", fontWeight: "900", color: "#fbbf24" }}>${todayStats.pending.toLocaleString('es-CL')}</div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ textAlign: "center", padding: "10px 0" }}>
                            <div style={{ fontSize: "32px", fontWeight: "950" }}>{todayStats.count}</div>
                            <div style={{ fontSize: "12px", opacity: 0.9, fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px" }}>Movimientos Totales</div>
                        </div>
                    )}
                    {chargingEnabled && (
                        <div style={{ marginTop: "15px", fontSize: "12px", background: "rgba(255,255,255,0.1)", padding: "8px", borderRadius: "8px", textAlign: "center", fontWeight: "600" }}>
                            {todayStats.count} Movimientos registrados hoy
                        </div>
                    )}
                </div>

                {/* Entry Camera */}
                <div style={styles.controlPanel}>
                    <div style={styles.panelTitle}>
                        <span>📸</span> Cámara ENTRADA
                    </div>
                    <input
                        type="text"
                        value={plateInput}
                        onChange={(e) => setPlateInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === "Enter" && handleSimulateEntry()}
                        style={styles.input}
                        placeholder="ABC-123"
                    />
                    <button
                        onClick={handleSimulateEntry}
                        disabled={loading}
                        style={{ ...styles.button("var(--primary)"), opacity: loading ? 0.7 : 1 }}
                    >
                        {loading ? "Procesando..." : "REGISTRAR INGRESO"}
                    </button>
                    {message && <div style={{ marginTop: "12px", padding: "10px", borderRadius: "6px", fontSize: "13px", fontWeight: "600", background: "#f8fafc", borderLeft: "4px solid var(--accent)", color: "#1e293b" }}>{message}</div>}
                </div>

                {/* Exit Camera */}
                <div style={styles.controlPanel}>
                    <div style={styles.panelTitle}>
                        <span>🏁</span> Cámara SALIDA
                    </div>
                    <input
                        type="text"
                        value={exitPlateInput}
                        onChange={(e) => setExitPlateInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === "Enter" && handleSimulateExit()}
                        style={styles.input}
                        placeholder="ABC-123"
                    />
                    <button
                        onClick={handleSimulateExit}
                        disabled={loading}
                        style={{ ...styles.button("var(--secondary)"), opacity: loading ? 0.7 : 1 }}
                    >
                        {loading ? "Procesando..." : "REGISTRAR SALIDA"}
                    </button>
                    {exitMessage && <div style={{ marginTop: "12px", padding: "10px", borderRadius: "6px", fontSize: "13px", fontWeight: "600", background: "#f8fafc", borderLeft: "4px solid var(--secondary)", color: "#1e293b" }}>{exitMessage}</div>}
                </div>

                {/* Recent Activity Log */}
                <div style={{ ...styles.controlPanel, padding: "20px 0" }}>
                    <div style={{ ...styles.panelTitle, padding: "0 20px" }}>
                        <span>📜</span> Actividad Reciente
                    </div>
                    <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                        {recentActivity.length === 0 ? (
                            <div style={{ padding: "20px", textAlign: "center", color: "#94a3b8", fontSize: "14px" }}>Sin movimientos recientes</div>
                        ) : (
                            recentActivity.map((activity) => (
                                <div
                                    key={activity.id}
                                    onClick={() => handleActivityClick(activity)}
                                    style={{
                                        padding: "14px 20px",
                                        borderBottom: "1px solid #f1f5f9",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        cursor: (activity.cost || activity.exitTime) ? "pointer" : "default",
                                        transition: "background 0.2s"
                                    }}
                                    className="activity-row"
                                >
                                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                                        <div style={{
                                            fontSize: "20px",
                                            background: activity.exitTime ? "#fef3c7" : "#dcfce7",
                                            width: "36px",
                                            height: "36px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            borderRadius: "10px"
                                        }}>
                                            {activity.exitTime ? "📤" : "📥"}
                                        </div>
                                        <div>
                                            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                                                <div style={{ fontWeight: "800", color: "var(--primary)", fontSize: "14px" }}>{activity.licensePlate}</div>
                                                <div style={{ fontSize: "10px", fontWeight: "800", color: "#64748b", background: "#f1f5f9", padding: "1px 6px", borderRadius: "4px" }}>
                                                    {activity.spotCode || "N/A"}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600" }}>
                                                {new Date(activity.entryTime).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                                {activity.exitTime && ` → ${new Date(activity.exitTime).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        {activity.cost && chargingEnabled ? (
                                            <div style={{ fontWeight: "900", color: "var(--success)", fontSize: "13px" }}>
                                                +${activity.cost.toLocaleString('es-CL')}
                                            </div>
                                        ) : (
                                            <div style={{
                                                fontSize: "10px",
                                                fontWeight: "800",
                                                color: activity.exitTime ? "#b45309" : "#15803d",
                                                background: activity.exitTime ? "#fef3c7" : "#dcfce7",
                                                padding: "2px 8px",
                                                borderRadius: "6px",
                                                textTransform: "uppercase"
                                            }}>
                                                {activity.exitTime ? "Liberado" : "En Sitio"}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </aside>

            <style jsx global>{`
        .spot-card:hover {
            transform: translateY(-4px);
            box-shadow: var(--shadow-lg) !important;
            border-color: var(--primary) !important;
        }
        .activity-row:hover {
            background-color: #f8fafc;
        }
      `}</style>

            {editingSpot && (
                <ReservationModal
                    isOpen={!!editingSpot}
                    onClose={() => setEditingSpot(null)}
                    onSave={handleSaveReservation}
                    onDelete={handleDeleteAssignment}
                    onAssignVisitor={handleAssignVisitor}
                    preFilledVisitorPlate={plateInput}
                    initialData={{
                        name: editingSpot.ownerName || "",
                        plate: editingSpot.ownerPlate || "",
                        phone: editingSpot.ownerPhone || "+569 ",
                        spotCode: editingSpot.code,
                        vacationStart: editingSpot.vacationStart,
                        vacationEnd: editingSpot.vacationEnd
                    }}
                />
            )}

            {assignmentSpot && (
                <AssignmentModal
                    isOpen={!!assignmentSpot}
                    onClose={() => setAssignmentSpot(null)}
                    onConfirm={handleGeneralAssignment}
                    spotCode={assignmentSpot.code}
                    initialPlate={plateInput || "VISITA"}
                />
            )}

            {releasingSpot && (
                <ReleaseModal
                    isOpen={!!releasingSpot}
                    onClose={() => {
                        setReleasingSpot(null);
                        if (hasMovement) {
                            setHasMovement(false);
                            window.location.reload();
                        }
                    }}
                    onRelease={handleRelease}
                    chargingEnabled={chargingEnabled}
                    spot={{
                        code: releasingSpot.code,
                        type: releasingSpot.type,
                        ownerName: releasingSpot.ownerName,
                        ownerPhone: releasingSpot.ownerPhone,
                        currentPlate: releasingSpot.currentPlate
                    }}
                />
            )}

            {activityDetail && (
                <ReleaseModal
                    isOpen={!!activityDetail}
                    onClose={() => setActivityDetail(null)}
                    onRelease={async () => ({ success: false, cost: 0, durationInSeconds: 0 })}
                    chargingEnabled={chargingEnabled}
                    spot={{
                        code: spots.find(s => s.id === activityDetail.spotId)?.code || "???",
                        type: "GENERAL",
                        currentPlate: activityDetail.licensePlate
                    }}
                    initialResult={{
                        cost: activityDetail.cost || 0,
                        durationInSeconds: activityDetail.exitTime ? (new Date(activityDetail.exitTime).getTime() - new Date(activityDetail.entryTime).getTime()) / 1000 : 0,
                        isHistory: true
                    }}
                />
            )}
            {/* Fullscreen Map Modal */}
            {isMapExpanded && (
                <div style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(15, 23, 42, 0.9)",
                    backdropFilter: "blur(8px)",
                    zIndex: 9000,
                    display: "flex",
                    flexDirection: "column",
                    padding: "40px",
                    overflowY: "auto"
                }} className="animate-fade-in">
                    <div style={{
                        maxWidth: "1400px",
                        margin: "0 auto",
                        width: "100%",
                        display: "flex",
                        flexDirection: "column",
                        gap: "20px"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h2 style={{ color: "white", margin: 0, fontSize: "32px", fontWeight: "900" }}>
                                🗺️ Vista General de Ocupación
                            </h2>
                            <button
                                onClick={() => setIsMapExpanded(false)}
                                style={{
                                    padding: "12px 24px",
                                    background: "white",
                                    color: "var(--primary)",
                                    border: "none",
                                    borderRadius: "12px",
                                    fontWeight: "900",
                                    cursor: "pointer",
                                    fontSize: "16px"
                                }}
                            >
                                ✕ CERRAR VISTA
                            </button>
                        </div>

                        <div style={{
                            background: "white",
                            padding: "30px",
                            borderRadius: "20px",
                            display: "grid",
                            gridTemplateColumns: "repeat(10, 1fr)", // Force 10 columns for better overview
                            gap: "10px"
                        }}>
                            {spots.map((spot) => (
                                <div
                                    key={spot.id}
                                    style={{
                                        ...styles.spot(spot.isOccupied, spot.type),
                                        height: "80px", // Fix height for grid consistency
                                        maxWidth: "none"
                                    }}
                                    onClick={() => {
                                        handleSpotClick(spot);
                                    }}
                                >
                                    <div style={{ position: "absolute", top: "5px", left: "8px", opacity: 0.5, fontSize: "10px" }}>
                                        {spot.type === "RESERVED" ? "R" : "G"}
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                        <span style={{ fontSize: "20px", fontWeight: "900" }}>{spot.code}</span>
                                        {spot.isOccupied && (
                                            <div style={{ fontSize: "9px", fontWeight: "800", color: "#991b1b" }}>
                                                {spot.entryTime ? formatTimeElapsed(spot.entryTime) : ""}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: "flex", gap: "30px", padding: "20px", background: "rgba(255,255,255,0.1)", borderRadius: "15px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "white", fontWeight: "700" }}>
                                <div style={{ ...styles.legendColor("#f0fdf4"), width: "24px", height: "24px" }}></div> General
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "white", fontWeight: "700" }}>
                                <div style={{ ...styles.legendColor("#e0f2fe"), width: "24px", height: "24px" }}></div> Abonado
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "white", fontWeight: "700" }}>
                                <div style={{ ...styles.legendColor("#fee2e2"), width: "24px", height: "24px" }}></div> Ocupado
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {adminEditingSpot && (
                <SpotAdminModal
                    spot={adminEditingSpot}
                    onClose={() => setAdminEditingSpot(null)}
                    onOpenAssignment={() => {
                        if (adminEditingSpot.isOccupied) {
                            setReleasingSpot(adminEditingSpot);
                        } else if (adminEditingSpot.type === "RESERVED") {
                            setEditingSpot(adminEditingSpot);
                        } else {
                            setAssignmentSpot(adminEditingSpot);
                        }
                    }}
                />
            )}
        </div>
    );
}

function FilterButton({ label, active, onClick, count }: { label: string, active: boolean, onClick: () => void, count: number }) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: "8px 16px",
                background: active ? "var(--primary)" : "white",
                color: active ? "white" : "#64748b",
                border: `1px solid ${active ? "var(--primary)" : "#e2e8f0"}`,
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: "700",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.2s"
            }}
        >
            {label}
            <span style={{
                background: active ? "rgba(255,255,255,0.2)" : "#f1f5f9",
                color: active ? "white" : "#94a3b8",
                padding: "1px 6px",
                borderRadius: "6px",
                fontSize: "11px"
            }}>{count}</span>
        </button>
    );
}

function formatTimeElapsed(entryTimeStr: string) {
    const entryTime = new Date(entryTimeStr);
    const now = new Date();
    const diffMs = now.getTime() - entryTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 60) return `${diffMins} min`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
}
