---
name: Detective Debugging (Método Científico)
description: Metodología rigurosa para encontrar la causa raíz de problemas en lugar de aplicar parches sintomáticos. Basado en el método científico de investigación.
---

# Propósito
Cuando un usuario reporta un problema, **NO aplicar cambios inmediatos**. En su lugar, investigar científicamente para encontrar el momento exacto y la causa raíz del problema antes de proponer soluciones.

# Filosofía
"Un problema bien diagnosticado está medio resuelto. Un problema mal diagnosticado genera 10 problemas más."

# Metodología: Los 5 Pasos del Detective

## 1. 🕐 Establecer la Línea de Tiempo
**Antes de tocar código, pregunta:**
- ¿Cuándo funcionaba correctamente?
- ¿Qué cambió entre "funcionaba" y "dejó de funcionar"?
- ¿Fue después de un despliegue? ¿Cuál commit?
- ¿Fue después de una acción del usuario? ¿Cuál?

**Ejemplo de este caso:**
- ✅ ANTES: Había datos en la base de datos
- 🔴 CAMBIO: Hicimos un "reset total" de la base de datos
- ❌ DESPUÉS: No hay datos

## 2. 🔍 Aislar la Causa Raíz
**No asumas. Verifica.**
- Revisa el commit exacto donde se introdujo el problema
- Compara archivos de configuración (package.json, .env, etc.)
- Busca flags destructivos (`--force`, `--accept-data-loss`, `--hard`)
- Verifica logs de despliegue

**Ejemplo de este caso:**
```json
// CAUSA RAÍZ ENCONTRADA:
"build": "prisma db push --accept-data-loss && next build"
//                        ^^^^^^^^^^^^^^^^^^^ 
// Este flag BORRA la base de datos en cada despliegue
```

## 3. 🧪 Formular Hipótesis
**Antes de aplicar un fix, formula una hipótesis clara:**
- "Creo que el problema es X porque Y"
- "Si cambio Z, debería resolver el problema porque..."
- "La evidencia que apoya esta hipótesis es..."

**Mal ejemplo:**
- "Voy a crear un script de seed" (sin entender por qué no hay datos)

**Buen ejemplo:**
- "El flag `--accept-data-loss` borra la DB en cada build. Si lo elimino, los datos persistirán entre despliegues."

## 4. ⚠️ Evitar el "Whack-a-Mole" (Golpear Topos)
**Señales de que estás aplicando parches en lugar de solucionar:**
- "Arreglamos X pero ahora falló Y"
- "Vamos a intentar esto a ver si funciona"
- Más de 3 intentos sin entender la causa raíz
- El usuario dice: "Resolvemos algo y falla otro lado"

**Cuando detectes esto, DETENTE y vuelve al Paso 1.**

## 5. ✅ Validar la Solución
**Después de aplicar el fix:**
- Explica por qué este cambio resuelve el problema raíz
- Identifica qué efectos secundarios podría tener
- Documenta la lección aprendida

# Casos de Uso Comunes

## Caso 1: "Los datos desaparecen después de cada despliegue"
❌ **Mal enfoque:** Crear scripts de seed cada vez más complejos
✅ **Buen enfoque:** Buscar comandos destructivos en el pipeline de build

## Caso 2: "El login funcionaba ayer, hoy no"
❌ **Mal enfoque:** Reescribir el sistema de autenticación
✅ **Buen enfoque:** Revisar qué cambió en las últimas 24 horas (git log, variables de entorno)

## Caso 3: "A veces funciona, a veces no"
❌ **Mal enfoque:** Reintentar hasta que funcione
✅ **Buen enfoque:** Buscar condiciones de carrera, cachés, o estados inconsistentes

# Frases Clave para Activar este Skill

Cuando el usuario diga:
- "Resolvemos algo y falla otro lado"
- "Antes funcionaba"
- "No entiendo por qué dejó de funcionar"
- "Esto es intermitente"

**ACTIVA ESTE SKILL INMEDIATAMENTE.**

# Checklist de Diagnóstico

Antes de proponer una solución, responde:
- [ ] ¿Sé exactamente cuándo dejó de funcionar?
- [ ] ¿Identifiqué el commit/cambio que causó el problema?
- [ ] ¿Entiendo POR QUÉ ese cambio causó el problema?
- [ ] ¿Mi solución ataca la causa raíz, no solo el síntoma?
- [ ] ¿Puedo explicar al usuario por qué esto resuelve el problema?

**Si respondiste "No" a alguna, NO apliques cambios todavía.**

# Lección de este Caso Real

**Problema reportado:** "No veo propiedades ni arrendatarios"

**Intentos fallidos (síntomas):**
1. Crear script de seed en `scripts/seed_production.ts`
2. Agregarlo al build command
3. Crear endpoint manual `/api/seed`
4. Crear botón de "Cargar Datos"

**Solución real (causa raíz):**
- Eliminar el flag `--accept-data-loss` que borraba la DB en cada build

**Tiempo perdido:** ~1 hora
**Tiempo que hubiera tomado con diagnóstico correcto:** ~5 minutos

---

**Recuerda:** "Mide dos veces, corta una vez." En desarrollo: "Diagnostica profundamente, cambia una vez."
