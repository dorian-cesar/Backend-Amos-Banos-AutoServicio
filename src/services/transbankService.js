const { POSAutoservicio } = require('transbank-pos-sdk');

class TransbankService {

    constructor() {
        this.pos = new POSAutoservicio();
        this.connectedPort = null;
        this.pos.setDebug(false);
        this.operationQueue = [];
        this.isProcessing = false;
        this.inTransaction = false;
    }

    async enqueueOperation(operation) {
        return new Promise((resolve, reject) => {
            this.operationQueue.push({ operation, resolve, reject });
            if (this.isProcessing) return;
            this.isProcessing = true;
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.operationQueue.length === 0 || !this.deviceConnected) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        const { operation, resolve, reject } = this.operationQueue.shift();

        try {
            const result = await operation();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            setTimeout(() => this.processQueue(), 0);
        }
    }

    get deviceConnected() {
        return this.connectedPort !== null;
    }

    get connection() {
        return this.connectedPort;
    }

    async isAlive() {
        return {
            deviceConnected: this.deviceConnected,
            connection: this.connection
        };
    }

    async listAvailablePorts() {
        try {
            const ports = await this.pos.listPorts();
            console.log("[SERVICE]  Puertos encontrados exitosamente");
            return ports;
        } catch (err) {
            console.log('[SERVICE]  Ocurrió un error listando los puertos, ', err.message);
            return [];
        }
    }

    async loadKey() {
        try {
            await this.pos.loadKeys();
            return { success: true, message: 'Llaves cargadas correctamente' };
        } catch (error) {
            console.log("[SERVICE]  Error al cargar llaves:", error)
            throw error;
        }
    }

    async connectToPort(portPath) {
        try {
            const response = await this.pos.connect(portPath);
            if (!response) {
                throw new Error('Respuesta indefinida al conectar');
            }
            this.connectedPort = Object.assign({ path: portPath }, response);
            return true;
        } catch (err) {
            console.error('[SERVICE]  Ocurrió un error al conectar con el POS:', err.message || 'Error desconocido');
            this.connectedPort = null;
            return false;
        }
    }

    async autoConnect() {
        try {
            const response = await this.pos.autoconnect();
            if (!response || !response.portName) {
                throw new Error('No se pudo obtener portName');
            }
            this.connectedPort = Object.assign({ path: response.portName }, response);
            return true;
        } catch (err) {
            console.error('[SERVICE]  Ocurrió un error al autoconectar con el POS:', err.message);
            this.connectedPort = null;
            return false;
        }
    }

    async closeConnection() {
        if (!this.connectedPort) {
            console.log("[SERVICE]  No hay conexión activa para cerrar");
            return false;
        }

        try {
            await this.pos.disconnect();
            console.log('[SERVICE]  Conexión con POS cerrada correctamente');
            this.connectedPort = null;
            return true;
        } catch (error) {
            console.log('[SERVICE]  Error al cerrar conexión con POS:', error.message);
        }
    }

    async closeDay() {
        try {
            const response = await this.pos.closeDay();
            return { success: true, data: response };
        } catch (error) {
            console.error("[SERVICE]  Error cerrando día:", error.message);
            throw error;
        }
    }

    async getLastSale() {
        try {
            const response = await this.pos.getLastSale();
            return { success: true, data: response };
        } catch (error) {
            console.error("[SERVICE]  Error obteniendo última venta:", error.message);
            throw error;
        }
    }

    async getTotals() {
        try {
            const response = await this.pos.getTotals();
            return { success: true, data: response };
        } catch (error) {
            console.error("[SERVICE]  Error obteniendo totales:", error.message);
            throw error;
        }
    }

    async salesDetail(printOnPos = false) {
        try {
            const response = await this.pos.salesDetail(printOnPos);
            return { success: true, data: response };
        } catch (error) {
            console.error("[SERVICE]  Error obteniendo detalle de ventas:", error.message);
            throw error;
        }
    }

    async refund(operationId) {
        try {
            const response = await this.pos.refund(operationId);
            return { success: true, data: response };
        } catch (error) {
            console.error("[SERVICE]  Error realizando reversa:", error.message);
            throw error;
        }
    }


    async sale(amount, ticket, sendStatus = false, callback = null) {
        return this.enqueueOperation(() => this._sale(amount, ticket, sendStatus, callback));
    }

    async _sale(amount, ticket, sendStatus = false, callback = null) {
        this.inTransaction = true;
        try {
            if (!this.connectedPort) {
                throw new Error('POS no conectado');
            }

            const response = await this.pos.sale(amount, ticket, sendStatus, callback);

            if (!response || typeof response !== 'object') {
                throw new Error('Respuesta inválida del POS');
            }

            return { success: true, data: response };
        } catch (error) {
            console.error("[SERVICE]  Error procesando venta:", error.message);
            
            return {
                success: false,
                error: error.message,
                shouldReconnect:
                    typeof error.message === 'string' &&
                    error.message.includes('desconectado')
            };
        } finally {
            this.inTransaction = false;
        }
    }

    async send(payload, waitResponse = true, callback = null) {
        try {
            const response = await this.pos.send(payload, waitResponse, callback);
            return { success: true, data: response };
        } catch (error) {
            console.error("[SERVICE]  Error enviando comando:", error.message);
            throw error;
        }
    }

    async getTxStatus() {
        try {
            const response = await this.pos.poll();
            return { success: true, data: response };
        } catch (error) {
            console.error("[SERVICE]  Error ejecutando poll:", error.message);
            throw error;
        }
    }
}

module.exports = new TransbankService();
