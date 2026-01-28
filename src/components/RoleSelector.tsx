
"use client";

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { loginUser } from "@/lib/actions";

export default function RoleSelector() {
    const { user, setUser, logout } = useAuth();
    const [showLogin, setShowLogin] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await loginUser(username, password);
            if (res.success && res.user) {
                // @ts-ignore - The user object matches the context type
                setUser(res.user);
                setShowLogin(false);
                setUsername("");
                setPassword("");
            } else {
                setError(res.message || "Error al iniciar sesión");
            }
        } catch (err) {
            setError("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="role-selector-container" style={{ position: "fixed", bottom: "20px", left: "20px", zIndex: 10000 }}>
            {user ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <div style={{
                        padding: "4px 12px",
                        background: user.role === "SUPER_ADMIN" ? "#7c3aed" : (user.role === "ADMIN" ? "var(--primary)" : "#64748b"),
                        color: "white",
                        borderRadius: "8px",
                        fontSize: "11px",
                        fontWeight: "900",
                        textAlign: "center"
                    }}>
                        {user.role}
                    </div>
                    <button
                        onClick={() => logout()}
                        style={{
                            padding: "8px 16px",
                            background: "#ef4444",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: "800",
                            cursor: "pointer",
                            boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)"
                        }}
                    >
                        🔒 Salir ({user.username})
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => setShowLogin(true)}
                    style={{
                        padding: "8px 16px",
                        background: "var(--primary)",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: "800",
                        cursor: "pointer",
                        boxShadow: "0 4px 12px rgba(0, 58, 140, 0.3)"
                    }}
                >
                    🔐 Iniciar Sesión
                </button>
            )}

            {showLogin && (
                <div style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "rgba(0,0,0,0.5)",
                    backdropFilter: "blur(4px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 10001
                }}>
                    <div style={{
                        background: "white",
                        padding: "30px",
                        borderRadius: "20px",
                        width: "100%",
                        maxWidth: "400px",
                        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
                    }}>
                        <h3 style={{ margin: "0 0 20px 0", color: "var(--primary)", fontWeight: "900", fontSize: "24px" }}>Control de Acceso</h3>
                        <form onSubmit={handleLogin}>
                            <div style={{ marginBottom: "15px" }}>
                                <label style={{ display: "block", fontSize: "12px", fontWeight: "800", color: "#64748b", marginBottom: "5px", textTransform: "uppercase" }}>Usuario</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Nombre de usuario"
                                    autoFocus
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        borderRadius: "10px",
                                        border: "2px solid #e2e8f0",
                                        outline: "none",
                                        fontSize: "16px"
                                    }}
                                />
                            </div>
                            <div style={{ marginBottom: "20px" }}>
                                <label style={{ display: "block", fontSize: "12px", fontWeight: "800", color: "#64748b", marginBottom: "5px", textTransform: "uppercase" }}>Contraseña</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Tu contraseña"
                                    style={{
                                        width: "100%",
                                        padding: "12px",
                                        borderRadius: "10px",
                                        border: "2px solid #e2e8f0",
                                        outline: "none",
                                        fontSize: "16px"
                                    }}
                                />
                            </div>

                            {error && (
                                <div style={{ color: "#ef4444", background: "#fee2e2", padding: "10px", borderRadius: "8px", marginBottom: "15px", fontSize: "14px", fontWeight: "600", textAlign: "center" }}>
                                    {error}
                                </div>
                            )}

                            <div style={{ display: "flex", gap: "10px" }}>
                                <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() => setShowLogin(false)}
                                    style={{
                                        flex: 1,
                                        padding: "14px",
                                        background: "#f1f5f9",
                                        border: "none",
                                        borderRadius: "12px",
                                        fontWeight: "700",
                                        cursor: "pointer",
                                        opacity: loading ? 0.7 : 1
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{
                                        flex: 1,
                                        padding: "14px",
                                        background: "var(--primary)",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "12px",
                                        fontWeight: "800",
                                        cursor: "pointer",
                                        boxShadow: "0 4px 12px rgba(0, 58, 140, 0.3)",
                                        opacity: loading ? 0.7 : 1
                                    }}
                                >
                                    {loading ? "Cargando..." : "Entrar al Sistema"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

