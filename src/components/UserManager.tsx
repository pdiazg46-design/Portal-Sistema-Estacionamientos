
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getUsers, createUser, deleteUser, getAccesses } from "@/lib/actions";

export default function UserManager() {
    const { user, isSuperAdmin, isAdmin } = useAuth();
    const [userList, setUserList] = useState<any[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [formData, setFormData] = useState({
        username: "",
        password: "",
        role: "OPERATOR" as any,
        accessId: ""
    });
    const [accessList, setAccessList] = useState<any[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isAdmin) {
            refreshUsers();
            loadAccesses();
        }
    }, [isAdmin]);

    const loadAccesses = async () => {
        const accs = await getAccesses();
        setAccessList(accs);
    };

    const refreshUsers = async () => {
        const users = await getUsers();
        setUserList(users);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        // Map data for Drizzle (ensure empty string becomes null for foreign key if needed, or just send it)
        const finalData = {
            ...formData,
            accessId: formData.accessId === "" ? null : formData.accessId
        };

        const res = await createUser(finalData as any);
        if (res.success) {
            setShowCreate(false);
            setFormData({ username: "", password: "", role: "OPERATOR", accessId: "" });
            refreshUsers();
        } else {
            setError(res.message || "Error al crear usuario");
        }
        setLoading(false);
    };

    const handleDelete = async (id: string, username: string) => {
        if (confirm(`¿Estás seguro de eliminar al usuario ${username}?`)) {
            const res = await deleteUser(id);
            if (res.success) {
                refreshUsers();
            } else {
                alert(res.message);
            }
        }
    };

    if (!isAdmin) return null;

    return (
        <div style={{ marginTop: "40px", background: "white", padding: "30px", borderRadius: "var(--border-radius)", boxShadow: "var(--shadow)" }} className="animate-fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2 style={{ margin: 0, color: "var(--primary)", fontWeight: "900" }}>Gestión de Usuarios</h2>
                <button
                    onClick={() => setShowCreate(true)}
                    style={{ padding: "10px 20px", background: "var(--success)", color: "white", border: "none", borderRadius: "10px", fontWeight: "800", cursor: "pointer" }}
                >
                    + Nuevo Usuario
                </button>
            </div>

            <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ borderBottom: "2px solid #f1f5f9", textAlign: "left" }}>
                            <th style={{ padding: "12px", color: "#64748b", fontSize: "14px" }}>Usuario</th>
                            <th style={{ padding: "12px", color: "#64748b", fontSize: "14px" }}>Rol</th>
                            <th style={{ padding: "12px", color: "#64748b", fontSize: "14px" }}>Acceso</th>
                            <th style={{ padding: "12px", color: "#64748b", fontSize: "14px" }}>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {userList.map(u => (
                            <tr key={u.user.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "12px", fontWeight: "700" }}>{u.user.username}</td>
                                <td style={{ padding: "12px" }}>
                                    <span style={{
                                        padding: "4px 8px",
                                        borderRadius: "6px",
                                        fontSize: "12px",
                                        fontWeight: "800",
                                        background: u.user.role === "SUPER_ADMIN" ? "#ede9fe" : (u.user.role === "ADMIN" ? "#dbeafe" : "#f1f5f9"),
                                        color: u.user.role === "SUPER_ADMIN" ? "#7c3aed" : (u.user.role === "ADMIN" ? "var(--primary)" : "#64748b")
                                    }}>
                                        {u.user.role}
                                    </span>
                                </td>
                                <td style={{ padding: "12px", fontSize: "13px", color: "#64748b" }}>
                                    {u.access?.name || (u.user.role === "OPERATOR" ? "No asignado" : "Acceso Global")}
                                </td>
                                <td style={{ padding: "12px" }}>
                                    {u.user.username !== user?.username && u.user.role !== "SUPER_ADMIN" && (
                                        <button
                                            onClick={() => handleDelete(u.user.id, u.user.username)}
                                            style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "18px" }}
                                            title="Eliminar"
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showCreate && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)",
                    backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 11000
                }}>
                    <div style={{ background: "white", padding: "30px", borderRadius: "20px", width: "100%", maxWidth: "450px" }}>
                        <h3 style={{ margin: "0 0 20px 0", color: "var(--primary)", fontWeight: "900" }}>Nuevo Usuario</h3>
                        <form onSubmit={handleCreate}>
                            <div style={{ marginBottom: "15px" }}>
                                <label style={{ display: "block", fontSize: "12px", fontWeight: "800", color: "#64748b", marginBottom: "5px" }}>USUARIO</label>
                                <input
                                    required
                                    style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "2px solid #e2e8f0" }}
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                />
                            </div>
                            <div style={{ marginBottom: "15px" }}>
                                <label style={{ display: "block", fontSize: "12px", fontWeight: "800", color: "#64748b", marginBottom: "5px" }}>CONTRASEÑA</label>
                                <input
                                    required type="password"
                                    style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "2px solid #e2e8f0" }}
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                            <div style={{ marginBottom: "20px" }}>
                                <label style={{ display: "block", fontSize: "12px", fontWeight: "800", color: "#64748b", marginBottom: "5px" }}>ROL</label>
                                <select
                                    style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "2px solid #e2e8f0" }}
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                >
                                    {isSuperAdmin && <option value="ADMIN">ADMINISTRADOR (Cliente)</option>}
                                    <option value="OPERATOR">OPERADOR (Guardia)</option>
                                </select>
                            </div>

                            {formData.role === "OPERATOR" && (
                                <div style={{ marginBottom: "20px" }}>
                                    <label style={{ display: "block", fontSize: "12px", fontWeight: "800", color: "#64748b", marginBottom: "5px" }}>ACCESO ASIGNADO</label>
                                    <select
                                        required
                                        style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "2px solid #e2e8f0" }}
                                        value={formData.accessId}
                                        onChange={e => setFormData({ ...formData, accessId: e.target.value })}
                                    >
                                        <option value="">Seleccione una puerta...</option>
                                        {accessList.map(a => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {error && <div style={{ color: "#ef4444", marginBottom: "15px", fontWeight: "600" }}>{error}</div>}

                            <div style={{ display: "flex", gap: "10px" }}>
                                <button type="button" onClick={() => setShowCreate(false)} style={{ flex: 1, padding: "12px", background: "#f1f5f9", border: "none", borderRadius: "10px", fontWeight: "700", cursor: "pointer" }}>Cancelar</button>
                                <button disabled={loading} type="submit" style={{ flex: 1, padding: "12px", background: "var(--primary)", color: "white", border: "none", borderRadius: "10px", fontWeight: "800", cursor: "pointer" }}>
                                    {loading ? "Creando..." : "Crear Usuario"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
