const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

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
app.use('/api/notificacoes', require('./routes/notificacoes'));
app.use('/api/pedidos', require('./routes/conclusao').router);
app.use('/api/pedidos', require('./routes/envio').router);
app.use('/api/pedidos', require('./routes/recebimento').router);
app.use('/api/pedidos', require('./routes/material-aacd').criarRouter());
app.use('/api/matchmaking', require('./routes/matchmaking').criarRouter());

app.use('/api/voluntarios', require('./routes/voluntarios'));
app.use('/api/auth', require('./routes/auth'));
app.get('/', (req, res) => res.send('API do Projeto AACD rodando com sucesso!'));
app.use(require('./routes/impressoras'));
app.use(require('./routes/cadastro-proteses'));
app.use('/api/funcionario', require('./routes/consulta-proteses'));
app.use('/api/funcionario/demandas', require('./routes/demandas'));
app.use(require('./routes/publicacao-demandas'));
app.use(require('./routes/pedidos-disponiveis'));
app.use(require('./routes/pedidos-voluntario'));

module.exports = app;
