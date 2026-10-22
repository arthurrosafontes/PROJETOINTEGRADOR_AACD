/* =========================================================
   telas/impressoras.js — funcionário vê, edita e remove
   as impressoras cadastradas pelos voluntários
   ========================================================= */
"use strict";

(() => {
  const { $, escapar, formatarData, mostrarToast, confirmar, alternarDetalhes, listaDescricao } = AACD.util;

  let impressoras = [];
  let idEmEdicao = null;
  const el = {};

  // 220, 220, 250 -> "220 × 220 × 250 mm"
  function areaImpressao(i) {
    if (!i.largura || !i.profundidade || !i.altura) return "-";
    return `${escapar(i.largura)} × ${escapar(i.profundidade)} × ${escapar(i.altura)} mm`;
  }

  function filtrar() {
    const termo = el.busca.value.trim().toLowerCase();
    const tecnologia = el.tecnologia.value;
    const resultado = impressoras.filter(i =>
      `${i.modelo} ${i.voluntarioNome} ${i.voluntarioCidade || ""}`.toLowerCase().includes(termo)
      && (tecnologia === "todas" || i.tecnologia === tecnologia));

    const texto = (v) => String(v || "");
    if (el.ordenar.value === "recentes") resultado.sort((a, b) => texto(b.cadastro).localeCompare(texto(a.cadastro)));
    if (el.ordenar.value === "modelo") resultado.sort((a, b) => texto(a.modelo).localeCompare(texto(b.modelo)));
    if (el.ordenar.value === "voluntario") resultado.sort((a, b) => texto(a.voluntarioNome).localeCompare(texto(b.voluntarioNome)));
    return resultado;
  }

  function renderizar(idDestaque = null) {
    const itens = filtrar();
    el.lista.innerHTML = itens.map(i => {
      const id = escapar(i.id);
      return `
      <li class="cartao-item cartao-item--grande ${String(i.id) === String(idDestaque) ? "atualizado" : ""}" data-id="${id}">
        <article aria-labelledby="imp-titulo-${id}">
          <header class="cartao-item__titulo">
            <h2 id="imp-titulo-${id}">${escapar(i.modelo)}</h2>
            <span class="selo selo--${escapar(i.tecnologia)}">${escapar(i.tecnologia)}</span>
            <span class="cartao-item__codigo">#${id}</span>
          </header>
          <p class="cartao-item__detalhes">
            <span>Voluntário: <strong>${escapar(i.voluntarioNome)}</strong></span>
            <span>Cidade: <strong>${escapar(i.voluntarioCidade) || "-"}</strong></span>
            <span>Área: <strong>${areaImpressao(i)}</strong></span>
            <span>Materiais: <strong>${escapar(i.materiais) || "-"}</strong></span>
          </p>
        </article>
        <div class="cartao-item__acoes">
          <button type="button" class="botao botao--secundario" data-acao="detalhes"
                  aria-expanded="false" aria-controls="imp-extra-${id}">Detalhes</button>
          <button type="button" class="botao botao--escuro" data-acao="editar">Editar</button>
          <button type="button" class="botao botao--perigo" data-acao="remover">Remover</button>
        </div>
        <div class="cartao-item__extra" id="imp-extra-${id}" hidden>
          ${listaDescricao([
            ["Tecnologia:", escapar(i.tecnologia)],
            ["Área de impressão:", areaImpressao(i)],
            ["Bico:", i.bico ? `${escapar(i.bico)} mm` : ""],
            ["Materiais:", escapar(i.materiais)],
            ["Cadastrada em:", `<time datetime="${escapar(i.cadastro)}">${formatarData(i.cadastro)}</time>`],
            ["Voluntário:", `${escapar(i.voluntarioNome)} (#${escapar(i.voluntarioId)}, ${escapar(i.voluntarioStatus)})`],
            ["E-mail:", i.voluntarioEmail ? `<a href="mailto:${escapar(i.voluntarioEmail)}">${escapar(i.voluntarioEmail)}</a>` : ""],
            ["Telefone:", escapar(i.voluntarioTelefone)],
            ["Observações:", escapar(i.obs)]
          ])}
        </div>
      </li>`;
    }).join("");

    el.contador.textContent = `${itens.length} impressora(s) encontrada(s)`;
    el.vazio.classList.remove("vazio--erro");
    el.vazio.textContent = "Nenhuma impressora encontrada.";
    el.vazio.hidden = itens.length > 0;
  }

  // ===== Modal de edição =====
  // O bico só faz sentido em impressoras FDM
  function atualizarCampoBico() {
    const ehResina = el.form.tecnologia.value === "Resina";
    el.form.bico.disabled = ehResina;
    if (ehResina) el.form.bico.value = "";
  }

  function abrirModal(impressora) {
    idEmEdicao = impressora.id;
    const f = el.form;
    f.modelo.value = impressora.modelo ?? "";
    f.tecnologia.value = impressora.tecnologia === "Resina" ? "Resina" : "FDM";
    f.bico.value = impressora.bico ?? "";
    f.largura.value = impressora.largura ?? "";
    f.profundidade.value = impressora.profundidade ?? "";
    f.altura.value = impressora.altura ?? "";
    f.materiais.value = impressora.materiais ?? "";
    f.obs.value = impressora.obs ?? "";

    $("modal-impressora-voluntario").textContent = `#${impressora.id} · Voluntário: ${impressora.voluntarioNome || "-"}`;
    el.erro.hidden = true;
    f.querySelectorAll("[aria-invalid]").forEach(c => c.removeAttribute("aria-invalid"));
    atualizarCampoBico();

    el.modal.showModal();
    f.modelo.focus();
  }

  function fecharModal() {
    el.modal.close();
  }

  function mostrarErroModal(mensagem, entrada = null) {
    el.erro.textContent = mensagem;
    el.erro.hidden = false;
    if (entrada) {
      entrada.setAttribute("aria-invalid", "true");
      entrada.focus();
    }
  }

  // "" -> null, texto -> número
  function numeroOuNulo(texto) {
    if (texto === "" || texto == null) return null;
    const n = Number(texto);
    return Number.isFinite(n) ? n : NaN;
  }

  // Lê e valida o formulário. Retorna os campos ou null se algo estiver errado.
  function lerFormulario() {
    const f = el.form;
    f.querySelectorAll("[aria-invalid]").forEach(c => c.removeAttribute("aria-invalid"));
    el.erro.hidden = true;

    const campos = {
      modelo: f.modelo.value.trim(),
      tecnologia: f.tecnologia.value,
      bico: numeroOuNulo(f.bico.value),
      largura: numeroOuNulo(f.largura.value),
      profundidade: numeroOuNulo(f.profundidade.value),
      altura: numeroOuNulo(f.altura.value),
      materiais: f.materiais.value.trim(),
      obs: f.obs.value.trim()
    };

    if (!campos.modelo) {
      mostrarErroModal("Informe o modelo da impressora.", f.modelo);
      return null;
    }
    for (const nome of ["largura", "profundidade", "altura", "bico"]) {
      const v = campos[nome];
      if (Number.isNaN(v) || (v !== null && v <= 0)) {
        mostrarErroModal(`O campo "${nome}" precisa ser um número maior que zero.`, f[nome]);
        return null;
      }
    }
    if (campos.tecnologia === "Resina") campos.bico = null;
    return campos;
  }

  async function salvar(e) {
    e.preventDefault();
    if (idEmEdicao == null) return;
    const campos = lerFormulario();
    if (!campos) return;

    const id = idEmEdicao;
    el.salvar.disabled = true;
    el.salvar.textContent = "Salvando...";
    try {
      const resposta = await AACD.api.atualizarImpressora(id, campos);
      // Se a API devolver a impressora atualizada, usa ela; senão usa o que foi enviado
      const atualizada = resposta && resposta.id ? resposta : campos;
      impressoras = impressoras.map(i => (String(i.id) === String(id) ? { ...i, ...atualizada, id: i.id } : i));
      fecharModal();
      renderizar(id);
      mostrarToast(`Impressora "${campos.modelo}" atualizada.`);
    } catch (erro) {
      mostrarErroModal(erro.message);
    } finally {
      el.salvar.disabled = false;
      el.salvar.textContent = "Salvar alterações";
    }
  }

  async function remover(botao, item, impressora) {
    const ok = await confirmar(
      `Remover a impressora "${impressora.modelo}" de ${impressora.voluntarioNome}?\nEssa ação não pode ser desfeita.`,
      "Remover"
    );
    if (!ok) return;

    item.querySelectorAll("button").forEach(b => { b.disabled = true; });
    botao.textContent = "Removendo...";
    try {
      await AACD.api.removerImpressora(impressora.id);
      item.classList.add("saindo");
      setTimeout(() => {
        impressoras = impressoras.filter(i => i.id !== impressora.id);
        renderizar();
        mostrarToast(`Impressora "${impressora.modelo}" removida.`);
      }, 300);
    } catch (erro) {
      item.querySelectorAll("button").forEach(b => { b.disabled = false; });
      botao.textContent = "Remover";
      mostrarToast(erro.message, true);
    }
  }

  AACD.telas["tela-impressoras"] = {
    iniciar() {
      el.lista = $("imp-lista");
      el.busca = $("imp-busca");
      el.tecnologia = $("imp-tecnologia");
      el.ordenar = $("imp-ordenar");
      el.contador = $("imp-contador");
      el.vazio = $("imp-vazio");
      el.modal = $("modal-impressora");
      el.form = $("form-editar-impressora");
      el.erro = $("modal-impressora-erro");
      el.salvar = $("modal-impressora-salvar");

      el.busca.addEventListener("input", () => renderizar());
      el.tecnologia.addEventListener("change", () => renderizar());
      el.ordenar.addEventListener("change", () => renderizar());

      el.form.tecnologia.addEventListener("change", atualizarCampoBico);
      el.form.addEventListener("submit", salvar);
      el.modal.querySelectorAll("[data-fechar]").forEach(b => b.addEventListener("click", fecharModal));
      el.modal.addEventListener("click", e => { if (e.target === el.modal) fecharModal(); }); // clique fora fecha
      el.modal.addEventListener("close", () => { idEmEdicao = null; });

      el.lista.addEventListener("click", e => {
        const botao = e.target.closest("button[data-acao]");
        if (!botao) return;
        const item = botao.closest(".cartao-item");
        const impressora = impressoras.find(i => String(i.id) === item.dataset.id);
        if (!impressora) return;

        if (botao.dataset.acao === "detalhes") alternarDetalhes(botao, "Detalhes");
        if (botao.dataset.acao === "editar") abrirModal(impressora);
        if (botao.dataset.acao === "remover") remover(botao, item, impressora);
      });
    },

    async aoEntrar() {
      el.contador.textContent = "Carregando impressoras...";
      try {
        impressoras = await AACD.api.listarImpressoras();
        renderizar();
      } catch {
        impressoras = [];
        el.lista.innerHTML = "";
        el.contador.textContent = "";
        el.vazio.textContent = "Erro ao carregar as impressoras. Verifique se o backend está rodando.";
        el.vazio.classList.add("vazio--erro");
        el.vazio.hidden = false;
      }
    },

    // Ao sair da tela, o modal não pode ficar aberto
    aoSair() {
      if (el.modal && el.modal.open) fecharModal();
    }
  };
})();
