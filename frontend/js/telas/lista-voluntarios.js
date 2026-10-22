/* =========================================================
   telas/lista-voluntarios.js — funcionário acompanha voluntários
   status: "Pendente" | "Ativo" | "Inativo"
   (qual é o próximo status quem decide é a API)
   ========================================================= */
"use strict";

(() => {
  const { $, escapar, formatarData, mostrarToast, alternarDetalhes, listaDescricao } = AACD.util;

  const acaoPorStatus = {
    Pendente: { texto: "Aprovar", aviso: "aprovado(a)" },
    Ativo: { texto: "Desativar", aviso: "desativado(a)" },
    Inativo: { texto: "Reativar", aviso: "reativado(a)" }
  };

  let voluntarios = [];
  const el = {};

  // "Rafael Martins" -> "RM"
  function iniciais(nome) {
    const partes = String(nome || "?").trim().split(/\s+/);
    return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
  }

  function filtrar() {
    const termo = el.busca.value.trim().toLowerCase();
    const status = el.status.value;
    const resultado = voluntarios.filter(v =>
      (String(v.nome || "").toLowerCase().includes(termo) || String(v.cidade || "").toLowerCase().includes(termo))
      && (status === "todos" || v.status === status));

    if (el.ordenar.value === "nome") resultado.sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
    if (el.ordenar.value === "entregas") resultado.sort((a, b) => (b.entregues || 0) - (a.entregues || 0));
    if (el.ordenar.value === "recentes") resultado.sort((a, b) => String(b.cadastro || "").localeCompare(String(a.cadastro || "")));
    return resultado;
  }

  function renderizar() {
    const itens = filtrar();
    el.lista.innerHTML = itens.map(v => {
      const id = escapar(v.id);
      const status = escapar(v.status);
      const acao = acaoPorStatus[v.status] || { texto: "Mudar status" };
      return `
      <li class="cartao-item cartao-item--faixa cartao-item--avatar cartao-item--${status}" data-id="${id}">
        <span class="iniciais" aria-hidden="true">${escapar(iniciais(v.nome))}</span>
        <article aria-labelledby="lvol-titulo-${id}">
          <header class="cartao-item__titulo">
            <h2 id="lvol-titulo-${id}">${escapar(v.nome)}</h2>
            <span class="selo selo--${status}">${status}</span>
            <span class="cartao-item__codigo">#${id}</span>
          </header>
          <p class="cartao-item__detalhes">
            <span>Cidade: <strong>${escapar(v.cidade) || "-"}</strong></span>
            <span>Peças entregues: <strong>${escapar(v.entregues ?? 0)}</strong></span>
            <span>Em produção: <strong>${escapar(v.emProducao ?? 0)}</strong></span>
            <span>Desde: <strong><time datetime="${escapar(v.cadastro)}">${formatarData(v.cadastro)}</time></strong></span>
          </p>
        </article>
        <div class="cartao-item__acoes">
          <button type="button" class="botao botao--secundario" data-acao="detalhes"
                  aria-expanded="false" aria-controls="lvol-extra-${id}">Detalhes</button>
          <button type="button" class="botao botao--primario" data-acao="status">${acao.texto}</button>
        </div>
        <div class="cartao-item__extra" id="lvol-extra-${id}" hidden>
          ${listaDescricao([
            ["E-mail:", v.email ? `<a href="mailto:${escapar(v.email)}">${escapar(v.email)}</a>` : ""],
            ["Telefone:", v.telefone ? `<a href="tel:${escapar(String(v.telefone).replace(/[^\d+]/g, ""))}">${escapar(v.telefone)}</a>` : ""],
            ["Impressoras:", escapar(v.impressoras)],
            ["Materiais:", escapar(v.materiais)]
          ])}
        </div>
      </li>`;
    }).join("");

    el.contador.textContent = `${itens.length} voluntário(s) encontrado(s)`;
    el.vazio.classList.remove("vazio--erro");
    el.vazio.textContent = "Nenhum voluntário encontrado.";
    el.vazio.hidden = itens.length > 0;
  }

  AACD.telas["tela-lista-voluntarios"] = {
    iniciar() {
      el.lista = $("lvol-lista");
      el.busca = $("lvol-busca");
      el.status = $("lvol-status");
      el.ordenar = $("lvol-ordenar");
      el.contador = $("lvol-contador");
      el.vazio = $("lvol-vazio");

      el.busca.addEventListener("input", renderizar);
      el.status.addEventListener("change", renderizar);
      el.ordenar.addEventListener("change", renderizar);

      el.lista.addEventListener("click", async e => {
        const botao = e.target.closest("button[data-acao]");
        if (!botao) return;
        const id = botao.closest(".cartao-item").dataset.id;
        const voluntario = voluntarios.find(v => String(v.id) === id);

        if (botao.dataset.acao === "detalhes") alternarDetalhes(botao, "Detalhes");

        if (botao.dataset.acao === "status") {
          const acao = acaoPorStatus[voluntario.status] || { aviso: "atualizado(a)" };
          const textoOriginal = botao.textContent;
          botao.disabled = true;
          botao.textContent = "Salvando...";
          try {
            const atualizado = await AACD.api.mudarStatusVoluntario(id);
            Object.assign(voluntario, atualizado);
            renderizar();
            mostrarToast(`${voluntario.nome} foi ${acao.aviso}.`);
          } catch (erro) {
            botao.disabled = false;
            botao.textContent = textoOriginal;
            mostrarToast(erro.message, true);
          }
        }
      });
    },

    async aoEntrar() {
      el.contador.textContent = "Carregando voluntários...";
      try {
        voluntarios = await AACD.api.listarVoluntarios();
        renderizar();
      } catch {
        voluntarios = [];
        el.lista.innerHTML = "";
        el.contador.textContent = "";
        el.vazio.textContent = "Erro ao carregar os voluntários. Verifique se o backend está rodando.";
        el.vazio.classList.add("vazio--erro");
        el.vazio.hidden = false;
      }
    }
  };
})();
