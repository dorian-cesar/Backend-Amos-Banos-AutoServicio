const transbankService = require('../services/transbankService');
const responseHandler = require('../utils/responseHandler');

const POSController = {

  getStatus: async (req, res) => {
    try {
      const status = {
        connected: transbankService.deviceConnected,
        port: transbankService.connection && transbankService.connection.path || null,
        status: transbankService.deviceConnected ? 'Conectado' : 'Desconectado'
      };

      return responseHandler.success(res, 'Estado de conexión', status);
    } catch (error) {
      console.error('[CONTROLLER] Error obteniendo estado del POS:', error);
      return responseHandler.error(res, 'Error al obtener estado', 500, 'STATUS_ERROR');
    }
  },

  listPorts: async (req, res) => {
    try {
      const ports = await transbankService.listAvailablePorts();
      const filteredPorts = ports.filter(function (port) {
        return port.path && port.path.includes('ACM');
      });

      return responseHandler.success(res, 'Puertos disponibles', filteredPorts);
    } catch (error) {
      console.error('[CONTROLLER] Error listando puertos:', error);
      return responseHandler.error(res, 'Error al listar puertos', 500, 'PORT_LIST_ERROR', {
        detail: error.message
      });
    }
  },

  connectPort: async (req, res) => {
    const { portPath } = req.body;

    if (!portPath) {
      return responseHandler.error(res, 'Debe proporcionar un puerto', 400, 'MISSING_PORT');
    }

    try {
      const connected = await transbankService.connectToPort(portPath);
      if (!connected) {
        return responseHandler.error(res, 'No se pudo conectar al puerto', 500, 'PORT_CONNECTION_FAILED');
      }

      // Intentar cargar llaves
      try {
        await transbankService.loadKey();
        return responseHandler.success(res, 'Conectado al puerto y llaves cargadas', {
          port: portPath,
          keysLoaded: true
        });
      } catch (keyError) {
        console.warn('[CONTROLLER]  Conectado pero no se cargaron llaves:', keyError);
        return responseHandler.success(res, 'Conectado al puerto pero no se cargaron las llaves', {
          port: portPath,
          keysLoaded: false,
          warning: keyError.message
        });
      }
    } catch (error) {
      console.error('[CONTROLLER] Error conectando al puerto:', error);
      return responseHandler.error(res, error.message, 500, 'CONNECTION_ERROR');
    }
  },

  autoConnect: async (req, res) => {
    try {
      const connected = await transbankService.autoConnect();
      if (!connected) {
        return responseHandler.error(res, 'No se pudo autoconectar', 500, 'AUTOCONNECT_FAILED');
      }

      // Intentar cargar llaves
      try {
        await transbankService.loadKey();
        return responseHandler.success(res, 'Autoconectado y llaves cargadas', {
          port: transbankService.connection && transbankService.connection.path || null,
          keysLoaded: true
        });
      } catch (keyError) {
        console.warn('[CONTROLLER]  Autoconectado pero no se cargaron llaves:', keyError);
        return responseHandler.success(res, 'Autoconectado pero no se cargaron las llaves', {
          port: transbankService.connection && transbankService.connection.path || null,
          keysLoaded: false,
          warning: keyError.message
        });
      }
    } catch (error) {
      console.error('[CONTROLLER] Error en autoconexión:', error);
      return responseHandler.error(res, error.message, 500, 'AUTOCONNECT_ERROR');
    }
  },

  disconnect: async (req, res) => {
    try {
      const result = await transbankService.closeConnection();
      if (!result) {
        return responseHandler.error(res, 'No había conexión activa', 400, 'NO_ACTIVE_CONNECTION');
      }
      return responseHandler.success(res, 'Desconectado del POS correctamente');
    } catch (error) {
      console.error('[CONTROLLER] Error desconectando:', error);
      return responseHandler.error(res, error.message, 500, 'DISCONNECT_ERROR');
    }
  },

  loadKeys: async (req, res) => {
    try {
      const result = await transbankService.loadKey();
      return responseHandler.success(res, result.message || 'Llaves cargadas correctamente', result);
    } catch (error) {
      console.error('[CONTROLLER] Error cargando llaves:', error);
      return responseHandler.error(res, error.message, 500, 'LOAD_KEYS_ERROR', {
        detail: error.message
      });
    }
  },

  poll: async (req, res) => {
    try {
      const { deviceConnected, connection } = await transbankService.isAlive();

      return responseHandler.success(res, 'Estado del POS', {
        alive: deviceConnected,
        port: connection && connection.path ? connection.path : null
      });
    } catch (error) {
      console.error('[CONTROLLER] Error en poll:', error);
      return responseHandler.error(res, error.message, 500, 'POLL_ERROR');
    }
  },

  closeDay: async (req, res) => {
    try {
      const response = await transbankService.closeDay();
      return responseHandler.success(res, 'Cierre de día ejecutado', response.data);
    } catch (error) {
      console.error('[CONTROLLER] Error en cierre de día:', error);
      return responseHandler.error(res, error.message, 500, 'CLOSE_DAY_ERROR', {
        detail: error.message
      });
    }
  },

  getLastTransaction: async (req, res) => {
    try {
      const response = await transbankService.getLastSale();
      const data = response.data;

      const formattedResponse = {
        approved: data.successful,
        operationNumber: data.operationNumber,
        amount: data.amount,
        cardNumber: data.last4Digits ? `••••${data.last4Digits}` : null,
        authorizationCode: data.authorizationCode,
        timestamp: data.realDate && data.realTime ? `${data.realDate} ${data.realTime}` : null,
        cardType: data.cardType,
        cardBrand: data.cardBrand
      };

      return responseHandler.success(res, 'Última transacción obtenida', formattedResponse);
    } catch (error) {
      console.error('[CONTROLLER] Error obteniendo última transacción:', error);
      return responseHandler.error(res, 'Error al obtener la transacción', 500, 'LAST_TXN_FAILED', {
        detail: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  },

  getTotals: async (req, res) => {
    try {
      const response = await transbankService.getTotals();
      return responseHandler.success(res, 'Totales obtenidos', response.data);
    } catch (error) {
      console.error('[CONTROLLER] Error obteniendo totales:', error);
      return responseHandler.error(res, error.message, 500, 'GET_TOTALS_ERROR');
    }
  },

  salesDetail: async (req, res) => {
    try {
      const printOnPos = req.query.print === 'true';
      const response = await transbankService.salesDetail(printOnPos);
      return responseHandler.success(res, 'Detalle de ventas obtenido', response.data);
    } catch (error) {
      console.error('[CONTROLLER] Error obteniendo detalle de ventas:', error);
      return responseHandler.error(res, error.message, 500, 'SALES_DETAIL_ERROR');
    }
  }
};

module.exports = POSController;