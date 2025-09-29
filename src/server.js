const express = require('express');
const https = require('https');
const fs = require('fs');
const bodyParser = require('body-parser');
const path = require('path');
const routes = require("./routes/posRoutes");
const transbankService = require("./services/transbankService");
const posManager = require("./utils/posConnect")

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/', routes);

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, '../certs/server.key')),
    cert: fs.readFileSync(path.join(__dirname, '../certs/server.crt')),
};

https.createServer(sslOptions, app).listen(PORT, function () {
    console.log('');
    console.log('[SERVER]   Servidor corriendo en https://localhost:' + PORT);
});


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