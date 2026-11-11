"use strict";

AACD.material = (() => {
  const { escapar, formatarData, formatarDataHora, mostrarToast } = AACD.util;
  const escolhas = new WeakMap(), pedidos = new Map();
  const campo = (nome, rotulo, tipo = "text", extra = "") => `<label class="d-block mb-3">${rotulo}<input class="form-control mt-1" name="${nome}" type="${tipo}" ${extra}></label>`;

  function limparEscolha(form) {
    const estado = escolhas.get(form);
    if (!estado) return;
    estado.versao++; estado.impressora = null;
    form.querySelector('[data-material-escolha]').hidden = true;
    form.querySelector('[data-material-escolha]').disabled = true;
    form.querySelector('[data-material-retirada]').disabled = true;
    form.querySelector('[data-material-correios]').disabled = true;
    form.querySelector('[data-material-aviso]').textContent = '';
  }
  function montarEscolha(form) {
    const bloco = document.createElement('fieldset');
    bloco.dataset.materialEscolha = ''; bloco.hidden = true; bloco.disabled = true;
    bloco.className = 'mt-3 border-top pt-3';
    bloco.innerHTML = `<legend class="fs-6 fw-bold">Como você prefere receber o material?</legend>
      <label class="d-block mb-3">Forma de recebimento
        <select class="form-select mt-1" name="materialModalidade" required>
          <option value="">Selecione</option><option>Retirada na AACD</option><option>Envio pelos Correios</option>
        </select>
      </label>
      <fieldset data-material-retirada hidden disabled>
        <label class="d-block">Unidade para retirada<select class="form-select mt-1" name="materialUnidade" required><option value="">Selecione a unidade</option></select></label>
        <p class="small mt-2" data-material-aviso aria-live="polite"></p>
        <p class="small mb-3">Você pode escolher outra unidade. Aguarde a AACD liberar o material antes de ir buscá-lo.</p>
      </fieldset>
      <fieldset data-material-correios hidden disabled>
        <p class="small">Confira o endereço para envio do material.</p>
        ${campo('destinatario','Nome de quem receberá','text','maxlength="150" required')}
        ${campo('logradouro','Rua / avenida','text','maxlength="150" required')}
        <div class="row g-2"><div class="col-5">${campo('numero','Número','text','maxlength="20" required')}</div><div class="col-7">${campo('complemento','Complemento','text','maxlength="100"')}</div></div>
        ${campo('bairro','Bairro','text','maxlength="100" required')}
        ${campo('cidade','Cidade','text','maxlength="100" required')}
        <div class="row g-2"><div class="col-4">${campo('estado','UF','text','maxlength="2" pattern="[A-Za-z]{2}" required')}</div><div class="col-8">${campo('cep','CEP','text','maxlength="9" pattern="[0-9]{5}-?[0-9]{3}" required')}</div></div>
      </fieldset>
      <p class="small mb-0">Você poderá iniciar a produção após confirmar que recebeu o material.</p>`;
    form.querySelector('.pd-dialogo-acoes').before(bloco);
    escolhas.set(form, { versao: 0, impressora: null });
    form.addEventListener('change', async e => {
      if (!['doacao_material','materialModalidade'].includes(e.target.name) && e.target.id !== 'pd-dialogo-select') return;
      const estado = escolhas.get(form), precisa = form.querySelector('[name=doacao_material]:checked')?.value === 'nao';
      bloco.hidden = !precisa; bloco.disabled = !precisa;
      const retirada = form.elements.materialModalidade.value === 'Retirada na AACD';
      const correios = form.elements.materialModalidade.value === 'Envio pelos Correios';
      const a = form.querySelector('[data-material-retirada]'), b = form.querySelector('[data-material-correios]');
      a.hidden = !retirada; a.disabled = !precisa || !retirada;
      b.hidden = !correios; b.disabled = !precisa || !correios;
      const id = form.querySelector('#pd-dialogo-select').value;
      if (!precisa || !id || estado.impressora === id) return;
      estado.impressora = id;
      const versao = ++estado.versao, seletor = form.elements.materialUnidade, aviso = form.querySelector('[data-material-aviso]');
      seletor.replaceChildren(new Option('Selecione a unidade', ''));
      aviso.textContent = 'Calculando os trajetos a partir da impressora…';
      // As opções manuais continuam disponíveis se o serviço de rotas falhar.
      try {
        const unidades = await AACD.api.unidadesRetirada();
        if (versao !== estado.versao) return;
        unidades.forEach(u => seletor.add(new Option(u.nome, u.id)));
        const resultado = await AACD.api.unidadesMaterial(id);
        if (versao !== estado.versao || !form.closest('dialog').open) return;
        const escolhida = seletor.value;
        seletor.replaceChildren(new Option('Selecione a unidade', ''));
        resultado.unidades.forEach(u => seletor.add(new Option(u.nome + (u.distanciaKm === null ? '' : ' — ' + u.distanciaKm.toLocaleString('pt-BR', {maximumFractionDigits:1}) + ' km'), u.id)));
        seletor.value = escolhida || resultado.sugerida || '';
        aviso.textContent = resultado.aviso || 'Unidade mais próxima sugerida pelo trajeto da impressora. ' + resultado.fonte;
        const endereco = resultado.enderecoImpressora || {};
        for (const nome of ['logradouro','numero','bairro','complemento','cidade','estado','cep']) {
          if (!form.elements[nome].value) form.elements[nome].value = endereco[nome] || '';
        }
      } catch {
        if (versao === estado.versao) aviso.textContent = 'Não foi possível calcular a distância. Selecione uma unidade manualmente; se a lista estiver vazia, reabra o aceite.';
      }
    });
  }
  function lerEscolha(form) {
    const modalidade = form.elements.materialModalidade.value;
    return modalidade === 'Retirada na AACD' ? { modalidade, unidadeId: form.elements.materialUnidade.value }
      : { modalidade, endereco: Object.fromEntries(['destinatario','logradouro','numero','bairro','complemento','cidade','estado','cep'].map(n => [n, form.elements[n].value])) };
  }
  function bloqueado(p) { return !!p.materialAacd && p.materialAacd.status !== 'Material recebido'; }
  function cartao(p, perfil) {
    if (!p.materialAacd || !p.id) return '';
    const chave = perfil + '-' + p.id;
    pedidos.set(chave, { ...p, perfil });
    return `<div class="cartao-item__extra d-block"><div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
      <div><strong>Material da AACD</strong> · ${escapar(p.materialAacd.status)}<br><span class="small">${escapar(p.materialAacd.modalidade)}${p.materialAacd.unidade ? ' · ' + escapar(p.materialAacd.unidade) : ''}</span></div>
      <button type="button" class="btn btn-outline-primary botao" data-material-pedido="${escapar(chave)}">${perfil === 'funcionario' && p.status === 'Aceita' && p.materialAacd.status === 'Aguardando preparação' ? 'Preparar material' : 'Ver material'}</button>
    </div>${perfil === 'voluntario' && p.status === 'Aceito' && bloqueado(p) ? '<p class="small mb-0 mt-2">A produção será liberada quando você confirmar o recebimento do material.</p>' : ''}</div>`;
  }
  async function abrir(p) {
    const m = p.materialAacd, d = document.createElement('dialog');
    d.className = 'aacd-dialogo'; d.style.cssText = 'width:min(560px,calc(100vw - 24px));max-height:90vh;overflow:auto';
    d.setAttribute('aria-labelledby', 'material-dialogo-titulo');
    const preparar = p.perfil === 'funcionario' && p.status === 'Aceita' && m.status === 'Aguardando preparação';
    const receber = p.perfil === 'voluntario' && p.status === 'Aceito' && ['Disponível para retirada','Material enviado'].includes(m.status);
    const correios = m.modalidade === 'Envio pelos Correios';
    const pares = [['Situação',m.status],['Material',m.material],['Forma de recebimento',m.modalidade],['Unidade',m.unidade],['Endereço',m.endereco],['Quantidade',m.gramas == null ? null : m.gramas + ' g'],['Horário para retirada',m.horario],['Responsável pela entrega',m.responsavel],['Data da postagem',m.dataPostagem ? formatarData(m.dataPostagem) : null],['Rastreio',m.rastreio],['Observações',m.observacoes],['Recebido em',m.recebidoEm ? formatarDataHora(m.recebidoEm) : null]];
    d.innerHTML = `<form class="p-4"><h2 class="h4 mb-2" id="material-dialogo-titulo">Material da AACD</h2><p class="text-muted mb-3">Pedido #${escapar(p.id)}</p>
      <dl class="mb-3">${pares.filter(([,v])=>v).map(([k,v])=>`<dt class="small mt-2">${k}</dt><dd class="mb-2" style="white-space:pre-line;overflow-wrap:anywhere">${escapar(v)}</dd>`).join('')}</dl>
      ${preparar ? `<fieldset class="border-top pt-3"><legend class="fs-6 fw-bold">${correios ? 'Registrar envio do material' : 'Disponibilizar para retirada'}</legend>
        ${campo('gramas','Quantidade de material (g)','number','min="0.01" max="99999999.99" step="0.01" required')}
        ${correios ? campo('data','Data da postagem','date','max="' + new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date()) + '" required') + campo('rastreio','Código de rastreio','text','maxlength="80" required') : campo('horario','Dias e horários para retirada','text','maxlength="200" required') + campo('responsavel','Responsável pela entrega','text','maxlength="150" required')}
        <label class="d-block mb-3">Instruções ou observações <span class="small">(opcional)</span><textarea class="form-control" name="observacoes" maxlength="1000" rows="2"></textarea></label>
      </fieldset>` : ''}
      ${receber ? '<p class="border-top pt-3">Confirme apenas quando o material estiver com você. Isso liberará o botão “Iniciar produção”.</p>' : ''}
      <p data-material-erro role="alert" class="text-danger"></p>
      <div class="d-flex flex-wrap gap-2 justify-content-end mt-3"><button type="button" data-fechar class="btn btn-outline-primary botao">Fechar</button>
      ${preparar || receber ? `<button type="submit" class="btn btn-primary botao">${receber ? 'Confirmar que recebi o material' : correios ? 'Registrar postagem' : 'Disponibilizar material'}</button>` : ''}</div>
    </form>`;
    document.body.appendChild(d);
    let salvando = false;
    d.querySelector('[data-fechar]').onclick = () => d.close();
    d.addEventListener('cancel', e => { if (salvando) e.preventDefault(); });
    d.addEventListener('close', () => d.remove(), { once: true });
    d.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault(); if (salvando || (!preparar && !receber)) return;
      const dados = Object.fromEntries(new FormData(e.target));
      salvando = true; d.querySelectorAll('button').forEach(b => b.disabled = true);
      try {
        if (preparar) await AACD.api.prepararMaterial(p.id, dados); else await AACD.api.receberMaterial(p.id);
        d.close(); mostrarToast(receber ? 'Material recebido. Você já pode iniciar a produção.' : 'Informações do material registradas.');
        document.dispatchEvent(new Event('material-atualizado'));
      } catch (erro) { d.querySelector('[data-material-erro]').textContent = erro.message; }
      finally { salvando = false; d.querySelectorAll('button').forEach(b => b.disabled = false); }
    });
    d.showModal();
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-material-pedido]');
    if (b && pedidos.has(b.dataset.materialPedido)) abrir(pedidos.get(b.dataset.materialPedido));
  });
  return { montarEscolha, limparEscolha, lerEscolha, bloqueado, cartao };
})();
