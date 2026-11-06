const express = require('express');
const pool = require('../config/mysql');
const { exigirAutenticacao, exigirPerfil } = require('../middleware/autenticacao');
const { lerObservacoes } = require('./observacoes-demanda');
const router = express.Router();
const modalidades = ['Envio pelos Correios', 'Voluntário entrega na unidade', 'Retirada pela equipe'];

const camposEnvio = `(SELECT JSON_OBJECT('modalidade', e.modalidade, 'data', DATE_FORMAT(e.data_envio, '%Y-%m-%d'),
  'rastreio', e.codigo_rastreio, 'recebedor', e.funcionario_recebedor, 'observacoes', e.observacoes)
  FROM envio_pedido e WHERE e.id_pedido = pp.id_pedido) AS envio`;

function dataValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor < '1000-01-01') return false;
  const dia = new Date(valor + 'T12:00:00Z');
  const hoje = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  return Number.isFinite(dia.getTime()) && dia.toISOString().slice(0, 10) === valor && valor <= hoje;
}

router.patch('/:id/envio', exigirAutenticacao, exigirPerfil('voluntario'), async (req, res) => {
  const id = Number(req.params.id);
  const { data, rastreio, recebedor, observacoes = '' } = req.body || {};
  if (!Number.isSafeInteger(id) || id <= 0 || !dataValida(data) || typeof observacoes !== 'string' || observacoes.trim().length > 1000) {
    return res.status(400).json({ erro: 'Confira a data do envio e as observações. Use uma data válida até hoje.' });
  }
  let c;
  try {
    c = await pool.getConnection();
    await c.beginTransaction();
    const [[pedido]] = await c.execute(`SELECT pp.id_demanda, pp.status, d.status AS demandaStatus, d.observacoes
      FROM pedido_producao pp JOIN demanda d ON d.id_demanda = pp.id_demanda
      WHERE pp.id_pedido = ? AND pp.id_voluntario = ? FOR UPDATE`, [id, req.usuario.id_voluntario]);
    if (!pedido || pedido.status !== 'Aguardando envio' || !['Em produção', 'Aguardando envio'].includes(pedido.demandaStatus)) {
      await c.rollback();
      return res.status(pedido ? 409 : 404).json({ erro: pedido ? 'Este pedido não está disponível para registrar envio.' : 'Pedido não encontrado.' });
    }
    const modalidade = lerObservacoes(pedido.observacoes).formaEntrega;
    if (!modalidades.includes(modalidade)) {
      await c.rollback();
      return res.status(409).json({ erro: 'A forma de entrega precisa ser definida pela AACD.' });
    }
    const correios = modalidade === modalidades[0];
    const comprovacao = correios ? rastreio : recebedor;
    if (typeof comprovacao !== 'string' || !comprovacao.trim() || comprovacao.trim().length > (correios ? 80 : 150)) {
      await c.rollback();
      return res.status(400).json({ erro: correios ? 'Informe o código de rastreio (até 80 caracteres).' : 'Informe o nome do funcionário que recebeu a peça (até 150 caracteres).' });
    }
    await c.execute(`INSERT INTO envio_pedido (id_pedido, modalidade, data_envio, codigo_rastreio, funcionario_recebedor, observacoes)
      VALUES (?, ?, ?, ?, ?, ?)`, [id, modalidade, data, correios ? comprovacao.trim() : null, correios ? null : comprovacao.trim(), observacoes.trim() || null]);
    await c.execute("UPDATE pedido_producao SET status = 'Aguardando validação' WHERE id_pedido = ?", [id]);
    await c.execute("UPDATE demanda SET status = 'Aguardando validação' WHERE id_demanda = ?", [pedido.id_demanda]);
    await c.execute(`INSERT INTO historico_producao (id_pedido,id_demanda,id_usuario,status,descricao)
      VALUES (?,?,?,'Aguardando validação','Envio registrado')`, [id,pedido.id_demanda,req.usuario.id_usuario]);
    await c.commit();
    res.json({ id, status: 'Aguardando validação' });
  } catch (erro) {
    if (c) await c.rollback().catch(() => {});
    console.error('Erro ao registrar envio:', erro);
    res.status(500).json({ erro: 'Falha ao registrar o envio. Consulte o pedido antes de tentar novamente.' });
  } finally { c?.release(); }
});
module.exports = { router, camposEnvio };
