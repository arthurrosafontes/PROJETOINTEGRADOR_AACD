
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const caPath = path.resolve(process.cwd(), 'certs', 'ca.pem');

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
