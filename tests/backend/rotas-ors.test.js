const { criarCliente } = require('../../backend/services/rotas-ors');

const resposta = (corpo, ok = true, status = 200) => ({ ok, status, json: async () => corpo });

const geocodificacao = (confianca = 0.95, layer = 'address', coords = [-46.65, -23.59]) => ({
  features: [{ properties: { confidence: confianca, layer }, geometry: { coordinates: coords } }]
});

function criar(extra = {}) {
  const fetchImpl = extra.fetchImpl || jest.fn().mockResolvedValue(resposta(geocodificacao()));
  const cliente = criarCliente({ chave: 'chave-teste', fetchImpl, agora: () => 1_000_000, ...extra });
  return { cliente, fetchImpl };
}

describe('configuração', () => {
  test('não configurado sem chave', () => {
    expect(criarCliente({ chave: '', fetchImpl: jest.fn() }).configurado).toBe(false);
    expect(criarCliente({ chave: '   ', fetchImpl: jest.fn() }).configurado).toBe(false);
  });

  test('configurado com chave', () => {
    expect(criar().cliente.configurado).toBe(true);
  });

  test('lança erro e não chama a API quando não configurado', async () => {
    const fetchImpl = jest.fn();
    const cliente = criarCliente({ chave: '', fetchImpl });
    await expect(cliente.coordenadas('Rua X, 1')).rejects.toThrow(/indisponível/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('coordenadas', () => {
  test('retorna [lon, lat] para um endereço preciso', async () => {
    const { cliente, fetchImpl } = criar();
    await expect(cliente.coordenadas('Rua Taquari, 549')).resolves.toEqual([-46.65, -23.59]);
    const [url, opcoes] = fetchImpl.mock.calls[0];
    expect(url).toContain('https://api.heigit.org/pelias/v1/search');
    expect(opcoes.method).toBe('GET');
    expect(opcoes.headers.Authorization).toBe('chave-teste');
  });

  test('retorna null quando a confiança é baixa', async () => {
    const { cliente } = criar({ fetchImpl: jest.fn().mockResolvedValue(resposta(geocodificacao(0.5))) });
    await expect(cliente.coordenadas('Algum lugar')).resolves.toBeNull();
  });

  test('retorna null para centro de cidade (layer diferente de address/venue)', async () => {
    const { cliente } = criar({ fetchImpl: jest.fn().mockResolvedValue(resposta(geocodificacao(0.95, 'locality'))) });
    await expect(cliente.coordenadas('São Paulo')).resolves.toBeNull();
  });

  test('retorna null para coordenadas fora do intervalo válido', async () => {
    const { cliente } = criar({ fetchImpl: jest.fn().mockResolvedValue(resposta(geocodificacao(0.95, 'address', [500, 10]))) });
    await expect(cliente.coordenadas('Endereço estranho')).resolves.toBeNull();
  });

  test('retorna null quando não há resultados', async () => {
    const { cliente } = criar({ fetchImpl: jest.fn().mockResolvedValue(resposta({ features: [] })) });
    await expect(cliente.coordenadas('Nada')).resolves.toBeNull();
  });

  test('retorna null quando há dois resultados igualmente confiáveis em lugares diferentes', async () => {
    const ambiguo = {
      features: [
        { properties: { confidence: 0.9, layer: 'address' }, geometry: { coordinates: [-46.1, -23.1] } },
        { properties: { confidence: 0.9, layer: 'address' }, geometry: { coordinates: [-47.2, -22.2] } }
      ]
    };
    const { cliente } = criar({ fetchImpl: jest.fn().mockResolvedValue(resposta(ambiguo)) });
    await expect(cliente.coordenadas('Rua Comum, 10')).resolves.toBeNull();
  });

  test('usa cache: o mesmo endereço consulta a API uma única vez', async () => {
    const { cliente, fetchImpl } = criar();
    await cliente.coordenadas('Rua A, 1');
    await cliente.coordenadas('Rua A, 1');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('consultas simultâneas ao mesmo endereço compartilham a mesma chamada', async () => {
    const { cliente, fetchImpl } = criar();
    await Promise.all([cliente.coordenadas('Rua B, 2'), cliente.coordenadas('Rua B, 2')]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('matriz de distâncias', () => {
  test('matriz() devolve a distância de cada origem até o destino', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(resposta({ distances: [[12.5], [30]] }));
    const { cliente } = criar({ fetchImpl });
    await expect(cliente.matriz([[-46, -23], [-47, -22]], [-46.5, -23.5])).resolves.toEqual([12.5, 30]);
    expect(fetchImpl.mock.calls[0][1].method).toBe('POST');
  });

  test('matriz() troca valores inválidos por null', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(resposta({ distances: [[null], [-3], ['x']] }));
    const { cliente } = criar({ fetchImpl });
    await expect(cliente.matriz([[1, 1], [2, 2], [3, 3]], [4, 4])).resolves.toEqual([null, null, null]);
  });

  test('matrizDestinos() devolve a distância da origem até cada destino', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(resposta({ distances: [[5, 15, 25]] }));
    const { cliente } = criar({ fetchImpl });
    await expect(cliente.matrizDestinos([-46, -23], [[1, 1], [2, 2], [3, 3]])).resolves.toEqual([5, 15, 25]);
  });
});

describe('limites e falhas do serviço', () => {
  test('lança erro quando a API responde com falha', async () => {
    const { cliente } = criar({ fetchImpl: jest.fn().mockResolvedValue(resposta({}, false, 500)) });
    await expect(cliente.coordenadas('Rua C, 3')).rejects.toThrow(/serviço de rotas/);
  });

  test('suspende novas consultas depois de 429 (limite da API)', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(resposta({}, false, 429));
    const { cliente } = criar({ fetchImpl });
    await expect(cliente.coordenadas('Rua D, 4')).rejects.toThrow();
    await expect(cliente.coordenadas('Rua E, 5')).rejects.toThrow(/indisponível/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('volta a consultar depois que a suspensão termina', async () => {
    let agora = 1_000_000;
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(resposta({}, false, 403))
      .mockResolvedValue(resposta(geocodificacao()));
    const cliente = criarCliente({ chave: 'k', fetchImpl, agora: () => agora });
    await expect(cliente.coordenadas('Rua F, 6')).rejects.toThrow();
    agora += 61_000;
    await expect(cliente.coordenadas('Rua F, 6')).resolves.toEqual([-46.65, -23.59]);
  });

  test('limita a 20 consultas por minuto', async () => {
    const { cliente, fetchImpl } = criar();
    for (let i = 0; i < 20; i++) await cliente.coordenadas(`Rua ${i}, ${i}`);
    await expect(cliente.coordenadas('Rua 21, 21')).rejects.toThrow(/limite/);
    expect(fetchImpl).toHaveBeenCalledTimes(20);
  });
});
