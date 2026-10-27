const express = require('express');
const router = express.Router();
const { cadastrarVoluntario, listarVoluntarios, removerVoluntario } = require('../controllers/voluntarioController');
const { exigirAutenticacao, exigirPerfil } = require('../middleware/autenticacao');

const somenteFuncionario = [exigirAutenticacao, exigirPerfil('funcionario')];

router.post('/', cadastrarVoluntario);
router.get('/', ...somenteFuncionario, listarVoluntarios);
router.delete('/:id', ...somenteFuncionario, removerVoluntario);

module.exports = router;
