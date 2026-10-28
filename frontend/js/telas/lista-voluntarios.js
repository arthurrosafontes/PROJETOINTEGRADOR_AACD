/* =========================================================
   telas/lista-voluntarios.js — funcionário vê todos os voluntários
   cadastrados, abre os detalhes, aceita os pendentes e pode remover um voluntário
   ========================================================= */
"use strict";

(() => {
  const { $, escapar, formatarData, mostrarToast, confirmar, alternarDetalhes, listaDescricao } = AACD.util;

  let voluntarios = [];
  const el = {};

  // "Rafael Martins" -> "RM"
  function iniciais(nome) {
    const partes = String(nome || "?").trim().split(/\s+/);
    return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
  }

function filtrar() {
  const termo = el.busca.value.trim().toLowerCase();
  const statusSelecionado = el.status.value.trim().toLowerCase();
  const ordenacao = el.ordenar.value;

  let resultado = voluntarios.filter(v => {

    // Pesquisa por nome, cidade, e-mail ou documento
    const pesquisa = [
      v.id,
      v.nome,
      v.email,
      v.cidade,
      v.estado,
      v.documento
    ].map(valor => String(valor ?? "").toLowerCase()).join(" ");

    const correspondeBusca = pesquisa.includes(termo);

    // Compara o status sem diferenciar letras maiúsculas/minúsculas
    const statusVoluntario = String(v.status ?? "").trim().toLowerCase();

    const correspondeStatus =
      statusSelecionado === "todos" ||
      statusVoluntario === statusSelecionado;

    return correspondeBusca && correspondeStatus;
  });

  // Ordenação
  if (ordenacao === "nome") {
    resultado.sort((a, b) =>
      String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR")
    );
  }

  if (ordenacao === "impressoras") {
    resultado.sort((a, b) =>
      Number(b.impressoras || 0) - Number(a.impressoras || 0)
    );
  }

  if (ordenacao === "recentes") {
    resultado.sort((a, b) =>
      new Date(b.cadastro || 0) - new Date(a.cadastro || 0)
    );
  }

  return resultado;
}

  function renderizar() {
    const itens = filtrar();
    el.lista.innerHTML = itens.map(v => {
      const id = escapar(v.id);
      const status = escapar(v.status);
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
            <span>Cidade: <strong>${escapar([v.cidade, v.estado].filter(Boolean).join(" / ")) || "-"}</strong></span>
            <span>Tipo: <strong>${escapar(v.tipo) || "-"}</strong></span>
            <span>Impressoras: <strong>${escapar(v.impressoras ?? 0)}</strong></span>
            ${v.cadastro ? `<span>Desde: <strong><time datetime="${escapar(v.cadastro)}">${formatarData(v.cadastro)}</time></strong></span>` : ""}
          </p>
        </article>
        <div class="cartao-item__acoes">
          <button type="button" class="botao botao--secundario" data-acao="detalhes"
                  aria-expanded="false" aria-controls="lvol-extra-${id}">Detalhes</button>
          ${v.status === "Pendente" ? `<button type="button" class="botao botao--escuro" data-acao="aceitar">Aceitar</button>` : ""}
          ${v.status === "Pendente" || v.status === "Aprovado"
           ? `<button type="button" class="botao botao--perigo" data-acao="remover">Reprovar</button>`
           : ""}
        </div>
        <div class="cartao-item__extra" id="lvol-extra-${id}" hidden>
          ${listaDescricao([
            ["E-mail:", v.email ? `<a href="mailto:${escapar(v.email)}">${escapar(v.email)}</a>` : ""],
            ["Telefone:", v.telefone ? `<a href="tel:${escapar(String(v.telefone).replace(/[^\d+]/g, ""))}">${escapar(v.telefone)}</a>` : ""],
            [v.tipo === "Pessoa física" ? "CPF:" : "CNPJ:", escapar(v.documento)],
            ["Razão social:", escapar(v.razaoSocial)],
            ["Endereço:", escapar(v.endereco)],
            ["CEP:", escapar(v.cep)]
          ])}
        </div>
      </li>`;
    }).join("");

    el.contador.textContent = `${itens.length} voluntário(s) encontrado(s)`;
    el.vazio.classList.remove("vazio--erro");
    el.vazio.textContent = "Nenhum voluntário encontrado.";
    el.vazio.hidden = itens.length > 0;
  }

  // Enquanto estiver "Pendente" o voluntário não consegue fazer login
  async function aceitar(botao, item, voluntario) {
    const ok = await confirmar(
      `Aceitar o voluntário "${voluntario.nome}"?
Ele passará a ter acesso ao sistema.`,
      "Aceitar",
      false
    );
    if (!ok) return;

    item.querySelectorAll("button").forEach(b => { b.disabled = true; });
    botao.textContent = "Aceitando...";
    try {
      const resposta = await AACD.api.aceitarVoluntario(voluntario.id);
      voluntario.status = resposta.status || "Ativo";
      renderizar();
      mostrarToast(`Voluntário "${voluntario.nome}" aceito. Ele já pode entrar no sistema.`);
    } catch (erro) {
      item.querySelectorAll("button").forEach(b => { b.disabled = false; });
      botao.textContent = "Aceitar";
      mostrarToast(erro.message, true);
    }
  }

  async function remover(botao, item, voluntario) {
    const ok = await confirmar(
      `Reprovar o voluntário "${voluntario.nome}"?
O acesso e as impressoras dele também serão removidos. Essa ação não pode ser desfeita.`,
      "Reprovar"
    );
    if (!ok) return;

    item.querySelectorAll("button").forEach(b => { b.disabled = true; });
    botao.textContent = "Reprovando...";
    try {
      await AACD.api.removerVoluntario(voluntario.id);
     voluntario.status = "Reprovado";
      renderizar();

      mostrarToast(
      `Voluntário "${voluntario.nome}" reprovado com sucesso.`
    );
    } catch (erro) {
      item.querySelectorAll("button").forEach(b => { b.disabled = false; });
      botao.textContent = "Reprovar";
      mostrarToast(erro.message, true);
    }
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

      el.lista.addEventListener("click", e => {
        const botao = e.target.closest("button[data-acao]");
        if (!botao) return;
        const id = botao.closest(".cartao-item").dataset.id;
        const voluntario = voluntarios.find(v => String(v.id) === id);

        if (botao.dataset.acao === "detalhes") alternarDetalhes(botao, "Detalhes");

        if (botao.dataset.acao === "aceitar") aceitar(botao, botao.closest(".cartao-item"), voluntario);

        if (botao.dataset.acao === "remover") remover(botao, botao.closest(".cartao-item"), voluntario);
      });
    },

    async aoEntrar() {
      el.contador.textContent = "Carregando voluntários...";
      try {
        voluntarios = await AACD.api.listarVoluntarios();
        // Garante que o filtro tenha todos os status que vieram do banco
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
