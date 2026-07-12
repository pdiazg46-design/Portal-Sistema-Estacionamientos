"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

type ReservationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  spot: any;
  onSave: (data: {
    id?: string;
    name: string;
    plate: string;
    phone: string;
    vacationStart?: Date | null;
    vacationEnd?: Date | null;
    isAllDay: boolean;
    weekdays: string;
    startTime: string;
    endTime: string;
    releasedDates: string;
  }) => Promise<void>;
  onDeleteStaff: (staffId: string) => Promise<void>;
  onDeleteSpotAll: () => Promise<void>;
  onAssignVisitor: (plate: string, visitorName?: string) => Promise<boolean>;
  onReleaseSpot: () => Promise<{ success: boolean; cost: number; durationInSeconds: number; entryTime?: Date | null; exitTime?: Date | null }>;
  onConvertToGeneral: () => Promise<void>;
  onConvertToReserved: () => Promise<void>;
  chargingEnabled: boolean;
  isAdmin: boolean;
  preFilledVisitorPlate?: string;
};

const WEEKDAY_OPTIONS = [
  { value: "MON", label: "Lunes" },
  { value: "TUE", label: "Martes" },
  { value: "WED", label: "Miércoles" },
  { value: "THU", label: "Jueves" },
  { value: "FRI", label: "Viernes" },
  { value: "SAT", label: "Sábado" },
  { value: "SUN", label: "Domingo" }
];

const formatDateDMY = (dateStr: string) => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
};

const WEEKDAY_MAP: Record<string, string> = {
  MON: "Lunes",
  TUE: "Martes",
  WED: "Miércoles",
  THU: "Jueves",
  FRI: "Viernes",
  SAT: "Sábado",
  SUN: "Domingo"
};

const formatWeekdaysSpanish = (weekdaysStr: string) => {
  if (!weekdaysStr) return "Ninguno";
  return weekdaysStr.split(",").map(day => WEEKDAY_MAP[day] || day).join(", ");
};

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h > 0 ? h + "h " : ""}${m > 0 ? m + "m " : ""}${s}s`;
};

export default function ReservationModal({
  isOpen,
  onClose,
  spot,
  onSave,
  onDeleteStaff,
  onDeleteSpotAll,
  onAssignVisitor,
  onReleaseSpot,
  onConvertToGeneral,
  onConvertToReserved,
  chargingEnabled,
  isAdmin,
  preFilledVisitorPlate
}: ReservationModalProps) {
  // Traffic / visitor assignment states
  const [visitorPlate, setVisitorPlate] = useState(preFilledVisitorPlate || "");
  const [visitorName, setVisitorName] = useState("");
  const [releaseResult, setReleaseResult] = useState<any>(null);

  // Form states for creating/editing a staff member
  const [editingStaffId, setEditingStaffId] = useState<string | undefined>(undefined);
  const [name, setName] = useState("");
  const [plate, setPlate] = useState("");
  const [phone, setPhone] = useState("+56 ");
  const [isAllDay, setIsAllDay] = useState(true);
  const [selectedDays, setSelectedDays] = useState<string[]>(["MON", "TUE", "WED", "THU", "FRI"]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [vacStart, setVacStart] = useState("");
  const [vacEnd, setVacEnd] = useState("");
  const [releasedDates, setReleasedDates] = useState<string[]>([]);
  const [releaseStart, setReleaseStart] = useState("");
  const [releaseEnd, setReleaseEnd] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync initial visitor plate if it changes
  useEffect(() => {
    if (preFilledVisitorPlate) {
      setVisitorPlate(preFilledVisitorPlate);
    }
  }, [preFilledVisitorPlate]);

  if (!isOpen || !spot) return null;

  const allOwners = spot.allOwners || [];

  const handleOpenForm = (staff?: any) => {
    if (staff) {
      setEditingStaffId(staff.id);
      setName(staff.name);
      setPlate(staff.licensePlate);
      setPhone(staff.phoneNumber || "");
      setIsAllDay(staff.isAllDay);
      setSelectedDays(staff.weekdays ? staff.weekdays.split(",") : ["MON", "TUE", "WED", "THU", "FRI"]);
      setStartTime(staff.startTime || "09:00");
      setEndTime(staff.endTime || "18:00");
      setVacStart(staff.vacationStart ? staff.vacationStart.split("T")[0] : "");
      setVacEnd(staff.vacationEnd ? staff.vacationEnd.split("T")[0] : "");
      setReleasedDates(staff.releasedDates ? staff.releasedDates.split(",") : []);
      setReleaseStart("");
      setReleaseEnd("");
    } else {
      setEditingStaffId(undefined);
      setName("");
      setPlate("");
      setPhone("+56 ");
      setIsAllDay(true);
      setSelectedDays(["MON", "TUE", "WED", "THU", "FRI"]);
      setStartTime("09:00");
      setEndTime("18:00");
      setVacStart("");
      setVacEnd("");
      setReleasedDates([]);
      setReleaseStart("");
      setReleaseEnd("");
    }
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
  };

  const getDatesInRange = (startDateStr: string, endDateStr: string): string[] => {
    if (!startDateStr) return [];
    const start = new Date(startDateStr + "T00:00:00");
    const end = endDateStr ? new Date(endDateStr + "T00:00:00") : start;
    if (end < start) return [];

    const dates: string[] = [];
    let current = new Date(start);
    while (current <= end) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, "0");
      const dd = String(current.getDate()).padStart(2, "0");
      dates.push(`${yyyy}-${mm}-${dd}`);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !plate) {
      alert("Nombre y Patente son requeridos.");
      return;
    }

    let finalReleasedDates = [...releasedDates];
    if (releaseStart) {
      const extraDates = getDatesInRange(releaseStart, releaseEnd);
      extraDates.forEach(d => {
        if (!finalReleasedDates.includes(d)) {
          finalReleasedDates.push(d);
        }
      });
    }

    setLoading(true);
    try {
      await onSave({
        id: editingStaffId,
        name,
        plate: plate.toUpperCase(),
        phone,
        vacationStart: vacStart ? new Date(vacStart + "T00:00:00") : null,
        vacationEnd: vacEnd ? new Date(vacEnd + "T23:59:59") : null,
        isAllDay,
        weekdays: selectedDays.join(","),
        startTime,
        endTime,
        releasedDates: finalReleasedDates.sort().join(",")
      });
      setShowForm(false);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStaff = async (staffId: string, staffName: string) => {
    if (confirm(`¿Seguro que desea eliminar la reserva de ${staffName}?`)) {
      setLoading(true);
      try {
        await onDeleteStaff(staffId);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteAll = async () => {
    if (confirm("ADVERTENCIA: ¿Seguro que desea eliminar a TODOS los abonados de este sitio?\nEl sitio quedará completamente LIBRE.")) {
      setLoading(true);
      try {
        await onDeleteSpotAll();
        onClose();
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleConvertToGeneral = async () => {
    if (confirm("ADVERTENCIA: ¿Está seguro de que desea cambiar este sitio a General? Se eliminarán todos los abonados y tramos registrados para este casillero.")) {
      setLoading(true);
      try {
        if (onConvertToGeneral) {
          await onConvertToGeneral();
        }
        onClose();
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleConvertToReserved = async () => {
    if (confirm("¿Está seguro de que desea cambiar este sitio a Reservado / Abonado?")) {
      setLoading(true);
      try {
        if (onConvertToReserved) {
          await onConvertToReserved();
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleVisitorAssign = async () => {
    if (!visitorPlate) {
      alert("Ingrese una patente para registrar ingreso.");
      return;
    }
    setLoading(true);
    try {
      const success = await onAssignVisitor(visitorPlate, visitorName);
      if (success) {
        setVisitorName("");
        onClose();
      }
    } catch (e) {
      console.error(e);
      alert("Error al registrar el ingreso de la visita.");
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async () => {
    setLoading(true);
    try {
      const res = await onReleaseSpot();
      if (res.success) {
        setReleaseResult(res);
      }
    } catch (e) {
      console.error(e);
      alert("Error al liberar sitio.");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseMasterModal = () => {
    setReleaseResult(null);
    onClose();
  };

  const toggleDay = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleAddReleaseRange = () => {
    if (!releaseStart) {
      alert("Seleccione al menos la fecha de inicio.");
      return;
    }
    const dates = getDatesInRange(releaseStart, releaseEnd);
    if (dates.length === 0) {
      alert("La fecha de fin no puede ser menor a la fecha de inicio.");
      return;
    }
    setReleasedDates(prev => {
      const updated = [...prev];
      dates.forEach(d => {
        if (!updated.includes(d)) {
          updated.push(d);
        }
      });
      return updated.sort();
    });
    setReleaseStart("");
    setReleaseEnd("");
  };

  const handleRemoveReleaseDate = (dateToRemove: string) => {
    setReleasedDates(prev => prev.filter(d => d !== dateToRemove));
  };

  const formatPhone = (val: string) => {
    let digits = val.replace(/[^\d+]/g, "");
    if (!digits.startsWith("+")) {
      digits = "+" + digits.replace("+", "");
    }
    if (!digits.startsWith("+56")) {
      if (digits.length <= 3) {
        digits = "+56";
      } else {
        digits = "+56" + digits.slice(1).replace("56", "");
      }
    }
    const afterPrefix = digits.slice(3).replace(/\D/g, "");
    let formatted = "+56";
    if (afterPrefix.length > 0) {
      formatted += " " + afterPrefix.slice(0, 1);
    }
    if (afterPrefix.length > 1) {
      formatted += " " + afterPrefix.slice(1, 5);
    }
    if (afterPrefix.length > 5) {
      formatted += " " + afterPrefix.slice(5, 9);
    }
    return formatted;
  };

  const styles = {
    overlay: {
      position: "fixed" as const,
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(15, 23, 42, 0.75)",
      backdropFilter: "blur(6px)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 20000,
      padding: "20px",
      overflowY: "auto" as const
    },
    modal: {
      backgroundColor: "white",
      borderRadius: "24px",
      width: "100%",
      maxWidth: spot.type === "RESERVED" ? "950px" : "460px",
      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
      position: "relative" as const,
      margin: "auto",
      display: "flex",
      flexDirection: "column" as const,
      overflow: "hidden"
    },
    modalHeader: {
      padding: "20px 24px",
      borderBottom: "1px solid #f1f5f9",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      background: "#fafafa"
    },
    modalTitle: {
      margin: 0,
      fontSize: "18px",
      fontWeight: "900",
      color: "var(--primary)",
      display: "flex",
      alignItems: "center",
      gap: "10px"
    },
    closeBtn: {
      background: "none",
      border: "none",
      fontSize: "24px",
      color: "#94a3b8",
      cursor: "pointer",
      padding: "4px",
      lineHeight: 1
    },
    modalBody: {
      padding: "24px",
      display: "flex",
      gap: "24px",
      flexDirection: "row" as const,
      flexWrap: "wrap" as const
    },
    leftPanel: {
      flex: 1,
      minWidth: "300px",
      display: "flex",
      flexDirection: "column" as const,
      gap: "20px"
    },
    rightPanel: {
      flex: 1.2,
      minWidth: "350px",
      background: "#f8fafc",
      padding: "20px",
      borderRadius: "16px",
      border: "1px solid #e2e8f0"
    },
    section: {
      borderBottom: "1px solid #f1f5f9",
      paddingBottom: "20px"
    },
    sectionTitle: {
      margin: "0 0 12px 0",
      fontSize: "14px",
      fontWeight: "800",
      color: "#475569",
      textTransform: "uppercase" as const,
      letterSpacing: "0.5px",
      display: "flex",
      alignItems: "center",
      gap: "6px"
    },
    statusGrid: {
      display: "flex",
      flexDirection: "column" as const,
      gap: "10px",
      background: "#f8fafc",
      padding: "12px 16px",
      borderRadius: "12px",
      border: "1px solid #e2e8f0"
    },
    statusRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontSize: "14px"
    },
    statusLabel: {
      color: "#64748b",
      fontWeight: "600"
    },
    largePlateBadge: {
      background: "#fee2e2",
      color: "#b91c1c",
      padding: "10px 24px",
      borderRadius: "14px",
      fontWeight: "900",
      fontFamily: "monospace",
      fontSize: "26px",
      letterSpacing: "1.5px",
      border: "2px solid #fecaca",
      display: "inline-block"
    },
    activeReservationBox: {
      background: "#e0f2fe",
      border: "1px solid #bae6fd",
      padding: "12px 16px",
      borderRadius: "12px",
      fontSize: "13px",
      color: "#0369a1",
      marginTop: "10px"
    },
    btnRelease: {
      width: "100%",
      padding: "14px",
      background: "#dc2626",
      color: "white",
      border: "none",
      borderRadius: "12px",
      cursor: "pointer",
      fontWeight: "900",
      fontSize: "14px",
      boxShadow: "0 4px 6px -1px rgba(220, 38, 38, 0.2)",
      transition: "background 0.2s"
    },
    receiptBox: {
      background: "#f0fdf4",
      border: "2px solid #bbf7d0",
      padding: "18px",
      borderRadius: "14px",
      color: "#166534"
    },
    input: {
      width: "100%",
      padding: "10px 14px",
      border: "1px solid #cbd5e1",
      borderRadius: "10px",
      fontSize: "14px",
      outline: "none",
      transition: "border-color 0.2s"
    },
    btnAssign: {
      padding: "10px 16px",
      background: "var(--primary)",
      color: "white",
      border: "none",
      borderRadius: "10px",
      cursor: "pointer",
      fontWeight: "800",
      fontSize: "13px",
      whiteSpace: "nowrap" as const
    },
    btnDeleteAll: {
      width: "100%",
      padding: "12px",
      background: "#fee2e2",
      color: "#b91c1c",
      border: "none",
      borderRadius: "10px",
      cursor: "pointer",
      fontWeight: "800",
      fontSize: "13px",
      marginTop: "10px"
    },
    ownersList: {
      display: "flex",
      flexDirection: "column" as const,
      gap: "12px",
      maxHeight: "260px",
      overflowY: "auto" as const,
      marginBottom: "16px"
    },
    ownerCard: {
      background: "white",
      padding: "14px",
      borderRadius: "12px",
      border: "1px solid #e2e8f0"
    },
    btnEditIcon: {
      background: "#f1f5f9",
      border: "none",
      borderRadius: "6px",
      padding: "4px 8px",
      cursor: "pointer",
      fontSize: "13px"
    },
    btnDeleteIcon: {
      background: "#fee2e2",
      border: "none",
      borderRadius: "6px",
      padding: "4px 8px",
      cursor: "pointer",
      fontSize: "13px"
    },
    scheduleText: {
      fontSize: "12px",
      color: "#475569",
      marginTop: "10px",
      background: "#f8fafc",
      padding: "8px 12px",
      borderRadius: "8px",
      border: "1px solid #f1f5f9"
    },
    group: {
      display: "flex",
      flexDirection: "column" as const,
      gap: "6px"
    },
    label: {
      fontSize: "11px",
      fontWeight: "800",
      color: "#64748b",
      textTransform: "uppercase" as const,
      letterSpacing: "0.5px"
    },
    dayBtn: {
      padding: "8px",
      borderRadius: "8px",
      border: "1px solid #cbd5e1",
      background: "white",
      cursor: "pointer",
      fontSize: "11px",
      fontWeight: "700",
      flex: 1,
      textAlign: "center" as const
    },
    dayBtnActive: {
      background: "var(--primary)",
      color: "white",
      borderColor: "var(--primary)"
    },
    btnAddOwner: {
      background: "var(--primary)",
      color: "white",
      border: "none",
      borderRadius: "8px",
      padding: "6px 12px",
      fontSize: "12px",
      fontWeight: "800",
      cursor: "pointer"
    },
    btnAddRelease: {
      padding: "8px 14px",
      background: "var(--primary)",
      color: "white",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "12px",
      fontWeight: "700"
    },
    releaseList: {
      display: "flex",
      flexWrap: "wrap" as const,
      gap: "6px",
      marginTop: "10px",
      background: "#f1f5f9",
      padding: "10px",
      borderRadius: "10px"
    },
    releasePill: {
      background: "white",
      border: "1px solid #e2e8f0",
      padding: "4px 8px 4px 10px",
      borderRadius: "6px",
      fontSize: "11px",
      fontWeight: "700",
      color: "#334155",
      display: "flex",
      alignItems: "center",
      gap: "6px"
    },
    removePillBtn: {
      background: "none",
      border: "none",
      color: "#94a3b8",
      cursor: "pointer",
      fontWeight: "800",
      padding: 0
    },
    formActions: {
      display: "flex",
      gap: "10px",
      marginTop: "16px"
    },
    btnSaveForm: {
      flex: 1,
      padding: "10px",
      background: "var(--primary)",
      color: "white",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      fontWeight: "800",
      fontSize: "13px"
    },
    btnCancelForm: {
      flex: 1,
      padding: "10px",
      background: "#e2e8f0",
      color: "#475569",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      fontWeight: "700",
      fontSize: "13px"
    }
  };

  const modalContent = (
    <div style={styles.overlay}>
      <div style={styles.modal} className="animate-scale-in">
        
        {/* Header */}
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>
            <span>🛡️</span> Gestión de Sitio: {spot.code}
          </h2>
          <button onClick={handleCloseMasterModal} style={styles.closeBtn}>✕</button>
        </div>

        {/* Body */}
        <div style={styles.modalBody}>
          
          {/* LEFT PANEL */}
          <div style={styles.leftPanel}>
            
            {/* Status info */}
            <div style={{ ...styles.section, marginTop: "0" }}>
              <h3 style={styles.sectionTitle}>ℹ️ Información del Sitio</h3>
              <div style={styles.statusGrid}>
                <div style={styles.statusRow}>
                  <span style={styles.statusLabel}>Tipo:</span>
                  <span style={{ 
                    fontWeight: "800", 
                    color: spot.type === "RESERVED" ? "#0369a1" : "#166534",
                    background: spot.type === "RESERVED" ? "#e0f2fe" : "#dcfce7",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    fontSize: "11px"
                  }}>
                    {spot.type === "RESERVED" ? "RESERVADO / ABONADO" : "GENERAL / PÚBLICO"}
                  </span>
                </div>
                <div style={styles.statusRow}>
                  <span style={styles.statusLabel}>Estado:</span>
                  <span style={{ 
                    fontWeight: "800", 
                    color: spot.isOccupied ? "#b91c1c" : "#166534",
                    background: spot.isOccupied ? "#fee2e2" : "#dcfce7",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    fontSize: "11px"
                  }}>
                    {spot.isOccupied ? "OCUPADO" : "DISPONIBLE"}
                  </span>
                </div>
              </div>
            </div>

            {/* Occupied View */}
            {spot.isOccupied ? (
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>🚗 Vehículo Estacionado</h3>
                {releaseResult ? (
                  <div style={styles.receiptBox}>
                    <h4 style={{ color: "#166534", fontWeight: "900", margin: "0 0 10px 0" }}>¡Salida Registrada!</h4>
                    <div style={styles.statusRow}>
                      <span>Tiempo de uso:</span>
                      <strong>{formatDuration(releaseResult.durationInSeconds)}</strong>
                    </div>
                    {chargingEnabled && (
                      <div style={{ ...styles.statusRow, marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed #cbd5e1" }}>
                        <span style={{ fontWeight: "800" }}>TOTAL A COBRAR:</span>
                        <strong style={{ fontSize: "20px", color: "#166534" }}>
                          ${releaseResult.cost.toLocaleString("es-CL")}
                        </strong>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "10px 0" }}>
                      <span style={styles.largePlateBadge}>
                        {spot.currentPlate}
                      </span>
                      {spot.currentVisitorName && (
                        <div style={{ marginTop: "8px", fontWeight: "800", color: "#475569", fontSize: "14px" }}>
                          👤 Visitante: {spot.currentVisitorName}
                        </div>
                      )}
                    </div>
                    {spot.type === "RESERVED" && (
                      <div style={styles.activeReservationBox}>
                        <div style={{ fontWeight: "800", color: "#0369a1", fontSize: "13px" }}>
                          👤 Reserva Activa hoy: {spot.ownerName || "Sin abonado activo hoy"}
                        </div>
                        {spot.ownerPlate && (
                          <div style={{ fontSize: "12px", marginTop: "4px" }}>
                            Patente Autorizada: <strong>{spot.ownerPlate}</strong>
                          </div>
                        )}
                        {spot.ownerName && (
                          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                            Tramo: {spot.ownerIsAllDay ? "Todo el día" : `${formatWeekdaysSpanish(spot.ownerWeekdays)} (${spot.ownerStartTime} - ${spot.ownerEndTime})`}
                          </div>
                        )}
                      </div>
                    )}
                    <button 
                      type="button" 
                      onClick={handleRelease} 
                      style={styles.btnRelease}
                      disabled={loading}
                    >
                      {loading ? "Procesando..." : "LIBERAR SITIO / REGISTRAR SALIDA"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Empty View */
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {spot.type === "RESERVED" && (
                  <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>👤 Titular Autorizado</h3>
                    <div style={styles.activeReservationBox}>
                      <div style={{ fontWeight: "800", color: "#0369a1", fontSize: "13px" }}>
                        👤 Reserva Activa hoy: {spot.ownerName || "Sin abonado activo hoy"}
                      </div>
                      {spot.ownerPlate && (
                        <div style={{ fontSize: "12px", marginTop: "4px" }}>
                          Patente Autorizada: <strong>{spot.ownerPlate}</strong>
                        </div>
                      )}
                      {spot.ownerName && (
                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                          Tramo: {spot.ownerIsAllDay ? "Todo el día" : `${formatWeekdaysSpanish(spot.ownerWeekdays)} (${spot.ownerStartTime} - ${spot.ownerEndTime})`}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {isAdmin ? (
                  <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>🚗 Ingreso Manual de Visita</h3>
                    <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 12px 0" }}>
                      Ingrese los datos de la visita para registrar la entrada manual en este sitio.
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={styles.group}>
                        <label style={styles.label}>Patente del Vehículo</label>
                        <input 
                          placeholder="Ej: ABCD12" 
                          style={styles.input}
                          value={visitorPlate}
                          onChange={e => setVisitorPlate(e.target.value.toUpperCase())}
                        />
                      </div>
                      <div style={styles.group}>
                        <label style={styles.label}>Nombre de la Visita</label>
                        <input 
                          placeholder="Ingrese nombre (Ej: Juan Pérez)" 
                          style={styles.input}
                          value={visitorName}
                          onChange={e => setVisitorName(e.target.value)}
                        />
                      </div>
                      <button 
                        type="button" 
                        onClick={handleVisitorAssign} 
                        style={{ ...styles.btnAssign, padding: "12px", fontSize: "14px", fontWeight: "800" }} 
                        disabled={loading}
                      >
                        Confirmar Ingreso y Registrar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ ...styles.section, borderBottom: "none" }}>
                    <p style={{ fontSize: "13px", color: "#64748b", fontWeight: "700", lineHeight: "1.4" }}>
                      🔒 El rol de Portero no tiene permisos para registrar ingresos manuales de visitas. El ingreso de visitas debe ser detectado por cámara LPR o ingresado por un Administrador o Jefatura.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Admin Type conversion */}
            {isAdmin && !spot.isOccupied && !releaseResult && !visitorPlate && (
              <div style={{ ...styles.section, borderBottom: "none", marginTop: "auto" }}>
                <h3 style={styles.sectionTitle}>🛠️ Administración del Sitio</h3>
                {spot.type === "RESERVED" ? (
                  <button 
                    type="button" 
                    onClick={handleConvertToGeneral} 
                    style={{ ...styles.btnDeleteAll, background: "#f1f5f9", color: "#64748b", border: "1px solid #cbd5e1" }}
                    disabled={loading}
                  >
                    🔄 Liberar y Convertir a General (Público)
                  </button>
                ) : (
                  <button 
                    type="button" 
                    onClick={handleConvertToReserved} 
                    style={{ ...styles.btnDeleteAll, background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd" }}
                    disabled={loading}
                  >
                    🔄 Convertir a Reservado / Abonado
                  </button>
                )}
              </div>
            )}
          </div>

          {/* RIGHT PANEL (only for RESERVED spots) */}
          {spot.type === "RESERVED" && (
            <div style={styles.rightPanel}>
              
              {!showForm ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <h3 style={{ ...styles.sectionTitle, margin: 0 }}>Abonados Asignados ({allOwners.length})</h3>
                    {isAdmin && (
                      <button 
                        type="button" 
                        onClick={() => handleOpenForm()} 
                        style={styles.btnAddOwner}
                        disabled={loading}
                      >
                        + Añadir Abonado / Tramo
                      </button>
                    )}
                  </div>

                  <div style={styles.ownersList}>
                    {allOwners.length > 0 ? (
                      allOwners.map((owner: any) => (
                        <div key={owner.id} style={styles.ownerCard}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <div style={{ fontWeight: "900", fontSize: "14px", color: "var(--primary)" }}>{owner.name}</div>
                              <div style={{ display: "flex", gap: "10px", marginTop: "4px", fontSize: "12px" }}>
                                <span style={{ fontFamily: "monospace", fontWeight: "700", background: "#f1f5f9", padding: "1px 6px", borderRadius: "4px" }}>
                                  🚗 {owner.licensePlate}
                                </span>
                                <span style={{ color: "#64748b" }}>📞 {owner.phoneNumber || "S/N"}</span>
                              </div>
                            </div>
                            {isAdmin && (
                              <div style={{ display: "flex", gap: "4px" }}>
                                <button 
                                  onClick={() => handleOpenForm(owner)} 
                                  style={styles.btnEditIcon}
                                  title="Editar"
                                >
                                  ✏️
                                </button>
                                <button 
                                  onClick={() => handleDeleteStaff(owner.id, owner.name)} 
                                  style={styles.btnDeleteIcon}
                                  title="Eliminar"
                                >
                                  🗑️
                                </button>
                              </div>
                            )}
                          </div>

                          <div style={styles.scheduleText}>
                            📅 {owner.isAllDay ? (
                              <span style={{ fontWeight: "700", color: "#059669" }}>Todo el día, todos los días</span>
                            ) : (
                              <span>
                                <strong>Días:</strong> {formatWeekdaysSpanish(owner.weekdays)} <br />
                                <strong>Horario:</strong> {owner.startTime} - {owner.endTime}
                              </span>
                            )}
                          </div>

                          {owner.releasedDates && (
                            <div style={{ marginTop: "6px", fontSize: "11px", background: "#fffbeb", padding: "4px 8px", borderRadius: "6px", border: "1px solid #fde68a" }}>
                              <strong>Liberaciones específicas:</strong> {owner.releasedDates.split(",").map(formatDateDMY).join(", ")}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div style={{ textAlign: "center", color: "#94a3b8", padding: "30px 20px", background: "white", borderRadius: "12px", border: "2px dashed #e2e8f0" }}>
                        No hay abonados asignados a este casillero de estacionamiento.
                      </div>
                    )}
                  </div>

                  {isAdmin && allOwners.length > 0 && (
                    <button 
                      type="button" 
                      onClick={handleDeleteAll} 
                      style={styles.btnDeleteAll}
                      disabled={loading}
                    >
                      Eliminar Todas las Reservas
                    </button>
                  )}
                </>
              ) : (
                <>
                  <h3 style={{ ...styles.sectionTitle, color: "var(--primary)", borderBottom: "2px solid var(--primary)", paddingBottom: "8px" }}>
                    {editingStaffId ? "📝 Editar Tramo de Reserva" : "➕ Crear Tramo de Reserva"}
                  </h3>

                  <form onSubmit={handleSaveStaff} style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "12px" }}>
                    <div style={styles.group}>
                      <label style={styles.label}>Nombre del Abonado</label>
                      <input 
                        required 
                        style={styles.input} 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        placeholder="Ingrese nombre del abonado" 
                      />
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
                      <div style={{ ...styles.group, flex: 1 }}>
                        <label style={styles.label}>Patente</label>
                        <input 
                          required 
                          style={styles.input} 
                          value={plate} 
                          onChange={e => setPlate(e.target.value.toUpperCase())} 
                          placeholder="Ingrese patente" 
                        />
                      </div>
                      <div style={{ ...styles.group, flex: 1 }}>
                        <label style={styles.label}>Teléfono</label>
                        <input 
                          style={styles.input} 
                          value={phone} 
                          onChange={e => setPhone(formatPhone(e.target.value))} 
                          placeholder="+56 9 1234 5678" 
                        />
                      </div>
                    </div>

                    <div style={{ ...styles.group, background: "white", padding: "10px 12px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                      <label style={{ ...styles.label, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "800" }}>
                        <input 
                          type="checkbox" 
                          checked={isAllDay} 
                          onChange={e => setIsAllDay(e.target.checked)} 
                        />
                        Reservado todo el día (Fijo)
                      </label>
                    </div>

                    {!isAllDay && (
                      <>
                        <div style={styles.group}>
                          <label style={styles.label}>Días de la Semana</label>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {WEEKDAY_OPTIONS.map(opt => (
                              <button 
                                key={opt.value} 
                                type="button" 
                                onClick={() => toggleDay(opt.value)}
                                style={{
                                  ...styles.dayBtn,
                                  ...(selectedDays.includes(opt.value) ? styles.dayBtnActive : {})
                                }}
                              >
                                {opt.label.slice(0, 3)}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "10px" }}>
                          <div style={{ ...styles.group, flex: 1 }}>
                            <label style={styles.label}>Hora Inicio</label>
                            <input 
                              type="time" 
                              style={styles.input} 
                              value={startTime} 
                              onChange={e => setStartTime(e.target.value)} 
                            />
                          </div>
                          <div style={{ ...styles.group, flex: 1 }}>
                            <label style={styles.label}>Hora Fin</label>
                            <input 
                              type="time" 
                              style={styles.input} 
                              value={endTime} 
                              onChange={e => setEndTime(e.target.value)} 
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div style={{ ...styles.group, background: "white", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                      <label style={styles.label}>Vacaciones / Ausencia Temporal</label>
                      <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: "10px", color: "#64748b" }}>Desde</span>
                          <input 
                            type="date" 
                            style={{ ...styles.input, padding: "6px" }} 
                            value={vacStart} 
                            onChange={e => setVacStart(e.target.value)} 
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: "10px", color: "#64748b" }}>Hasta</span>
                          <input 
                            type="date" 
                            style={{ ...styles.input, padding: "6px" }} 
                            value={vacEnd} 
                            onChange={e => setVacEnd(e.target.value)} 
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ ...styles.group, background: "white", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                      <label style={styles.label}>Liberar Fechas Específicas</label>
                      <p style={{ fontSize: "11px", color: "#64748b", margin: "2px 0 6px 0" }}>
                        Pídele al abonado liberar este casillero ciertos días específicos para otro uso.
                      </p>
                      <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: "10px", color: "#64748b" }}>Desde</span>
                          <input 
                            type="date" 
                            style={{ ...styles.input, padding: "6px" }} 
                            value={releaseStart} 
                            onChange={e => setReleaseStart(e.target.value)} 
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: "10px", color: "#64748b" }}>Hasta (Opcional)</span>
                          <input 
                            type="date" 
                            style={{ ...styles.input, padding: "6px" }} 
                            value={releaseEnd} 
                            onChange={e => setReleaseEnd(e.target.value)} 
                          />
                        </div>
                        <button 
                          type="button" 
                          onClick={handleAddReleaseRange} 
                          style={{ ...styles.btnAddRelease, height: "34px" }}
                        >
                          Añadir
                        </button>
                      </div>

                      {releasedDates.length > 0 && (
                        <div style={styles.releaseList}>
                          {releasedDates.map(dateStr => (
                            <span key={dateStr} style={styles.releasePill}>
                              {formatDateDMY(dateStr)}
                              <button 
                                type="button" 
                                onClick={() => handleRemoveReleaseDate(dateStr)}
                                style={styles.removePillBtn}
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={styles.formActions}>
                      <button type="button" onClick={handleCloseForm} style={styles.btnCancelForm}>
                        Cancelar
                      </button>
                      <button type="submit" style={styles.btnSaveForm} disabled={loading}>
                        {loading ? "Guardando..." : "Guardar Abonado"}
                      </button>
                    </div>
                  </form>
                </>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : null;
}
