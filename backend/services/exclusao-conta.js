const { randomUUID } = require('node:crypto');
const bcrypt = require('bcrypt');
const fs = require('node:fs/promises');
const path = require('node:path');
const pool = require('../config/mysql');
const Impressora = require('../models/FichaTecnicaImpressora');

const pastaPerfil = path.join(__dirname, '..', '..', 'uploads', 'fotos-perfil');

async function transacao(operacao) {
    const conexao = await pool.getConnection();
    try {
        await conexao.beginTransaction();
        const resultado = await operacao(conexao);
        await conexao.commit();
        return resultado;
    } catch (erro) {
        await conexao.rollback().catch(() => {});
        throw erro;
    } finally {
        conexao.release();
    }
}

async function bloquearConta(conexao, id) {
    const [[conta]] = await conexao.execute(
        'SELECT status, senha_hash FROM usuario WHERE id_usuario = ? FOR UPDATE', [id]
    );
    return conta;
}

// Uma criação de impressora ou foto não pode atravessar o encerramento do acesso.
async function comContaAtiva(id, operacao) {
    return transacao(async conexao => {
        const conta = await bloquearConta(conexao, id);
        if (conta?.status !== 'Ativo') {
            const erro = new Error('Esta conta não está ativa.');
            erro.code = 'CONTA_INATIVA';
            throw erro;
        }
        return operacao();
    });
}

async function vinculos(conexao, usuario) {
    const [[voluntario]] = await conexao.execute('SELECT id_voluntario FROM voluntario WHERE id_usuario = ? FOR UPDATE', [usuario]);
    const [[funcionario]] = await conexao.execute('SELECT id_funcionario FROM funcionario_aacd WHERE id_usuario = ? FOR UPDATE', [usuario]);
    const [[dados]] = await conexao.execute(`SELECT
        EXISTS(SELECT 1 FROM pedido_producao WHERE id_voluntario = ?) OR
        EXISTS(SELECT 1 FROM demanda WHERE id_funcionario = ?) OR
        EXISTS(SELECT 1 FROM historico_producao WHERE id_usuario = ?) OR
        EXISTS(SELECT 1 FROM recebimento_pedido WHERE id_usuario = ?) OR
        EXISTS(SELECT 1 FROM material_pedido WHERE preparado_por = ?) AS temVinculos`,
    [voluntario?.id_voluntario ?? null, funcionario?.id_funcionario ?? null, usuario, usuario, usuario]);
    return { voluntario, funcionario, temVinculos: Boolean(dados.temVinculos) };
}

async function solicitar(usuario, senha) {
    // Compara antes de adquirir o bloqueio e verifica novamente o hash dentro da transação.
    const [[atual]] = await pool.execute('SELECT senha_hash FROM usuario WHERE id_usuario = ? AND status = ?', [usuario, 'Ativo']);
    if (!atual || !(await bcrypt.compare(senha, atual.senha_hash))) return null;
    return transacao(async conexao => {
        const conta = await bloquearConta(conexao, usuario);
        if (conta?.status !== 'Ativo' || conta.senha_hash !== atual.senha_hash) return null;
        const { temVinculos } = await vinculos(conexao, usuario);
        const protocolo = randomUUID();
        const estado = temVinculos ? 'revisao' : 'limpeza';
        await conexao.execute("UPDATE usuario SET status = 'Inativo' WHERE id_usuario = ?", [usuario]);
        await conexao.execute("UPDATE notificacao SET email_estado = 'ignorado' WHERE id_usuario = ? AND email_estado = 'pendente'", [usuario]);
        await conexao.execute('INSERT INTO exclusao_conta (protocolo, id_usuario, estado) VALUES (?, ?, ?)', [protocolo, usuario, estado]);
        return { protocolo, estado };
    });
}

async function limpar(protocolo) {
    try {
        return await transacao(async conexao => {
            const [[pedido]] = await conexao.execute('SELECT id_usuario, estado FROM exclusao_conta WHERE protocolo = ? FOR UPDATE', [protocolo]);
            if (!pedido || pedido.estado !== 'limpeza') return pedido?.estado;
            const id = pedido.id_usuario;
            const conta = await bloquearConta(conexao, id);
            const { voluntario, temVinculos } = await vinculos(conexao, id);
            if (temVinculos || conta?.status === 'Ativo') {
                await conexao.execute("UPDATE exclusao_conta SET estado = 'revisao' WHERE protocolo = ?", [protocolo]);
                return 'revisao';
            }
            if (voluntario) await Impressora.deleteMany({ id_voluntario: voluntario.id_voluntario });
            for (const extensao of ['jpg', 'png']) {
                await fs.rm(path.join(pastaPerfil, `${id}.${extensao}`), { force: true });
            }
            // Os aceites são removidos pela FK do usuário. As preferências e a fila não têm FK.
            await conexao.execute('DELETE FROM preferencia_notificacao WHERE id_usuario = ?', [id]);
            await conexao.execute('DELETE FROM notificacao WHERE id_usuario = ?', [id]);
            await conexao.execute('DELETE FROM voluntario WHERE id_usuario = ?', [id]);
            await conexao.execute('DELETE FROM funcionario_aacd WHERE id_usuario = ?', [id]);
            await conexao.execute('DELETE FROM usuario WHERE id_usuario = ?', [id]);
            await conexao.execute("UPDATE exclusao_conta SET estado = 'concluida', id_usuario = NULL, concluido_em = UTC_TIMESTAMP() WHERE protocolo = ?", [protocolo]);
            return 'concluida';
        });
    } catch (erro) {
        console.error('Falha na limpeza da conta:', erro.code || erro.name);
        const estado = erro.code === 'ER_ROW_IS_REFERENCED_2' ? 'revisao' : 'limpeza';
        try {
            await pool.execute(`UPDATE exclusao_conta SET estado = ?, proxima_tentativa = CURRENT_TIMESTAMP + INTERVAL 2 MINUTE
                WHERE protocolo = ? AND estado = 'limpeza'`, [estado, protocolo]);
        } catch (falha) {
            console.error('Não foi possível atualizar a fila de exclusões:', falha.code || falha.name);
        }
        return estado;
    }
}

function iniciarFila() {
    let processando = false;
    setInterval(async () => {
        if (processando) return;
        processando = true;
        try {
            const [pedidos] = await pool.execute(`SELECT protocolo FROM exclusao_conta
                WHERE estado = 'limpeza' AND proxima_tentativa <= CURRENT_TIMESTAMP
                ORDER BY proxima_tentativa LIMIT 10`);
            for (const { protocolo } of pedidos) await limpar(protocolo);
        } catch (erro) {
            console.error('Fila de exclusões indisponível:', erro.code || erro.name);
        } finally {
            processando = false;
        }
    }, 30000).unref();
}

module.exports = { comContaAtiva, pastaPerfil, solicitar, limpar, iniciarFila };
