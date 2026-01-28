---
name: Reparador de Autenticación Serverless
description: Especialista en diagnóstico y reparación de problemas de sesión (login/logout/guardado) en entornos Vercel/NextAuth.
---

# Propósito
Esta habilidad encapsula las soluciones definitivas para los problemas recurrentes de "No autenticado", "Server Configuration Error" y bucles de redirección al cerrar sesión en aplicaciones Next.js desplegadas en Vercel.

# Síntomas Comunes
- El usuario no puede cerrar sesión (el botón no hace nada o redirige al dashboard).
- Error "No autenticado" al intentar ejecutar Server Actions (como guardar en base de datos).
- Pantalla blanca con mensaje "Application error: a client-side exception has occurred" al cerrar sesión.
- Error "There was a problem with the server configuration" en `/api/auth/signout`.

# Soluciones Estándar (Patrones)

## 1. Patrón "Salida de Emergencia" (Manual Logout)
Cuando la configuración de `NextAuth` falla en la nube, el endpoint estándar de logout deja de funcionar. La solución es **bypassear** la librería.

### Implementación
1.  Crear una **Route Handler** (`GET`) en `app/api/manual-logout/route.ts`.
2.  Esta ruta debe iterar sobre todas las cookies y borrarlas manualmente:
    ```typescript
    import { cookies } from "next/headers"
    import { NextResponse } from "next/server"

    export async function GET(request: Request) {
        const cookieStore = await cookies()
        const url = new URL("/login", request.url)
        const response = NextResponse.redirect(url)

        // Lista de cookies conocidas de Auth.js
        const authCookies = [
            "authjs.session-token",
            "__Secure-authjs.session-token",
            "next-auth.session-token",
            "__Secure-next-auth.session-token",
            "authjs.csrf-token",
            "next-auth.csrf-token",
            "next-auth.callback-url",
            "__Secure-next-auth.callback-url"
        ]

        // Borrado explícito
        authCookies.forEach((cookieName) => {
            response.cookies.delete(cookieName)
        })

        // Borrado agresivo de todo lo demás
        cookieStore.getAll().forEach((cookie) => {
            if (!authCookies.includes(cookie.name)) {
                 response.cookies.delete(cookie.name)
            }
        })

        return response
    }
    ```
3.  El botón de "Cerrar Sesión" debe ser un simple enlace `<a>` apuntando a esta ruta. **No usar Server Actions ni onClick handlers**.

## 2. Patrón "Memoria Permanente" (Fallback Secret)
En entornos serverless, si la variable `AUTH_SECRET` falla o rota, las cookies antiguas se vuelven indescifrables, causando el error "No autenticado" intermitente.

### Implementación
En el archivo de configuración `auth.ts`, forzar un secreto de respaldo si la variable de entorno falta.

```typescript
export const { handlers, auth, signIn, signOut } = NextAuth({
    // ... adaptadores y providers
    trustHost: true, // Crucial para Vercel
    secret: process.env.AUTH_SECRET || "fallback-secret-key-emergency-only", // Evita "amnesia" del servidor
    // ...
})
```

# Instrucciones de Uso
1.  Si el usuario reporta problemas de login/logout, verificar primero si `trustHost` está en `true`.
2.  Si el problema persiste, aplicar el **Patrón 2 (Fallback Secret)** inmediatamente para estabilizar la sesión.
3.  Si el logout sigue fallando, implementar el **Patrón 1 (Manual Logout)** y reemplazar el botón de la UI.
