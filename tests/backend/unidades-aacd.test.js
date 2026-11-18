const unidades = require('../../backend/config/unidades-aacd');

describe('unidades da AACD', () => {
  test('existe pelo menos uma unidade', () => {
    expect(Array.isArray(unidades)).toBe(true);
    expect(unidades.length).toBeGreaterThan(0);
  });

  test('todas têm id, nome e endereço preenchidos', () => {
    for (const u of unidades) {
      expect(typeof u.id).toBe('string');
      expect(u.id.trim()).not.toBe('');
      expect(u.nome.trim()).not.toBe('');
      expect(u.endereco.trim()).not.toBe('');
    }
  });

  test('ids são únicos e no formato kebab-case', () => {
    const ids = unidades.map(u => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  test('nomes e aliases não se repetem entre unidades', () => {
    const nomes = unidades.flatMap(u => [u.nome, ...(u.aliases || [])]);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  test('aliases, quando existem, são listas de texto', () => {
    for (const u of unidades.filter(x => x.aliases)) {
      expect(Array.isArray(u.aliases)).toBe(true);
      u.aliases.forEach(a => expect(typeof a).toBe('string'));
    }
  });
});
