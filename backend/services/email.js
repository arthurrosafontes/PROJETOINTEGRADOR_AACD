function emailConfigurado() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.AACD_EMAIL_REMETENTE?.trim());
}

function enviarEmail({ destinatario, assunto, texto, idempotencia }, enviar = fetch) {
  return enviar('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.RESEND_API_KEY.trim(),
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencia
    },
    body: JSON.stringify({
      from: process.env.AACD_EMAIL_REMETENTE.trim(),
      to: [destinatario],
      subject: assunto,
      text: texto
    }),
    signal: AbortSignal.timeout(10000)
  });
}

module.exports = { emailConfigurado, enviarEmail };
