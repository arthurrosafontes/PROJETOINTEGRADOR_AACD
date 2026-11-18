const { emailConfigurado, enviarEmail } = require('../../backend/services/email');

const ambienteOriginal = { ...process.env };
afterEach(() => { process.env = { ...ambienteOriginal }; });

describe('emailConfigurado', () => {
  test('false sem variáveis de ambiente', () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.AACD_EMAIL_REMETENTE;
    expect(emailConfigurado()).toBe(false);
  });

  test('false quando só uma das variáveis existe', () => {
    process.env.RESEND_API_KEY = 're_123';
    delete process.env.AACD_EMAIL_REMETENTE;
    expect(emailConfigurado()).toBe(false);
  });

  test('false quando as variáveis são só espaços', () => {
    process.env.RESEND_API_KEY = '   ';
    process.env.AACD_EMAIL_REMETENTE = '  ';
    expect(emailConfigurado()).toBe(false);
  });

  test('true com as duas variáveis preenchidas', () => {
    process.env.RESEND_API_KEY = 're_123';
    process.env.AACD_EMAIL_REMETENTE = 'hub@aacd.org';
    expect(emailConfigurado()).toBe(true);
  });
});

describe('enviarEmail', () => {
  test('monta a requisição para a API do Resend', async () => {
    process.env.RESEND_API_KEY = '  re_chave  ';
    process.env.AACD_EMAIL_REMETENTE = ' hub@aacd.org ';
    const enviar = jest.fn().mockResolvedValue({ ok: true });

    await enviarEmail(
      { destinatario: 'maria@teste.com', assunto: 'Novo pedido', texto: 'Olá!', idempotencia: 'abc-1' },
      enviar
    );

    expect(enviar).toHaveBeenCalledTimes(1);
    const [url, opcoes] = enviar.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(opcoes.method).toBe('POST');
    expect(opcoes.headers.Authorization).toBe('Bearer re_chave');
    expect(opcoes.headers['Idempotency-Key']).toBe('abc-1');
    expect(JSON.parse(opcoes.body)).toEqual({
      from: 'hub@aacd.org', to: ['maria@teste.com'], subject: 'Novo pedido', text: 'Olá!'
    });
    expect(opcoes.signal).toBeDefined();
  });
});
