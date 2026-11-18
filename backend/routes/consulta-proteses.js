const express = require('express');
const pool = require('../config/mysql');
const { somenteFuncionario } = require('../middleware/autenticacao');

const router = express.Router();

router.get('/proteses', ...somenteFuncionario, async (req, res) => {
  try {
    const [linhas] = await pool.query(
      `SELECT id_protese, nome, codigo, tipo, regiao_corpo, material_recomendado,
              largura, profundidade, altura, altura_camada, infill, status
         FROM protese
        ORDER BY nome`
    );
    res.json(linhas);
  } catch (erro) {
    console.error('Erro ao listar próteses:', erro);
    res.status(500).json({ erro: 'Não foi possível listar as próteses.' });
  }
});

module.exports = router;
