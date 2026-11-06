"use strict";
AACD.envio = (() => {
  const { $, escapar, formatarData, mostrarToast } = AACD.util;
  const dialogo = $("envio-dialogo");
  const form = $("envio-form");
  const campos = form.elements;
  const rotulosData = {
    "Envio pelos Correios": "Data da postagem",
    "Voluntário entrega na unidade": "Data da entrega",
    "Retirada pela equipe": "Data da retirada"
  };
  let pedido, resolver, salvando = false;
  function abrir(atual) {
    if (!Object.hasOwn(rotulosData, atual.formaEntrega)) {
      mostrarToast("Consulte a AACD para definir a forma de entrega deste pedido.", true);
      return false;
    }
    pedido = atual;
    form.reset();
    const correios = pedido.formaEntrega === "Envio pelos Correios";
    $("envio-resumo").textContent = `Pedido #${pedido.id} · ${pedido.formaEntrega}`;
    $("envio-data-label").textContent = rotulosData[pedido.formaEntrega];
    campos.data.max = new Intl.DateTimeFormat("sv-SE", {timeZone:"America/Sao_Paulo"}).format(new Date());
    $("envio-correios").hidden = campos.rastreio.disabled = !correios;
    $("envio-presencial").hidden = campos.recebedor.disabled = correios;
    campos.rastreio.required = correios;
    campos.recebedor.required = !correios;
    $("envio-erro").textContent = "";
    dialogo.returnValue = "";
    dialogo.showModal();
    return new Promise(resolve => { resolver = resolve; });
  }
  $("envio-cancelar").onclick = () => dialogo.close();
  dialogo.addEventListener("cancel", e => { if (salvando) e.preventDefault(); });
  dialogo.addEventListener("close", () => { resolver?.(dialogo.returnValue === "salvo"); resolver = null; });
  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (salvando) return;
    const dados = Object.fromEntries(new FormData(form));
    const comprovacao = campos.rastreio.disabled ? campos.recebedor : campos.rastreio;
    if (!comprovacao.value.trim()) {
      $("envio-erro").textContent = "Preencha o campo obrigatório.";
      comprovacao.focus();
      return;
    }
    salvando = true;
    const controles = form.querySelectorAll("fieldset,button");
    controles.forEach(c => { c.disabled = true; });
    try {
      await AACD.api.registrarEnvio(pedido.id, dados);
      dialogo.close("salvo");
    } catch (erro) { $("envio-erro").textContent = erro.message; }
    finally { salvando = false; controles.forEach(c => { c.disabled = false; }); }
  });
  function detalhes(envio) {
    if (!envio) return [];
    return [
      ["Forma de envio:", escapar(envio.modalidade)],
      [(rotulosData[envio.modalidade] || "Data do envio") + ":", formatarData(envio.data)],
      envio.modalidade === "Envio pelos Correios"
        ? ["Código de rastreio:", escapar(envio.rastreio)]
        : ["Recebido por:", escapar(envio.recebedor)],
      ["Observações do envio:", escapar(envio.observacoes)]
    ];
  }
  return { abrir, detalhes };
})();
