const mongoose = require('mongoose');
require('dotenv').config();

const conectarBanco = async () => {
    try {
        const uri = process.env.MONGO_URI;
        if (!uri) {
            throw new Error('A variável MONGO_URI não foi definida no arquivo .env');
        }
        await mongoose.connect(uri);
        console.log('Conectado ao MongoDB Atlas (Nuvem) com sucesso!');
    } catch (erro) {
        console.error('Erro ao conectar ao MongoDB:', erro.message);
        process.exit(1);
    }
};

module.exports = conectarBanco;