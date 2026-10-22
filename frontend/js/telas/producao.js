/* =========================================================
   telas/producao.js — peças que o voluntário está imprimindo
   status: "Em produção" | "Aguardando validação" | "Concluída"
   A aba escolhida fica no endereço, ex.: #/voluntario/producao/concluidas
   ========================================================= */
"use strict";

(() => {
  const { $, escapar, formatarData, mostrarToast, alternarDetalhes, listaDescricao } = AACD.util;

  const infoStatus = {
    "todos": { titulo: "Minha produção", subtitulo: "Todas as peças que você imprimiu ou está imprimindo." },
    "Em produção": { titulo: "Em produção", subtitulo: "Peças que você está imprimindo agora.", classe: "producao" },
    "Aguardando validação": { titulo: "Aguardando validação", subtitulo: "Peças impressas que a equipe da AACD está conferindo.", classe: "validacao" },
    "Concluída": { titulo: "Concluídas", subtitulo: "Peças aprovadas pela equipe. Obrigado pela ajuda!", classe: "concluida" }
  };

  // Trecho do endereço de cada aba ("" = aba padrão)
  const statusPorSegmento = {
    "": "Em produção",
    "em-producao": "Em produção",
    "todos": "todos",
    "aguardando-validacao": "Aguardando validação",
    "concluidas": "Concluída"
  };

  let producao = [];
  let statusSelecionado = "Em produção";
  let carregado = false;
  const el = {};

  // Diferença em dias entre hoje e a data de entrega (negativo = atrasado)
  function diasParaEntrega(iso) {
    const [ano, mes, dia] = String(iso).split("-").map(Number);
    const entrega = new Date(ano, mes - 1, dia);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return Math.round((entrega - hoje) / 86400000);
  }

  // Texto da direita do cartão, que muda conforme o status da peça
  function textoPrazo(p) {
    if (p.status === "Aguardando validação") {
      return { rotulo: "Enviada em", data: p.enviado, texto: "Em análise pela equipe", classe: "validacao" };
    }
    if (p.status === "Concluída") {
      return { rotulo: "Concluída em", data: p.concluido, texto: "Validada pela AACD", classe: "concluida" };
    }
    const dias = diasParaEntrega(p.entrega);
    const base = { rotulo: "Entrega", data: p.entrega };
    const plural = Math.abs(dias) > 1 ? "s" : "";
    if (dias < 0) return { ...base, texto: `Atrasado ${Math.abs(dias)} dia${plural}`, classe: "atrasado" };
    if (dias === 0) return { ...base, texto: "Entrega hoje", classe: "hoje" };
    return { ...base, texto: `Falta${dias > 1 ? "m" : ""} ${dias} dia${plural}`, classe: "" };
  }

  function filtrar() {
    const termo = el.busca.value.trim().toLowerCase();
    return producao
      .filter(p => String(p.paciente || "").toLowerCase().includes(termo)
        && (statusSelecionado === "todos" || p.status === statusSelecionado))
      .sort((a, b) => String(a.entrega || "").localeCompare(String(b.entrega || ""))); // mais urgentes primeiro
  }

  function atualizarContadores() {
    el.abas.querySelectorAll("[data-contador]").forEach(span => {
      const status = span.dataset.contador;
      span.textContent = status === "todos" ? producao.length : producao.filter(p => p.status === status).length;
    });
  }

  function renderizar() {
    const itens = filtrar();
    el.lista.innerHTML = itens.map(p => {
      const id = escapar(p.id);
      const prazo = textoPrazo(p);
      const info = infoStatus[p.status] || {};
      // Só peças em produção podem ser enviadas para validação
      const botaoEnviar = p.status === "Em produção"
        ? `<button type="button" class="botao botao--primario" data-acao="enviar">Enviar para validação</button>`
        : "";
      return `
      <li class="cartao-item cartao-item--tres cartao-item--grande" data-id="${id}">
        <article aria-labelledby="pr-item-${id}">
          <header class="cartao-item__titulo">
            <h2 id="pr-item-${id}">${escapar(p.paciente)}</h2>
            <span class="selo selo--${info.classe || ""}">${escapar(p.status)}</span>
          </header>
          <p class="cartao-item__subtitulo">${escapar(p.peca)}</p>
        </article>
        <p class="cartao-item__lateral">
          <span>${prazo.rotulo}: <time datetime="${escapar(prazo.data)}">${formatarData(prazo.data)}</time></span>
          <span class="prazo-status ${prazo.classe ? `prazo-status--${prazo.classe}` : ""}">${prazo.texto}</span>
        </p>
        <button type="button" class="botao botao--secundario" data-acao="detalhes"
                aria-expanded="false" aria-controls="pr-extra-${id}">Ver detalhes</button>
        <div class="cartao-item__extra" id="pr-extra-${id}" hidden>
          ${listaDescricao([
            ["Pedido:", `#${id}`],
            ["Material:", escapar(p.material)],
            ["Impressora:", escapar(p.impressora)],
            ["Progresso:", `<meter min="0" max="100" value="${Number(p.progresso) || 0}">${Number(p.progresso) || 0}%</meter> ${Number(p.progresso) || 0}%`],
            ["Prazo:", `<time datetime="${escapar(p.entrega)}">${formatarData(p.entrega)}</time>`],
            ["Observações:", escapar(p.obs)]
          ])}
          ${botaoEnviar}
        </div>
      </li>`;
    }).join("");

    el.titulo.textContent = infoStatus[statusSelecionado].titulo;
    el.subtitulo.textContent = infoStatus[statusSelecionado].subtitulo;
    atualizarContadores();
    el.vazio.classList.remove("vazio--erro");
    el.vazio.textContent = "Nenhuma peça encontrada.";
    el.vazio.hidden = itens.length > 0;
  }

  function marcarAba() {
    el.abas.querySelectorAll(".aba").forEach(a => {
      if (a.dataset.status === statusSelecionado) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  }

  AACD.telas["tela-producao"] = {
    iniciar() {
      el.lista = $("pr-lista");
      el.busca = $("pr-busca");
      el.abas = $("pr-abas");
      el.titulo = $("pr-titulo");
      el.subtitulo = $("pr-subtitulo");
      el.vazio = $("pr-vazio");

      el.busca.addEventListener("input", renderizar);

      el.lista.addEventListener("click", async e => {
        const botao = e.target.closest("button[data-acao]");
        if (!botao) return;
        const id = botao.closest(".cartao-item").dataset.id;
        const peca = producao.find(p => String(p.id) === id);

        if (botao.dataset.acao === "detalhes") alternarDetalhes(botao, "Ver detalhes");

        if (botao.dataset.acao === "enviar") {
          botao.disabled = true;
          botao.textContent = "Enviando...";
          try {
            const atualizada = await AACD.api.enviarParaValidacao(id);
            Object.assign(peca, atualizada);
            renderizar();
            mostrarToast(`Peça de ${peca.paciente} enviada para validação.`);
          } catch (erro) {
            botao.disabled = false;
            botao.textContent = "Enviar para validação";
            mostrarToast(erro.message, true);
          }
        }
      });
    },

    // parametros[0] = trecho da aba no endereço (ex.: "concluidas")
    async aoEntrar(parametros) {
      statusSelecionado = statusPorSegmento[parametros[0] || ""] || "Em produção";
      marcarAba();

      // Trocar de aba não precisa ir ao servidor de novo
      if (carregado && parametros.trocaInterna) return renderizar();

      try {
        producao = await AACD.api.listarProducao();
        carregado = true;
        renderizar();
      } catch {
        producao = [];
        carregado = false;
        el.lista.innerHTML = "";
        atualizarContadores();
        el.titulo.textContent = infoStatus[statusSelecionado].titulo;
        el.subtitulo.textContent = infoStatus[statusSelecionado].subtitulo;
        el.vazio.textContent = "Erro ao carregar as peças. Verifique se o backend está rodando.";
        el.vazio.classList.add("vazio--erro");
        el.vazio.hidden = false;
      }
    }
  };
})();
