const transbankService = require('../services/transbankService');
const responseHandler = require('../utils/responseHandler');

const PaymentController = {

    processPayment: async (req, res) => {
        try {
            const { amount, ticketNumber } = req.body;

            if (!amount || isNaN(amount) || amount <= 0) {
                return responseHandler.error(res, 'Monto inválido', 400, 'INVALID_AMOUNT');
            }

            if (!ticketNumber || typeof ticketNumber !== 'string') {
                return responseHandler.error(res, 'Número de ticket/boleta inválido', 400, 'INVALID_TICKET');
            }

            const response = await transbankService.sale(amount, ticketNumber);
            const data = response && response.data || {};

            // Formatear respuesta
            const formattedResponse = {
                approved: data.successful,
                responseCode: data.responseCode === 0 ? '00' : 'UNKNOWN',
                operationNumber: data.operationNumber, // Mantener este nombre
                amount: data.amount,
                cardNumber: data.last4Digits ? `••••${data.last4Digits}` : null,
                authorizationCode: data.authorizationCode,
                timestamp: data.realDate && data.realTime ? `${data.realDate} ${data.realTime}` : null,
                cardType: data.cardType,
                cardBrand: data.cardBrand,
                rawData: data // Mantener todos los datos originales
            };

            return responseHandler.success(res, 'Pago procesado', formattedResponse);
        } catch (error) {
            console.error('[CONTROLLER] Error procesando pago:', error);

            // Manejo especial de errores conocidos
            const message = (error.message || '').toLowerCase();
            const isUserCancelled = message.includes('cancelada') || message.includes('cancelado');
            const isPosDisconnected = message.includes('no se pudo conectar') ||
                message.includes('pos no conectado') ||
                message.includes('pos desconectado');

            const statusCode = isUserCancelled || isPosDisconnected ? 400 : 500;
            const errorCode = isUserCancelled ? 'USER_CANCELLED' :
                isPosDisconnected ? 'POS_DISCONNECTED' :
                    (error.responseCode || 'PAYMENT_ERROR');

            const userMessage = isUserCancelled ? 'Transacción cancelada por el usuario' :
                isPosDisconnected ? 'El POS no está conectado' :
                    'Error al procesar el pago';

            return responseHandler.error(res, userMessage, statusCode, errorCode, {
                detail: error.message
            });
        }
    },

    processRefund: async (req, res) => {
        try {
            const { amount, originalOperationNumber } = req.body;

            if (!amount || isNaN(amount) || amount <= 0) {
                return responseHandler.error(res, 'Monto inválido', 400, 'INVALID_AMOUNT');
            }

            if (!originalOperationNumber) {
                return responseHandler.error(res, 'Número de operación original requerido', 400, 'MISSING_ORIGINAL_OPERATION');
            }

            const response = await transbankService.refund(originalOperationNumber);
            const data = response && response.data || {};

            // Formatear respuesta
            const formattedResponse = {
                success: data.successful,
                operationId: data.operationNumber,
                amount: data.amount,
                originalOperation: originalOperationNumber,
                timestamp: new Date().toISOString(),
                authorizationCode: data.authorizationCode
            };

            return responseHandler.success(res, 'Reversa exitosa', formattedResponse);
        } catch (error) {
            console.error('[CONTROLLER] Error procesando reversa:', error);
            return responseHandler.error(res, error.message, 500, error.responseCode || 'REFUND_ERROR', {
                detail: error.message
            });
        }
    },

    getTxStatus: async (req, res) => {
        try {
            const response = await transbankService.getTxStatus();
            return responseHandler.success(res, 'Estado de transacción', response.data);
        } catch (error) {
            console.error('[CONTROLLER] Error obteniendo estado de transacción:', error);
            return responseHandler.error(res, error.message, 500, 'TX_STATUS_ERROR');
        }
    }
};

module.exports = PaymentController;