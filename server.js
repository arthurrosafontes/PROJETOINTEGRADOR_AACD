require('dotenv').config();

const app = require('./backend/app');
const conectarBanco = require('./backend/config/db');
const pool = require('./backend/config/mysql');
const notificacoes = require('./backend/services/notificacoes');
const exclusaoConta = require('./backend/services/exclusao-conta');

const PORTA = process.env.PORT || 3000;

async function iniciarServidor() {
  await conectarBanco();
  app.listen(PORTA, () => {
    notificacoes.iniciarEnvio(pool);
    exclusaoConta.iniciarFila();
    console.log(`Servidor rodando com sucesso na porta ${PORTA}`);
  });
}

iniciarServidor();
