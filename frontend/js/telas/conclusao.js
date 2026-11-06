"use strict";

AACD.conclusao = (() => {
  const { $, escapar, formatarDataHora } = AACD.util;
  const dialogo = $("conclusao-dialogo");
  const form = $("conclusao-form");
  const campos = form.elements;
  const erro = $("conclusao-erro");
  const fotos = [];
  let pedidoAtual, responder, enviando = false;

  function removerFotos() {
    fotos.splice(0).forEach(f => URL.revokeObjectURL(f.url));
    $("conclusao-previas").replaceChildren();
  }

  campos.arquivos.addEventListener("change", () => {
    const novas = Array.from(campos.arquivos.files);
    campos.arquivos.value = "";
    if (novas.length + fotos.length > 5 || novas.some(f =>
      !["image/jpeg", "image/png"].includes(f.type) || f.size > 5 * 1024 * 1024)) {
      erro.textContent = "Selecione até 5 fotos JPEG ou PNG de até 5 MB cada.";
      return;
    }
    erro.textContent = "";
    for (const arquivo of novas) {
      const foto = { arquivo, url: URL.createObjectURL(arquivo) };
      fotos.push(foto);
      const bloco = document.createElement("div");
      const imagem = document.createElement("img");
      imagem.src = foto.url;
      imagem.alt = arquivo.name;
      imagem.width = 96;
      imagem.height = 96;
      imagem.className = "object-fit-contain d-block";
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "btn btn-sm btn-outline-danger";
      botao.textContent = "Remover";
      botao.setAttribute("aria-label", "Remover " + arquivo.name);
      botao.onclick = () => {
        fotos.splice(fotos.indexOf(foto), 1);
        URL.revokeObjectURL(foto.url);
        bloco.remove();
      };
      bloco.append(imagem, botao);
      $("conclusao-previas").append(bloco);
    }
  });

  $("conclusao-cancelar").onclick = () => dialogo.close();
  dialogo.addEventListener("cancel", e => { if (enviando) e.preventDefault(); });
  dialogo.addEventListener("close", () => {
    removerFotos();
    responder?.(dialogo.returnValue === "salvo");
    responder = null;
  });
  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (enviando) return;
    const minutos = Number(campos.horas.value) * 60 + Number(campos.minutos.value);
    if (!campos.material.value.trim() || minutos < 1 || minutos > 59999999) {
      erro.textContent = "Informe o material e uma duração total válida de pelo menos um minuto.";
      return;
    }
    const corpo = new FormData();
    for (const nome of ["material", "gramas", "observacoes"]) corpo.set(nome, campos[nome].value.trim());
    corpo.set("minutos", minutos);
    fotos.forEach(f => corpo.append("fotos", f.arquivo));
    enviando = true;
    erro.textContent = "";
    const controles = form.querySelectorAll("fieldset, .modal__acoes button");
    controles.forEach(c => { c.disabled = true; });
    try {
      await AACD.api.finalizarImpressao(pedidoAtual.id, corpo);
      dialogo.close("salvo");
    } catch (e) {
      erro.textContent = e.message;
    } finally {
      enviando = false;
      controles.forEach(c => { c.disabled = false; });
    }
  });

  function abrir(pedido) {
    pedidoAtual = pedido;
    form.reset();
    erro.textContent = "";
    campos.material.value = pedido.material || "";
    $("conclusao-pedido").textContent = `Pedido #${pedido.id} · ${pedido.produto}`;
    dialogo.returnValue = "";
    dialogo.showModal();
    return new Promise(resolve => { responder = resolve; });
  }

  function detalhes(c) {
    if (!c) return [];
    const fotosSalvas = c.fotos || [];
    const tempo = c.minutos == null ? "" : `${Math.floor(c.minutos / 60)} h ${c.minutos % 60} min`;
    return [
      ["Conclusão:", escapar(formatarDataHora(c.data))],
      ["Material utilizado:", escapar(c.material)],
      ["Peso consumido:", c.gramas == null ? "" : Number(c.gramas).toLocaleString("pt-BR") + " g"],
      ["Tempo real:", tempo],
      ["Observações da impressão:", escapar(c.observacoes)],
      ["Fotos da peça:", fotosSalvas.length ? fotosSalvas.map((id, i) =>
        `<a class="me-2" href="${AACD.api.urlFotoProducao(id)}" target="_blank" rel="noopener">Foto ${i + 1}</a>`).join(" ") : "Nenhuma foto"]
    ];
  }
  return { abrir, detalhes };
})();
