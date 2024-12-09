const express = require('express');
const callController = require('../controller/callController');


const router = express.Router();

//=============Public Api Routes==================

router.get('/call-history', callController.getCallHistory);


module.exports = router;
