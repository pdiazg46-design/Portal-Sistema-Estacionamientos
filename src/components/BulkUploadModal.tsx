"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { bulkUploadStaff, exportCurrentAssignments, getLastBulkUpload } from "@/lib/actions";

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BulkUploadModal({ isOpen, onClose }: BulkUploadModalProps) {
  const { user } = useAuth();
  const [fileContent, setFileContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [overwriteAll, setOverwriteAll] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  
  // Last load audit state
  const [lastUpload, setLastUpload] = useState<any>(null);
  
  // Validation results
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationSuccessMsg, setValidationSuccessMsg] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchLastUpload();
      resetForm();
    }
  }, [isOpen]);

  const fetchLastUpload = async () => {
    try {
      const data = await getLastBulkUpload();
      setLastUpload(data);
    } catch (e) {
      console.error(e);
    }
  };

  const resetForm = () => {
    setFileContent("");
    setFileName("");
    setOverwriteAll(false);
    setValidationErrors([]);
    setValidationSuccessMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (!isOpen) return null;

  // Export current assignments as CSV
  const handleDownloadCurrent = async () => {
    try {
      const csvContent = await exportCurrentAssignments();
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      link.setAttribute("download", `asignaciones_estacionamiento_${dateStr}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert("Error al descargar la configuración actual.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFileContent(text);
      validateCSV(text);
    };
    reader.readAsText(file);
  };

  // Perform client-side validations to give immediate feedback
  const validateCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length === 0) {
      setValidationErrors(["El archivo está vacío."]);
      setValidationSuccessMsg("");
      return;
    }

    const firstLine = lines[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;

    let delimiter = ",";
    if (semicolonCount > commaCount && semicolonCount > tabCount) {
      delimiter = ";";
    } else if (tabCount > commaCount && tabCount > semicolonCount) {
      delimiter = "\t";
    }

    const parseLine = (line: string) => {
      const result = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const cleanHeader = (h: string) => {
      return h.toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_")
        .trim();
    };

    const headers = parseLine(lines[0]).map(cleanHeader);
    const expectedHeaders = ["SITIO", "NOMBRE", "PATENTE"];
    const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));

    if (missingHeaders.length > 0) {
      setValidationErrors([`Estructura incorrecta. Faltan las siguientes columnas: ${missingHeaders.join(", ")}`]);
      setValidationSuccessMsg("");
      return;
    }

    const errors: string[] = [];
    let recordCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length === 0 || (values.length === 1 && values[0] === "")) continue;

      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] !== undefined ? values[index].trim() : "";
      });

      const lineNum = i + 1;
      const sitio = row["SITIO"] || "";
      const nombre = row["NOMBRE"] || "";
      const patente = row["PATENTE"] || "";

      if (!sitio) {
        errors.push(`Fila ${lineNum}: El campo SITIO está vacío.`);
      }
      if (!nombre) {
        errors.push(`Fila ${lineNum}: El campo NOMBRE está vacío.`);
      }
      if (!patente) {
        errors.push(`Fila ${lineNum}: El campo PATENTE está vacío.`);
      } else {
        const cleanPlate = patente.replace(/[^a-zA-Z0-9]/g, "");
        if (cleanPlate.length < 4 || cleanPlate.length > 10) {
          errors.push(`Fila ${lineNum}: Patente '${patente}' tiene formato inválido.`);
        }
      }
      recordCount++;
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      setValidationSuccessMsg("");
    } else {
      setValidationErrors([]);
      setValidationSuccessMsg(`¡Archivo válido! Se detectaron ${recordCount} asignaciones listas para procesar.`);
    }
  };

  const handleApplyUpload = async () => {
    if (!fileContent) return;
    setLoading(true);
    try {
      const result = await bulkUploadStaff(fileContent, overwriteAll, user?.username || "Admin");
      if (result.success) {
        alert("¡Carga masiva aplicada exitosamente!");
        onClose();
        resetForm();
        window.location.reload();
      } else {
        setValidationErrors(result.errors);
        setValidationSuccessMsg("");
      }
    } catch (e: any) {
      alert(`Error al procesar: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    overlay: {
      position: "fixed" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(15, 23, 42, 0.75)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "20px"
    },
    modal: {
      background: "white",
      borderRadius: "20px",
      width: "100%",
      maxWidth: "750px",
      boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
      display: "flex",
      flexDirection: "column" as const,
      maxHeight: "90vh",
      overflow: "hidden"
    },
    header: {
      padding: "20px 24px",
      borderBottom: "1px solid #e2e8f0",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    },
    title: {
      fontSize: "20px",
      fontWeight: "900",
      color: "#0f172a",
      margin: 0,
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
      padding: "4px"
    },
    body: {
      padding: "24px",
      overflowY: "auto" as const,
      display: "flex",
      flexDirection: "column" as const,
      gap: "20px"
    },
    footer: {
      padding: "20px 24px",
      borderTop: "1px solid #e2e8f0",
      display: "flex",
      justifyContent: "flex-end",
      gap: "12px"
    },
    sectionTitle: {
      fontSize: "14px",
      fontWeight: "800",
      color: "#475569",
      margin: "0 0 8px 0"
    },
    card: {
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
      borderRadius: "12px",
      padding: "16px",
      display: "flex",
      flexDirection: "column" as const,
      gap: "8px"
    },
    btnPrimary: {
      padding: "10px 20px",
      background: "var(--primary)",
      color: "white",
      border: "none",
      borderRadius: "8px",
      fontSize: "13px",
      fontWeight: "700",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "8px"
    },
    btnSecondary: {
      padding: "10px 20px",
      background: "#f1f5f9",
      color: "#475569",
      border: "1px solid #e2e8f0",
      borderRadius: "8px",
      fontSize: "13px",
      fontWeight: "700",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "8px"
    },
    dropzone: {
      border: "2px dashed #cbd5e1",
      borderRadius: "12px",
      padding: "30px 20px",
      textAlign: "center" as const,
      cursor: "pointer",
      background: "#f8fafc",
      transition: "all 0.2s"
    },
    errorBox: {
      background: "#fef2f2",
      border: "1px solid #fee2e2",
      borderRadius: "12px",
      padding: "16px",
      color: "#991b1b",
      fontSize: "13px"
    },
    successBox: {
      background: "#f0fdf4",
      border: "1px solid #dcfce7",
      borderRadius: "12px",
      padding: "16px",
      color: "#166534",
      fontSize: "13px",
      fontWeight: "700"
    },
    label: {
      fontSize: "13px",
      fontWeight: "800",
      color: "#334155",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      cursor: "pointer"
    }
  };

  const formatDateString = (isoStr: string) => {
    if (!isoStr) return "";
    const date = new Date(isoStr);
    const d = date.getDate().toString().padStart(2, "0");
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const y = date.getFullYear();
    const hr = date.getHours().toString().padStart(2, "0");
    const min = date.getMinutes().toString().padStart(2, "0");
    return `${d}-${m}-${y} a las ${hr}:${min} hrs`;
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>📥 Carga Masiva de Abonados</h2>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.body}>
          {/* Step 1: Download Configuration */}
          <div>
            <h4 style={styles.sectionTitle}>Paso 1: Descargar base actual para modificar</h4>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 12px 0", lineHeight: "1.4" }}>
              Descarga la configuración actual de abonados en formato CSV. Podrás abrirla directamente en Excel, editarla, añadir o quitar filas, y luego volver a guardarla en Excel para cargarla aquí.
            </p>
            <button style={styles.btnSecondary} onClick={handleDownloadCurrent}>
              📊 Descargar Configuración Actual
            </button>
          </div>

          <hr style={{ border: 0, borderTop: "1px solid #e2e8f0", margin: "4px 0" }} />

          {/* Step 2: Upload new File */}
          <div>
            <h4 style={styles.sectionTitle}>Paso 2: Subir archivo modificado (.csv)</h4>
            <div 
              style={styles.dropzone}
              onClick={() => fileInputRef.current?.click()}
            >
              <span style={{ fontSize: "28px" }}>📁</span>
              <p style={{ margin: "8px 0 4px 0", fontSize: "13px", fontWeight: "700", color: "#334155" }}>
                {fileName ? `Archivo: ${fileName}` : "Haz clic aquí para seleccionar tu archivo CSV"}
              </p>
              <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>
                Guardado como CSV delimitado por comas o punto y coma
              </p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".csv" 
                style={{ display: "none" }} 
              />
            </div>
          </div>

          {/* Validation Feedback */}
          {validationSuccessMsg && (
            <div style={styles.successBox}>
              ✅ {validationSuccessMsg}
            </div>
          )}

          {validationErrors.length > 0 && (
            <div style={styles.errorBox}>
              <h5 style={{ margin: "0 0 8px 0", fontWeight: "900" }}>⚠️ Se encontraron errores en el archivo:</h5>
              <ul style={{ margin: 0, paddingLeft: "16px", maxHeight: "150px", overflowY: "auto" }}>
                {validationErrors.map((err, idx) => (
                  <li key={idx} style={{ marginBottom: "4px" }}>{err}</li>
                ))}
              </ul>
              <p style={{ margin: "8px 0 0 0", fontSize: "11px", color: "#b91c1c", fontWeight: "700" }}>
                Por favor, corrige estas filas en tu Excel y vuelve a subir el archivo.
              </p>
            </div>
          )}

          {/* Step 3: Options */}
          {fileContent && validationErrors.length === 0 && (
            <div>
              <h4 style={styles.sectionTitle}>Paso 3: Opciones de carga</h4>
              <div style={styles.card}>
                <label style={styles.label}>
                  <input 
                    type="checkbox" 
                    checked={overwriteAll}
                    onChange={(e) => setOverwriteAll(e.target.checked)} 
                  />
                  Sobrescribir absolutamente todos los abonados del sistema
                </label>
                <p style={{ margin: "0 0 0 22px", fontSize: "11px", color: "#64748b", lineHeight: "1.4" }}>
                  {overwriteAll 
                    ? "⚠️ ATENCIÓN: Se eliminarán todos los abonados actuales del sistema y se reemplazarán únicamente por los contenidos en el archivo."
                    : "Actualizar/Añadir: Se actualizarán únicamente los casilleros que estén en el archivo de Excel. El resto de abonados no incluidos no sufrirá cambios."
                  }
                </p>
              </div>
            </div>
          )}

          {/* Last upload log/audit */}
          {lastUpload && (
            <div style={{ ...styles.card, marginTop: "10px", background: "#f0f9ff", borderColor: "#bae6fd" }}>
              <h5 style={{ margin: "0 0 6px 0", color: "#0369a1", fontWeight: "900", fontSize: "12px" }}>
                ℹ️ Registro de Última Carga Masiva:
              </h5>
              <div style={{ fontSize: "11px", color: "#0369a1", lineHeight: "1.4" }}>
                Usuario: <strong>{lastUpload.username}</strong> <br />
                Fecha: {formatDateString(lastUpload.timestamp)} <br />
                Registros cargados: <strong>{lastUpload.successCount} abonados</strong> <br />
                Modo: {lastUpload.overwriteAll ? "Sobrescribir Todo" : "Actualizar/Añadir"}
              </div>
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button style={styles.btnSecondary} onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button 
            style={{ ...styles.btnPrimary, opacity: (!fileContent || validationErrors.length > 0 || loading) ? 0.6 : 1 }} 
            onClick={handleApplyUpload} 
            disabled={!fileContent || validationErrors.length > 0 || loading}
          >
            {loading ? "Procesando..." : "Aplicar Carga Masiva"}
          </button>
        </div>
      </div>
    </div>
  );
}
