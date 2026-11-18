const { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } = require('node:crypto');
const bcrypt = require('bcrypt');
const router = require('express').Router();
const pool = require('../config/mysql');
const { emailConfigurado, enviarEmail } = require('../services/email');

const mensagemEnvio = 'Se o e-mail estiver cadastrado e a conta estiver ativa, você receberá um código.';
const janelaMs = 15 * 60 * 1000;

function limitarPorIp(maximo) {
  const acessos = new Map();
  let fimDaJanela = 0;
  return (req, res, next) => {
    const agora = Date.now();
    if (agora >= fimDaJanela) {
      acessos.clear();
      fimDaJanela = agora + janelaMs;
    }
    const total = acessos.get(req.ip) || 0;
    if (total >= maximo || (total === 0 && acessos.size >= 10000)) {
      return res.set('Retry-After', String(Math.ceil((fimDaJanela - agora) / 1000)))
        .status(429).json({ erro: 'Muitas solicitações. Aguarde alguns minutos e tente novamente.' });
    }
    acessos.set(req.ip, total + 1);
    next();
  };
}

function resumoCodigo(id, codigo) {
  return createHmac('sha256', process.env.JWT_SECRET).update(`recuperacao:${id}:${codigo}`).digest();
}

function resumoAutorizacao(autorizacao) {
  return createHash('sha256').update(autorizacao).digest();
}

// A conta é bloqueada primeiro em todas as operações, inclusive quando ainda não há código.
async function comConta(email, operacao) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();
    const [[usuario]] = await conexao.execute(
      "SELECT id_usuario, email FROM usuario WHERE email = ? AND status = 'Ativo' LIMIT 1 FOR UPDATE", [email]
    );
    const resultado = usuario ? await operacao(conexao, usuario) : null;
    await conexao.commit();
    return resultado;
  } catch (erro) {
    await conexao.rollback().catch(() => {});
    throw erro;
  } finally {
    conexao.release();
  }
}

function tratarRequisicao(operacao) {
  return async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ erro: 'Informe um e-mail válido.' });
    }
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      return res.status(503).json({ erro: 'A recuperação de senha está temporariamente indisponível.' });
    }
    try {
      return await operacao(req, res, email);
    } catch (erro) {
      console.error('Falha na recuperação de senha:', erro.code || erro.name);
      return res.status(503).json({ erro: 'A recuperação de senha está temporariamente indisponível.' });
    }
  };
}

async function enviarCodigo({ destinatario, codigo }) {
  try {
    const resposta = await enviarEmail({
      destinatario,
      assunto: 'Código para redefinir sua senha no Hub AACD',
      texto: `Seu código de recuperação é ${codigo}. Ele vale por 15 minutos e só pode ser usado uma vez.\n\nSe você não solicitou a recuperação, ignore este e-mail.`,
      idempotencia: 'aacd/recuperacao/' + randomUUID()
    });
    if (!resposta.ok) console.warn('O Resend recusou o código de recuperação (HTTP %s). Consulte o painel do Resend.', resposta.status);
    await resposta.body?.cancel().catch(() => {});
  } catch {
    console.warn('O Resend não respondeu ao envio do código de recuperação.');
  }
}

router.post('/solicitar', limitarPorIp(12), tratarRequisicao(async (_req, res, email) => {
  if (!emailConfigurado()) {
    return res.status(503).json({ erro: 'O envio de código por e-mail está temporariamente indisponível.' });
  }
  const envio = await comConta(email, async (conexao, usuario) => {
    const id = usuario.id_usuario;
    const [[recente]] = await conexao.execute(`SELECT id_usuario FROM recuperacao_senha
      WHERE id_usuario = ? AND enviada_em > UTC_TIMESTAMP() - INTERVAL 1 MINUTE`, [id]);
    if (recente) return null;
    const codigo = String(randomInt(1000000)).padStart(6, '0');
    const hash = resumoCodigo(id, codigo);
    await conexao.execute(`INSERT INTO recuperacao_senha
      (id_usuario, codigo_hash, enviada_em, expira_em)
      VALUES (?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP() + INTERVAL 15 MINUTE)
      ON DUPLICATE KEY UPDATE codigo_hash = ?, autorizacao_hash = NULL, tentativas = 0,
        enviada_em = UTC_TIMESTAMP(), expira_em = UTC_TIMESTAMP() + INTERVAL 15 MINUTE`, [id, hash, hash]);
    return { destinatario: usuario.email, codigo };
  });

  // A resposta pública não espera o provedor, para evitar revelar contas pelo tempo de resposta.
  if (envio) void enviarCodigo(envio);
  return res.status(202).json({ mensagem: mensagemEnvio });
}));

router.post('/validar', limitarPorIp(40), tratarRequisicao(async (req, res, email) => {
  const { codigo } = req.body;
  if (typeof codigo !== 'string' || !/^\d{6}$/.test(codigo)) {
    return res.status(400).json({ erro: 'Digite os 6 dígitos do código.' });
  }
  const autorizacao = await comConta(email, async (conexao, { id_usuario: id }) => {
    const [[pedido]] = await conexao.execute(`SELECT codigo_hash FROM recuperacao_senha
      WHERE id_usuario = ? AND codigo_hash IS NOT NULL AND tentativas < 5 AND expira_em > UTC_TIMESTAMP()`, [id]);
    if (!pedido) return null;
    if (!timingSafeEqual(pedido.codigo_hash, resumoCodigo(id, codigo))) {
      await conexao.execute('UPDATE recuperacao_senha SET tentativas = tentativas + 1 WHERE id_usuario = ?', [id]);
      return null;
    }
    const token = randomBytes(32).toString('hex');
    await conexao.execute(`UPDATE recuperacao_senha SET codigo_hash = NULL, autorizacao_hash = ?,
      expira_em = UTC_TIMESTAMP() + INTERVAL 10 MINUTE WHERE id_usuario = ?`, [resumoAutorizacao(token), id]);
    return token;
  });
  if (!autorizacao) {
    return res.status(400).json({ erro: 'Código inválido, expirado ou sem tentativas restantes. Confira o código ou solicite outro.' });
  }
  return res.json({ autorizacao });
}));

router.post('/redefinir', limitarPorIp(40), tratarRequisicao(async (req, res, email) => {
  const { autorizacao, senha } = req.body;
  if (typeof senha !== 'string' || senha.length < 8 || Buffer.byteLength(senha, 'utf8') > 72) {
    return res.status(400).json({ erro: 'Use pelo menos 8 caracteres. O limite é de 72 bytes.' });
  }
  const erroAutorizacao = 'A autorização para trocar a senha expirou ou já foi usada. Solicite outro código.';
  if (typeof autorizacao !== 'string' || !/^[0-9a-f]{64}$/.test(autorizacao)) {
    return res.status(400).json({ erro: erroAutorizacao });
  }
  const alterada = await comConta(email, async (conexao, { id_usuario: id }) => {
    const [[pedido]] = await conexao.execute(`SELECT autorizacao_hash FROM recuperacao_senha
      WHERE id_usuario = ? AND autorizacao_hash IS NOT NULL AND expira_em > UTC_TIMESTAMP()`, [id]);
    if (!pedido || !timingSafeEqual(pedido.autorizacao_hash, resumoAutorizacao(autorizacao))) return false;
    const hash = await bcrypt.hash(senha, 12);
    await conexao.execute('UPDATE usuario SET senha_hash = ? WHERE id_usuario = ?', [hash, id]);
    await conexao.execute('DELETE FROM recuperacao_senha WHERE id_usuario = ?', [id]);
    return true;
  });
  if (!alterada) return res.status(400).json({ erro: erroAutorizacao });
  return res.json({ mensagem: 'Senha alterada. Entre com a nova senha.' });
}));

module.exports = router;
