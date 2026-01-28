---
name: Especialista en Mapas Científicos
description: Experto en implementación de mapas híbridos de alta precisión (Leaflet + Google Maps Tiles) con calibración absoluta y auto-zoom inteligente.
---

# Especialista en Mapas Científicos

Esta habilidad permite al agente implementar soluciones geoespaciales de grado científico, priorizando la precisión visual absoluta sobre la cartografía real de Google Maps sin los bloqueos técnicos de una API Key tradicional.

## Propósito
Garantizar que los activos inmobiliarios se visualicen exactamente en las coordenadas reales, eliminando errores de píxel y permitiendo una gestión visual efectiva mediante indicadores de estado (colores) e interactividad avanzada.

## Reglas de Oro
1. **Motor Híbrido**: Utilizar siempre `react-leaflet` como motor principal de renderizado por su estabilidad, pero inyectar las capas oficiales de Google Maps (Tiles) para precisión visual.
2. **Precisión Absoluta**: Al recibir coordenadas de enlaces externos (Google Maps), no intentar "ajustarlas" o "corregirlas". Inyectar el valor decimal exacto en la base de datos.
3. **Auto-Zoom Científico (FitBounds)**: El mapa NUNCA debe ser estático. Debe recalcular sus límites (`fitBounds`) inmediatamente después de que cambie la lista de propiedades mostradas (por filtros o búsqueda).
4. **Interactividad Navegable**: Cada marcador debe ser un portal. El Popup del marcador debe contener un enlace directo a la ficha técnica del activo.
5. **Parseo de Coordenadas Robustas**: El buscador de coordenadas debe aceptar múltiples formatos (separados por coma, espacio o barra) y preservar todos los decimales pegados desde Google Maps.

## Instrucciones Técnicas

### 1. Implementación del Tile Layer de Google
Usar la siguiente configuración para los Tiles de Google en Leaflet:
```tsx
<TileLayer
    url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
    subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
    attribution='&copy; Google Maps'
/>
```

### 2. Controlador de Zoom Dinámico
Implementar un `useEffect` dentro de un sub-componente que use `useMap()` para ajustar la vista:
```tsx
useEffect(() => {
    if (properties.length > 0) {
        const bounds = L.latLngBounds(properties.map(p => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
    }
}, [properties, map]);
```

### 3. Gestión de Iconos de Estado
Utilizar `L.divIcon` para crear marcadores minimalistas y de alto contraste:
- **Rojo (#ef4444)**: Estado Crítico / Arrendada.
- **Verde (#22c55e)**: Estado Disponible / Operativo.
- **Azul (#3b82f6)**: Edición Activa / Selección.

### 4. Calibración de Datos
Cuando se trabaje con Prisma, asegurar que los campos `latitud` y `longitud` utilicen el tipo `Float` y manejar la nulidad devolviendo una coordenada de fallback segura (ej: Centro de Santiago) para evitar el colapso del mapa.

# Ejemplos de Éxito
- **Lo Prado (Dinamarca 5424)**: Calibración realizada mediante inyección directa de coordenadas `-33.4571546, -70.7105982`.
- **Maipú (Ciudad Satélite)**: Calibración absoluta utilizando `-33.5654606, -70.7803392`.
