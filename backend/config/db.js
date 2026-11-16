const mongoose = require('mongoose');
const path = require('path');
const dns = require('node:dns');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function conectarAtlas(uri) {
    try {
        await mongoose.connect(uri);
    } catch (erro) {
        const alternativos = (process.env.MONGO_DNS_SERVERS || '').split(',').map(s => s.trim()).filter(Boolean);
        const falhaDns = erro.syscall === 'querySrv' || erro.syscall === 'queryTxt';
        if (!uri.startsWith('mongodb+srv://') || !falhaDns || !alternativos.length) throw erro;

        const dnsDaRede = dns.getServers();
        console.warn('A consulta DNS do Atlas pela rede falhou. Tentando os servidores DNS alternativos do Hub.');
        dns.setServers(alternativos);
        try {
            await mongoose.connect(uri);
        } catch (falhaAlternativa) {
            dns.setServers(dnsDaRede);
            throw falhaAlternativa;
        }
    }
}

const conectarBanco = async () => {
    try {
        const uri = process.env.MONGO_URI;
        if (!uri) {
            throw new Error('A variável MONGO_URI não foi definida no arquivo .env');
        }
        await conectarAtlas(uri);
        console.log('Conectado ao MongoDB Atlas (Nuvem) com sucesso!');
        mongoose.connection.on('disconnected', () => {
            console.warn('Aviso: Conexão com o MongoDB Atlas foi encerrada.');
        });
    } catch (erro) {
        console.error('Erro ao conectar ao MongoDB:', erro.message);
        process.exit(1);
    }
};

module.exports = conectarBanco;
