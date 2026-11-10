"use strict";
AACD.recebimento = (() => {
  const { $, escapar, formatarDataHora } = AACD.util;
  const dialogo = $("recebimento-dialogo");
  const form = $("recebimento-form");
  const erro = $("recebimento-erro");
  const campoFoto = form.elements.foto;
  const botaoSalvar = form.querySelector('[type="submit"]');
  let url, pedidoId, resolver, salvando = false;

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
    resolver?.(dialogo.returnValue === "salvo");
    resolver = null;
  });
  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (salvando || !form.reportValidity()) return;
    const corpo = new FormData(form);
    const controles = form.querySelectorAll("fieldset, .modal__acoes button");
    salvando = true;
    erro.textContent = "";
    controles.forEach(c => { c.disabled = true; });
    botaoSalvar.textContent = "Salvando…";
    try {
      await AACD.api.receberPedido(pedidoId, corpo);
      dialogo.close("salvo");
    } catch (e) {
      erro.textContent = e.message;
    } finally {
      salvando = false;
      controles.forEach(c => { c.disabled = false; });
      botaoSalvar.textContent = "Confirmar recebimento e aprovação";
    }
  });
  function abrir(demanda) {
    pedidoId = demanda.pedidoId;
    form.reset();
    limparPrevia();
    erro.textContent = "";
    $("recebimento-resumo").textContent = `Demanda #${demanda.id} · Pedido #${pedidoId} · ${demanda.protese || demanda.nome}`;
    dialogo.returnValue = "";
    dialogo.showModal();
    return new Promise(resolve => { resolver = resolve; });
  }
  function detalhes(r) {
    if (!r) return [];
    return [
      ["Resultado:", "Recebida e aprovada"],
      ["Funcionário:", escapar(r.funcionario)],
      ["Data da aprovação:", escapar(formatarDataHora(r.data))],
      ["Observações da AACD:", escapar(r.observacoes)],
      ["Foto do recebimento:", `<a href="${AACD.api.urlFotoRecebimento(r.pedidoId)}" target="_blank" rel="noopener">Ver foto da peça recebida</a>`]
    ];
  }
  return { abrir, detalhes };
})();
