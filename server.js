require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
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
    const impressoras = await FichaImpressora.find({ id_voluntario: req.usuario.id_voluntario });
    res.status(200).json(impressoras);
  } catch (erro) {
    console.error('Erro ao listar impressoras:', erro);
    res.status(500).json({ erro: 'Erro ao buscar impressoras.' });
  }
});

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

      const ids = [...new Set(
        impressoras.map(i => Number(i.id_voluntario))
          .filter(Number.isInteger)
      )];

      let voluntarios = [];

      if (ids.length > 0) {
        const marcadores = ids.map(() => '?').join(',');

        const [linhas] = await pool.query(
          `SELECT v.id_voluntario, u.nome, u.email,
                  u.telefone, v.status_homologacao
           FROM voluntario v
           INNER JOIN usuario u
             ON u.id_usuario = v.id_usuario
           WHERE v.id_voluntario IN (${marcadores})`,
          ids
        );

        voluntarios = linhas;
      }

      const porId = new Map(
        voluntarios.map(v => [Number(v.id_voluntario), v])
      );

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

app.listen(PORTA, () => console.log(`Servidor rodando com sucesso na porta ${PORTA}`));
