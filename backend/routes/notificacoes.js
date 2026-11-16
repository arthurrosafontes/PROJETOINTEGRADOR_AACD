const express = require('express');
const pool = require('../config/mysql');
const { exigirAutenticacao } = require('../middleware/autenticacao');
const { emailConfigurado } = require('../services/notificacoes');
const router = express.Router();
const emailDeTeste = () => /@resend\.dev(?:\s*>\s*)?$/i.test(process.env.AACD_EMAIL_REMETENTE?.trim() || "");
router.use(exigirAutenticacao, (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/preferencias', async (req, res) => {
  const [[p]] = await pool.execute('SELECT hub, email FROM preferencia_notificacao WHERE id_usuario = ?', [req.usuario.id_usuario]);
  res.json({ hub: p ? Boolean(p.hub) : true, email: Boolean(p?.email), emailDisponivel: emailConfigurado(), emailDeTeste: emailDeTeste() });
});

router.put('/preferencias', async (req, res) => {
  const { hub, email } = req.body || {};
  if (typeof hub !== 'boolean' || typeof email !== 'boolean') return res.status(400).json({ erro: 'Preferências inválidas.' });
  const conexao = await pool.getConnection();
  try {
    const usuario = req.usuario.id_usuario;
    await conexao.beginTransaction();
    await conexao.execute(`INSERT INTO preferencia_notificacao (id_usuario, hub, email) VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE hub = ?, email = ?`, [usuario, hub, email, hub, email]);
    if (!hub) await conexao.execute('UPDATE notificacao SET exibida = TRUE WHERE id_usuario = ? AND popup AND NOT exibida', [usuario]);
    if (!email) await conexao.execute("UPDATE notificacao SET email_estado = 'ignorado' WHERE id_usuario = ? AND email_estado = 'pendente'", [usuario]);
    await conexao.commit();
    res.json({ hub, email, emailDisponivel: emailConfigurado(), emailDeTeste: emailDeTeste() });
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally { conexao.release(); }
});

router.get('/', async (req, res) => {
  const [avisos] = await pool.execute(`SELECT n.id, n.mensagem, n.link FROM notificacao n
    LEFT JOIN preferencia_notificacao p ON p.id_usuario = n.id_usuario
    WHERE n.id_usuario = ? AND n.popup AND NOT n.exibida AND COALESCE(p.hub, TRUE)
    ORDER BY n.criada, n.id LIMIT 3`, [req.usuario.id_usuario]);
  res.json(avisos);
});

router.patch('/:id/exibida', async (req, res) => {
  if (!/^[a-f0-9-]{36}$/i.test(req.params.id)) return res.sendStatus(400);
  await pool.execute('UPDATE notificacao SET exibida = TRUE WHERE id_usuario = ? AND id = ?', [req.usuario.id_usuario, req.params.id]);
  res.sendStatus(204);
});

router.use((erro, _req, res, _next) => {
  console.error('Falha nas notificações AACD:', erro.code || erro.name);
  res.status(500).json({ erro: 'Não foi possível acessar as notificações agora.' });
});
module.exports = router;
