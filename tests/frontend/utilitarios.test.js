/**
 * @jest-environment jsdom
 */
require('../../frontend/js/utilitarios.js');
const { util } = window.AACD;

describe('escapar', () => {
  test('converte caracteres perigosos de HTML', () => {
    expect(util.escapar('<script>alert("x")</script>')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(util.escapar("O'Neil & Filhos")).toBe('O&#39;Neil &amp; Filhos');
  });

  test('null e undefined viram texto vazio', () => {
    expect(util.escapar(null)).toBe('');
    expect(util.escapar(undefined)).toBe('');
  });

  test('números são convertidos para texto', () => {
    expect(util.escapar(42)).toBe('42');
  });
});

describe('formatarData', () => {
  test('converte AAAA-MM-DD para DD/MM/AAAA', () => {
    expect(util.formatarData('2026-10-22')).toBe('22/10/2026');
  });

  test('aceita data com horário ISO', () => {
    expect(util.formatarData('2026-10-22T15:30:00.000Z')).toBe('22/10/2026');
  });

  test('vazio devolve hífen', () => {
    expect(util.formatarData('')).toBe('-');
    expect(util.formatarData(null)).toBe('-');
  });
});

describe('formatarDataHora', () => {
  test('converte UTC para o horário de Brasília (UTC-3)', () => {
    expect(util.formatarDataHora('2026-10-29 15:05:29')).toMatch(/^29\/10\/2026,? 12:05:29$/);
  });

  test('aceita o formato ISO com Z', () => {
    expect(util.formatarDataHora('2026-10-29T15:05:29Z')).toMatch(/^29\/10\/2026,? 12:05:29$/);
  });

  test('virada de dia respeita o fuso', () => {
    expect(util.formatarDataHora('2026-10-29 01:00:00')).toMatch(/^28\/10\/2026,? 22:00:00$/);
  });

  test('valores vazios ou inválidos devolvem hífen', () => {
    expect(util.formatarDataHora('')).toBe('-');
    expect(util.formatarDataHora(null)).toBe('-');
    expect(util.formatarDataHora('isso não é data')).toBe('-');
  });
});

describe('hojeISO', () => {
  test('retorna uma data no formato AAAA-MM-DD', () => {
    expect(util.hojeISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('digitos', () => {
  test('mantém só os números', () => {
    expect(util.digitos('(11) 98765-4321')).toBe('11987654321');
    expect(util.digitos('abc')).toBe('');
  });
});

describe('máscaras', () => {
  test('cep', () => {
    expect(util.mascaras.cep('04027000')).toBe('04027-000');
    expect(util.mascaras.cep('0402')).toBe('0402');
    expect(util.mascaras.cep('040270001234')).toBe('04027-000');
  });

  test('telefone fixo (10 dígitos)', () => {
    expect(util.mascaras.telefone('1123456789')).toBe('(11) 2345-6789');
  });

  test('telefone celular (11 dígitos)', () => {
    expect(util.mascaras.telefone('11987654321')).toBe('(11) 98765-4321');
  });

  test('telefone ignora dígitos além de 11', () => {
    expect(util.mascaras.telefone('119876543219999')).toBe('(11) 98765-4321');
  });

  test('cpf', () => {
    expect(util.mascaras.cpf('12345678901')).toBe('123.456.789-01');
    expect(util.mascaras.cpf('123')).toBe('123');
    expect(util.mascaras.cpf('1234')).toBe('123.4');
    expect(util.mascaras.cpf('1234567')).toBe('123.456.7');
  });

  test('cnpj', () => {
    expect(util.mascaras.cnpj('12345678000195')).toBe('12.345.678/0001-95');
  });

  test('máscaras ignoram letras e símbolos digitados', () => {
    expect(util.mascaras.cpf('123.abc.456')).toBe('123.456');
  });
});

describe('emailValido', () => {
  test.each(['maria@teste.com', 'a.b@c.org', '  joao@aacd.org.br  '])('aceita %p', (email) => {
    expect(util.emailValido(email)).toBe(true);
  });

  test.each(['', 'sem-arroba.com', 'a@b', 'a b@c.com', '@c.com', 'a@.com'])('rejeita %p', (email) => {
    expect(util.emailValido(email)).toBe(false);
  });
});

describe('armazenamento', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

  test('grava e lê objetos', () => {
    expect(util.armazenamento.gravar('chave', { a: 1 })).toBe(true);
    expect(util.armazenamento.ler('chave')).toEqual({ a: 1 });
  });

  test('ler chave inexistente devolve null', () => {
    expect(util.armazenamento.ler('nao-existe')).toBeNull();
  });

  test('ler valor corrompido devolve null em vez de lançar erro', () => {
    localStorage.setItem('quebrado', '{não é json');
    expect(util.armazenamento.ler('quebrado')).toBeNull();
  });

  test('apagar remove a chave', () => {
    util.armazenamento.gravar('x', 1);
    util.armazenamento.apagar('x');
    expect(util.armazenamento.ler('x')).toBeNull();
  });

  test('gravar devolve false quando o armazenamento falha', () => {
    const areaQuebrada = { setItem() { throw new Error('cheio'); } };
    expect(util.armazenamento.gravar('x', 1, areaQuebrada)).toBe(false);
  });
});

describe('sessao', () => {
  beforeEach(() => sessionStorage.clear());

  test('salva, obtém e limpa o usuário logado', () => {
    util.sessao.salvar({ nome: 'Maria', perfil: 'voluntario' });
    expect(util.sessao.obter()).toEqual({ nome: 'Maria', perfil: 'voluntario' });
    util.sessao.limpar();
    expect(util.sessao.obter()).toBeNull();
  });
});

describe('listaDescricao', () => {
  test('monta um <dl> com os pares', () => {
    expect(util.listaDescricao([['Nome', 'Maria']])).toBe('<dl><dt>Nome</dt><dd>Maria</dd></dl>');
  });

  test('valor vazio vira hífen', () => {
    expect(util.listaDescricao([['Telefone', '']])).toContain('<dd>-</dd>');
  });
});
