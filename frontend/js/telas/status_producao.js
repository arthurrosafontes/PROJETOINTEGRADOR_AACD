const express = require('express');
const mongoose = require('mongoose');
const pool = require('../../../backend/config/mysql');
const FichaImpressora = require('../../../backend/models/FichaTecnicaImpressora');
const { exigirAutenticacao, exigirPerfil } = require('../../../backend/middleware/autenticacao');

const router = express.Router();
const somenteVoluntario = [exigirAutenticacao, exigirPerfil('voluntario')];

// Status que o voluntário pode escolher na tela de status da produção.
// São os mesmos valores da coluna demanda.status.
const STATUS_PERMITIDOS = ['Aberta', 'Em produção', 'Aguardando validação', 'Concluída', 'Cancelada'];

// Depois de concluída ou cancelada, a demanda não muda mais por aqui.
// (Se quiser permitir desfazer, é só esvaziar esta lista.)
const STATUS_FINAIS = ['Concluída', 'Cancelada'];

// Status que "soltam" o pedido do voluntário: o pedido_producao dele passa a
// 'Cancelado'. Assim a demanda volta a aceitar um novo voluntário (a rota de aceite
// só bloqueia quando existe pedido_producao diferente de 'Cancelado').
const STATUS_QUE_ENCERRAM_PEDIDO = ['Aberta', 'Cancelada'];

function lerId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ erro: 'Pedido inválido.' });
    return null;
  }
  return id;
}

// A rota de publicação guarda "Paciente: fulano" dentro de demanda.observacoes
function lerPaciente(observacoes) {
  const linha = String(observacoes || '').split('\n').find(l => l.startsWith('Paciente:'));
  return linha ? linha.slice('Paciente:'.length).trim() : '';
}

// Lista os pedidos que o voluntário logado aceitou (alimenta a tela de produção)
router.get('/', ...somenteVoluntario, async (req, res) => {
  try {
    const [linhas] = await pool.execute(
      `SELECT pd.id_pedido, pd.id_impressora_mongo,
              d.id_demanda, d.status, d.tipo_filamento, d.quantidade, d.observacoes,
              DATE_FORMAT(d.prazo, '%Y-%m-%d') AS prazo,
              p.nome AS peca
         FROM pedido_producao pd
         INNER JOIN demanda d ON d.id_demanda = pd.id_demanda
         LEFT JOIN protese p ON p.id_protese = d.id_protese
        WHERE pd.id_voluntario = ? AND pd.status <> 'Cancelado'
        ORDER BY d.prazo ASC`,
      [req.usuario.id_voluntario]
    );

    // Nome da impressora vem do MongoDB
    const idsMongo = [...new Set(linhas.map(l => l.id_impressora_mongo).filter(i => mongoose.isValidObjectId(i)))];
    const impressoras = idsMongo.length
      ? await FichaImpressora.find({ _id: { $in: idsMongo } }).select('nome_da_impressora modelo_da_impressora').lean()
      : [];
    const nomePorId = new Map(impressoras.map(i => [String(i._id), i.nome_da_impressora || i.modelo_da_impressora || '']));

    res.json(linhas.map(l => ({
      id: l.id_pedido,
      idDemanda: l.id_demanda,
      paciente: lerPaciente(l.observacoes),
      peca: l.peca || '',
      status: l.status,
      entrega: l.prazo,
      material: l.tipo_filamento || '',
      quantidade: l.quantidade,
      impressora: nomePorId.get(String(l.id_impressora_mongo)) || '',
      obs: l.observacoes || ''
    })));
  } catch (erro) {
    console.error('Erro ao listar produção do voluntário:', erro);
    res.status(500).json({ erro: 'Não foi possível carregar a produção.' });
  }
});

// Altera o status de um pedido que o voluntário aceitou.
// Body: { "status": "Em produção" }
router.patch('/:id/status', ...somenteVoluntario, async (req, res) => {
  const idPedido = lerId(req, res);
  if (idPedido === null) return;

  const novoStatus = String(req.body?.status || '').trim();
  if (!STATUS_PERMITIDOS.includes(novoStatus)) {
    return res.status(400).json({ erro: `Status inválido. Use: ${STATUS_PERMITIDOS.join(', ')}.` });
  }

  let conexao;
  let transacaoIniciada = false;
  try {
    conexao = await pool.getConnection();
    await conexao.beginTransaction();
    transacaoIniciada = true;

    // Trava o pedido e a demanda. O id_voluntario vem da sessão, nunca do navegador:
    // se o pedido for de outro voluntário, a consulta não encontra nada.
    const [pedidos] = await conexao.execute(
      `SELECT pd.id_pedido, pd.id_demanda, d.status AS status_demanda
         FROM pedido_producao pd
         INNER JOIN demanda d ON d.id_demanda = pd.id_demanda
        WHERE pd.id_pedido = ?
          AND pd.id_voluntario = ?
          AND pd.status <> 'Cancelado'
        FOR UPDATE`,
      [idPedido, req.usuario.id_voluntario]
    );

    if (pedidos.length === 0) {
      await conexao.rollback();
      transacaoIniciada = false;
      return res.status(404).json({ erro: 'Pedido não encontrado entre os seus pedidos aceitos.' });
    }

    const { id_demanda: idDemanda, status_demanda: statusAtual } = pedidos[0];

    if (statusAtual === novoStatus) {
      await conexao.rollback();
      transacaoIniciada = false;
      return res.json({ mensagem: 'O pedido já está com esse status.', id: idPedido, id_demanda: idDemanda, status: statusAtual });
    }

    if (STATUS_FINAIS.includes(statusAtual)) {
      await conexao.rollback();
      transacaoIniciada = false;
      return res.status(409).json({ erro: `Pedidos com status "${statusAtual}" não podem mais ser alterados.` });
    }

    // Status da demanda no MySQL
    await conexao.execute(
      'UPDATE demanda SET status = ? WHERE id_demanda = ?',
      [novoStatus, idDemanda]
    );

    // Voltar para "Aberta" ou cancelar encerra o pedido deste voluntário
    if (STATUS_QUE_ENCERRAM_PEDIDO.includes(novoStatus)) {
      await conexao.execute(
        "UPDATE pedido_producao SET status = 'Cancelado' WHERE id_pedido = ?",
        [idPedido]
      );
    }

    await conexao.commit();
    transacaoIniciada = false;

    return res.json({
      mensagem: 'Status atualizado com sucesso!',
      id: idPedido,
      id_demanda: idDemanda,
      status: novoStatus
    });
  } catch (erro) {
    if (conexao && transacaoIniciada) {
      try { await conexao.rollback(); } catch (e) { console.error('Erro ao desfazer transação:', e); }
    }
    console.error('Erro ao alterar status do pedido:', erro);
    return res.status(500).json({ erro: 'Não foi possível alterar o status do pedido.' });
  } finally {
    if (conexao) conexao.release();
  }
});

module.exports = router;