const express = require('express');
const router = express.Router();
const { cadastrarVoluntario, listarVoluntarios, aceitarVoluntario, removerVoluntario } = require('../controllers/voluntarioController');
const { exigirAutenticacao, exigirPerfil } = require('../middleware/autenticacao');

const somenteFuncionario = [exigirAutenticacao, exigirPerfil('funcionario')];

router.post('/', cadastrarVoluntario);
router.get('/', ...somenteFuncionario, listarVoluntarios);
router.patch('/:id/aceitar', ...somenteFuncionario, aceitarVoluntario);
router.delete('/:id',...somenteFuncionario, removerVoluntario);

module.exports = router;
