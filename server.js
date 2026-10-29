require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const conectarBanco = require('./backend/config/db');
const FichaImpressora = require('./backend/models/FichaTecnicaImpressora');
const voluntariosRoutes = require('./backend/routes/voluntarios');
const authRoutes = require('./backend/routes/auth');
const { exigirAutenticacao, exigirPerfil } = require('./backend/middleware/autenticacao');
const pool = require('./backend/config/mysql');

const app = express();
app.use(express.json());
const origensPermitidas = new Set([
  'http://localhost:5500', 'http://127.0.0.1:5500',
  'http://localhost:5501', 'http://127.0.0.1:5501'
]);
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || origensPermitidas.has(origin)),
  credentials: true
}));
app.use(cookieParser());

conectarBanco();
app.use('/api/voluntarios', voluntariosRoutes);
app.use('/api/auth', authRoutes);
app.get('/', (req, res) => res.send('API do Projeto AACD rodando com sucesso!'));

// A impressora sempre pertence ao voluntário autenticado.
// Não aceitar id_voluntario, _id, datas ou status enviados pelo navegador.
const CAMPOS_EDITAVEIS = [
  'nome_da_impressora', 'marca_da_impressora', 'modelo_da_impressora',
  'tecnologia_da_impressora', 'filamentos_compativeis', 'diametro_bico_mm',
  'volume_impressao', 'diametro_filamento_mm', 'temperatura_maxima_bico',
  'temperatura_maxima_mesa', 'horas_disponiveis_semana', 'dias_disponiveis',
  'localizacao', 'observacoes', 'informacoes_adicionais'
];
function selecionarCampos(dados) {
  const resultado = {};
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return resultado;
  for (const campo of CAMPOS_EDITAVEIS) {
    if (Object.prototype.hasOwnProperty.call(dados, campo)) {
      resultado[campo] = dados[campo];
    }
  }
  return resultado;
}

const somenteVoluntario = [exigirAutenticacao, exigirPerfil('voluntario')];

app.post('/api/impressoras', ...somenteVoluntario, async (req, res) => {
  try {
    const novaImpressora = new FichaImpressora({
      ...selecionarCampos(req.body),
      id_voluntario: req.usuario.id_voluntario
    });
    await novaImpressora.save();
    res.status(201).json({
      mensagem: 'Impressora cadastrada com sucesso no MongoDB!',
      impressora: novaImpressora
    });
  } catch (erro) {
    if (erro.name === 'ValidationError' || erro.name === 'CastError') {
      return res.status(400).json({ erro: 'Dados da impressora inválidos.', detalhes: erro.message });
    }
    console.error('Erro ao cadastrar impressora:', erro);
    res.status(500).json({ erro: 'Não foi possível cadastrar a impressora.' });
  }
});

app.get('/api/impressoras', ...somenteVoluntario, async (req, res) => {
  try {
    const impressoras = await FichaImpressora.find({ id_voluntario: req.usuario.id_voluntario })
      .sort({ data_cadastro: -1 });
    res.status(200).json(impressoras);
  } catch (erro) {
    console.error('Erro ao listar impressoras:', erro);
    res.status(500).json({ erro: 'Erro ao buscar impressoras.' });
  }
});

const MSG_SOMENTE_DONO = 'Você precisa ser o dono do cadastro desta impressora para editá-la.';

// Nome dos voluntários (MySQL) indexado pelo id_voluntario
async function buscarVoluntariosPorId(impressoras) {
  const ids = [...new Set(impressoras.map(i => Number(i.id_voluntario)).filter(Number.isInteger))];
  if (ids.length === 0) return new Map();
  const marcadores = ids.map(() => '?').join(',');
  const [linhas] = await pool.query(
    `SELECT v.id_voluntario, u.nome, u.email, u.telefone, v.status_homologacao
     FROM voluntario v
     INNER JOIN usuario u ON u.id_usuario = v.id_usuario
     WHERE v.id_voluntario IN (${marcadores})`,
    ids
  );
  return new Map(linhas.map(v => [Number(v.id_voluntario), v]));
}

app.get('/api/impressoras/:id', ...somenteVoluntario, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ erro: 'ID de impressora inválido.' });
  }
  try {
    const impressora = await FichaImpressora.findOne({
      _id: req.params.id,
      id_voluntario: req.usuario.id_voluntario
    });
    if (!impressora) return res.status(404).json({ erro: 'Impressora não encontrada.' });
    res.status(200).json(impressora);
  } catch (erro) {
    console.error('Erro ao consultar impressora:', erro);
    res.status(500).json({ erro: 'Erro ao buscar impressora.' });
  }
});

app.put('/api/impressoras/:id', ...somenteVoluntario, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ erro: 'ID de impressora inválido.' });
  }
  const dados = selecionarCampos(req.body);
  if (Object.keys(dados).length === 0) {
    return res.status(400).json({ erro: 'Nenhum campo editável foi informado.' });
  }
  try {
    const existente = await FichaImpressora.findById(req.params.id).select('id_voluntario').lean();
    if (!existente) return res.status(404).json({ erro: 'Impressora não encontrada.' });
    if (Number(existente.id_voluntario) !== Number(req.usuario.id_voluntario)) {
      return res.status(403).json({ erro: MSG_SOMENTE_DONO });
    }
    const impressoraAtualizada = await FichaImpressora.findOneAndUpdate(
      { _id: req.params.id, id_voluntario: req.usuario.id_voluntario },
      { $set: { ...dados, data_atualizacao: new Date() } },
      { new: true, runValidators: true }
    );
    if (!impressoraAtualizada) return res.status(404).json({ erro: 'Impressora não encontrada.' });
    res.status(200).json({ mensagem: 'Impressora atualizada com sucesso!', impressora: impressoraAtualizada });
  } catch (erro) {
    if (erro.name === 'ValidationError' || erro.name === 'CastError') {
      return res.status(400).json({ erro: 'Dados da impressora inválidos.', detalhes: erro.message });
    }
    console.error('Erro ao atualizar impressora:', erro);
    res.status(500).json({ erro: 'Não foi possível atualizar a impressora.' });
  }
});

const PORTA = process.env.PORT || 3000;


app.get(
  '/api/funcionario/impressoras',
  exigirAutenticacao,
  exigirPerfil('funcionario'),
  async (req, res) => {
    try {
      const impressoras = await FichaImpressora.find()
        .sort({ data_cadastro: -1 })
        .lean();

      const porId = await buscarVoluntariosPorId(impressoras);

      const resultado = impressoras.map(i => {
        const voluntario = porId.get(Number(i.id_voluntario));

        return {
          ...i,
          voluntarioNome: voluntario?.nome || `Voluntário #${i.id_voluntario}`,
          voluntarioEmail: voluntario?.email || '',
          voluntarioTelefone: voluntario?.telefone || '',
          voluntarioStatus: voluntario?.status_homologacao || ''
        };
      });

      res.json(resultado);
    } catch (erro) {
      console.error('Erro ao listar impressoras:', erro);
      res.status(500).json({
        erro: 'Não foi possível listar as impressoras.'
      });
    }
  }
);




// OBJETIVO 8 — Gestão de impressoras pelos funcionários AACD.
// Não permite editar o proprietário, o ID, o status nem as datas de criação.
const somenteFuncionario = [exigirAutenticacao, exigirPerfil('funcionario')];

app.put('/api/funcionario/impressoras/:id', ...somenteFuncionario, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ erro: 'ID de impressora inválido.' });
  }

  const entrada = req.body;
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) {
    return res.status(400).json({ erro: 'Dados de edição inválidos.' });
  }

  const { modelo, tecnologia, bico, largura, profundidade, altura, materiais, obs } = entrada;
  if (typeof modelo !== 'string' || !modelo.trim() ||
      !['FDM', 'Resina'].includes(tecnologia) ||
      typeof materiais !== 'string' ||
      typeof obs !== 'string') {
    return res.status(400).json({ erro: 'Preencha modelo, tecnologia, materiais e observações corretamente.' });
  }

  const dimensoes = [largura, profundidade, altura].map(Number);
  if (dimensoes.some(n => !Number.isFinite(n) || n <= 0)) {
    return res.status(400).json({ erro: 'As dimensões devem ser números maiores que zero.' });
  }

  if (tecnologia === 'FDM' && (!Number.isFinite(Number(bico)) || Number(bico) <= 0)) {
    return res.status(400).json({ erro: 'Informe um bico válido para a impressora FDM.' });
  }

  const atualizacoes = {
    modelo_da_impressora: modelo.trim(),
    tecnologia_da_impressora: tecnologia,
    filamentos_compativeis: materiais.split(',').map(m => m.trim()).filter(Boolean),
    'volume_impressao.largura_mm': dimensoes[0],
    'volume_impressao.profundidade_mm': dimensoes[1],
    'volume_impressao.altura_mm': dimensoes[2],
    observacoes: obs.trim(),
    data_atualizacao: new Date()
  };
  if (tecnologia === 'FDM') atualizacoes.diametro_bico_mm = Number(bico);
  // Ao escolher Resina, remove o bico, pois não é aplicável.
  else atualizacoes.diametro_bico_mm = null;

  try {
    const impressora = await FichaImpressora.findByIdAndUpdate(
      req.params.id,
      { $set: atualizacoes },
      { new: true, runValidators: true }
    );
    if (!impressora) return res.status(404).json({ erro: 'Impressora não encontrada.' });
    return res.json({ mensagem: 'Impressora atualizada com sucesso!', impressora });
  } catch (erro) {
    if (erro.name === 'ValidationError' || erro.name === 'CastError') {
      return res.status(400).json({ erro: 'Dados da impressora inválidos.', detalhes: erro.message });
    }
    console.error('Erro ao editar impressora (funcionário):', erro);
    return res.status(500).json({ erro: 'Não foi possível editar a impressora.' });
  }
});

app.delete('/api/funcionario/impressoras/:id', ...somenteFuncionario, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ erro: 'ID de impressora inválido.' });
  }
  try {
    const impressora = await FichaImpressora.findByIdAndDelete(req.params.id);
    if (!impressora) return res.status(404).json({ erro: 'Impressora não encontrada.' });
    return res.json({ mensagem: 'Impressora removida com sucesso.' });
  } catch (erro) {
    console.error('Erro ao remover impressora (funcionário):', erro);
    return res.status(500).json({ erro: 'Não foi possível remover a impressora.' });
  }
});

// Cadastro de prótese pelo funcionário (tabela "protese" do MySQL)
const TIPOS_PROTESE = ['Prótese', 'Órtese', 'Componente'];
const MATERIAIS_PROTESE = ['PLA', 'PETG', 'TPU (flexível)', 'ABS', 'ASA', 'Nylon'];

// Ciclo de vida do status da prótese (o navegador nunca escolhe o status):
//   cadastro                          -> 'Inativa'
//   demanda criada com a prótese      -> 'Inativa' vira 'Revisão'
//   voluntário aceita essa demanda    -> 'Revisão' vira 'Ativa'
// Chame esta função nas rotas de demanda: mudarStatusProtese(id, 'demanda') / (id, 'aceite').
// Só muda se a prótese estiver no status anterior esperado; devolve true se mudou.
const TRANSICOES_PROTESE = {
  demanda: { de: 'Inativa', para: 'Revisão' },
  aceite: { de: 'Revisão', para: 'Ativa' }
};
async function mudarStatusProtese(idProtese, evento, conexao = pool) {
  const { de, para } = TRANSICOES_PROTESE[evento];
  const [resultado] = await conexao.execute(
    'UPDATE protese SET status = ? WHERE id_protese = ? AND status = ?',
    [para, idProtese, de]
  );
  return resultado.affectedRows > 0;
}

// Upload do arquivo 3D da prótese (.stl, .obj ou .3mf, até 50 MB).
// Fica em uploads/proteses com nome gerado; a coluna arquivo_3d guarda esse caminho.
const PASTA_UPLOADS_PROTESE = path.join(__dirname, 'uploads', 'proteses');
fs.mkdirSync(PASTA_UPLOADS_PROTESE, { recursive: true });
const EXTENSOES_3D = ['.stl', '.obj', '.3mf'];
const uploadArquivo3d = multer({
  storage: multer.diskStorage({
    destination: PASTA_UPLOADS_PROTESE,
    filename: (req, arquivo, cb) => {
      const extensao = path.extname(arquivo.originalname).toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extensao}`);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: (req, arquivo, cb) => {
    if (EXTENSOES_3D.includes(path.extname(arquivo.originalname).toLowerCase())) return cb(null, true);
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', arquivo.fieldname));
  }
}).single('arquivo_3d');

// Roda o multer e transforma erros de upload em resposta 400
function receberArquivo3d(req, res, next) {
  uploadArquivo3d(req, res, erro => {
    if (!erro) return next();
    const mensagem = erro.code === 'LIMIT_FILE_SIZE'
      ? 'O arquivo 3D deve ter no máximo 50 MB.'
      : 'Envie um único arquivo 3D .stl, .obj ou .3mf.';
    return res.status(400).json({ erro: mensagem });
  });
}

app.post('/api/funcionario/proteses', ...somenteFuncionario, receberArquivo3d, async (req, res) => {
  // Se o cadastro falhar, o arquivo enviado não deve ficar órfão na pasta
  const descartarArquivo = () => req.file && fs.promises.unlink(req.file.path).catch(() => {});
  const d = req.body;
  if (!d || typeof d !== 'object' || Array.isArray(d)) {
    return res.status(400).json({ erro: 'Dados da prótese inválidos.' });
  }

  // Texto opcional: vazio vira NULL; acima do limite da coluna é erro
  const texto = (campo, limite) => {
    const v = String(d[campo] ?? '').trim();
    if (limite && v.length > limite) throw new Error(`O campo ${campo} excede ${limite} caracteres.`);
    return v || null;
  };
  // Número opcional dentro do intervalo aceito pela coluna
  const numero = (campo, min, max, inteiro = false) => {
    if (d[campo] === null || d[campo] === undefined || d[campo] === '') return null;
    const n = Number(d[campo]);
    if (!Number.isFinite(n) || n < min || n > max || (inteiro && !Number.isInteger(n))) {
      throw new Error(`Valor inválido para ${campo}.`);
    }
    return n;
  };

  let valores;
  try {
    const nome = texto('nome', 150);
    if (!nome) throw new Error('Informe o nome da prótese.');
    if (!TIPOS_PROTESE.includes(d.tipo)) throw new Error('Tipo de prótese inválido.');
    const material = texto('material_recomendado', 100);
    if (material && !MATERIAIS_PROTESE.includes(material)) throw new Error('Material recomendado inválido.');

    valores = [
      nome, texto('codigo', 50), d.tipo, texto('regiao_corpo', 100), texto('descricao'),
      material,
      numero('largura', 0.01, 999999.99), numero('profundidade', 0.01, 999999.99), numero('altura', 0.01, 999999.99),
      req.file ? `uploads/proteses/${req.file.filename}` : null,
      numero('altura_camada', 0.01, 99.99), numero('infill', 0, 100, true),
      // Pode vir como booleano (JSON) ou texto "true"/"false" (multipart)
      d.necessita_suporte === true || d.necessita_suporte === 'true' ? 1 : 0,
      texto('orientacoes_impressao'), texto('observacoes'),
      texto('versao', 20), 'Inativa'
    ];
  } catch (erro) {
    descartarArquivo();
    return res.status(400).json({ erro: erro.message });
  }

  try {
    const [resultado] = await pool.execute(
      `INSERT INTO protese
        (nome, codigo, tipo, regiao_corpo, descricao, material_recomendado, largura, profundidade, altura,
         arquivo_3d, altura_camada, infill, necessita_suporte, orientacoes_impressao, observacoes, versao, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      valores
    );
    return res.status(201).json({ mensagem: 'Prótese cadastrada com sucesso!', id_protese: resultado.insertId });
  } catch (erro) {
    descartarArquivo();
    if (erro.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Já existe uma prótese com esse código.' });
    console.error('Erro ao cadastrar prótese:', erro);
    return res.status(500).json({ erro: 'Não foi possível cadastrar a prótese.' });
  }
});

app.use('/api/funcionario', require('./backend/routes/consulta-proteses'));
// Lista, edição e cancelamento das demandas (tela "Lista de demandas")
app.use('/api/funcionario/demandas', require('./backend/routes/demandas'));
// Produção do voluntário: listar pedidos aceitos e alterar o status

// OBJETIVO 10 — Publicar demandas no MySQL

app.post(
  '/api/demandas',
  exigirAutenticacao,
  exigirPerfil('funcionario'),
  async (req, res) => {
    const d = req.body || {};

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

    const prioridades = ['Baixa', 'Normal', 'Alta', 'Urgente'];

    if (!prioridades.includes(d.prioridade)) {
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

    // Guarda informações adicionais sem criar colunas.
    // Não registra o arquivo como anexado, pois ele não foi enviado.
    const observacoes = [
      `Nome da demanda: ${d.nome || ''}`,
      `Paciente: ${d.paciente || ''}`,
      `Forma de entrega: ${entrega.forma || ''}`,
      `Responsável: ${entrega.responsavel || ''}`,
      `Instruções: ${entrega.instrucoes || ''}`,
      `Observações: ${d.observacoes || ''}`
    ].join('\n');

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
          observacoes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          observacoes
        ]
      );

      // Ao criar uma demanda, a prótese Inativa passa para Revisão.
      await conexao.execute(
        `UPDATE protese
         SET status = 'Revisão'
         WHERE id_protese = ? AND status = 'Inativa'`,
        [idProtese]
      );

      await conexao.commit();

      return res.status(201).json({
        mensagem: 'Demanda publicada com sucesso!',
        id_demanda: resultado.insertId,
        nome: d.nome
      });

    } catch (erro) {
      if (conexao) await conexao.rollback();

      console.error('Erro ao publicar demanda:', erro);

      return res.status(500).json({
        erro: 'Não foi possível publicar a demanda.'
      });

    } finally {
      if (conexao) conexao.release();
    }
  }
);

// OBJETIVO 14 — Listar pedidos disponíveis para voluntários

app.get('/api/disponiveis', ...somenteVoluntario, async (req, res) => {
  try {
    const [linhas] = await pool.execute(`
      SELECT
        d.id_demanda AS id,
        p.nome AS peca,
        d.tipo_filamento AS material,
        d.quantidade,
        d.prioridade,
        DATE_FORMAT(d.prazo, '%Y-%m-%d') AS prazo,
        DATE_FORMAT(d.data_cadastro, '%Y-%m-%d') AS criado,
        d.tempo_estimado_horas AS tempoHoras,
        d.observacoes AS obs
      FROM demanda d
      INNER JOIN protese p
        ON p.id_protese = d.id_protese
      WHERE d.status = 'Aberta'
      ORDER BY d.data_cadastro DESC
    `);

    const pedidos = linhas.map(p => ({
      id: p.id,
      peca: p.peca,
      material: p.material,
      quantidade: p.quantidade,
      prioridade: p.prioridade,
      prazo: p.prazo,
      criado: p.criado,
      tempo: p.tempoHoras != null
        ? `${Number(p.tempoHoras)} horas`
        : 'Não informado',
      obs: p.obs || ''
    }));

    res.status(200).json(pedidos);

  } catch (erro) {
    console.error('Erro ao listar pedidos disponíveis:', erro);

    res.status(500).json({
      erro: 'Não foi possível carregar os pedidos disponíveis.'
    });
  }
});

// OBJETIVO 14 — Aceitar pedido disponível

app.patch('/api/disponiveis/:id/aceitar', ...somenteVoluntario, async (req, res) => {
  const idDemanda = Number(req.params.id);
  const idImpressora = String(req.body?.id_impressora_mongo || '').trim();
  const doacaoMaterial = req.body?.doacao_material;

if (typeof doacaoMaterial !== 'boolean') {
  return res.status(400).json({
    erro: 'Informe se deseja doar o material para fabricação.'
  });
}
  const idVoluntario = req.usuario.id_voluntario;

  // Validar o ID da demanda
  if (!Number.isSafeInteger(idDemanda) || idDemanda <= 0) {
    return res.status(400).json({
      erro: 'ID da demanda inválido.'
    });
  }

  // Validar o ID da impressora
  if (!mongoose.isValidObjectId(idImpressora)) {
    return res.status(400).json({
      erro: 'Selecione uma impressora válida.'
    });
  }

  // Verificar se a impressora pertence ao voluntário
  try {
    const impressora = await FichaImpressora.findOne({
      _id: idImpressora,
      id_voluntario: idVoluntario
    });

    if (!impressora) {
      return res.status(403).json({
        erro: 'Esta impressora não pertence ao voluntário.'
      });
    }

  } catch (erro) {
    console.error('Erro ao verificar impressora:', erro);

    return res.status(500).json({
      erro: 'Não foi possível verificar a impressora.'
    });
  }

  let conexao;
  let transacaoIniciada = false;

  try {
    conexao = await pool.getConnection();
    await conexao.beginTransaction();
    transacaoIniciada = true;

    // Bloquear a demanda para evitar aceites simultâneos
    const [demandas] = await conexao.execute(
      `SELECT id_demanda, id_protese, quantidade, status
       FROM demanda
       WHERE id_demanda = ?
       FOR UPDATE`,
      [idDemanda]
    );

    if (demandas.length === 0) {
      await conexao.rollback();
      transacaoIniciada = false;

      return res.status(404).json({
        erro: 'Demanda não encontrada.'
      });
    }

    const demanda = demandas[0];

    // Somente demandas abertas podem ser aceitas
    if (demanda.status !== 'Aberta') {
      await conexao.rollback();
      transacaoIniciada = false;

      return res.status(409).json({
        erro: 'Este pedido não está mais disponível.'
      });
    }

    // Verificar se já existe um pedido ativo para essa demanda
    const [pedidosExistentes] = await conexao.execute(
      `SELECT id_pedido
       FROM pedido_producao
       WHERE id_demanda = ?
         AND status <> 'Cancelado'
       LIMIT 1`,
      [idDemanda]
    );

    if (pedidosExistentes.length > 0) {
      await conexao.rollback();
      transacaoIniciada = false;

      return res.status(409).json({
        erro: 'Esta demanda já possui um pedido de produção.'
      });
    }

    // Registrar o aceite no MySQL
   const [resultado] = await conexao.execute(
  `INSERT INTO pedido_producao (
    id_demanda,
    id_voluntario,
    id_impressora_mongo,
    quantidade_atribuida,
    status,
    doacao_material
  )
  VALUES (?, ?, ?, ?, 'Aceito', ?)`,
  [
    idDemanda,
    idVoluntario,
    idImpressora,
    demanda.quantidade,
    doacaoMaterial ? 1 : 0
  ]
);
    // Atualizar status da demanda
    await conexao.execute(
      `UPDATE demanda
       SET status = 'Em produção'
       WHERE id_demanda = ?`,
      [idDemanda]
    );

    // Atualizar status da prótese, quando aplicável
    await mudarStatusProtese(
      demanda.id_protese,
      'aceite',
      conexao
    );

    // Confirmar todas as alterações
    await conexao.commit();
    transacaoIniciada = false;

    return res.status(201).json({
      mensagem: 'Pedido aceito com sucesso!',
      id_pedido: resultado.insertId,
      id_demanda: idDemanda
    });

  } catch (erro) {
    if (conexao && transacaoIniciada) {
      try {
        await conexao.rollback();
      } catch (erroRollback) {
        console.error('Erro ao desfazer transação:', erroRollback);
      }
    }

    console.error('Erro ao aceitar pedido:', erro);

    return res.status(500).json({
      erro: 'Não foi possível registrar o aceite.'
    });

  } finally {
    if (conexao) {
      conexao.release();
    }
  }
});

// OBJETIVO 15 — Listar pedidos aceitos pelo voluntário

app.get('/api/pedidos', ...somenteVoluntario, async (req, res) => {
  try {
    const idVoluntario = req.usuario.id_voluntario;

    // Consultar pedidos no MySQL
const [linhas] = await pool.execute(
  `SELECT
    pp.id_pedido AS id,
    pp.id_demanda AS demandaId,
    pp.id_impressora_mongo AS impressoraId,
    pp.quantidade_atribuida AS quantidade,
    pp.status,
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
const pedidos = linhas.map(p => ({
  id: p.id,
  demandaId: p.demandaId,
  produto: p.produto,
  categoria: p.categoria,
  material: p.material,
  quantidade: p.quantidade,
  status: p.status,
  aceito_em: p.aceito_em,
  dataAceiteUTC: p.dataAceiteUTC,
  dataInicioUTC: p.dataInicioUTC,
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
}));
    return res.status(200).json(pedidos);

  } catch (erro) {
    console.error('Erro ao listar pedidos aceitos:', erro);

    return res.status(500).json({
      erro: 'Não foi possível carregar os pedidos aceitos.'
    });
  }
});

// OBJETIVO 16 — Download protegido do arquivo 3D

app.get('/api/pedidos/:id/arquivo-3d', ...somenteVoluntario, async (req, res) => {
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

    const caminhoCompleto = path.join(PASTA_UPLOADS_PROTESE, nomeArquivo);

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

app.patch('/api/pedidos/:id/iniciar', ...somenteVoluntario, async (req, res) => {
  const idPedido = Number(req.params.id);
  const idVoluntario = req.usuario.id_voluntario;

  if (!Number.isSafeInteger(idPedido) || idPedido <= 0) {
    return res.status(400).json({
      erro: 'ID do pedido inválido.'
    });
  }

  try {
    const [resultado] = await pool.execute(
      `UPDATE pedido_producao
       SET status = 'Em produção',
           data_inicio = NOW()
       WHERE id_pedido = ?
         AND id_voluntario = ?
         AND status = 'Aceito'`,
      [idPedido, idVoluntario]
    );

    if (resultado.affectedRows === 0) {
      return res.status(409).json({
        erro: 'Pedido não encontrado ou não está com status Aceito.'
      });
    }

    return res.status(200).json({
      mensagem: 'Produção iniciada com sucesso!',
      id_pedido: idPedido,
      status: 'Em produção'
    });

  } catch (erro) {
    console.error('Erro ao iniciar produção:', erro);

    return res.status(500).json({
      erro: 'Não foi possível iniciar a produção.'
    });
  }
});

app.listen(PORTA, () => {
  console.log(`Servidor rodando com sucesso na porta ${PORTA}`);
});