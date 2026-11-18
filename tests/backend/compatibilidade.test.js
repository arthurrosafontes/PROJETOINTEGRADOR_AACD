const { avaliar, pontosDistancia, ordenar, normalizar } = require('../../backend/services/compatibilidade');

const demanda = {
  tipo_filamento: 'PLA',
  largura_necessaria: 100,
  profundidade_necessaria: 100,
  altura_necessaria: 100,
  diametro_bico: 0.4
};

const impressora = {
  tecnologia_da_impressora: 'FDM',
  status: 'Disponível',
  filamentos_compativeis: ['PLA', 'PETG'],
  volume_impressao: { largura_mm: 220, profundidade_mm: 220, altura_mm: 250 },
  diametro_bico_mm: 0.4
};

describe('normalizar', () => {
  test('remove acentos, espaços e converte para minúsculas', () => {
    expect(normalizar('  Disponível ')).toBe('disponivel');
  });
  test('trata null e undefined como texto vazio', () => {
    expect(normalizar(null)).toBe('');
    expect(normalizar(undefined)).toBe('');
  });
});

describe('avaliar', () => {
  test('impressora totalmente compatível', () => {
    const r = avaliar(demanda, impressora);
    expect(r.compativel).toBe(true);
    expect(r.motivos).toEqual([]);
    expect(r.pontosTecnicos).toBe(3);
  });

  test('ignora maiúsculas e acentos no material e no status', () => {
    const r = avaliar({ ...demanda, tipo_filamento: 'pla' }, { ...impressora, status: 'DISPONIVEL' });
    expect(r.compativel).toBe(true);
  });

  test('rejeita tecnologia diferente de FDM', () => {
    const r = avaliar(demanda, { ...impressora, tecnologia_da_impressora: 'SLA' });
    expect(r.compativel).toBe(false);
    expect(r.motivos).toContain('Tecnologia FDM não confirmada.');
    expect(r.pontosTecnicos).toBe(0);
  });

  test('rejeita impressora indisponível', () => {
    const r = avaliar(demanda, { ...impressora, status: 'Em uso' });
    expect(r.compativel).toBe(false);
    expect(r.motivos).toContain('Impressora não está disponível.');
  });

  test('rejeita material que não consta na lista', () => {
    const r = avaliar({ ...demanda, tipo_filamento: 'ABS' }, impressora);
    expect(r.compativel).toBe(false);
    expect(r.motivos).toContain('Material exigido não consta entre os compatíveis.');
  });

  test('rejeita quando a lista de filamentos está ausente', () => {
    const { filamentos_compativeis, ...semLista } = impressora;
    expect(avaliar(demanda, semLista).compativel).toBe(false);
  });

  test('aceita peça com exatamente o tamanho do volume de impressão', () => {
    const d = { ...demanda, largura_necessaria: 220, profundidade_necessaria: 220, altura_necessaria: 250 };
    expect(avaliar(d, impressora).compativel).toBe(true);
  });

  test('rejeita peça maior que o volume de impressão', () => {
    const r = avaliar({ ...demanda, altura_necessaria: 251 }, impressora);
    expect(r.compativel).toBe(false);
    expect(r.motivos).toContain('Peça excede o volume de impressão na orientação cadastrada.');
  });

  test('rejeita quando faltam dimensões', () => {
    const r = avaliar({ ...demanda, largura_necessaria: null }, impressora);
    expect(r.compativel).toBe(false);
    expect(r.motivos).toContain('Dimensões da peça ou da impressora incompletas.');
  });

  test('rejeita dimensões zero ou negativas', () => {
    expect(avaliar({ ...demanda, largura_necessaria: 0 }, impressora).compativel).toBe(false);
    expect(avaliar({ ...demanda, largura_necessaria: -5 }, impressora).compativel).toBe(false);
  });

  test('rejeita bico com diâmetro diferente', () => {
    const r = avaliar({ ...demanda, diametro_bico: 0.6 }, impressora);
    expect(r.compativel).toBe(false);
    expect(r.motivos).toContain('Diâmetro do bico diferente do exigido ou não informado.');
  });

  test('aceita números enviados como texto', () => {
    const d = { ...demanda, largura_necessaria: '100', diametro_bico: '0.4' };
    expect(avaliar(d, impressora).compativel).toBe(true);
  });

  test('acumula vários motivos de incompatibilidade', () => {
    const r = avaliar({ ...demanda, tipo_filamento: 'ABS' }, { ...impressora, status: 'Em uso', tecnologia_da_impressora: 'SLA' });
    expect(r.motivos).toHaveLength(3);
  });
});

describe('pontosDistancia', () => {
  test.each([
    [0, 5], [10, 5], [10.1, 4], [25, 4], [25.1, 3],
    [50, 3], [50.1, 2], [100, 2], [100.1, 1], [5000, 1]
  ])('%p km vale %p pontos', (km, pontos) => {
    expect(pontosDistancia(km)).toBe(pontos);
  });

  test.each([[-1], [NaN], [Infinity], ['10'], [null], [undefined]])(
    'valor inválido %p vale 0 pontos', (valor) => {
      expect(pontosDistancia(valor)).toBe(0);
    });
});

describe('ordenar', () => {
  const base = { compativel: true, pontos: 5, distanciaKm: 10, nome: 'A', id: '1' };

  test('compatíveis vêm antes dos incompatíveis', () => {
    const lista = [{ ...base, compativel: false, id: 'x' }, base].sort(ordenar);
    expect(lista[0].compativel).toBe(true);
  });

  test('mais pontos vêm primeiro', () => {
    const lista = [{ ...base, pontos: 3, id: 'x' }, { ...base, pontos: 8 }].sort(ordenar);
    expect(lista[0].pontos).toBe(8);
  });

  test('empate de pontos desempata pela menor distância', () => {
    const lista = [{ ...base, distanciaKm: 30, id: 'x' }, { ...base, distanciaKm: 5 }].sort(ordenar);
    expect(lista[0].distanciaKm).toBe(5);
  });

  test('distância ausente fica por último', () => {
    const lista = [{ ...base, distanciaKm: null, id: 'x' }, base].sort(ordenar);
    expect(lista[0].distanciaKm).toBe(10);
  });

  test('desempata por nome e depois por id', () => {
    const porNome = [{ ...base, nome: 'Zeca' }, { ...base, nome: 'Ana', id: '2' }].sort(ordenar);
    expect(porNome[0].nome).toBe('Ana');
    const porId = [{ ...base, id: '9' }, { ...base, id: '2' }].sort(ordenar);
    expect(porId[0].id).toBe('2');
  });
});
