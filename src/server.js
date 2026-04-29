const express = require('express');
const https = require('https');
const fs = require('fs');
const bodyParser = require('body-parser');
const path = require('path');
const os = require('os');
const mysql = require('mysql2/promise'); // Recuerda: npm install mysql2
require('dotenv').config();

const routes = require("./routes/posRoutes");
const transbankService = require("./services/transbankService");
const posManager = require("./utils/posConnect");

const app = express();
const PORT = process.env.PORT || 3000;

// --- FUNCIONES DE SOPORTE ---

// Obtiene la IP local de la interfaz conectada al router
function getNetworkIP() {
    const interfaces = os.networkInterfaces();
    let preferredIP = null;

    for (const name of Object.keys(interfaces)) {
        // Ignorar interfaces de Loopback (127.0.0.1) y Virtuales (WSL/Docker/vEthernet)
        if (name.toLowerCase().includes('loopback') || 
            name.toLowerCase().includes('vbox') || 
            name.toLowerCase().includes('virtual') || 
            name.toLowerCase().includes('wsl') ||
            name.toLowerCase().includes('vethernet')) {
            continue;
        }

        for (const iface of interfaces[name]) {
            // Buscamos IPv4 que no sea interna
            if (iface.family === 'IPv4' && !iface.internal) {
                // Si encontramos una IP que empieza con 192 (típica de router), la devolvemos de inmediato
                if (iface.address.startsWith('192.168.')) {
                    return iface.address;
                }
                preferredIP = iface.address;
            }
        }
    }
    return preferredIP || '127.0.0.1';
}

// Registra o actualiza la IP en la base de datos
async function syncDeviceToDatabase(ip) {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        const identificador = process.env.DB_IDENTIFICADOR;
        const ubicacion = process.env.DB_UBICACION;

        // Buscamos si el dispositivo existe
        const [rows] = await connection.execute(
            'SELECT id FROM dispositivos WHERE identificador = ?', 
            [identificador]
        );

        if (rows.length > 0) {
            // Actualizar
            await connection.execute(
                'UPDATE dispositivos SET ip = ?, ubicacion = ? WHERE identificador = ?',
                [ip, ubicacion, identificador]
            );
            console.log(`[DB]       Dispositivo '${identificador}' actualizado con IP: ${ip}`);
        } else {
            // Insertar nuevo
            await connection.execute(
                'INSERT INTO dispositivos (identificador, ubicacion, ip) VALUES (?, ?, ?)',
                [identificador, ubicacion, ip]
            );
            console.log(`[DB]       Nuevo dispositivo '${identificador}' registrado con IP: ${ip}`);
        }

    } catch (error) {
        console.error('[DB]       Error en sincronización:', error.message);
    } finally {
        if (connection) await connection.end();
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
    
    // Sincronizar con DB al arrancar
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

// Manejo de cierre
process.on('SIGINT', async () => {
    if (connectionMonitor) connectionMonitor.stop();
    console.log('');
    await transbankService.closeConnection();
    process.exit(0);
});
