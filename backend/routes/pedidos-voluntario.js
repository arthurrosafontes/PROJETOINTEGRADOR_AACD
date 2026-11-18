const router = require('express').Router();
const mongoose = require('mongoose');
const path = require('node:path');
const FichaImpressora = require('../models/FichaTecnicaImpressora');
const pool = require('../config/mysql');
const { pastaProteses } = require('../config/caminhos');
const { somenteVoluntario } = require('../middleware/autenticacao');
const { lerObservacoes } = require('./observacoes-demanda');
const { camposConclusao } = require('./conclusao');
const { camposEnvio } = require('./envio');
const { camposRecebimento } = require('./recebimento');
const { camposMaterial, condicaoInicio } = require('./material-aacd');
const notificacoes = require('../services/notificacoes');

function formatarPedido(p, nomesImpressoras) {
  const dadosDemanda = lerObservacoes(p.obs);
  return {
    id: p.id,
    demandaId: p.demandaId,
    produto: p.produto,
    categoria: p.categoria,
    material: p.material,
    quantidade: p.quantidade,
    doacaoMaterial: p.doacaoMaterial,
    status: p.status,
    aceito_em: p.aceito_em,
    dataAceiteUTC: p.dataAceiteUTC,
    dataInicioUTC: p.dataInicioUTC,
    conclusao: p.conclusao,
    envio: p.envio,
    recebimento: p.recebimento,
    materialAacd: p.materialAacd,
    demanda: { ...dadosDemanda, codigo: p.proteseCodigo, regiao: p.regiao,
      localEntrega: p.localEntrega, cadastro: p.cadastroDemanda },
    formaEntrega: dadosDemanda.formaEntrega || '',
    prazo: p.prazo,
    obs: p.obs || '',

    impressoraId: p.impressoraId,
    impressora: nomesImpressoras.get(p.impressoraId)
      || 'Impressora não encontrada',

    // Informações técnicas
    descricao: p.descricao || '',
    largura: p.largura,
    profundidade: p.profundidade,
    altura: p.altura,
    diametroBico: p.diametroBico,
    tempoHoras: p.tempoHoras,
    alturaCamada: p.alturaCamada,
    infill: p.infill,
    necessitaSuporte: Boolean(p.necessitaSuporte),
    orientacoes: p.orientacoes || '',

    // Indica a disponibilidade, sem expor o caminho físico
    possuiArquivo3d: Boolean(p.arquivo3d)
  };
}

// OBJETIVO 15 — Listar pedidos aceitos pelo voluntário

router.get('/api/pedidos', ...somenteVoluntario, async (req, res) => {
  try {
    const idVoluntario = req.usuario.id_voluntario;

    // Consultar pedidos no MySQL
    const [linhas] = await pool.execute(
      `SELECT
        pp.id_pedido AS id,
        pp.id_demanda AS demandaId,
        pp.id_impressora_mongo AS impressoraId,
        pp.quantidade_atribuida AS quantidade,
        p.codigo AS proteseCodigo, p.regiao_corpo AS regiao,
        d.local_entrega AS localEntrega, DATE_FORMAT(d.data_cadastro, '%Y-%m-%d') AS cadastroDemanda,
        pp.doacao_material AS doacaoMaterial, 
        pp.status, ${camposConclusao}, ${camposEnvio}, ${camposRecebimento}, ${camposMaterial},
        DATE_FORMAT(pp.data_aceite, '%Y-%m-%d') AS aceito_em,
        DATE_FORMAT(pp.data_aceite, '%Y-%m-%dT%H:%i:%sZ') AS dataAceiteUTC,
        DATE_FORMAT(pp.data_inicio, '%Y-%m-%dT%H:%i:%sZ') AS dataInicioUTC,

        p.nome AS produto,
        p.tipo AS categoria,
        p.descricao,
        p.altura_camada AS alturaCamada,
        p.infill,
        p.necessita_suporte AS necessitaSuporte,
        p.orientacoes_impressao AS orientacoes,
        p.arquivo_3d AS arquivo3d,

        d.tipo_filamento AS material,
        d.diametro_bico AS diametroBico,
        d.largura_necessaria AS largura,
        d.profundidade_necessaria AS profundidade,
        d.altura_necessaria AS altura,
        d.tempo_estimado_horas AS tempoHoras,
        DATE_FORMAT(d.prazo, '%Y-%m-%d') AS prazo,
        d.observacoes AS obs

      FROM pedido_producao pp

      INNER JOIN demanda d
        ON pp.id_demanda = d.id_demanda

      INNER JOIN protese p
        ON d.id_protese = p.id_protese

      WHERE pp.id_voluntario = ?

      ORDER BY pp.data_aceite DESC, pp.id_pedido DESC`,
      [idVoluntario]
    );
    // Consultar no MongoDB as impressoras utilizadas
    const idsImpressoras = [...new Set(
      linhas
        .map(p => p.impressoraId)
        .filter(id => mongoose.isValidObjectId(id))
    )];

    const impressoras = idsImpressoras.length
      ? await FichaImpressora.find({
          _id: { $in: idsImpressoras },
          id_voluntario: idVoluntario
        })
          .select('_id nome_da_impressora modelo_da_impressora')
          .lean()
      : [];

    const nomesImpressoras = new Map(
      impressoras.map(i => [
        String(i._id),
        i.nome_da_impressora ||
          i.modelo_da_impressora ||
          'Impressora sem nome'
      ])
    );

    // Organizar os dados para o frontend
    const pedidos = linhas.map(pedido => formatarPedido(pedido, nomesImpressoras));
    return res.status(200).json(pedidos);

  } catch (erro) {
    console.error('Erro ao listar pedidos aceitos:', erro);

    return res.status(500).json({
      erro: 'Não foi possível carregar os pedidos aceitos.'
    });
  }
});

// OBJETIVO 16 — Download protegido do arquivo 3D

router.get('/api/pedidos/:id/arquivo-3d', ...somenteVoluntario, async (req, res) => {
  const idPedido = Number(req.params.id);

  if (!Number.isSafeInteger(idPedido) || idPedido <= 0) {
    return res.status(400).json({
      erro: 'ID do pedido inválido.'
    });
  }

  try {
    const [pedidos] = await pool.execute(
      `SELECT p.arquivo_3d
       FROM pedido_producao pp
       INNER JOIN demanda d ON d.id_demanda = pp.id_demanda
       INNER JOIN protese p ON p.id_protese = d.id_protese
       WHERE pp.id_pedido = ?
         AND pp.id_voluntario = ?
       LIMIT 1`,
      [idPedido, req.usuario.id_voluntario]
    );

    if (pedidos.length === 0) {
      return res.status(404).json({
        erro: 'Pedido não encontrado.'
      });
    }

    const arquivo = pedidos[0].arquivo_3d;

    if (!arquivo) {
      return res.status(404).json({
        erro: 'Arquivo 3D ainda não disponibilizado pela AACD.'
      });
    }

    // Impede o acesso a caminhos externos à pasta de próteses.
    const nomeArquivo = path.basename(arquivo);

    if (
      arquivo.replace(/\\/g, '/') !== `uploads/proteses/${nomeArquivo}` ||
      !/^[a-zA-Z0-9_-]+\.(stl|obj|3mf)$/i.test(nomeArquivo)
    ) {
      return res.status(400).json({
        erro: 'Caminho do arquivo inválido.'
      });
    }

    const caminhoCompleto = path.join(pastaProteses, nomeArquivo);

    return res.download(caminhoCompleto, nomeArquivo, erro => {
      if (erro) {
        console.error('Erro ao baixar arquivo 3D:', erro);
      }
    });

  } catch (erro) {
    console.error('Erro ao consultar arquivo 3D:', erro);

    return res.status(500).json({
      erro: 'Não foi possível consultar o arquivo 3D.'
    });
  }
});

// OBJETIVO 17 — Iniciar produção do pedido

router.patch('/api/pedidos/:id/iniciar', ...somenteVoluntario, async (req, res) => {
  const idPedido = Number(req.params.id);
  const idVoluntario = req.usuario.id_voluntario;

  if (!Number.isSafeInteger(idPedido) || idPedido <= 0) {
    return res.status(400).json({
      erro: 'ID do pedido inválido.'
    });
  }

  let conexao;
  try {
    conexao = await pool.getConnection();
    await conexao.beginTransaction();
    const [resultado] = await conexao.execute(
      `UPDATE pedido_producao pp
       INNER JOIN demanda d ON d.id_demanda = pp.id_demanda
       SET pp.status = 'Em produção', pp.data_inicio = NOW(), d.status = 'Em produção'
       WHERE pp.id_pedido = ? AND pp.id_voluntario = ?
         AND pp.status = 'Aceito' AND d.status = 'Aceita' AND ${condicaoInicio}`,
      [idPedido, idVoluntario]
    );

    if (resultado.affectedRows === 0) {
      await conexao.rollback();
      return res.status(409).json({
        erro: 'O pedido deve estar aceito e, quando solicitado, o recebimento do material da AACD precisa estar confirmado.'
      });
    }

    await notificacoes.pedido(conexao, idPedido, 'inicio', 'O pedido entrou em produção.');
    await conexao.commit();

    return res.status(200).json({
      mensagem: 'Produção iniciada com sucesso!',
      id_pedido: idPedido,
      status: 'Em produção'
    });

  } catch (erro) {
    if (conexao) await conexao.rollback().catch(() => {});
    console.error('Erro ao iniciar produção:', erro);

    return res.status(500).json({
      erro: 'Não foi possível iniciar a produção.'
    });
  } finally { conexao?.release(); }
});

module.exports = router;
