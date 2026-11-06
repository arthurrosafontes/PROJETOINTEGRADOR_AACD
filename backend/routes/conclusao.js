const express = require('express');
const multer = require('multer');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const pool = require('../config/mysql');
const { exigirAutenticacao, exigirPerfil } = require('../middleware/autenticacao');

const router = express.Router();
const pasta = path.resolve(process.env.AACD_FOTOS_DIR || path.join(os.homedir(), '.aacd', 'fotos-producao'));
const receber = multer({
  storage: multer.memoryStorage(),
  limits: { files: 5, fileSize: 5 * 1024 * 1024, fields: 4, fieldSize: 8192, parts: 10 }
}).array('fotos', 5);

// Usada pelas duas consultas de pedidos; retorna somente IDs públicos das fotos.
const camposConclusao = `IF(pp.data_conclusao IS NULL, NULL, JSON_OBJECT(
  'material', pp.material_utilizado, 'gramas', pp.peso_utilizado_gramas,
  'minutos', ROUND(pp.tempo_real_horas * 60), 'observacoes', pp.observacoes_voluntario,
  'data', DATE_FORMAT(pp.data_conclusao, '%Y-%m-%dT%H:%i:%sZ'),
  'fotos', (SELECT JSON_ARRAYAGG(f.id_foto) FROM foto_pedido_producao f WHERE f.id_pedido = pp.id_pedido)
)) AS conclusao`;

function extensaoFoto(buffer) {
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
      && buffer.toString('ascii', 12, 16) === 'IHDR') return 'png';
  if (buffer.length >= 4 && buffer.readUInt16BE(0) === 0xffd8 && buffer[2] === 0xff
      && buffer.readUInt16BE(buffer.length - 2) === 0xffd9) return 'jpg';
  return null;
}

router.patch('/:id/finalizar', exigirAutenticacao, exigirPerfil('voluntario'), (req, res, next) => {
  receber(req, res, erro => erro
    ? res.status(400).json({ erro: 'Envie até 5 fotos JPEG ou PNG de até 5 MB cada e confira os campos.' })
    : next());
}, async (req, res) => {
  const id = Number(req.params.id);
  const { material, gramas, minutos, observacoes = '' } = req.body || {};
  const fotos = req.files || [];
  if (!Number.isSafeInteger(id) || id <= 0 || typeof material !== 'string' || !material.trim() ||
      material.trim().length > 50 || !/^\d{1,8}(\.\d{1,2})?$/.test(gramas) || Number(gramas) <= 0 ||
      !/^\d{1,8}$/.test(minutos) || Number(minutos) < 1 || Number(minutos) > 59999999 ||
      typeof observacoes !== 'string' || observacoes.length > 2000) {
    return res.status(400).json({ erro: 'Confira o material, o peso, o tempo e as observações da impressão.' });
  }
  const tipos = fotos.map(f => extensaoFoto(f.buffer));
  if (tipos.includes(null)) return res.status(400).json({ erro: 'Escolha fotos nos formatos JPEG ou PNG.' });

  const gravadas = [];
  let conexao;
  let confirmando = false;
  try {
    conexao = await pool.getConnection();
    await conexao.beginTransaction();
    const [pedidos] = await conexao.execute(
      `SELECT pp.status, d.status AS demandaStatus, d.id_demanda FROM pedido_producao pp
       JOIN demanda d ON d.id_demanda = pp.id_demanda
       WHERE pp.id_pedido = ? AND pp.id_voluntario = ? FOR UPDATE`, [id, req.usuario.id_voluntario]);
    const pedido = pedidos[0];
    if (!pedido || pedido.status !== 'Em produção' || pedido.demandaStatus !== 'Em produção') {
      await conexao.rollback();
      return res.status(pedido ? 409 : 404).json({ erro: pedido ? 'Somente pedidos em produção podem ser finalizados.' : 'Pedido não encontrado.' });
    }
    if (fotos.length) await fs.mkdir(pasta, { recursive: true, mode: 0o700 });
    for (const [i, foto] of fotos.entries()) {
      const nome = randomUUID() + '.' + tipos[i];
      const arquivo = path.join(pasta, nome);
      gravadas.push(arquivo);
      await fs.writeFile(arquivo, foto.buffer, { flag: 'wx', mode: 0o600 });
      await conexao.execute('INSERT INTO foto_pedido_producao (id_pedido, caminho_arquivo) VALUES (?, ?)', [id, nome]);
    }
    await conexao.execute(`UPDATE pedido_producao SET material_utilizado = ?, peso_utilizado_gramas = ?,
      tempo_real_horas = ROUND(? / 60, 2), observacoes_voluntario = ?, data_conclusao = UTC_TIMESTAMP(),
      status = 'Aguardando envio' WHERE id_pedido = ?`,
      [material.trim(), gramas, Number(minutos), observacoes.trim() || null, id]);
    await conexao.execute(`INSERT INTO historico_producao (id_pedido, id_demanda, id_usuario, status, descricao)
      VALUES (?, ?, ?, 'Aguardando envio', 'Impressão finalizada')`, [id, pedido.id_demanda, req.usuario.id_usuario]);
    confirmando = true;
    await conexao.commit();
    res.json({ id, status: 'Aguardando envio' });
  } catch (erro) {
    if (conexao) await conexao.rollback().catch(() => {});
    // Em caso de perda de conexão durante COMMIT, preserve os arquivos possivelmente vinculados.
    if (!confirmando) await Promise.allSettled(gravadas.map(f => fs.unlink(f)));
    console.error('Erro na conclusão da impressão:', erro);
    res.status(500).json({ erro: 'Falha ao confirmar a conclusão. Consulte o pedido antes de tentar novamente.' });
  } finally { conexao?.release(); }
});

router.get('/fotos/:id', exigirAutenticacao, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.sendStatus(404);
  try {
    const [rows] = await pool.execute(`SELECT f.caminho_arquivo FROM foto_pedido_producao f
      JOIN pedido_producao p ON p.id_pedido = f.id_pedido
      WHERE f.id_foto = ? AND (? = 'funcionario' OR p.id_voluntario = ?)`,
      [id, req.usuario.perfil, req.usuario.id_voluntario]);
    const nome = rows[0]?.caminho_arquivo;
    if (!nome || !/^[a-f0-9-]{36}\.(jpg|png)$/.test(nome)) return res.sendStatus(404);
    res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    res.sendFile(path.join(pasta, nome), { dotfiles: 'allow' }, erro => { if (erro && !res.headersSent) res.sendStatus(404); });
  } catch { res.sendStatus(500); }
});
module.exports = { router, camposConclusao };
