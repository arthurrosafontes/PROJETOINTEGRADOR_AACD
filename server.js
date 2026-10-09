const express = require('express');
const cors = require('cors');
const conectarBanco = require('./backend/config/db');

const FichaImpressora = require('./backend/models/FichaTecnicaImpressora');

const app = express();

app.use(express.json());
app.use(cors());

conectarBanco();

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
        const impressoras = await FichaImpressora.find();
        res.status(200).json(impressoras);
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao buscar impressoras', detalhes: erro.message });
    }
});

const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => {
    console.log(`Servidor rodando com sucesso na porta ${PORTA}`);
});