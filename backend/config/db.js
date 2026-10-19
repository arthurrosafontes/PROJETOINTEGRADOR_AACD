const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const conectarBanco = async () => {
    try {
        const uri = process.env.MONGO_URI;
        if (!uri) {
            throw new Error('A variável MONGO_URI não foi definida no arquivo .env');
        }
        await mongoose.connect(uri);
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