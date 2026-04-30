const allowCors = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
};
const express = require('express');
const https = require('https');
const fs = require('fs');
const bodyParser = require('body-parser');
const path = require('path');
const os = require('os');
const { Client } = require('pg'); // Cambiado: de mysql2 a pg
require('dotenv').config();

const routes = require("./routes/posRoutes");
const transbankService = require("./services/transbankService");
const posManager = require("./utils/posConnect");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(allowCors);

// --- FUNCIONES DE SOPORTE ---

function getNetworkIP() {
    const interfaces = os.networkInterfaces();
    let preferredIP = null;

    for (const name of Object.keys(interfaces)) {
        if (name.toLowerCase().includes('loopback') || 
            name.toLowerCase().includes('vbox') || 
            name.toLowerCase().includes('virtual') || 
            name.toLowerCase().includes('wsl') ||
            name.toLowerCase().includes('vethernet')) {
            continue;
        }

        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                if (iface.address.startsWith('192.168.')) {
                    return iface.address;
                }
                preferredIP = iface.address;
            }
        }
    }
    return preferredIP || '127.0.0.1';
}

// Registra o actualiza la IP en la base de datos (POSTGRES VERSION)
async function syncDeviceToDatabase(ip) {
    const client = new Client({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 5432, // Puerto por defecto de Postgres
    });

    try {
        await client.connect();

        const identificador = process.env.DB_IDENTIFICADOR;
        const ubicacion = process.env.DB_UBICACION;

        // Postgres usa $1, $2... en lugar de ?
        const res = await client.query(
            'SELECT id FROM bano_autoservicio.dispositivos WHERE identificador = $1', 
            [identificador]
        );

        if (res.rows.length > 0) {
            // Actualizar
            await client.query(
                'UPDATE bano_autoservicio.dispositivos SET ip = $1, ubicacion = $2 WHERE identificador = $3',
                [ip, ubicacion, identificador]
            );
            console.log(`[DB]       Dispositivo '${identificador}' actualizado con IP: ${ip}`);
        } else {
            // Insertar nuevo
            await client.query(
                'INSERT INTO bano_autoservicio.dispositivos (identificador, ubicacion, ip) VALUES ($1, $2, $3)',
                [identificador, ubicacion, ip]
            );
            console.log(`[DB]       Nuevo dispositivo '${identificador}' registrado con IP: ${ip}`);
        }

    } catch (error) {
        console.error('[DB]       Error en sincronización:', error.message);
    } finally {
        await client.end();
    }
}

// --- MIDDLEWARES Y RUTAS ---

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/', routes);

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get("/monitor", function (req, res) {
  res.json({ success: true, server: true });
});

// --- INICIO DEL SERVIDOR ---

const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, '../certs/server.key')),
    cert: fs.readFileSync(path.join(__dirname, '../certs/server.crt')),
};

https.createServer(sslOptions, app).listen(PORT, async function () {
    const localIP = getNetworkIP();
    
    console.log('');
    console.log('=============================================');
    console.log(`[SERVER]   IP RED LOCAL: ${localIP}`);
    
    await syncDeviceToDatabase(localIP);
    
    console.log(`[SERVER]   CORRIENDO EN: https://localhost:${PORT}`);
    console.log('=============================================');
});

// --- LÓGICA DEL POS ---

let connectionMonitor = null;

async function startPOSConnection() {
    if (connectionMonitor) connectionMonitor.pause();

    const result = await posManager.initializePOS();

    if (result.success) {
        console.log(`[POS]      ${result.message}`);
        console.log('');
        console.log('---------------------------------------------')
        console.log('');
        if (!connectionMonitor) {
            connectionMonitor = await posManager.monitorConnection(async () => {
                console.log('[POS]      Intentando reconectar...');
                await transbankService.closeConnection();
                if (connectionMonitor) connectionMonitor.pause();
                await posManager.sleep(5000);
                await startPOSConnection();
                if (connectionMonitor) connectionMonitor.resume();
            });
            connectionMonitor.start();
        } else {
            connectionMonitor.resume();
        }
    } else {
        console.error(`[POS]      Error: ${result.reason}`);
        console.log('[POS]      Reintentando en 10 segundos...');
        setTimeout(startPOSConnection, 10000);
    }
}

setTimeout(startPOSConnection, 10000);

process.on('SIGINT', async () => {
    if (connectionMonitor) connectionMonitor.stop();
    console.log('');
    await transbankService.closeConnection();
    process.exit(0);
});
