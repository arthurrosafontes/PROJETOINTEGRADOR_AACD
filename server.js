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
app.listen(PORTA, () => console.log(`Servidor rodando com sucesso na porta ${PORTA}`));
