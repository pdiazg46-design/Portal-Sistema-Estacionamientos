
"use client";

import { useState } from "react";

type AssignmentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (plate: string) => void;
  spotCode: string;
  initialPlate: string;
};

export default function AssignmentModal({ isOpen, onClose, onConfirm, spotCode, initialPlate }: AssignmentModalProps) {
  const [plate, setPlate] = useState(initialPlate);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(plate);
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
      padding: "32px",
      borderRadius: "16px",
      width: "100%",
      maxWidth: "400px",
      boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.2)",
      textAlign: "center" as const,
      position: "relative" as const,
      margin: "auto"
    },
    header: {
      fontSize: "20px",
      fontWeight: "800",
      color: "var(--primary)",
      margin: "0 0 8px 0"
    },
    subHeader: {
      fontSize: "14px",
      color: "#64748b",
      marginBottom: "24px"
    },
    label: {
      display: "block",
      marginBottom: "12px",
      fontSize: "15px",
      fontWeight: "600",
      color: "#1e293b"
    },
    input: {
      width: "100%",
      padding: "12px",
      border: "2px solid var(--accent)",
      borderRadius: "12px",
      fontSize: "24px",
      textAlign: "center" as const,
      textTransform: "uppercase" as const,
      marginBottom: "24px",
      fontWeight: "900",
      letterSpacing: "2px",
      fontFamily: "monospace",
      outline: "none"
    },
    actions: {
      display: "flex",
      justifyContent: "center",
      gap: "12px"
    },
    btnConfirm: {
      padding: "12px 24px",
      background: "var(--primary)",
      color: "white",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      fontWeight: "800",
      fontSize: "15px",
      flex: 1
    },
    btnCancel: {
      padding: "12px 24px",
      background: "#f1f5f9",
      color: "#475569",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      fontWeight: "700",
      fontSize: "15px",
      flex: 1
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal} className="animate-fade-in">
        <h3 style={styles.header}>Asignación de Visita</h3>
        <p style={styles.subHeader}>Sitio General: {spotCode}</p>

        <form onSubmit={handleSubmit}>
          <label style={styles.label}>Patente del Vehículo</label>
          <input
            autoFocus
            style={styles.input}
            value={plate}
            onChange={e => setPlate(e.target.value.toUpperCase())}
            placeholder="ABC-123"
          />

          <div style={styles.actions}>
            <button type="button" onClick={onClose} style={styles.btnCancel}>Cancelar</button>
            <button type="submit" style={styles.btnConfirm}>Confirmar Ingreso</button>
          </div>
        </form>
      </div>
    </div>
  );
}
