# 🧠 Biblioteca de Habilidades de Antigravity

Esta carpeta contiene habilidades especializadas que extienden las capacidades de Antigravity para proyectos específicos.

## 📚 Habilidades Disponibles

### 1. Detective Debugging (Método Científico)
**Archivo:** `detective_debugging/SKILL.md`  
**Propósito:** Metodología rigurosa para encontrar la causa raíz de problemas en lugar de aplicar parches sintomáticos.

**Cuándo usarla:**
- Cuando algo "dejó de funcionar"
- Cuando "resolvemos algo y falla otro lado"
- Problemas intermitentes
- Debugging complejo

**Lección clave:** Ir al origen del problema, no seguir aplicando cambios sin buscar el momento exacto del problema.

---

### 2. Simplificador Técnico Automático
**Archivo:** `simplificador_tecnico/SKILL.md`  
**Propósito:** Automatización total de tareas técnicas para evitar que el usuario ejecute comandos manuales.

**Cuándo usarla:**
- Despliegues
- Configuración de bases de datos
- Scripts de inicialización
- Cualquier tarea repetitiva

**Filosofía:** "Yo me encargo" - El usuario es el CEO, tú eres el CTO.

---

### 3. Creador de Apps Científico
**Archivo:** `creador_apps_cientifico/SKILL.md`  
**Propósito:** Planificación y desarrollo de aplicaciones web basadas en evidencia científica y necesidades reales.

**Cuándo usarla:**
- Inicio de nuevos proyectos
- Validación de ideas
- Análisis de mercado

---

### 4. Especialista en Mapas Científicos
**Archivo:** `especialista_mapas_cientificos/SKILL.md`  
**Propósito:** Implementación de mapas híbridos de alta precisión (Leaflet + Google Maps).

**Cuándo usarla:**
- Aplicaciones con geolocalización
- Mapas interactivos
- Calibración de coordenadas

---

### 5. Reparador de Autenticación Serverless
**Archivo:** `reparador_autenticacion_serverless/SKILL.md`  
**Propósito:** Diagnóstico y reparación de problemas de sesión en Vercel/NextAuth.

**Cuándo usarla:**
- Problemas de login/logout
- Sesiones que no persisten
- Errores de autenticación en producción

---

### 6. Creador de Habilidades
**Archivo:** `creador_de_habilidades/SKILL.md`  
**Propósito:** Asistente para crear nuevas habilidades en Antigravity.

**Cuándo usarla:**
- Cuando identifiques un patrón repetitivo
- Cuando quieras documentar una metodología
- Para crear nuevas skills

---

## 🚀 Cómo Usar las Habilidades

### Para el Usuario:
1. **Abre este workspace** al iniciar Antigravity
2. Las skills estarán disponibles automáticamente
3. Puedes mencionar una skill por nombre: *"Usa la habilidad Detective Debugging"*
4. O simplemente describe el problema - el agente elegirá la skill apropiada

### Para el Agente:
1. Las skills aparecen en tu contexto inicial
2. Actívalas cuando detectes las "frases clave" mencionadas en cada skill
3. Sigue la metodología documentada en cada `SKILL.md`

## 📦 Instalación en Nuevos Proyectos

**Opción A: Workspace Global (Recomendado)**
```bash
# Crea una carpeta permanente
mkdir c:\Users\pdiaz\.antigravity-skills
# Mueve esta carpeta ahí
move .agent c:\Users\pdiaz\.antigravity-skills\
# Siempre abre ese workspace primero en Antigravity
```

**Opción B: Por Proyecto**
```bash
# Copia la carpeta .agent a cada nuevo proyecto
cp -r c:\Users\pdiaz\Desarrollos\habilidades Agente\.agent nuevo-proyecto\.agent
```

## 🔄 Mantenimiento

### Actualizar una Skill
1. Edita el archivo `SKILL.md` correspondiente
2. Los cambios estarán disponibles en la próxima conversación

### Crear una Nueva Skill
1. Usa la skill "Creador de Habilidades"
2. O crea manualmente siguiendo el formato:
```markdown
---
name: Nombre de la Skill
description: Descripción breve
---

# Propósito
...

# Metodología
...
```

## 📊 Métricas de Efectividad

Para cada skill, documenta:
- ✅ Problemas resueltos
- ⏱️ Tiempo ahorrado
- 🎯 Casos de uso exitosos

Esto ayuda a mejorar las skills con el tiempo.

---

**Última actualización:** 2026-01-26  
**Mantenedor:** Patricio Díaz  
**Workspace:** `c:\Users\pdiaz\Desarrollos\habilidades Agente`
