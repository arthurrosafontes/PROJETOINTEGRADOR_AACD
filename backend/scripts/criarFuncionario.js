require('dotenv').config();
const readline = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');
const bcrypt = require('bcrypt');
const pool = require('../config/mysql');

async function main() {
  const rl = readline.createInterface({ input, output });
  let conexao;
  try {
    const nome = (await rl.question('Nome completo: ')).trim();
    const email = (await rl.question('E-mail institucional: ')).trim().toLowerCase();
    const telefone = (await rl.question('Telefone (opcional): ')).replace(/\D/g, '');
    const setor = (await rl.question('Setor (opcional): ')).trim();
    const cargo = (await rl.question('Cargo (opcional): ')).trim();
    const senha = await rl.question('Senha de teste (ficara visivel no terminal): ');
    const confirmacao = await rl.question('Confirme a senha: ');

    if (!nome || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Nome ou e-mail invalido.');
    if (senha.length < 8 || senha !== confirmacao) throw new Error('A senha precisa ter ao menos 8 caracteres e coincidir com a confirmacao.');
    if (telefone && !/^\d{10,11}$/.test(telefone)) throw new Error('Telefone invalido.');

    const hash = await bcrypt.hash(senha, 12);
    conexao = await pool.getConnection();
    await conexao.beginTransaction();
    const [usuario] = await conexao.execute(
      'INSERT INTO usuario (nome, email, senha_hash, telefone, tipo_usuario, status) VALUES (?, ?, ?, ?, ?, ?)',
      [nome, email, hash, telefone || null, 'Funcionário AACD', 'Ativo']
    );
    const [funcionario] = await conexao.execute(
      'INSERT INTO funcionario_aacd (id_usuario, setor, cargo) VALUES (?, ?, ?)',
      [usuario.insertId, setor || null, cargo || null]
    );
    await conexao.commit();
    console.log(`Funcionario cadastrado. id_usuario=${usuario.insertId}; id_funcionario=${funcionario.insertId}`);
  } catch (erro) {
    if (conexao) await conexao.rollback();
    if (erro.code === 'ER_DUP_ENTRY') console.error('E-mail ja cadastrado.');
    else console.error('Falha:', erro.message);
    process.exitCode = 1;
  } finally {
    if (conexao) conexao.release();
    rl.close();
    await pool.end();
  }
}
main();
