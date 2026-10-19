require('dotenv').config();
const express = require('express');
const cors = require('cors');
const conectarBanco = require('./backend/config/db');

const FichaImpressora = require('./backend/models/FichaTecnicaImpressora');
const voluntariosRoutes = require('./backend/routes/voluntarios');

const app = express();

app.use(express.json());
app.use(cors());

conectarBanco();

app.use('/api/voluntarios', voluntariosRoutes);

app.get('/', (req, res) => {
    res.send('API do Projeto AACD rodando com sucesso!');
});

app.post('/api/impressoras', async (req, res) => {
    try {
        const novaImpressora = new FichaImpressora(req.body);
        await novaImpressora.save();
        res.status(201).json({
            mensagem: 'Impressora cadastrada com sucesso no MongoDB!',
            impressora: novaImpressora
        });
    } catch (erro) {
        res.status(400).json({ erro: 'Erro ao cadastrar impressora', detalhes: erro.message });
    }
});

app.get('/api/impressoras', async (req, res) => {
    try {
        const filtro = {};
        if (req.query.id_voluntario) {
            filtro.id_voluntario = Number(req.query.id_voluntario);
        }
        const impressoras = await FichaImpressora.find(filtro);
        res.status(200).json(impressoras);
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao buscar impressoras', detalhes: erro.message });
    }
});

app.get('/api/impressoras/:id', async (req, res) => {
    try {
        const impressora = await FichaImpressora.findById(req.params.id);
        if (!impressora) {
            return res.status(404).json({ erro: 'Impressora não encontrada' });
        }
        res.status(200).json(impressora);
    } catch (erro) {
        res.status(400).json({
            erro: 'ID inválido ou erro ao buscar impressora',
            detalhes: erro.message
        });
    }
});

app.put('/api/impressoras/:id', async (req, res) => {
    try {
        const dadosAtualizados = {
            ...req.body,
            data_atualizacao: Date.now()
        };
        const impressoraAtualizada = await FichaImpressora.findByIdAndUpdate(
            req.params.id,
            dadosAtualizados,
            { new: true, runValidators: true }
        );
        if (!impressoraAtualizada) {
            return res.status(404).json({ erro: 'Impressora não encontrada' });
        }
        res.status(200).json({
            mensagem: 'Impressora atualizada com sucesso!',
            impressora: impressoraAtualizada
        });
    } catch (erro) {
        res.status(400).json({
            erro: 'Erro ao atualizar impressora',
            detalhes: erro.message
        });
    }
});

const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => {
    console.log(`Servidor rodando com sucesso na porta ${PORTA}`);
});
