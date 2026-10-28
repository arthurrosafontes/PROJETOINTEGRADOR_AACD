const express = require('express');
const pool = require('../config/mysql');
const { exigirAutenticacao, exigirPerfil } = require('../middleware/autenticacao');

const router = express.Router();
const somenteFuncionario = [exigirAutenticacao, exigirPerfil('funcionario')];

const PRIORIDADES = ['Baixa', 'Normal', 'Alta', 'Urgente'];
// Só demandas abertas podem ser editadas; nos outros status dá para adicionar observação
const STATUS_EDITAVEIS = ['Aberta'];
// Depois que a peça foi enviada para validação, a demanda não é mais cancelada por aqui
const STATUS_CANCELAVEIS = ['Rascunho', 'Aberta', 'Em produção'];

// A rota de publicação guarda nome, paciente, entrega etc. no campo "observacoes",
// uma informação por linha ("Rótulo: valor"). Aqui essas linhas viram campos.
const ROTULOS_OBS = {
  nome: 'Nome da demanda',
  paciente: 'Paciente',
  formaEntrega: 'Forma de entrega',
  responsavel: 'Responsável',
  instrucoes: 'Instruções',
  observacoes: 'Observações'
};

function lerObservacoes(texto) {
  const campos = {};
  const linhas = String(texto || '').split('\n');
  let atual = null;
  for (const linha of linhas) {
    const chave = Object.keys(ROTULOS_OBS).find(k => linha.startsWith(`${ROTULOS_OBS[k]}:`));
    if (chave) {
      atual = chave;
      campos[chave] = linha.slice(ROTULOS_OBS[chave].length + 1).trim();
    } else if (atual) {
      campos[atual] += `\n${linha}`; // texto com quebra de linha continua no campo anterior
    }
  }
  return campos;
}

function montarObservacoes(campos) {
  return Object.keys(ROTULOS_OBS).map(k => `${ROTULOS_OBS[k]}: ${campos[k] || ''}`).join('\n');
}

// DATE/DATETIME do MySQL chegam como Date; devolve "AAAA-MM-DD"
function paraISO(valor) {
  if (!valor) return null;
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    const local = new Date(valor.getTime() - valor.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }
  return String(valor).slice(0, 10);
}

const numeroOuNulo = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

function formatarDemanda(d) {
  const extra = lerObservacoes(d.observacoes);
  return {
    id: d.id_demanda,
    nome: extra.nome || `Demanda – ${d.protese_nome || `#${d.id_demanda}`}`,
    proteseId: d.id_protese,
    protese: d.protese_nome || '',
    proteseCodigo: d.protese_codigo || '',
    tipo: d.protese_tipo || '',
    regiao: d.protese_regiao || '',
    quantidade: d.quantidade,
    material: d.tipo_filamento || '',
    bico: numeroOuNulo(d.diametro_bico),
    largura: numeroOuNulo(d.largura_necessaria),
    profundidade: numeroOuNulo(d.profundidade_necessaria),
    altura: numeroOuNulo(d.altura_necessaria),
    tempoHoras: numeroOuNulo(d.tempo_estimado_horas),
    prioridade: d.prioridade || '',
    prazo: paraISO(d.prazo),
    status: d.status || '',
    // O nome da coluna de data de cadastro varia entre as versões do banco
    cadastro: paraISO(d.data_cadastro ?? d.data_criacao ?? d.criado_em ?? d.data_publicacao ?? null),
    localEntrega: d.local_entrega || '',
    paciente: extra.paciente || '',
    formaEntrega: extra.formaEntrega || '',
    responsavel: extra.responsavel || '',
    instrucoes: extra.instrucoes || '',
    observacoes: extra.observacoes || ''
  };
}

async function buscarDemanda(id, conexao = pool) {
  const [linhas] = await conexao.query(
    `SELECT d.*, p.nome AS protese_nome, p.codigo AS protese_codigo,
            p.tipo AS protese_tipo, p.regiao_corpo AS protese_regiao
       FROM demanda d
       LEFT JOIN protese p ON p.id_protese = d.id_protese
      ${id === undefined ? '' : 'WHERE d.id_demanda = ?'}
      ORDER BY d.id_demanda DESC`,
    id === undefined ? [] : [id]
  );
  return linhas;
}

function lerId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ erro: 'Demanda inválida.' });
    return null;
  }
  return id;
}

router.get('/', ...somenteFuncionario, async (req, res) => {
  try {
    const linhas = await buscarDemanda();
    res.json(linhas.map(formatarDemanda));
  } catch (erro) {
    console.error('Erro ao listar demandas:', erro);
    res.status(500).json({ erro: 'Não foi possível listar as demandas.' });
  }
});

router.put('/:id', ...somenteFuncionario, async (req, res) => {
  const id = lerId(req, res);
  if (id === null) return;
  const d = req.body || {};

  const nome = String(d.nome || '').trim();
  const quantidade = Number(d.quantidade);
  const material = String(d.material || '').trim();
  const bico = Number(d.bico);
  const tempoHoras = Number(d.tempoHoras);
  const prazo = String(d.prazo || '');
  const localEntrega = String(d.localEntrega || '').trim();

  if (!nome || nome.length > 150) return res.status(400).json({ erro: 'Informe um nome válido para a demanda.' });
  if (!Number.isSafeInteger(quantidade) || quantidade <= 0) return res.status(400).json({ erro: 'Informe uma quantidade válida.' });
  if (!material || material.length > 50) return res.status(400).json({ erro: 'Informe um material válido.' });
  if (!Number.isFinite(bico) || bico <= 0 || bico > 99.99) return res.status(400).json({ erro: 'Informe um diâmetro de bico válido.' });
  if (!Number.isFinite(tempoHoras) || tempoHoras <= 0 || tempoHoras > 999999.99) {
    return res.status(400).json({ erro: 'Informe um tempo estimado válido.' });
  }
  if (!PRIORIDADES.includes(d.prioridade)) return res.status(400).json({ erro: 'Prioridade inválida.' });
  const dataPrazo = new Date(`${prazo}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(prazo) || Number.isNaN(dataPrazo.getTime()) ||
      dataPrazo.toISOString().slice(0, 10) !== prazo) {
    return res.status(400).json({ erro: 'Informe um prazo válido.' });
  }
  if (localEntrega.length > 255) return res.status(400).json({ erro: 'Local de entrega muito longo.' });

  let conexao;
  try {
    conexao = await pool.getConnection();
    await conexao.beginTransaction();

    const [atuais] = await conexao.query(
      'SELECT status, observacoes FROM demanda WHERE id_demanda = ? FOR UPDATE', [id]
    );
    if (atuais.length === 0) {
      await conexao.rollback();
      return res.status(404).json({ erro: 'Demanda não encontrada.' });
    }
    if (!STATUS_EDITAVEIS.includes(atuais[0].status)) {
      await conexao.rollback();
      return res.status(409).json({ erro: `Demandas com status "${atuais[0].status}" não podem ser editadas.` });
    }

    // Mantém paciente, responsável etc. e troca só o que foi editado
    const extra = lerObservacoes(atuais[0].observacoes);
    extra.nome = nome;
    extra.observacoes = String(d.observacoes || '').trim();

    await conexao.execute(
      `UPDATE demanda
          SET quantidade = ?, tipo_filamento = ?, diametro_bico = ?, tempo_estimado_horas = ?,
              prioridade = ?, prazo = ?, local_entrega = ?, observacoes = ?
        WHERE id_demanda = ?`,
      [quantidade, material, bico, Number(tempoHoras.toFixed(2)), d.prioridade, prazo,
        localEntrega || null, montarObservacoes(extra), id]
    );
    const [linha] = await buscarDemanda(id, conexao);
    await conexao.commit();
    return res.json(formatarDemanda(linha));
  } catch (erro) {
    if (conexao) await conexao.rollback();
    console.error('Erro ao editar demanda:', erro);
    return res.status(500).json({ erro: 'Não foi possível salvar as alterações da demanda.' });
  } finally {
    if (conexao) conexao.release();
  }
});

// Acrescenta uma observação com a data, sem apagar as anteriores
router.post('/:id/observacoes', ...somenteFuncionario, async (req, res) => {
  const id = lerId(req, res);
  if (id === null) return;
  const texto = String(req.body?.texto || '').trim();
  if (!texto) return res.status(400).json({ erro: 'Escreva a observação.' });
  if (texto.length > 500) return res.status(400).json({ erro: 'A observação deve ter no máximo 500 caracteres.' });

  let conexao;
  try {
    conexao = await pool.getConnection();
    await conexao.beginTransaction();

    const [atuais] = await conexao.query(
      'SELECT observacoes FROM demanda WHERE id_demanda = ? FOR UPDATE', [id]
    );
    if (atuais.length === 0) {
      await conexao.rollback();
      return res.status(404).json({ erro: 'Demanda não encontrada.' });
    }

    const extra = lerObservacoes(atuais[0].observacoes);
    const [ano, mes, dia] = paraISO(new Date()).split('-');
    const nova = `[${dia}/${mes}/${ano} – ${req.usuario.nome}] ${texto}`;
    extra.observacoes = extra.observacoes ? `${extra.observacoes}\n${nova}` : nova;

    await conexao.execute(
      'UPDATE demanda SET observacoes = ? WHERE id_demanda = ?',
      [montarObservacoes(extra), id]
    );
    const [linha] = await buscarDemanda(id, conexao);
    await conexao.commit();
    return res.status(201).json(formatarDemanda(linha));
  } catch (erro) {
    if (conexao) await conexao.rollback();
    console.error('Erro ao adicionar observação na demanda:', erro);
    return res.status(500).json({ erro: 'Não foi possível adicionar a observação.' });
  } finally {
    if (conexao) conexao.release();
  }
});

// Cancelar não apaga o registro: só muda o status para "Cancelada"
router.patch('/:id/cancelar', ...somenteFuncionario, async (req, res) => {
  const id = lerId(req, res);
  if (id === null) return;
  try {
    const [resultado] = await pool.execute(
      `UPDATE demanda SET status = 'Cancelada'
        WHERE id_demanda = ? AND status IN (${STATUS_CANCELAVEIS.map(() => '?').join(', ')})`,
      [id, ...STATUS_CANCELAVEIS]
    );
    if (resultado.affectedRows === 0) {
      const [linhas] = await pool.query('SELECT status FROM demanda WHERE id_demanda = ?', [id]);
      if (linhas.length === 0) return res.status(404).json({ erro: 'Demanda não encontrada.' });
      return res.status(409).json({ erro: `Demandas com status "${linhas[0].status}" não podem ser canceladas.` });
    }
    return res.json({ mensagem: 'Demanda cancelada.', id, status: 'Cancelada' });
  } catch (erro) {
    console.error('Erro ao cancelar demanda:', erro);
    return res.status(500).json({ erro: 'Não foi possível cancelar a demanda.' });
  }
});

module.exports = router;
