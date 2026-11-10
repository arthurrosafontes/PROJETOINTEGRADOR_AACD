const normalizar = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const positivo = v => v !== null && v !== '' && Number.isFinite(Number(v)) && Number(v) > 0;
function avaliar(d, i) {
  const motivos = [];
  if (normalizar(i.tecnologia_da_impressora) !== 'fdm') motivos.push('Tecnologia FDM não confirmada.');
  if (normalizar(i.status) !== 'disponivel') motivos.push('Impressora não está disponível.');
  const material = normalizar(d.tipo_filamento);
  const materiais = (i.filamentos_compativeis || []).map(normalizar);
  const materialOk = !!material && materiais.includes(material);
  if (!materialOk) motivos.push('Material exigido não consta entre os compatíveis.');
  const dimensoes = [['largura_necessaria','largura_mm'],['profundidade_necessaria','profundidade_mm'],['altura_necessaria','altura_mm']];
  const medidasCompletas = dimensoes.every(([a,b]) => positivo(d[a]) && positivo(i.volume_impressao?.[b]));
  const cabe = medidasCompletas && dimensoes.every(([a,b]) => Number(d[a]) <= Number(i.volume_impressao[b]));
  if (!cabe) motivos.push(medidasCompletas ? 'Peça excede o volume de impressão na orientação cadastrada.' : 'Dimensões da peça ou da impressora incompletas.');
  const bico = positivo(d.diametro_bico) && positivo(i.diametro_bico_mm) && Math.abs(Number(d.diametro_bico) - Number(i.diametro_bico_mm)) < 0.000001;
  if (!bico) motivos.push('Diâmetro do bico diferente do exigido ou não informado.');
  return { compativel: motivos.length === 0, motivos, pontosTecnicos: motivos.length ? 0 : 3 };
}
function pontosDistancia(km) {
  if (typeof km !== 'number' || !Number.isFinite(km) || km < 0) return 0;
  return km <= 10 ? 5 : km <= 25 ? 4 : km <= 50 ? 3 : km <= 100 ? 2 : 1;
}
function ordenar(a,b) {
  return Number(b.compativel)-Number(a.compativel) || b.pontos-a.pontos ||
    (a.distanciaKm ?? Infinity)-(b.distanciaKm ?? Infinity) || String(a.nome).localeCompare(String(b.nome),'pt-BR') || String(a.id).localeCompare(String(b.id));
}
module.exports = { avaliar, pontosDistancia, ordenar, normalizar };
