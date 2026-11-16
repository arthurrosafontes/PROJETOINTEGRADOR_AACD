const pool = require('../config/mysql');

(async () => {
    try {
        const [solicitacoes] = await pool.query(
            "SELECT protocolo, id_usuario, estado, solicitado_em FROM exclusao_conta WHERE estado <> 'concluida' ORDER BY solicitado_em"
        );
        if (solicitacoes.length) console.table(solicitacoes);
        else console.log('Nenhuma solicitação de exclusão pendente.');
    } finally {
        await pool.end();
    }
})().catch(erro => {
    console.error('Falha ao consultar solicitações:', erro.code || erro.name);
    process.exitCode = 1;
});
