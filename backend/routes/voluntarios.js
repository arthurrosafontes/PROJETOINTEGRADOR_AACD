const express = require('express');
const router = express.Router();
const { cadastrarVoluntario } = require('../controllers/voluntarioController');

router.post('/', cadastrarVoluntario);

module.exports = router;
