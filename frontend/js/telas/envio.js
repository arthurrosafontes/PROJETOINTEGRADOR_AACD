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
  const diaSaoPaulo = data => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(data);
  function validarData() {
    // Não alterar min/max durante a digitação: isso reinicializa segmentos do input date.
    const data = campos.data.value;
    campos.data.setCustomValidity(data && data < campos.data.min
      ? 'A data de postagem, entrega ou retirada não pode ser anterior à conclusão da impressão.'
      : data && data > campos.data.max ? 'A data de postagem, entrega ou retirada não pode ser futura.' : '');
  }
  campos.data.addEventListener('input', validarData);
  campos.data.addEventListener('change', validarData);
  function abrir(atual) {
    if (!Object.hasOwn(rotulosData, atual.formaEntrega)) {
      mostrarToast("Consulte a AACD para definir a forma de entrega deste pedido.", true);
      return false;
    }
    const conclusao = atual.conclusao?.data ? new Date(atual.conclusao.data) : null;
    if (!conclusao || !Number.isFinite(conclusao.getTime())) {
      mostrarToast('A data de conclusão da impressão não está registrada. Consulte a AACD antes de registrar o envio.', true);
      return false;
    }
    pedido = atual;
    form.reset();
    const correios = pedido.formaEntrega === "Envio pelos Correios";
    $("envio-resumo").textContent = `Pedido #${pedido.id} · ${pedido.formaEntrega}`;
    $("envio-data-label").textContent = rotulosData[pedido.formaEntrega];
    campos.data.min = diaSaoPaulo(conclusao);
    campos.data.max = diaSaoPaulo(new Date());
    campos.data.setCustomValidity('');
    validarData();
    let ajuda = document.getElementById('envio-data-ajuda');
    if (!ajuda) {
      ajuda = document.createElement('small'); ajuda.id = 'envio-data-ajuda'; ajuda.className = 'text-muted d-block mt-1';
      campos.data.after(ajuda); campos.data.setAttribute('aria-describedby', ajuda.id);
    }
    ajuda.textContent = 'Informe uma data entre ' + formatarData(campos.data.min) + ' e hoje.';
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
    validarData();
    if (!form.reportValidity()) return;
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
