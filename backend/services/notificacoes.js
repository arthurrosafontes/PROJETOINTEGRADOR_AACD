const { randomUUID } = require('node:crypto');
const caminhos = {
  funcionario: '/funcionario/demandas/lista',
  voluntario: '/voluntario/pedidos-aceitos',
  convite: '/voluntario/pedidos-disponiveis'
};

function emailConfigurado() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.AACD_EMAIL_REMETENTE?.trim());
}

const inserir = `INSERT INTO notificacao (id, id_usuario, evento, mensagem, link, popup, email_estado)
  SELECT ?, u.id_usuario, ?, ?, ?, COALESCE(pn.hub, TRUE),
    IF(COALESCE(pn.email, FALSE) AND ?, 'pendente', 'ignorado')
  FROM usuario u LEFT JOIN preferencia_notificacao pn ON pn.id_usuario = u.id_usuario
  WHERE u.id_usuario = ? AND u.status = 'Ativo'
  AND (COALESCE(pn.hub, TRUE) OR (COALESCE(pn.email, FALSE) AND ?))
  ON DUPLICATE KEY UPDATE id = notificacao.id`;

async function registrar(conexao, usuario, evento, mensagem, destino) {
  const email = emailConfigurado();
  const [resultado] = await conexao.execute(inserir, [randomUUID(), evento, mensagem, caminhos[destino], email, usuario, email]);
  // Um novo convite pode enfileirar o e-mail que não chegou a ser tentado.
  // O registro e a confirmação de exibição do pop-up são preservados.
  if (email && destino === "convite") {
    const [reenfileirado] = await conexao.execute(
      "UPDATE notificacao n JOIN preferencia_notificacao p ON p.id_usuario = n.id_usuario " +
      "JOIN usuario u ON u.id_usuario = n.id_usuario " +
      "SET n.email_estado = 'pendente', n.proxima_tentativa = CURRENT_TIMESTAMP, n.criada = CURRENT_TIMESTAMP " +
      "WHERE n.id_usuario = ? AND n.evento = ? AND n.email_estado = 'ignorado' " +
      "AND n.tentativas = 0 AND p.email = TRUE AND u.status = 'Ativo'",
      [usuario, evento]
    );
    return resultado.affectedRows + reenfileirado.affectedRows;
  }
  return resultado.affectedRows;
}

async function pedido(conexao, id, etapa, mensagem) {
  const [[destinos]] = await conexao.execute(`SELECT d.id_demanda, v.id_usuario AS usuarioVoluntario, f.id_usuario AS usuarioFuncionario
    FROM pedido_producao pp JOIN demanda d ON d.id_demanda = pp.id_demanda
    JOIN voluntario v ON v.id_voluntario = pp.id_voluntario
    JOIN funcionario_aacd f ON f.id_funcionario = d.id_funcionario WHERE pp.id_pedido = ?`, [id]);
  if (!destinos) return;
  for (const [perfil, usuario] of [['funcionario', destinos.usuarioFuncionario], ['voluntario', destinos.usuarioVoluntario]]) {
    await registrar(conexao, usuario, `pedido:${id}:${etapa}`,
      `Pedido #${id} (demanda #${destinos.id_demanda}). ${mensagem}`, perfil);
  }
}

async function enviarLote(pool, enviar = fetch) {
  const [fila] = await pool.execute(`SELECT id FROM notificacao
    WHERE email_estado = 'pendente' AND proxima_tentativa <= CURRENT_TIMESTAMP
    ORDER BY proxima_tentativa LIMIT 10`);
  for (const { id } of fila) {
    const [reserva] = await pool.execute(`UPDATE notificacao SET proxima_tentativa = CURRENT_TIMESTAMP + INTERVAL 2 MINUTE
      WHERE id = ? AND email_estado = 'pendente' AND proxima_tentativa <= CURRENT_TIMESTAMP`, [id]);
    if (!reserva.affectedRows) continue;
    const [[item]] = await pool.execute(`SELECT n.mensagem, n.tentativas, u.email,
      (p.email = TRUE AND u.status = 'Ativo') AS autorizado,
      (n.criada > CURRENT_TIMESTAMP - INTERVAL 23 HOUR) AS recente
      FROM notificacao n LEFT JOIN usuario u ON u.id_usuario = n.id_usuario
      LEFT JOIN preferencia_notificacao p ON p.id_usuario = n.id_usuario WHERE n.id = ? AND n.email_estado = 'pendente'`, [id]);
    if (!item) continue;
    let estado = 'ignorado';
    if (item.autorizado && item.email && item.recente) {
      estado = 'pendente';
      try {
        const resposta = await enviar('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
            'Content-Type': 'application/json',
            'Idempotency-Key': 'aacd/' + id
          },
          body: JSON.stringify({
            from: process.env.AACD_EMAIL_REMETENTE,
            to: [item.email],
            subject: 'Nova atualização no Hub AACD',
            text: item.mensagem + '\n\nAcesse o Hub AACD para ver os detalhes.'
          }),
          signal: AbortSignal.timeout(10000)
        });
        if (resposta.ok) estado = 'enviado';
        else if ([400, 422].includes(resposta.status)) estado = 'falhou';
        if (resposta.ok) {
          await resposta.body?.cancel().catch(() => {});
        } else {
          const erro = await resposta.json().catch(() => ({}));
          const mensagem = String(erro?.message || "");
          // Use mensagens fixas. A resposta do Resend pode conter endereços de e-mail.
          let motivo = "consulte a resposta no painel do Resend";
          if (resposta.status === 403 && /only send testing emails|your own email address/i.test(mensagem)) {
            motivo = "o remetente de teste só envia para o e-mail vinculado à conta do Resend";
          } else if (resposta.status === 403 && /not verified/i.test(mensagem)) {
            motivo = "o domínio do remetente não está verificado";
          } else if (resposta.status === 401 || erro?.name === "restricted_api_key" || erro?.name === "invalid_permission") {
            motivo = "confira a chave e a permissão para envio";
          }
          console.warn("Falha no serviço de e-mail AACD (HTTP %s), aviso %s: %s.", resposta.status, id, motivo);
        }
      } catch {
        console.warn('O serviço de e-mail AACD não respondeu.');
      }
      if (estado === 'pendente' && item.tentativas >= 4) estado = 'falhou';
    }
    await pool.execute(`UPDATE notificacao SET email_estado = ?, tentativas = tentativas + 1,
      proxima_tentativa = CURRENT_TIMESTAMP + INTERVAL 5 MINUTE WHERE id = ? AND email_estado = 'pendente'`, [estado, id]);
  }
}

function iniciarEnvio(pool) {
  if (!emailConfigurado()) return;
  let ativo = false;
  async function processar() {
    if (ativo) return;
    ativo = true;
    try { await enviarLote(pool); }
    catch (erro) { console.warn('Falha na fila de e-mail AACD:', erro.code || erro.name); }
    finally { ativo = false; }
  }
  setInterval(processar, 15000).unref();
}

module.exports = { registrar, pedido, emailConfigurado, enviarLote, iniciarEnvio };
