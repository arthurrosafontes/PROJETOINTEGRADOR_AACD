const express = require('express');
const cors = require('cors');
const conectarBanco = require('./backend/config/db');

const FichaImpressora = require('./backend/models/FichaTecnicaImpressora');
const Demanda = require('./backend/models/EspecificacaoDemanda');
const Andamento = require('./backend/models/AndamentoProducao');

const app = express();

app.use(express.json());
app.use(cors());

conectarBanco();

app.get('/', (req, res) => {
    res.send('Servidor do Projeto Integrador AACD está rodando com sucesso!');
});

app.post('/api/impressoras', async (req, res) => {
    try {
        const novaImpressora = new FichaImpressora(req.body);
        await novaImpressora.save();
        res.status(201).json({ mensagem: 'Impressora cadastrada com sucesso!', impressora: novaImpressora });
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

app.post('/api/demandas', async (req, res) => {
    try {
        const novaDemanda = new Demanda(req.body);
        await novaDemanda.save();
        res.status(201).json({ mensagem: 'Demanda técnica cadastrada com sucesso!', demanda: novaDemanda });
    } catch (erro) {
        res.status(400).json({ erro: 'Erro ao cadastrar demanda', detalhes: erro.message });
    }
});

app.get('/api/demandas', async (req, res) => {
    try {
        const demandas = await Demanda.find();
        res.status(200).json(demandas);
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao buscar demandas', detalhes: erro.message });
    }
});

app.post('/api/andamento/iniciar', async (req, res) => {
    try {
        const novoAndamento = new Andamento(req.body);
        await novoAndamento.save();
        res.status(201).json({ mensagem: 'Produção iniciada com sucesso!', andamento: novoAndamento });
    } catch (erro) {
        res.status(400).json({ erro: 'Erro ao iniciar produção', detalhes: erro.message });
    }
});

app.post('/api/andamento/:id/atualizar', async (req, res) => {
    try {
        const { status, foto_url, motivo_pausa } = req.body;
        const andamento = await Andamento.findById(req.params.id);

        if (!andamento) {
            return res.status(404).json({ erro: 'Registro de produção não encontrado.' });
        }

        andamento.historico_eventos.push({
            status,
            foto_url,
            motivo_pausa: status === 'Pausado' ? motivo_pausa : null,
            data_hora: new Date()
        });

        if (status === 'Entregue') {
            andamento.data_conclusao = new Date();
        }

        await andamento.save();
        res.status(200).json({ mensagem: 'Status atualizado com sucesso!', andamento });
    } catch (erro) {
        res.status(400).json({ erro: 'Erro ao atualizar status', detalhes: erro.message });
    }
});

app.get('/api/andamento/:id', async (req, res) => {
    try {
        const andamento = await Andamento.findById(req.params.id);
        if (!andamento) {
            return res.status(404).json({ erro: 'Produção não encontrada.' });
        }
        res.status(200).json(andamento);
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao consultar andamento', detalhes: erro.message });
    }
});

const PORTA = 3000;
app.listen(PORTA, () => {
    console.log(`Servidor rodando com sucesso na porta ${PORTA}`);
});