const router = require('express').Router();
const pool = require('../config/mysql');
const { somenteFuncionario } = require('../middleware/autenticacao');
const { PRIORIDADES } = require('../services/demandas');
const { montarObservacoes } = require('./observacoes-demanda');
const { mudarStatusProtese } = require('../services/status-protese');

// OBJETIVO 10 — Publicar demandas no MySQL

router.post(
  '/api/demandas',
  ...somenteFuncionario,
  async (req, res) => {
    const d = req.body || {};

    const chavePublicacao = d.chavePublicacao ?? null;
    if (chavePublicacao !== null && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(chavePublicacao)) {
      return res.status(400).json({ erro: 'Identificador de publicação inválido.' });
    }
    const idProtese = Number(d.proteseId);
    const quantidade = Number(d.quantidade);
    const impressao = d.impressao || {};
    const entrega = d.entrega || {};

    const numeroValido = (valor, maximo) => {
      const n = Number(valor);
      return valor !== null &&
        valor !== undefined &&
        valor !== '' &&
        Number.isFinite(n) &&
        n > 0 &&
        n <= maximo;
    };

    if (!Number.isSafeInteger(idProtese) || idProtese <= 0) {
      return res.status(400).json({
        erro: 'Selecione uma prótese cadastrada.'
      });
    }

    if (!Number.isSafeInteger(quantidade) || quantidade <= 0) {
      return res.status(400).json({
        erro: 'Informe uma quantidade válida.'
      });
    }

    if (!PRIORIDADES.includes(d.prioridade)) {
      return res.status(400).json({
        erro: 'Prioridade inválida.'
      });
    }

    const filamento = String(impressao.filamento || '').trim();

    if (!filamento || filamento.length > 50) {
      return res.status(400).json({
        erro: 'Informe um filamento válido.'
      });
    }

    if (
      !numeroValido(impressao.largura, 999999.99) ||
      !numeroValido(impressao.profundidade, 999999.99) ||
      !numeroValido(impressao.altura, 999999.99)
    ) {
      return res.status(400).json({
        erro: 'Informe dimensões válidas.'
      });
    }

    if (!numeroValido(impressao.bico, 99.99)) {
      return res.status(400).json({
        erro: 'Informe um diâmetro de bico válido.'
      });
    }

    const minutos = Number(impressao.tempoEstimadoMin);

    if (!Number.isInteger(minutos) || minutos <= 0) {
      return res.status(400).json({
        erro: 'Informe um tempo estimado válido.'
      });
    }

    const tempoHoras = Number((minutos / 60).toFixed(2));

    if (tempoHoras > 999999.99) {
      return res.status(400).json({
        erro: 'Tempo estimado acima do limite permitido.'
      });
    }

    const prazo = String(entrega.prazo || '');

    if (!/^\d{4}-\d{2}-\d{2}$/.test(prazo)) {
      return res.status(400).json({
        erro: 'Informe um prazo válido.'
      });
    }

    const dataPrazo = new Date(`${prazo}T00:00:00Z`);

    if (
      Number.isNaN(dataPrazo.getTime()) ||
      dataPrazo.toISOString().slice(0, 10) !== prazo
    ) {
      return res.status(400).json({
        erro: 'Data de prazo inválida.'
      });
    }

    const localEntrega = String(entrega.local || '').trim();

    if (localEntrega.length > 255) {
      return res.status(400).json({
        erro: 'Local de entrega muito longo.'
      });
    }
    const observacoes = montarObservacoes({
      nome: d.nome,
      paciente: d.paciente,
      formaEntrega: entrega.forma,
      responsavel: entrega.responsavel,
      instrucoes: entrega.instrucoes,
      observacoes: d.observacoes
    });

    let conexao;

    try {
      conexao = await pool.getConnection();
      await conexao.beginTransaction();

      // Confirma que a prótese existe.
      const [proteses] = await conexao.execute(
        'SELECT id_protese FROM protese WHERE id_protese = ?',
        [idProtese]
      );

      if (proteses.length === 0) {
        await conexao.rollback();

        return res.status(404).json({
          erro: 'Prótese não encontrada.'
        });
      }

      // O funcionário é identificado pela sessão, não pelo navegador.
      const idFuncionario = req.usuario.id_funcionario;

      const [resultado] = await conexao.execute(
        `INSERT INTO demanda (
          id_funcionario,
          id_protese,
          quantidade,
          tipo_filamento,
          diametro_bico,
          largura_necessaria,
          profundidade_necessaria,
          altura_necessaria,
          tempo_estimado_horas,
          prazo,
          prioridade,
          status,
          local_entrega,
          observacoes,
          chave_publicacao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          idFuncionario,
          idProtese,
          quantidade,
          filamento,
          Number(impressao.bico),
          Number(impressao.largura),
          Number(impressao.profundidade),
          Number(impressao.altura),
          tempoHoras,
          prazo,
          d.prioridade,
          'Aberta',
          localEntrega || null,
          observacoes,
          chavePublicacao
        ]
      );

      await mudarStatusProtese(conexao, idProtese, 'demanda');

      await conexao.commit();

      return res.status(201).json({
        mensagem: 'Demanda publicada com sucesso!',
        id_demanda: resultado.insertId,
        nome: d.nome
      });

    } catch (erro) {
      if (conexao) await conexao.rollback();

      if (erro.code === 'ER_DUP_ENTRY' && chavePublicacao) {
        const [anteriores] = await conexao.execute(
          'SELECT id_demanda FROM demanda WHERE id_funcionario = ? AND chave_publicacao = ?',
          [req.usuario.id_funcionario, chavePublicacao]
        );
        if (anteriores.length) return res.status(200).json({ id_demanda: anteriores[0].id_demanda });
      }
      console.error('Erro ao publicar demanda:', erro);

      return res.status(500).json({
        erro: 'Não foi possível publicar a demanda.'
      });

    } finally {
      if (conexao) conexao.release();
    }
  }
);

module.exports = router;
