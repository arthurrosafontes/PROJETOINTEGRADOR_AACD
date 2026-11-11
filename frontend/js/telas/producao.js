"use strict";

(() => {
  const { $, escapar, formatarData, formatarDataHora, mostrarToast } = AACD.util;
  const STATUS = ["Em produção", "Aguardando envio", "Aguardando validação", "Concluído", "Reprovado"];
  const segmentos = { "": "todos", todos: "todos", "em-producao": "Em produção", "aguardando-envio": "Aguardando envio", "aguardando-validacao": "Aguardando validação", concluidas: "Concluído", reprovadas: "Reprovado" };
  const classes = { "Em produção": "em-producao", "Aguardando envio": "aguardando-envio", "Aguardando validação": "aguardando-validacao", "Concluído": "concluida", Reprovado: "reprovada" };
  let pedidos = [], statusSelecionado = "todos", visita = 0, carregando, intervalo, ocupada = false;
  const el = {};

  function tabela(titulo, linhas, vazio = "Sem registro.") {
    return `<div class="col-12 col-xl-4"><table class="table table-sm tabela-etapa">
      <caption class="caption-top">${titulo}</caption><tbody>${linhas.length ? linhas.map(([rotulo, valor]) =>
        `<tr><th scope="row">${rotulo}</th><td>${valor || "—"}</td></tr>`).join("") : `<tr><td colspan="2">${vazio}</td></tr>`}</tbody>
    </table></div>`;
  }

  function renderizar() {
    const abertos = new Set(Array.from(el.lista.querySelectorAll("details[open]"), d => d.closest("li").dataset.id));
    const termo = el.busca.value.trim().toLowerCase().replace(/^#/, "");
    const itens = pedidos.filter(p => (statusSelecionado === "todos" || p.status === statusSelecionado)
      && [p.id, p.demandaId, p.produto, p.demanda?.nome, p.demanda?.paciente, p.impressora].some(v => String(v ?? "").toLowerCase().includes(termo)))
      .sort((a,b) => STATUS.indexOf(a.status) - STATUS.indexOf(b.status) || Number(b.id) - Number(a.id));
    el.abas.querySelectorAll("[data-contador]").forEach(s => { s.textContent = s.dataset.contador === "todos" ? pedidos.length : pedidos.filter(p => p.status === s.dataset.contador).length; });
    el.abas.querySelectorAll(".aba").forEach(a => {
      if (a.dataset.status === statusSelecionado) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
    el.lista.innerHTML = itens.map(p => {
      const id = escapar(p.id), cor = classes[p.status];
      return `<li class="card cartao-item cartao-item--faixa cartao-item--demanda-${cor}" data-id="${id}">
        <article aria-labelledby="pr-item-${id}">
          <header class="cartao-item__titulo">
            <h2 id="pr-item-${id}">Pedido #${id} · Demanda #${escapar(p.demandaId)} — ${escapar(p.produto)}</h2>
            <span class="badge rounded-pill selo selo--st-${cor}">${escapar(p.status)}</span>
          </header>
          <p class="cartao-item__subtitulo">${escapar(p.demanda?.nome || p.categoria)}</p>
          <p class="cartao-item__detalhes">
            <span>Impressora: <strong>${escapar(p.impressora || "Não informada")}</strong></span>
            <span>Quantidade: <strong>${escapar(p.quantidade)} ${Number(p.quantidade) === 1 ? "unidade" : "unidades"}</strong></span>
            <span>Material: <strong>${escapar(p.material)}</strong></span>
            <span>Prazo: <strong>${p.prazo ? formatarData(p.prazo) : "—"}</strong></span>
          </p>
        </article>
        ${p.status === "Em produção" || p.status === "Aguardando envio" ? `<div class="cartao-item__acoes"><button type="button" class="btn btn-primary botao" data-acao="${p.status === "Em produção" ? "finalizar" : "envio"}">${p.status === "Em produção" ? "Finalizar impressão" : "Registrar envio"}</button></div>` : ""}
        ${AACD.material.cartao(p, "voluntario")}
        <details class="cartao-item__extra d-block" ${abertos.has(id) ? "open" : ""}>
          <summary>Ver produção e avaliação</summary>
          <section class="etapas-pedido" aria-label="Etapas do pedido #${id}"><div class="row g-3">
            ${tabela("Aceito", [
              ["Pedido:", "#" + id], ["Demanda:", "#" + escapar(p.demandaId)],
              ["Aceito em:", p.dataAceiteUTC ? escapar(formatarDataHora(p.dataAceiteUTC)) : p.aceito_em ? escapar(formatarData(p.aceito_em)) : "—"],
              ["Impressora:", escapar(p.impressora)],
              ["Doação de material:", ({1: "Sim", 0: "Não"})[p.doacaoMaterial] ?? "Não informado"]
            ])}
            ${tabela("Impressão", [
              ["Início da produção:", p.dataInicioUTC ? escapar(formatarDataHora(p.dataInicioUTC)) : "Não informado"],
              ...AACD.conclusao.detalhes(p.conclusao),
              ...(!p.conclusao ? [["Conclusão:", "Impressão ainda não finalizada."]] : [])
            ])}
            ${tabela("Envio da peça", AACD.envio.detalhes(p.envio), "Envio ainda não registrado.")}
            ${p.recebimento ? tabela("Recebimento e avaliação", AACD.recebimento.detalhes(p.recebimento)) : ""}
          </div></section>
        </details>
      </li>`;
    }).join("");
    el.vazio.classList.remove("vazio--erro");
    el.vazio.textContent = "Nenhum pedido nesta etapa da produção.";
    el.vazio.hidden = itens.length > 0;
  }

  async function atualizar(inicial = false) {
    const atual = visita;
    if (carregando === atual) return;
    carregando = atual;
    try {
      const dados = await AACD.api.listarPedidos();
      if (visita !== atual) return;
      pedidos = dados.filter(p => STATUS.includes(p.status));
      renderizar();
    } catch (erro) {
      if (atual !== visita) return;
      if (inicial) {
        pedidos = []; renderizar();
        el.vazio.textContent = "Não foi possível carregar sua produção. Tente novamente.";
        el.vazio.classList.add("vazio--erro");
      }
      mostrarToast(erro.message, true);
    } finally { if (carregando === atual) carregando = undefined; }
  }
  function atualizarSeVisivel() { if (!document.hidden && !ocupada) atualizar(); }

  AACD.telas["tela-producao"] = {
    iniciar() {
      el.lista = $("pr-lista"); el.busca = $("pr-busca"); el.abas = $("pr-abas"); el.vazio = $("pr-vazio");
      el.busca.addEventListener("input", renderizar);
      el.lista.addEventListener("click", async e => {
        const botao = e.target.closest("button[data-acao]");
        if (!botao || ocupada) return;
        const pedido = pedidos.find(p => String(p.id) === botao.closest("li").dataset.id);
        if (!pedido) return;
        ocupada = true; botao.disabled = true;
        const atual = visita;
        try {
          const salvo = botao.dataset.acao === "finalizar" ? await AACD.conclusao.abrir(pedido) : await AACD.envio.abrir(pedido);
          if (salvo && atual === visita) {
            mostrarToast(botao.dataset.acao === "finalizar" ? "Impressão finalizada. Registre o envio da peça." : "Envio registrado. Aguarde a avaliação da AACD.");
            await atualizar();
          }
        } catch (erro) { mostrarToast(erro.message, true); }
        finally { ocupada = false; botao.disabled = false; }
      });
    },
    async aoEntrar(parametros = []) {
      visita++;
      statusSelecionado = segmentos[parametros[0] || ""] || "todos";
      renderizar();
      clearInterval(intervalo);
      intervalo = setInterval(atualizarSeVisivel, 10000);
      document.addEventListener("visibilitychange", atualizarSeVisivel);
      window.addEventListener("focus", atualizarSeVisivel);
      await atualizar(true);
    },
    aoSair() {
      visita++; clearInterval(intervalo);
      document.removeEventListener("visibilitychange", atualizarSeVisivel);
      window.removeEventListener("focus", atualizarSeVisivel);
    }
  };
})();
