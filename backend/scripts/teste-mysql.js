
const pool = require('./config/mysql');

async function testarConexao() {
    try {
        const [resultado] = await pool.query(
            'SELECT DATABASE() AS banco'
        );

        console.log('Conectado ao MySQL Aiven!');
        console.log('Banco:', resultado[0].banco);

    } catch (erro) {
        console.error('Erro ao conectar:', erro.message);

    } finally {
        await pool.end();
    }
}

testarConexao();
