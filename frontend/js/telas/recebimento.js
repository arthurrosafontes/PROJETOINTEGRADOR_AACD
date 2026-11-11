"use strict";
AACD.recebimento = (() => {
  const { $, escapar, formatarDataHora } = AACD.util;
  const dialogo = $("recebimento-dialogo");
  const form = $("recebimento-form");
  const erro = $("recebimento-erro");
  const campoFoto = form.elements.foto;
  const botaoSalvar = form.querySelector('[type="submit"]');
  let url, pedidoId, resolver, respostaSalva, salvando = false;
  const resultado = form.elements.resultado;
  const observacoes = form.elements.observacoes;
  function validarMotivo() {
    observacoes.setCustomValidity(resultado.value === 'Reprovada' && !observacoes.value.trim()
      ? 'Descreva o motivo da reprovação.' : '');
  }
  function atualizarEscolha() {
    const reprovada = resultado.value === 'Reprovada';
    const escolhido = ['Aprovada', 'Reprovada'].includes(resultado.value);
    $('recebimento-dados').hidden = !escolhido;
    $('recebimento-dados').disabled = !escolhido;
    botaoSalvar.disabled = !escolhido;
    observacoes.required = reprovada;
    $('recebimento-observacoes-label').textContent = reprovada ? '3. Por que a peça foi reprovada? (obrigatório)' : '3. Observações (opcional)';
    observacoes.placeholder = reprovada ? 'Descreva o problema encontrado na peça.' : 'Algo a acrescentar sobre a peça?';
    $('recebimento-foto-label').textContent = reprovada ? '2. Foto do problema' : '2. Foto da peça';
    $('recebimento-orientacao').textContent = reprovada
      ? 'A foto e o motivo ficarão disponíveis para o voluntário.'
      : 'Ao confirmar, o pedido será concluído.';
    botaoSalvar.textContent = reprovada ? 'Confirmar reprovação' : resultado.value === 'Aprovada' ? 'Confirmar aprovação' : 'Confirmar recebimento';
    botaoSalvar.classList.toggle('btn-danger', reprovada);
    botaoSalvar.classList.toggle('btn-primary', !reprovada);
    validarMotivo();
  }
  form.addEventListener('change', e => { if (e.target.name === 'resultado') atualizarEscolha(); });
  observacoes.addEventListener('input', validarMotivo);

  function limparPrevia() {
    if (url) URL.revokeObjectURL(url);
    url = null;
    $("recebimento-imagem").removeAttribute("src");
    $("recebimento-previa").hidden = true;
  }
  campoFoto.addEventListener("change", () => {
    limparPrevia();
    erro.textContent = "";
    const foto = campoFoto.files[0];
    if (!foto) return;
    if (!["image/jpeg", "image/png"].includes(foto.type) || foto.size > 5 * 1024 * 1024) {
      campoFoto.value = "";
      erro.textContent = "Escolha uma foto JPEG ou PNG de até 5 MB.";
      return;
    }
    url = URL.createObjectURL(foto);
    $("recebimento-imagem").src = url;
    $("recebimento-previa").hidden = false;
  });
  $("recebimento-remover").onclick = () => { campoFoto.value = ""; limparPrevia(); };
  $("recebimento-cancelar").onclick = () => dialogo.close();
  dialogo.addEventListener("cancel", e => { if (salvando) e.preventDefault(); });
  dialogo.addEventListener("close", () => {
    limparPrevia();
    resolver?.(dialogo.returnValue === "salvo" ? respostaSalva : null);
    resolver = null;
  });
  form.addEventListener("submit", async e => {
    e.preventDefault();
    validarMotivo();
    if (salvando || !form.reportValidity()) return;
    const corpo = new FormData(form);
    const controles = form.querySelectorAll("fieldset, .modal__acoes button");
    salvando = true;
    erro.textContent = "";
    controles.forEach(c => { c.disabled = true; });
    botaoSalvar.textContent = "Salvando…";
    try {
      respostaSalva = await AACD.api.receberPedido(pedidoId, corpo);
      dialogo.close("salvo");
    } catch (e) {
      erro.textContent = e.message;
    } finally {
      salvando = false;
      controles.forEach(c => { c.disabled = false; });
      atualizarEscolha();
    }
  });
  function abrir(demanda) {
    pedidoId = demanda.pedidoId;
    form.reset();
    respostaSalva = null;
    atualizarEscolha();
    limparPrevia();
    erro.textContent = "";
    $("recebimento-resumo").textContent = `Demanda #${demanda.id} · Pedido #${pedidoId} · ${demanda.protese || demanda.nome}`;
    dialogo.returnValue = "";
    dialogo.showModal();
    return new Promise(resolve => { resolver = resolve; });
  }
  function detalhes(r) {
    if (!r) return [];
    const reprovada = r.resultado === "Reprovada";
    return [
      ["Resultado:", reprovada ? "Recebida e reprovada" : "Recebida e aprovada"],
      ["Funcionário:", escapar(r.funcionario)],
      ["Data da avaliação:", escapar(formatarDataHora(r.data))],
      [reprovada ? "Motivo da reprovação:" : "Observações da AACD:", escapar(r.observacoes)],
      ["Foto do recebimento:", `<a href="${AACD.api.urlFotoRecebimento(r.pedidoId)}" target="_blank" rel="noopener">Ver foto da peça recebida</a>`]
    ];
  }
  return { abrir, detalhes };
})();
