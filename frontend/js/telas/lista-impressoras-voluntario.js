/* =========================================================
   telas/lista-impressoras-voluntario.js — voluntário vê as
   impressoras cadastradas na rede e edita apenas as suas
   ========================================================= */
"use strict";

(() => {
  const { $, escapar, formatarData, mostrarToast, alternarDetalhes, listaDescricao } = AACD.util;

  const MSG_SOMENTE_DONO = "Você precisa ser o dono do cadastro desta impressora para editá-la.";

  let impressoras = [];
  let idEmEdicao = null;
  const el = {};

  // 220, 220, 250 -> "220 × 220 × 250 mm"
  function areaImpressao(i) {
    if (!i.largura || !i.profundidade || !i.altura) return "-";
    return `${escapar(i.largura)} × ${escapar(i.profundidade)} × ${escapar(i.altura)} mm`;
  }

  const local = (i) => [i.cidade, i.estado].filter(Boolean).join(" / ");

  function filtrar() {
    const termo = el.busca.value.trim().toLowerCase();
    const somenteMinhas = el.dono.value === "minhas";
    const resultado = impressoras.filter(i =>
      `${i.nome} ${i.marca} ${i.modelo} ${i.voluntarioNome} ${i.cidade}`.toLowerCase().includes(termo)
      && (!somenteMinhas || i.minha));

    const texto = (v) => String(v || "");
    if (el.ordenar.value === "recentes") resultado.sort((a, b) => texto(b.cadastro).localeCompare(texto(a.cadastro)));
    if (el.ordenar.value === "nome") resultado.sort((a, b) => texto(a.nome).localeCompare(texto(b.nome)));
    if (el.ordenar.value === "voluntario") resultado.sort((a, b) => texto(a.voluntarioNome).localeCompare(texto(b.voluntarioNome)));
    return resultado;
  }

  function renderizar(idDestaque = null) {
    const itens = filtrar();
    el.lista.innerHTML = itens.map(i => {
      const id = escapar(i.id);
      return `
      <li class="cartao-item cartao-item--grande ${String(i.id) === String(idDestaque) ? "atualizado" : ""}" data-id="${id}">
        <article aria-labelledby="liv-titulo-${id}">
          <header class="cartao-item__titulo">
            <h2 id="liv-titulo-${id}">${escapar(i.nome || i.modelo)}</h2>
            <span class="selo selo--${escapar(i.tecnologia)}">${escapar(i.tecnologia)}</span>
            ${i.minha ? '<span class="selo selo--concluido">Minha impressora</span>' : ""}
          </header>
          <p class="cartao-item__detalhes">
            <span>Marca/Modelo: <strong>${escapar(i.marca)} ${escapar(i.modelo)}</strong></span>
            <span>Dono: <strong>${i.minha ? "Você" : escapar(i.voluntarioNome)}</strong></span>
            <span>Cidade: <strong>${escapar(local(i)) || "-"}</strong></span>
            <span>Materiais: <strong>${escapar(i.materiais) || "-"}</strong></span>
          </p>
        </article>
        <div class="cartao-item__acoes">
          <button type="button" class="botao botao--secundario" data-acao="detalhes"
                  aria-expanded="false" aria-controls="liv-extra-${id}">Detalhes</button>
          <button type="button" class="botao botao--escuro" data-acao="editar">Editar</button>
        </div>
        <div class="cartao-item__extra" id="liv-extra-${id}" hidden>
          ${listaDescricao([
            ["Nome:", escapar(i.nome)],
            ["Marca:", escapar(i.marca)],
            ["Modelo:", escapar(i.modelo)],
            ["Tecnologia:", escapar(i.tecnologia)],
            ["Área de impressão:", areaImpressao(i)],
            ["Bico:", i.bico ? `${escapar(i.bico)} mm` : ""],
            ["Diâmetro do filamento:", i.diametroFilamento ? `${escapar(i.diametroFilamento)} mm` : ""],
            ["Temp. máx. do bico:", i.tempBico ? `${escapar(i.tempBico)} °C` : ""],
            ["Materiais:", escapar(i.materiais)],
            ["Status:", escapar(i.status)],
            ["Cidade:", escapar(local(i))],
            ["Dono do cadastro:", i.minha ? "Você" : escapar(i.voluntarioNome)],
            ["Cadastrada em:", `<time datetime="${escapar(i.cadastro)}">${formatarData(i.cadastro)}</time>`],
            ["Atualizada em:", i.atualizacao ? `<time datetime="${escapar(i.atualizacao)}">${formatarData(i.atualizacao)}</time>` : ""],
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

  // ===== Modal de edição (só para o dono) =====
  function abrirModal(impressora) {
    if (!impressora.minha) {
      mostrarToast(MSG_SOMENTE_DONO, true);
      return;
    }
    idEmEdicao = impressora.id;
    const f = el.form;
    f.nome.value = impressora.nome;
    f.marca.value = impressora.marca;
    f.modelo.value = impressora.modelo;
    f.bico.value = impressora.bico ?? "";
    f.diametro.value = impressora.diametroFilamento ?? "";
    f.largura.value = impressora.largura ?? "";
    f.profundidade.value = impressora.profundidade ?? "";
    f.altura.value = impressora.altura ?? "";
    f.tempBico.value = impressora.tempBico ?? "";
    f.materiais.value = impressora.materiais;
    f.obs.value = impressora.obs;

    $("modal-minha-impressora-sub").textContent = `${impressora.marca} ${impressora.modelo}`.trim();
    el.erro.hidden = true;
    f.querySelectorAll("[aria-invalid]").forEach(c => c.removeAttribute("aria-invalid"));

    el.modal.showModal();
    f.nome.focus();
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

  // Lê e valida o formulário. Retorna os campos no formato do backend ou null.
  function lerFormulario() {
    const f = el.form;
    f.querySelectorAll("[aria-invalid]").forEach(c => c.removeAttribute("aria-invalid"));
    el.erro.hidden = true;

    for (const nome of ["nome", "marca", "modelo", "materiais"]) {
      if (!f[nome].value.trim()) {
        mostrarErroModal("Preencha todos os campos obrigatórios.", f[nome]);
        return null;
      }
    }
    const numeros = {};
    for (const nome of ["bico", "diametro", "largura", "profundidade", "altura"]) {
      const n = Number(f[nome].value);
      if (f[nome].value === "" || !Number.isFinite(n) || n <= 0) {
        mostrarErroModal("Os valores numéricos precisam ser maiores que zero.", f[nome]);
        return null;
      }
      numeros[nome] = n;
    }
    const tempBico = f.tempBico.value === "" ? null : Number(f.tempBico.value);
    if (tempBico !== null && (!Number.isFinite(tempBico) || tempBico <= 0)) {
      mostrarErroModal("A temperatura precisa ser um número maior que zero.", f.tempBico);
      return null;
    }

    return {
      nome_da_impressora: f.nome.value.trim(),
      marca_da_impressora: f.marca.value.trim(),
      modelo_da_impressora: f.modelo.value.trim(),
      diametro_bico_mm: numeros.bico,
      diametro_filamento_mm: numeros.diametro,
      volume_impressao: {
        largura_mm: numeros.largura,
        profundidade_mm: numeros.profundidade,
        altura_mm: numeros.altura
      },
      temperatura_maxima_bico: tempBico,
      filamentos_compativeis: f.materiais.value.split(",").map(m => m.trim()).filter(Boolean),
      observacoes: f.obs.value.trim()
    };
  }

  async function salvar(e) {
    e.preventDefault();
    if (idEmEdicao == null) return;
    const dados = lerFormulario();
    if (!dados) return;

    const id = idEmEdicao;
    el.salvar.disabled = true;
    el.salvar.textContent = "Salvando...";
    try {
      await AACD.api.editarMinhaImpressora(id, dados);
      fecharModal();
      await carregar(id);
      mostrarToast(`Impressora "${dados.nome_da_impressora}" atualizada.`);
    } catch (erro) {
      mostrarErroModal(erro.message);
    } finally {
      el.salvar.disabled = false;
      el.salvar.textContent = "Salvar alterações";
    }
  }

  async function carregar(idDestaque = null) {
    try {
      impressoras = await AACD.api.listarImpressorasVoluntario();
      renderizar(idDestaque);
    } catch {
      impressoras = [];
      el.lista.innerHTML = "";
      el.contador.textContent = "";
      el.vazio.textContent = "Erro ao carregar as impressoras. Verifique se o backend está rodando.";
      el.vazio.classList.add("vazio--erro");
      el.vazio.hidden = false;
    }
  }

  AACD.telas["tela-lista-impressoras-vol"] = {
    iniciar() {
      el.lista = $("liv-lista");
      el.busca = $("liv-busca");
      el.dono = $("liv-dono");
      el.ordenar = $("liv-ordenar");
      el.contador = $("liv-contador");
      el.vazio = $("liv-vazio");
      el.modal = $("modal-minha-impressora");
      el.form = $("form-minha-impressora");
      el.erro = $("modal-minha-impressora-erro");
      el.salvar = $("modal-minha-impressora-salvar");

      el.busca.addEventListener("input", () => renderizar());
      el.dono.addEventListener("change", () => renderizar());
      el.ordenar.addEventListener("change", () => renderizar());

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
      });
    },

    aoEntrar() {
      el.contador.textContent = "Carregando impressoras...";
      return carregar();
    },

    // Ao sair da tela, o modal não pode ficar aberto
    aoSair() {
      if (el.modal && el.modal.open) fecharModal();
    }
  };
})();
