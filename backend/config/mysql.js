
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Certificado CA do Aiven (baixe em Aiven > seu serviço MySQL > "CA certificate")
// e salve como certs/ca.pem na raiz do projeto. A pasta certs/ não vai para o Git.
const caPath = path.resolve(__dirname, '..', '..', 'certs', 'ca.pem');
if (!fs.existsSync(caPath)) {
    throw new Error(
        `Certificado do MySQL não encontrado em: ${caPath}\n` +
        'Baixe o "CA certificate" no painel do Aiven e salve como certs/ca.pem na raiz do projeto.'
    );
}

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,

    ssl: {
        ca: fs.readFileSync(caPath),
        rejectUnauthorized: true
    },

    waitForConnections: true,
    connectionLimit: 10
});

module.exports = pool;
