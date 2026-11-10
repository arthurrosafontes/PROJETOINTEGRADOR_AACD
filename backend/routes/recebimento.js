const express = require('express');
const multer = require('multer');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const pool = require('../config/mysql');
const { exigirAutenticacao, exigirPerfil } = require('../middleware/autenticacao');
const { extensaoFoto } = require('./conclusao');
const router = express.Router();
const pasta = path.resolve(process.env.AACD_RECEBIMENTOS_DIR || path.join(os.homedir(), '.aacd', 'fotos-recebimento'));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 5 * 1024 * 1024, fields: 1, fieldSize: 8192, parts: 3 }
}).single('foto');

const camposRecebimento = `(SELECT JSON_OBJECT('funcionario', r.nome_funcionario,
  'data', DATE_FORMAT(r.data_recebimento, '%Y-%m-%dT%H:%i:%sZ'),
  'observacoes', r.observacoes, 'pedidoId', r.id_pedido)
  FROM recebimento_pedido r WHERE r.id_pedido = pp.id_pedido) AS recebimento`;

router.patch('/:id/receber', exigirAutenticacao, exigirPerfil('funcionario'), (req, res, next) => {
  upload(req, res, erro => erro
    ? res.status(400).json({ erro: 'Anexe uma foto JPEG ou PNG de até 5 MB e confira as observações.' })
    : next());
}, async (req, res) => {
  const id = Number(req.params.id);
  const observacoes = req.body?.observacoes ?? '';
  const extensao = req.file && extensaoFoto(req.file.buffer);
  if (!Number.isSafeInteger(id) || id <= 0 || !extensao ||
      typeof observacoes !== 'string' || observacoes.length > 2000) {
    return res.status(400).json({ erro: 'Anexe uma foto da peça em JPEG ou PNG. As observações podem ter até 2000 caracteres.' });
  }
  let c, arquivo;
  let confirmando = false;
  try {
    c = await pool.getConnection();
    await c.beginTransaction();
    const [[pedido]] = await c.execute(`SELECT pp.id_demanda, pp.status, d.status AS demanda_status
      FROM pedido_producao pp JOIN demanda d ON d.id_demanda = pp.id_demanda
      WHERE pp.id_pedido = ? FOR UPDATE`, [id]);
    if (!pedido || pedido.status !== 'Aguardando validação' || pedido.demanda_status !== 'Aguardando validação') {
      await c.rollback();
      return res.status(pedido ? 409 : 404).json({ erro: pedido
        ? 'Somente pedidos aguardando validação podem ser recebidos e aprovados.'
        : 'Pedido não encontrado.' });
    }
    const nome = randomUUID() + '.' + extensao;
    await fs.mkdir(pasta, { recursive: true, mode: 0o700 });
    arquivo = path.join(pasta, nome);
    await fs.writeFile(arquivo, req.file.buffer, { flag: 'wx', mode: 0o600 });
    await c.execute(`INSERT INTO recebimento_pedido
      (id_pedido, id_usuario, nome_funcionario, foto_arquivo, observacoes, data_recebimento)
      VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      [id, req.usuario.id_usuario, req.usuario.nome, nome, observacoes.trim() || null]);
    await c.execute("UPDATE pedido_producao SET status = 'Concluído' WHERE id_pedido = ?", [id]);
    await c.execute(`UPDATE demanda SET status = 'Concluída', resultado = 'Aprovada',
      observacoes_validacao = ?, motivo_reprovacao = NULL, data_validacao = UTC_TIMESTAMP()
      WHERE id_demanda = ?`, [observacoes.trim() || null, pedido.id_demanda]);
    await c.execute(`INSERT INTO historico_producao
      (id_pedido, id_demanda, id_usuario, status, descricao, observacoes)
      VALUES (?, ?, ?, 'Concluído', 'Peça recebida e aprovada pela AACD', ?)`,
      [id, pedido.id_demanda, req.usuario.id_usuario, observacoes.trim() || null]);
    confirmando = true;
    await c.commit();
    res.json({ id, status: 'Concluído', demandaStatus: 'Concluída' });
  } catch (erro) {
    if (c) await c.rollback().catch(() => {});
    // Preserve uma foto possivelmente confirmada se a conexão cair durante COMMIT.
    if (arquivo && !confirmando) await fs.unlink(arquivo).catch(() => {});
    console.error('Erro ao confirmar recebimento:', erro);
    res.status(500).json({ erro: 'Falha ao confirmar o recebimento. Consulte o pedido antes de tentar novamente.' });
  } finally { c?.release(); }
});

router.get('/:id/recebimento/foto', exigirAutenticacao, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.sendStatus(404);
  try {
    const [[foto]] = await pool.execute(`SELECT r.foto_arquivo FROM recebimento_pedido r
      JOIN pedido_producao p ON p.id_pedido = r.id_pedido
      WHERE r.id_pedido = ? AND (? = 'funcionario' OR p.id_voluntario = ?)`,
      [id, req.usuario.perfil, req.usuario.id_voluntario ?? null]);
    if (!foto || !/^[a-f0-9-]{36}\.(jpg|png)$/.test(foto.foto_arquivo)) return res.sendStatus(404);
    res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    res.sendFile(path.join(pasta, foto.foto_arquivo), { dotfiles: 'allow' }, erro => {
      if (erro && !res.headersSent) res.sendStatus(404);
    });
  } catch { res.sendStatus(500); }
});
module.exports = { router, camposRecebimento };
