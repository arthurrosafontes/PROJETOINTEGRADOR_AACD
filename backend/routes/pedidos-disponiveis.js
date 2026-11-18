const router = require('express').Router();
const mongoose = require('mongoose');
const FichaImpressora = require('../models/FichaTecnicaImpressora');
const pool = require('../config/mysql');
const { somenteVoluntario } = require('../middleware/autenticacao');
const { avaliar: avaliarCompatibilidade } = require('../services/compatibilidade');
const { mudarStatusProtese } = require('../services/status-protese');
const materialAacd = require('./material-aacd');
const notificacoes = require('../services/notificacoes');

// OBJETIVO 14 — Listar pedidos disponíveis para voluntários

router.get('/api/disponiveis', ...somenteVoluntario, async (req, res) => {
  try {
    const [linhas] = await pool.execute(`
      SELECT
        d.*, d.id_demanda AS id,
        p.nome AS peca,
        d.tipo_filamento AS material,
        d.quantidade,
        d.prioridade,
        DATE_FORMAT(d.prazo, '%Y-%m-%d') AS prazo,
        DATE_FORMAT(d.data_cadastro, '%Y-%m-%d') AS criado,
        d.tempo_estimado_horas AS tempoHoras,
        d.observacoes AS obs
      FROM demanda d
      INNER JOIN protese p
        ON p.id_protese = d.id_protese
      WHERE d.status = 'Aberta'
      ORDER BY d.data_cadastro DESC
    `);

    const equipamentos = await FichaImpressora.find({id_voluntario:req.usuario.id_voluntario}).lean();
    const pedidos = linhas.filter(d => equipamentos.some(i => avaliarCompatibilidade(d,i).compativel)).map(p => ({
      id: p.id,
      peca: p.peca,
      material: p.material,
      quantidade: p.quantidade,
      prioridade: p.prioridade,
      prazo: p.prazo,
      criado: p.criado,
      tempo: p.tempoHoras != null
        ? `${Number(p.tempoHoras)} horas`
        : 'Não informado',
      obs: p.obs || ''
    }));

    res.status(200).json(pedidos);

  } catch (erro) {
    console.error('Erro ao listar pedidos disponíveis:', erro);

    res.status(500).json({
      erro: 'Não foi possível carregar os pedidos disponíveis.'
    });
  }
});

// OBJETIVO 14 — Aceitar pedido disponível

router.patch('/api/disponiveis/:id/aceitar', ...somenteVoluntario, async (req, res) => {
  const idDemanda = Number(req.params.id);
  const idImpressora = String(req.body?.id_impressora_mongo || '').trim();
  const doacaoMaterial = req.body?.doacao_material;
  let solicitacaoMaterial;
  if (doacaoMaterial === false) {
    try { solicitacaoMaterial = materialAacd.validarSolicitacao(req.body?.materialAacd); }
    catch (e) { return res.status(400).json({ erro: e.message }); }
  }

if (typeof doacaoMaterial !== 'boolean') {
  return res.status(400).json({
    erro: 'Informe se deseja doar o material para fabricação.'
  });
}
  const idVoluntario = req.usuario.id_voluntario;

  // Validar o ID da demanda
  if (!Number.isSafeInteger(idDemanda) || idDemanda <= 0) {
    return res.status(400).json({
      erro: 'ID da demanda inválido.'
    });
  }

  // Validar o ID da impressora
  if (!mongoose.isValidObjectId(idImpressora)) {
    return res.status(400).json({
      erro: 'Selecione uma impressora válida.'
    });
  }

  // Verificar se a impressora pertence ao voluntário
  try {
    const impressora = await FichaImpressora.findOne({
      _id: idImpressora,
      id_voluntario: idVoluntario
    });

    if (!impressora) {
      return res.status(403).json({
        erro: 'Esta impressora não pertence ao voluntário.'
      });
    }

  } catch (erro) {
    console.error('Erro ao verificar impressora:', erro);

    return res.status(500).json({
      erro: 'Não foi possível verificar a impressora.'
    });
  }

  let conexao;
  let transacaoIniciada = false;

  try {
    conexao = await pool.getConnection();
    await conexao.beginTransaction();
    transacaoIniciada = true;

    // Bloquear a demanda para evitar aceites simultâneos
    const [demandas] = await conexao.execute(
      `SELECT *
       FROM demanda
       WHERE id_demanda = ?
       FOR UPDATE`,
      [idDemanda]
    );

    if (demandas.length === 0) {
      await conexao.rollback();
      transacaoIniciada = false;

      return res.status(404).json({
        erro: 'Demanda não encontrada.'
      });
    }

    const demanda = demandas[0];

    // Somente demandas abertas podem ser aceitas
    if (demanda.status !== 'Aberta') {
      await conexao.rollback();
      transacaoIniciada = false;

      return res.status(409).json({
        erro: 'Este pedido não está mais disponível.'
      });
    }

    // Revalidar no servidor; não confiar no ranking anterior nem no navegador.
    const equipamentoAtual = await FichaImpressora.findOne({ _id: idImpressora, id_voluntario: idVoluntario }).lean();
    const compatibilidade = equipamentoAtual && avaliarCompatibilidade(demanda, equipamentoAtual);
    if (!compatibilidade?.compativel) {
      await conexao.rollback(); transacaoIniciada = false;
      return res.status(409).json({ erro: equipamentoAtual
        ? 'Impressora incompatível: ' + compatibilidade.motivos.join(' ')
        : 'A impressora não está mais disponível para este voluntário.' });
    }

    // Verificar se já existe um pedido ativo para essa demanda
    const [pedidosExistentes] = await conexao.execute(
      `SELECT id_pedido
       FROM pedido_producao
       WHERE id_demanda = ?
         AND status <> 'Cancelado'
       LIMIT 1`,
      [idDemanda]
    );

    if (pedidosExistentes.length > 0) {
      await conexao.rollback();
      transacaoIniciada = false;

      return res.status(409).json({
        erro: 'Esta demanda já possui um pedido de produção.'
      });
    }

    // Registrar o aceite no MySQL
    const [resultado] = await conexao.execute(
      `INSERT INTO pedido_producao (
        id_demanda,
        id_voluntario,
        id_impressora_mongo,
        quantidade_atribuida,
        status,
        doacao_material
      )
      VALUES (?, ?, ?, ?, 'Aceito', ?)`,
      [
        idDemanda,
        idVoluntario,
        idImpressora,
        demanda.quantidade,
        doacaoMaterial ? 1 : 0
      ]
    );
    if (solicitacaoMaterial) await materialAacd.registrarSolicitacao(conexao, resultado.insertId, demanda.tipo_filamento, solicitacaoMaterial);
    // Atualizar status da demanda
    await conexao.execute(
      `UPDATE demanda
       SET status = 'Aceita'
       WHERE id_demanda = ?`,
      [idDemanda]
    );

    await mudarStatusProtese(conexao, demanda.id_protese, 'aceite');

    await notificacoes.pedido(conexao, resultado.insertId, 'aceite', 'A demanda foi aceita pelo voluntário.');

    // Confirmar todas as alterações
    await conexao.commit();
    transacaoIniciada = false;

    return res.status(201).json({
      mensagem: 'Pedido aceito com sucesso!',
      id_pedido: resultado.insertId,
      id_demanda: idDemanda
    });

  } catch (erro) {
    if (conexao && transacaoIniciada) {
      try {
        await conexao.rollback();
      } catch (erroRollback) {
        console.error('Erro ao desfazer transação:', erroRollback);
      }
    }

    console.error('Erro ao aceitar pedido:', erro);

    return res.status(500).json({
      erro: 'Não foi possível registrar o aceite.'
    });

  } finally {
    if (conexao) {
      conexao.release();
    }
  }
});

module.exports = router;
