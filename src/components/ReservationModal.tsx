
"use client";

import { useState } from "react";

type ReservationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; plate: string; phone: string; vacationStart?: Date | null; vacationEnd?: Date | null }) => void;
  onDelete: () => void;
  onAssignVisitor: (plate: string) => void;
  initialData: { name: string; plate: string; phone: string; spotCode: string; vacationStart?: string; vacationEnd?: string };
  preFilledVisitorPlate?: string;
};

export default function ReservationModal({ isOpen, onClose, onSave, onDelete, onAssignVisitor, initialData, preFilledVisitorPlate }: ReservationModalProps) {
  const [name, setName] = useState(initialData.name);
  const [plate, setPlate] = useState(initialData.plate);
  const [phone, setPhone] = useState(initialData.phone);

  // Visitor Assignment State - Initialize with passed prop
  const [visitorPlate, setVisitorPlate] = useState(preFilledVisitorPlate || "");

  const formatDateForInput = (dateStr?: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toISOString().split("T")[0];
  };

  const [vacStart, setVacStart] = useState(formatDateForInput(initialData.vacationStart));
  const [vacEnd, setVacEnd] = useState(formatDateForInput(initialData.vacationEnd));

  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const vStart = vacStart ? new Date(`${vacStart}T00:00:00`) : null;
    const vEnd = vacEnd ? new Date(`${vacEnd}T23:59:59`) : null;
    onSave({ name, plate, phone, vacationStart: vStart, vacationEnd: vEnd });
  };

  const handleDelete = () => {
    if (confirm("ADVERTENCIA: ¿Seguro que desea eliminar la asignación de este sitio?\nEl sitio quedará LIBRE para ser asignado a otro abonado.")) {
      setLoading(true);
      onDelete();
    }
  };

  const handleVisitorAssign = () => {
    if (!visitorPlate) {
      alert("Ingrese una patente para asignar visita.");
      return;
    }
    setLoading(true);
    onAssignVisitor(visitorPlate);
  };

  const styles = {
    overlay: {
      position: "fixed" as const,
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      backdropFilter: "blur(5px)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10000,
      padding: "40px 20px",
      overflowY: "auto" as const
    },
    modal: {
      backgroundColor: "white",
      padding: "24px",
      borderRadius: "16px",
      width: "100%",
      maxWidth: "500px",
      boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.25)",
      position: "relative" as const,
      margin: "auto"
    },
    header: {
      fontSize: "20px",
      fontWeight: "800",
      color: "var(--primary)",
      margin: "0 0 16px 0",
      textAlign: "center" as const
    },
    sectionTitle: {
      fontSize: "12px",
      fontWeight: "800",
      color: "#64748b",
      textTransform: "uppercase" as const,
      letterSpacing: "0.5px",
      borderBottom: "1px solid #f1f5f9",
      paddingBottom: "6px",
      marginBottom: "12px",
      marginTop: "16px"
    },
    group: { marginBottom: "12px" },
    label: { display: "block", marginBottom: "4px", fontWeight: "700", fontSize: "12px", color: "#475569" },
    input: {
      width: "100%",
      padding: "8px 12px",
      border: "2px solid #e2e8f0",
      borderRadius: "8px",
      fontSize: "14px",
      outline: "none",
      transition: "border-color 0.2s"
    },
    actions: {
      display: "flex",
      justifyContent: "space-between",
      gap: "10px",
      marginTop: "24px",
      paddingTop: "16px",
      borderTop: "1px solid #f1f5f9"
    },
    btnSave: {
      padding: "8px 16px",
      background: "var(--primary)",
      color: "white",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      fontWeight: "700",
      fontSize: "13px"
    },
    btnCancel: {
      padding: "8px 16px",
      background: "#f1f5f9",
      color: "#475569",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      fontWeight: "700",
      fontSize: "13px"
    },
    btnDelete: {
      padding: "8px 14px",
      background: "#fee2e2",
      color: "#dc2626",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "12px",
      fontWeight: "700"
    },
    visitorSection: {
      backgroundColor: "#f0fdf4",
      padding: "16px",
      borderRadius: "12px",
      border: "2px solid #bbf7d0",
      marginBottom: "16px"
    },
    btnAssign: {
      padding: "10px",
      background: "var(--success)",
      color: "white",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      fontWeight: "800",
      width: "100%",
      marginTop: "10px",
      fontSize: "13px",
      boxShadow: "0 2px 0 rgba(0,0,0,0.1)"
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal} className="animate-fade-in">
        <h2 style={styles.header}>Gestión de Sitio: {initialData.spotCode}</h2>

        <div style={styles.visitorSection}>
          <label style={{ ...styles.label, color: "#166534", marginBottom: "8px" }}>OCUPACIÓN INMEDIATA (VISITA)</label>
          <input
            autoFocus
            style={styles.input}
            placeholder="ABC-123"
            value={visitorPlate}
            onChange={e => setVisitorPlate(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleVisitorAssign()}
          />
          <button type="button" onClick={handleVisitorAssign} style={styles.btnAssign} disabled={loading}>
            {loading ? "ASIGNANDO..." : "OCUPAR SITIO AHORA"}
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={styles.sectionTitle}>Datos del Abonado</div>
          <div style={styles.group}>
            <label style={styles.label}>Nombre Completo</label>
            <input required style={styles.input} value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Juan Pérez" />
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ ...styles.group, flex: 1 }}>
              <label style={styles.label}>Patente</label>
              <input required style={styles.input} value={plate} onChange={e => setPlate(e.target.value.toUpperCase())} placeholder="ABC-123" />
            </div>
            <div style={{ ...styles.group, flex: 1 }}>
              <label style={styles.label}>Teléfono</label>
              <input required style={styles.input} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+569..." />
            </div>
          </div>

          <div style={styles.sectionTitle}>Periodo de Vacaciones</div>
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Fecha Inicio</label>
              <input type="date" style={styles.input} value={vacStart} onChange={e => setVacStart(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>Fecha Fin</label>
              <input type="date" style={styles.input} value={vacEnd} onChange={e => setVacEnd(e.target.value)} />
            </div>
          </div>

          <div style={styles.actions}>
            <button type="button" onClick={handleDelete} style={styles.btnDelete} disabled={loading}>
              Eliminar
            </button>
            <div style={{ display: "flex", gap: "10px" }}>
              <button type="button" onClick={onClose} style={styles.btnCancel} disabled={loading}>Cancelar</button>
              <button type="submit" style={styles.btnSave} disabled={loading}>
                {loading ? "..." : "Guardar"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
