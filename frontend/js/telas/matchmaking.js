"use strict";
AACD.matchmaking = (() => {
  const { escapar } = AACD.util;
  let dialogo, versao = 0;
  const motivosCurtos = {
    'Tecnologia FDM não confirmada.': 'Tecnologia FDM não confirmada',
    'Impressora não está disponível.': 'Impressora indisponível',
    'Material exigido não consta entre os compatíveis.': 'Não trabalha com o material solicitado',
    'Peça excede o volume de impressão na orientação cadastrada.': 'A peça não cabe na impressora',
    'Dimensões da peça ou da impressora incompletas.': 'Faltam as medidas da peça ou da impressora',
    'Diâmetro do bico diferente do exigido ou não informado.': 'Bico diferente do solicitado ou não informado',
    'Voluntário não está ativo e homologado.': 'Voluntário precisa estar ativo e aprovado'
  };
  function preparar() {
    if (dialogo) return;
    dialogo = document.createElement('dialog');
    dialogo.className = 'aacd-dialogo';
    dialogo.id = 'matchmaking-dialogo';
    dialogo.setAttribute('aria-labelledby', 'matchmaking-titulo');
    dialogo.innerHTML = `
      <style>
        #matchmaking-dialogo { width: min(860px, calc(100vw - 24px)); padding: 0; }
        #matchmaking-dialogo .mm-header { padding: 24px 28px 20px; border-bottom: 1px solid var(--borda); display: flex; justify-content: space-between; align-items: start; gap: 16px; }
        #matchmaking-dialogo h2 { margin: 0 0 6px; font-size: 23px; }
        #matchmaking-dialogo .mm-body { padding: 24px 28px; }
        #matchmaking-dialogo .mm-context { color: var(--texto-suave); margin: 0; font-size: 14px; }
        #matchmaking-dialogo .mm-summary { padding: 18px 20px; border-radius: 12px; background: #eaf7f5; margin-bottom: 20px; }
        #matchmaking-dialogo .mm-summary strong { display: block; font-size: 18px; margin-bottom: 5px; }
        #matchmaking-dialogo .mm-summary p { margin: 0; color: var(--texto-suave); line-height: 1.5; }
        #matchmaking-dialogo .mm-notice { font-size: 14px; padding: 12px 16px; border-left: 3px solid #c6a15a; background: #fff9ec; border-radius: 6px; margin-bottom: 20px; line-height: 1.5; }
        #matchmaking-dialogo .mm-list { list-style: none; padding: 0; margin: 12px 0 24px; display: grid; gap: 12px; }
        #matchmaking-dialogo .mm-card { padding: 18px; border: 1px solid var(--borda); border-radius: 12px; }
        #matchmaking-dialogo .mm-card-top { display: flex; justify-content: space-between; align-items: start; gap: 12px; }
        #matchmaking-dialogo h3 { font-size: 16px; font-weight: 700; margin: 0 0 5px; overflow-wrap: anywhere; }
        #matchmaking-dialogo .mm-owner { color: var(--texto-suave); font-size: 14px; margin: 0; overflow-wrap: anywhere; }
        #matchmaking-dialogo .mm-label { padding: 5px 10px; border-radius: 20px; background: #e6f4ec; color: #226443; font-size: 12px; font-weight: 700; white-space: nowrap; }
        #matchmaking-dialogo .mm-label-neutral { background: #f1f3f4; color: #596166; }
        #matchmaking-dialogo .mm-metrics { display: flex; flex-wrap: wrap; gap: 12px 24px; margin-top: 15px; padding-top: 12px; border-top: 1px solid var(--borda); font-size: 14px; }
        #matchmaking-dialogo .mm-metrics span { color: var(--texto-suave); }
        #matchmaking-dialogo .mm-metrics strong { display: block; color: var(--texto); margin-top: 3px; }
        #matchmaking-dialogo .mm-reasons { padding-left: 20px; margin: 12px 0 0; font-size: 14px; line-height: 1.6; color: #735026; }
        #matchmaking-dialogo details { margin-top: 16px; }
        #matchmaking-dialogo summary { cursor: pointer; font-weight: 600; font-size: 14px; padding: 8px 0; color: var(--teal-titulo); }
        #matchmaking-dialogo .mm-rules { font-size: 14px; line-height: 1.6; color: var(--texto-suave); padding: 12px 0; }
        #matchmaking-dialogo .mm-footer { border-top: 1px solid var(--borda); padding: 16px 28px; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
        #matchmaking-dialogo .mm-footer small { color: var(--texto-suave); font-size: 11px; }
        @media (max-width: 600px) {
          #matchmaking-dialogo .mm-header, #matchmaking-dialogo .mm-body { padding: 18px; }
          #matchmaking-dialogo .mm-footer { padding: 14px 18px; }
          #matchmaking-dialogo h2 { font-size: 20px; }
          #matchmaking-dialogo .mm-card-top { flex-wrap: wrap; }
        }
      </style>
      <header class="mm-header"><div><h2 id="matchmaking-titulo">Impressoras para esta demanda</h2><p class="mm-context" data-contexto></p></div>
        <button type="button" class="btn-close" aria-label="Fechar compatibilidade" data-fechar></button></header>
      <div class="mm-body" data-conteudo aria-live="polite"></div>
      <footer class="mm-footer"><small>Rotas: openrouteservice.org<br>Dados: OpenStreetMap contributors</small><button type="button" class="btn btn-outline-primary" data-fechar>Fechar</button></footer>`;
    dialogo.querySelectorAll('[data-fechar]').forEach(b => b.onclick = () => dialogo.close());
    dialogo.addEventListener('close', () => { versao++; });
    document.body.append(dialogo);
  }
  function card(c, indice, completo) {
    const apta = c.compativel;
    const distancia = typeof c.distanciaKm === 'number'
      ? c.distanciaKm.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' km de carro'
      : c.situacaoDistancia || 'Não calculada';
    const selo = apta ? (completo && indice === 0 ? '1ª na classificação' : 'Compatível') : 'Não atende';
    return `<li class="mm-card"><div class="mm-card-top"><div><h3>${escapar(c.nome)}</h3>
      <p class="mm-owner">Voluntário: ${escapar(c.voluntario || 'Não informado')}</p></div>
      <span class="mm-label ${apta ? '' : 'mm-label-neutral'}">${selo}</span></div>
      ${apta ? `<div class="mm-metrics"><span>Trajeto até a unidade<strong>${escapar(distancia)}</strong></span>
        <span>Pontuação<strong>${escapar(c.pontos)} pontos${completo ? '' : ' · parcial'}</strong></span></div>`
        : `<ul class="mm-reasons">${(c.motivos || []).map(m => `<li>${escapar(motivosCurtos[m] || m)}</li>`).join('')}</ul>`}</li>`;
  }
  async function abrir(id) {
    preparar(); const atual = ++versao;
    const corpo = dialogo.querySelector('[data-conteudo]');
    dialogo.querySelector('[data-contexto]').textContent = `Demanda #${id}`;
    corpo.textContent = 'Conferindo impressoras e trajetos…';
    if (!dialogo.open) dialogo.showModal();
    try {
      const r = await AACD.api.consultarMatchmaking(id); if (atual !== versao) return;
      dialogo.querySelector('[data-contexto]').textContent = `Demanda #${id}${r.unidade ? ' · Entrega em ' + r.unidade.nome : ''}`;
      const aptas = r.candidatos.filter(c => c.compativel), outras = r.candidatos.filter(c => !c.compativel);
      const titulo = aptas.length ? `${aptas.length} impressora${aptas.length === 1 ? '' : 's'} pode${aptas.length === 1 ? '' : 'm'} fabricar esta peça`
        : r.candidatos.length ? 'Nenhuma impressora compatível por enquanto' : 'Nenhuma impressora cadastrada';
      corpo.innerHTML = `<div class="mm-summary"><strong>${titulo}</strong><p>${aptas.length
        ? 'Os requisitos técnicos foram atendidos. O aceite continua sendo feito pelo voluntário.'
        : r.candidatos.length ? 'Confira abaixo o que impede cada impressora de atender à demanda.' : 'Cadastre uma impressora para verificar a compatibilidade.'}</p></div>
        ${r.aviso && aptas.length ? `<div class="mm-notice">${escapar(r.aviso)}</div>` : ''}
        ${aptas.length ? `<ul class="mm-list">${aptas.map((c,i) => card(c,i,r.classificacaoCompleta)).join('')}</ul>` : ''}
        ${outras.length ? aptas.length
          ? `<details><summary>Ver ${outras.length} impressora${outras.length === 1 ? '' : 's'} que não atende${outras.length === 1 ? '' : 'm'}</summary><ul class="mm-list">${outras.map(c => card(c)).join('')}</ul></details>`
          : `<ul class="mm-list">${outras.map(c => card(c)).join('')}</ul>` : ''}
        <details><summary>Como funciona a classificação?</summary><div class="mm-rules">
          <p>Primeiro verificamos o material, o tamanho da peça, o bico e a disponibilidade da impressora. O voluntário precisa estar ativo e aprovado.</p>
          <p>As compatíveis recebem 3 pontos técnicos e até 5 pela distância até a unidade da AACD. No empate, o menor trajeto vem primeiro.</p>
          <p>Distância: até 10 km, 5 pontos; até 25 km, 4; até 50 km, 3; até 100 km, 2; acima de 100 km, 1.</p>
          <p class="mb-0">Sem trajeto calculado, não há pontos de distância e a classificação fica parcial. Nenhum pedido é aceito automaticamente.</p>
        </div></details>`;
    } catch (e) { if (atual === versao) corpo.textContent = e.message; }
  }
  return { abrir };
})();
