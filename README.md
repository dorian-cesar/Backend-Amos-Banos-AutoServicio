# Integración Transbank POS
Este backend permite conectar y controlar un dispositivo `POS Transbank` en modo autoservicio, adaptado para hardware antiguo (Debian 8 y Node.js 10). Está diseñado para ejecutar operaciones como ventas, reversiones y monitoreo de estado del POS, garantizando reconexión automática y evitando bloqueos por operaciones simultáneas.

## Características principales
 - Conexión automática al POS vía puerto serial `(/dev/ttyACM*)`
 - Carga de llaves para operar
 - Monitoreo periódico de estado con `poll()`
 - Manejo de cola para evitar operaciones simultáneas
 - Reintento automático ante desconexiones
 - APIs REST para consumo por parte de un frontend u otros sistemas
 - Compatible con entorno `Node.js 10` y `Debian 8`

## Estructura del proyecto
```
.
└── BACKEND-POS/
    ├── node_modules/               # Dependencias del proyecto
    ├── src/                        # Código fuente principal
    │   ├── config/                 # Configuraciones generales
    │   │   └── posConfig.js
    │   ├── controllers/            # Controladores de rutas/API
    │   │   ├── paymentController.js
    │   │   └── posController.js
    │   ├── public/                 # tester
    │   │   └── index.html
    │   ├── routes/                 # Definición de rutas
    │   │   └── posRoutes.js
    │   ├── services/               # Lógica central del POS (Transbank SDK)
    │   │   └── transbankService.js
    │   ├── utils/                  # Utilidades y helpers
    │   │   ├── posConnect.js
    │   │   └── responseHandler.js
    │   └── server.js               # Archivo principal del servidor
    ├── certs/                      # Certificados SSL 
    │   ├── server.crt
    │   └── server.key
    ├── .env                        # Variables de entorno
    ├── .gitignore                  # Archivos ignorados por Git
    ├── package-lock.json
    └── package.json   
```
## Descripción de archivos principales
| Ubicación | Nombre | Función |
| ------ | ------ | ------ |
| src/config/ | posConfig.js | Contiene la configuración base del sistema (reintentos, tiempos) |
| src/controllers/ | paymentController.js | Controla las operaciones de pago y validación de parámetros |
| src/controllers/ | posController.js | Gestiona acciones generales del POS (estado, reconexión) |
| src/routes/ | posRoutes.js | Define las APIs para interactuar con el POS |
| src/services/ | transbankService.js | Lógica central para manejar conexión y operaciones con el POS |
| src/utils/ | posConnect.js | Busca puertos disponibles y maneja conexión/reintentos al POS | 
| src/utils/ | responseHandler.js | Estructura respuestas uniformes para el cliente | 
| src/ | server.js | Archivo principal que levanta el servidor y gestiona eventos | 
| src/public/ | index.html | Página de prueba para interactuar con el POS | 
| certs/ | server.crt | Certificado SSL para HTTPS | 
| certs/ | server.key | Llave privada SSL para HTTPS | 
| .env	| .env	| Variables de entorno para configuración segura |

## Cómo iniciar el servidor
### Instalar dependencias
```
npm install
```
### (Opcional) Crear archivo .env con variables personalizadas

### Iniciar el servidor
```
node src/server.js
```

## Requisitos
- Node.js 10.x
- Sistema operativo compatible con dispositivos USB Serial `(ej: /dev/ttyACM0)`
- SDK POS Transbank en modo autoservicio
- Dispositivo POS Transbank conectado por USB
