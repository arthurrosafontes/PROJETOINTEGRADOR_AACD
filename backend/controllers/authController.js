const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/mysql');

const COOKIE_NAME = 'aacd_sessao';
const normalizar = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

async function login(req, res) {
  const { email, senha, perfil } = req.body || {};
  if (typeof email !== 'string' || typeof senha !== 'string' ||
      !email.trim() || !senha || !['voluntario', 'funcionario'].includes(perfil)) {
    return res.status(400).json({ erro: 'Informe e-mail, senha e perfil válidos.' });
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('JWT_SECRET ausente ou muito curto no .env');
    return res.status(500).json({ erro: 'Autenticação não configurada no servidor.' });
  }
  try {
    const [rows] = await pool.execute(
      `SELECT u.id_usuario, u.nome, u.email, u.senha_hash, u.tipo_usuario, u.status,
              v.id_voluntario, v.status_homologacao, f.id_funcionario
       FROM usuario u
       LEFT JOIN voluntario v ON v.id_usuario = u.id_usuario
       LEFT JOIN funcionario_aacd f ON f.id_usuario = u.id_usuario
       WHERE u.email = ? LIMIT 1`,
      [email.trim().toLowerCase()]
    );
    const usuario = rows[0];
    // Mensagem genérica evita revelar se o e-mail existe.
    if (!usuario || !(await bcrypt.compare(senha, usuario.senha_hash))) {
      return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
    }
    const perfilBanco = normalizar(usuario.tipo_usuario);
    const permitido = perfil === 'voluntario'
      ? perfilBanco === 'voluntario' && usuario.id_voluntario != null
      : perfilBanco === 'funcionario aacd' && usuario.id_funcionario != null;
    if (!permitido) return res.status(403).json({ erro: 'Conta sem acesso a esta área.' });
    if (normalizar(usuario.status) !== 'ativo') {
      return res.status(403).json({ erro: 'Essa conta foi reprovada.' });
    }
    // Voluntário só entra depois que um funcionário aceitar o cadastro
    if (perfil === 'voluntario' && normalizar(usuario.status_homologacao) !== 'aprovado') {
      return res.status(403).json({
        erro: normalizar(usuario.status_homologacao) === 'pendente'
          ? 'Seu cadastro ainda está aguardando a aprovação da AACD.'
          : 'Seu cadastro de voluntário não está ativo.'
      });
    }
    const token = jwt.sign(
      { sub: String(usuario.id_usuario), perfil, id_voluntario: usuario.id_voluntario || null,
        id_funcionario: usuario.id_funcionario || null },
      process.env.JWT_SECRET,
      { expiresIn: '8h', issuer: 'aacd' }
    );
    res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: 8 * 60 * 60 * 1000 });
    return res.json({ mensagem: 'Login realizado com sucesso!', usuario: {
      id_usuario: usuario.id_usuario, nome: usuario.nome, email: usuario.email, perfil
    }});
  } catch (erro) {
    console.error('Erro na autenticação:', erro);
    return res.status(500).json({ erro: 'Não foi possível realizar o login.' });
  }
}

function sair(req, res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  return res.json({ mensagem: 'Sessão encerrada.' });
}
module.exports = { login, sair };
