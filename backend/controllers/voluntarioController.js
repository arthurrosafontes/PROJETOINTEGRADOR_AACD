const pool = require('../config/mysql');
const bcrypt = require('bcrypt');

const somenteDigitos = (valor) => String(valor ?? '').replace(/\D/g, '');

function cpfValido(cpf) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let tamanho = 9; tamanho <= 10; tamanho++) {
    const soma = [...cpf.slice(0, tamanho)].reduce((total, n, i) => total + Number(n) * (tamanho + 1 - i), 0);
    const resto = (soma * 10) % 11;
    if (Number(cpf[tamanho]) !== (resto === 10 ? 0 : resto)) return false;
  }
  return true;
}

function cnpjValido(cnpj) {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  // Validação do CNPJ numérico tradicional (14 dígitos).
  const digito = (parte, pesos) => {
    const soma = [...parte].reduce((total, n, i) => total + Number(n) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = digito(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digito(cnpj.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return Number(cnpj[12]) === d1 && Number(cnpj[13]) === d2;
}

async function cadastrarVoluntario(req, res) {
  const dados = req.body ?? {};
  const nome = String(dados.nome ?? '').trim();
  const email = String(dados.email ?? '').trim().toLowerCase();
  const telefone = somenteDigitos(dados.telefone);
  const senha = dados.senha;
  const confirmarSenha = dados.confirmar_senha;
  const tipoRecebido = String(dados.tipo_voluntario ?? '').trim();
  const tipos = {
    'Pessoa fisica': 'Pessoa física',
    'Pessoa física': 'Pessoa física',
    'Empresa': 'Empresa',
    'Universidade': 'Universidade'
  };
  const tipo = tipos[tipoRecebido];
  const documento = somenteDigitos(dados.cpf_cnpj);
  const cep = somenteDigitos(dados.cep);
  const logradouro = String(dados.logradouro ?? '').trim();
  const numero = String(dados.numero ?? '').trim();
  const complemento = String(dados.complemento ?? '').trim();
  const bairro = String(dados.bairro ?? '').trim();
  const cidade = String(dados.cidade ?? '').trim();
  const estado = String(dados.estado ?? '').trim().toUpperCase();
  const razaoSocial = String(dados.razao_social ?? '').trim();

  if (!nome || !email || !telefone || !tipo || !documento || !cep || !logradouro || !numero || !bairro || !cidade || !estado || typeof senha !== 'string' || typeof confirmarSenha !== 'string') {
    return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
  }
  if (nome.length > 150 || email.length > 150 || logradouro.length > 150 || numero.length > 20 || complemento.length > 100 || bairro.length > 100 || cidade.length > 100 || razaoSocial.length > 150) {
    return res.status(400).json({ erro: 'Um dos campos excede o tamanho permitido.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ erro: 'E-mail inválido.' });
  if (!/^\d{10,11}$/.test(telefone)) return res.status(400).json({ erro: 'Telefone inválido.' });
  if (senha !== confirmarSenha) return res.status(400).json({ erro: 'As senhas não coincidem.' });
  if (senha.length < 8 || senha.length > 72) return res.status(400).json({ erro: 'A senha deve conter entre 8 e 72 caracteres.' });
  if (!/^\d{8}$/.test(cep)) return res.status(400).json({ erro: 'CEP inválido.' });
  if (!/^[A-Z]{2}$/.test(estado)) return res.status(400).json({ erro: 'UF inválida.' });
  if (tipo === 'Pessoa física' ? !cpfValido(documento) : !cnpjValido(documento)) {
    return res.status(400).json({ erro: tipo === 'Pessoa física' ? 'CPF inválido.' : 'CNPJ inválido.' });
  }

  let conexao;
  try {
    const senhaHash = await bcrypt.hash(senha, 12);
    conexao = await pool.getConnection();
    await conexao.beginTransaction();
    const [usuario] = await conexao.execute(
      `INSERT INTO usuario (nome, email, senha_hash, telefone, tipo_usuario, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nome, email, senhaHash, telefone, 'Voluntário', 'Ativo']
    );
    const [voluntario] = await conexao.execute(
      `INSERT INTO voluntario
        (id_usuario, tipo_voluntario, cpf_cnpj, razao_social, cep, logradouro, numero,
         complemento, bairro, cidade, estado, status_homologacao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [usuario.insertId, tipo, documento, tipo === 'Pessoa física' ? null : (razaoSocial || nome),
        cep, logradouro, numero, complemento || null, bairro, cidade, estado, 'Pendente']
    );
    await conexao.commit();
    return res.status(201).json({
      mensagem: 'Voluntário cadastrado com sucesso!',
      id_usuario: usuario.insertId,
      id_voluntario: voluntario.insertId
    });
  } catch (erro) {
    if (conexao) {
      try { await conexao.rollback(); } catch (e) { console.error('Falha ao reverter transação:', e); }
    }
    if (erro.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'E-mail ou CPF/CNPJ já cadastrado.' });
    console.error('Erro ao cadastrar voluntário:', erro);
    return res.status(500).json({ erro: 'Não foi possível concluir o cadastro.' });
  } finally {
    if (conexao) conexao.release();
  }
}

module.exports = { cadastrarVoluntario };
