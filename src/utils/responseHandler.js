const responseHandler = {
    success: (res, message, data = {}, status = 200) => {
        res.status(status).json({
            success: true,
            message,
            data
        });
    },

    error: (res, message, status = 500, code = 'INTERNAL_ERROR', meta = {}) => {
        const response = {
            success: false,
            error: message,
            code,
            responseCode: code // Mantener compatibilidad con el viejo sistema
        };

        // Solo mostrar stack en desarrollo
        if (process.env.NODE_ENV === 'development') {
            response.stack = meta.stack;
        }

        res.status(status).json(response);
    }
};

module.exports = responseHandler;

