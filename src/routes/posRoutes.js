var express = require('express');
var router = express.Router();
var posController = require('../controllers/posController');
const paymentController = require('../controllers/paymentController');

const allowCors = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
};

router.use(allowCors);

router.get('/terminal/status', posController.getStatus);
router.get('/terminal/ports', posController.listPorts);
router.post('/terminal/connect', posController.connectPort);
router.post('/terminal/release-port', posController.disconnect);
router.post('/terminal/loadKeys', posController.loadKeys);
router.get('/terminal/poll', posController.poll);
router.post('/payment', paymentController.processPayment);
router.post('/refund', paymentController.processRefund);
router.get('/terminal/last-transaction', posController.getLastTransaction);
router.post('/terminal/cierre-diario', posController.closeDay);

module.exports = router;

