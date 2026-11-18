const jwt = require('jsonwebtoken');
const pool = require('../config/mysql');
const { verificarAcesso } = require('../services/acesso-conta');

async function exigirAutenticacao(req, res, next) {
  const token = req.cookies?.aacd_sessao;
  if (!token || !process.env.JWT_SECRET) {
    return res.status(401).json({ erro: 'Faça login para continuar.' });
  }
  try {
    const dados = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'aacd' });
    const [rows] = await pool.execute(
      `SELECT u.id_usuario, u.nome, u.email, u.tipo_usuario, u.status,
              v.id_voluntario, v.status_homologacao, f.id_funcionario
       FROM usuario u
       LEFT JOIN voluntario v ON v.id_usuario = u.id_usuario
       LEFT JOIN funcionario_aacd f ON f.id_usuario = u.id_usuario
       WHERE u.id_usuario = ? LIMIT 1`, [dados.sub]
    );
    const usuario = rows[0];
    if (verificarAcesso(usuario, dados.perfil)) {
      return res.status(401).json({ erro: 'Sessão inválida.' });
    }
    req.usuario = { id_usuario: usuario.id_usuario, nome: usuario.nome, email: usuario.email,
      perfil: dados.perfil, id_voluntario: usuario.id_voluntario,
      id_funcionario: usuario.id_funcionario };
    next();
  } catch (erro) {
    if (erro.name === 'TokenExpiredError' || erro.name === 'JsonWebTokenError' || erro.name === 'NotBeforeError') {
      return res.status(401).json({ erro: 'Sessão inválida ou expirada.' });
    }
    console.error('Erro ao validar sessão:', erro);
    return res.status(500).json({ erro: 'Erro ao verificar sessão.' });
  }
}
function exigirPerfil(perfil) {
  return (req, res, next) => req.usuario?.perfil === perfil
    ? next() : res.status(403).json({ erro: 'Acesso não autorizado.' });
}
const somenteFuncionario = [exigirAutenticacao, exigirPerfil('funcionario')];
const somenteVoluntario = [exigirAutenticacao, exigirPerfil('voluntario')];

module.exports = { exigirAutenticacao, exigirPerfil, somenteFuncionario, somenteVoluntario };
