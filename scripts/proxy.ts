
import express from 'express';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 8080;
const VERCEL_URL = 'https://portal-sistema-estacionamientos.vercel.app/api/hikvision';

app.use(express.json());
app.use(express.text({ type: ['*/xml', 'text/xml'] }));

// Endpoint para recibir eventos de la cámara
app.post('/api/hikvision', async (req, res) => {
    console.log(`\n🚗 Evento recibido de la cámara [${new Date().toISOString()}]`);
    console.log('Payload:', JSON.stringify(req.body, null, 2));

    try {
        const response = await fetch(VERCEL_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Forzamos el host para que Vercel sepa a qué proyecto va
                'Host': 'portal-sistema-estacionamientos.vercel.app'
            },
            body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
        });

        const data = await response.json();
        console.log('✅ Reenviado a Vercel. Respuesta:', data);
        res.status(response.status).json(data);
    } catch (error) {
        console.error('❌ Error reenviando a Vercel:', error);
        res.status(500).json({ success: false, error: 'Error en el Proxy' });
    }
});

app.get('/health', (req, res) => {
    res.send('Proxy LPR activo y funcionando 🚀');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Proxy LPR iniciado en el puerto ${PORT}`);
    console.log(`📍 Apunta la cámara a: http://[TU_IP_FIJA]:${PORT}/api/hikvision`);
});
