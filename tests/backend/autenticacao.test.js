jest.mock('../../backend/config/mysql', () => ({ execute: jest.fn() }));

const jwt = require('jsonwebtoken');
const pool = require('../../backend/config/mysql');
const { exigirAutenticacao, exigirPerfil } = require('../../backend/middleware/autenticacao');

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres!!';

const criarRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const criarToken = (payload = {}, opcoes = {}) =>
  jwt.sign({ sub: 1, perfil: 'voluntario', ...payload }, SEGREDO, { issuer: 'aacd', expiresIn: '1h', ...opcoes });

const reqComToken = (token) => ({ cookies: { aacd_sessao: token } });

const voluntarioAprovado = {
  id_usuario: 1, nome: 'Maria', email: 'maria@teste.com', tipo_usuario: 'Voluntário',
  status: 'Ativo', id_voluntario: 10, status_homologacao: 'Aprovado', id_funcionario: null
};

const funcionario = {
  id_usuario: 2, nome: 'João', email: 'joao@aacd.org', tipo_usuario: 'Funcionário AACD',
  status: 'Ativo', id_voluntario: null, status_homologacao: null, id_funcionario: 20
};

beforeEach(() => {
  process.env.JWT_SECRET = SEGREDO;
  pool.execute.mockReset();
});

describe('exigirAutenticacao', () => {
  test('401 sem cookie de sessão', async () => {
    const res = criarRes(); const next = jest.fn();
    await exigirAutenticacao({ cookies: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('401 quando não há cookies no request', async () => {
    const res = criarRes(); const next = jest.fn();
    await exigirAutenticacao({}, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('401 quando JWT_SECRET não está configurado', async () => {
    delete process.env.JWT_SECRET;
    const res = criarRes(); const next = jest.fn();
    await exigirAutenticacao(reqComToken('qualquer'), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('401 com token malformado', async () => {
    const res = criarRes(); const next = jest.fn();
    await exigirAutenticacao(reqComToken('token.invalido.aqui'), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(pool.execute).not.toHaveBeenCalled();
  });

  test('401 com token expirado', async () => {
    const res = criarRes(); const next = jest.fn();
    await exigirAutenticacao(reqComToken(criarToken({}, { expiresIn: -10 })), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('401 com token assinado por outro segredo', async () => {
    const falso = jwt.sign({ sub: 1, perfil: 'voluntario' }, 'outro-segredo', { issuer: 'aacd' });
    const res = criarRes(); const next = jest.fn();
    await exigirAutenticacao(reqComToken(falso), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('401 com token de outro emissor', async () => {
    const res = criarRes(); const next = jest.fn();
    await exigirAutenticacao(reqComToken(criarToken({}, { issuer: 'invasor' })), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('voluntário aprovado e ativo é autenticado', async () => {
    pool.execute.mockResolvedValue([[voluntarioAprovado]]);
    const req = reqComToken(criarToken());
    const res = criarRes(); const next = jest.fn();
    await exigirAutenticacao(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.usuario).toMatchObject({ id_usuario: 1, perfil: 'voluntario', id_voluntario: 10 });
  });

  test('voluntário com cadastro pendente não tem acesso', async () => {
    pool.execute.mockResolvedValue([[{ ...voluntarioAprovado, status_homologacao: 'Pendente' }]]);
    const res = criarRes(); const next = jest.fn();
    await exigirAutenticacao(reqComToken(criarToken()), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('funcionário ativo é autenticado', async () => {
    pool.execute.mockResolvedValue([[funcionario]]);
    const req = reqComToken(criarToken({ sub: 2, perfil: 'funcionario' }));
    const res = criarRes(); const next = jest.fn();
    await exigirAutenticacao(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.usuario).toMatchObject({ id_usuario: 2, perfil: 'funcionario', id_funcionario: 20 });
  });

  test('usuário inativo é rejeitado', async () => {
    pool.execute.mockResolvedValue([[{ ...voluntarioAprovado, status: 'Inativo' }]]);
    const res = criarRes(); const next = jest.fn();
    await exigirAutenticacao(reqComToken(criarToken()), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('usuário que não existe mais é rejeitado', async () => {
    pool.execute.mockResolvedValue([[]]);
    const res = criarRes(); const next = jest.fn();
    await exigirAutenticacao(reqComToken(criarToken()), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('perfil do token diferente do cadastro é rejeitado (voluntário fingindo ser funcionário)', async () => {
    pool.execute.mockResolvedValue([[voluntarioAprovado]]);
    const res = criarRes(); const next = jest.fn();
    await exigirAutenticacao(reqComToken(criarToken({ perfil: 'funcionario' })), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('perfil desconhecido no token é rejeitado', async () => {
    pool.execute.mockResolvedValue([[funcionario]]);
    const res = criarRes(); const next = jest.fn();
    await exigirAutenticacao(reqComToken(criarToken({ sub: 2, perfil: 'admin' })), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('500 quando o banco falha', async () => {
    const erroSilencioso = jest.spyOn(console, 'error').mockImplementation(() => {});
    pool.execute.mockRejectedValue(new Error('banco fora do ar'));
    const res = criarRes(); const next = jest.fn();
    await exigirAutenticacao(reqComToken(criarToken()), res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
    erroSilencioso.mockRestore();
  });
});

describe('exigirPerfil', () => {
  test('libera quando o perfil confere', () => {
    const next = jest.fn();
    exigirPerfil('voluntario')({ usuario: { perfil: 'voluntario' } }, criarRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('403 quando o perfil não confere', () => {
    const res = criarRes(); const next = jest.fn();
    exigirPerfil('funcionario')({ usuario: { perfil: 'voluntario' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('403 quando não há usuário no request', () => {
    const res = criarRes(); const next = jest.fn();
    exigirPerfil('voluntario')({}, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
