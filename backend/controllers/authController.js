const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/mysql');

// Fotos de perfil: uploads/fotos-perfil/<id_usuario>.jpg ou .png (uma por usuário)
const PASTA_FOTOS = path.join(__dirname, '..', '..', 'uploads', 'fotos-perfil');
fs.mkdirSync(PASTA_FOTOS, { recursive: true });

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

// ===== Meu perfil =====

// Foto atual do usuário (ou null se ele ainda não tiver foto)
function caminhoFoto(idUsuario) {
  const opcoes = ['.jpg', '.png'].map(ext => path.join(PASTA_FOTOS, `${Number(idUsuario)}${ext}`));
  return opcoes.find(arquivo => fs.existsSync(arquivo)) || null;
}

// Dados da conta do usuário logado (os de voluntário ou de funcionário vêm vazios para o outro perfil)
async function perfil(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT u.nome, u.email, u.telefone,
              f.setor, f.cargo,
              v.tipo_voluntario, v.cpf_cnpj, v.razao_social, v.status_homologacao,
              v.logradouro, v.numero, v.complemento, v.bairro, v.cidade, v.estado, v.cep
       FROM usuario u
       LEFT JOIN funcionario_aacd f ON f.id_usuario = u.id_usuario
       LEFT JOIN voluntario v ON v.id_usuario = u.id_usuario
       WHERE u.id_usuario = ? LIMIT 1`,
      [req.usuario.id_usuario]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    return res.json({ ...rows[0], perfil: req.usuario.perfil, temFoto: caminhoFoto(req.usuario.id_usuario) !== null });
  } catch (erro) {
    console.error('Erro ao carregar perfil:', erro);
    return res.status(500).json({ erro: 'Não foi possível carregar o perfil.' });
  }
}

function verFoto(req, res) {
  const foto = caminhoFoto(req.usuario.id_usuario);
  if (!foto) return res.status(404).json({ erro: 'Sem foto de perfil.' });
  return res.sendFile(foto);
}

// Salva a foto enviada (req.file vem do multer). O tipo é conferido pelos
// primeiros bytes do arquivo, e não pela extensão, que pode ser falsa.
async function enviarFoto(req, res) {
  const bytes = req.file ? req.file.buffer : Buffer.alloc(0);
  const extensao = bytes[0] === 0xff && bytes[1] === 0xd8 ? '.jpg'
    : bytes.toString('ascii', 1, 4) === 'PNG' ? '.png'
    : null;
  if (!extensao) return res.status(400).json({ erro: 'Envie uma imagem JPG ou PNG.' });

  try {
    const antiga = caminhoFoto(req.usuario.id_usuario);
    if (antiga) await fs.promises.unlink(antiga);
    await fs.promises.writeFile(path.join(PASTA_FOTOS, `${Number(req.usuario.id_usuario)}${extensao}`), bytes);
    return res.json({ mensagem: 'Foto atualizada.' });
  } catch (erro) {
    console.error('Erro ao salvar foto de perfil:', erro);
    return res.status(500).json({ erro: 'Não foi possível salvar a foto.' });
  }
}

module.exports = { login, sair, perfil, verFoto, enviarFoto };
