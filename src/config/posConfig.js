require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

function getInt(envVar, fallback) {
    const parsed = parseInt(envVar, 10);
    return isNaN(parsed) ? fallback : parsed;
}

module.exports = {
    MAX_PORT_ATTEMPTS: getInt(process.env.MAX_PORT_ATTEMPTS, 3),
    PORT_RETRY_DELAY: getInt(process.env.PORT_RETRY_DELAY, 5000),
    MAX_KEY_ATTEMPTS: getInt(process.env.MAX_KEY_ATTEMPTS, 5),
    KEY_RETRY_DELAY: getInt(process.env.KEY_RETRY_DELAY, 5000),
    MONITOR_INTERVAL: getInt(process.env.MONITOR_INTERVAL, 30000),
    RECONNECT_DELAY: getInt(process.env.RECONNECT_DELAY, 10000)
};
