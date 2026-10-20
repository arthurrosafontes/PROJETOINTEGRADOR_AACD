// =====================================================
// TELA: Impressoras cadastradas (frontend)
// Este arquivo só cuida da tela: lista, filtros, modal,
// botões e avisos. Toda a comunicação com o backend/banco
// fica no api.js (carregado antes deste no HTML), que
// fornece: buscarImpressoras(), atualizarImpressora(id, campos)
// e removerImpressora(id).
// =====================================================

// Lista de impressoras que veio da API (formato descrito no api.js)
let impressoras = [];

// Id da impressora que está sendo editada no modal
let idEmEdicao = null;

// ===== ELEMENTOS =====
const lista = document.getElementById("listaImpressoras");
const busca = document.getElementById("busca");
const filtroTecnologia = document.getElementById("filtroTecnologia");
const ordenar = document.getElementById("ordenar");
const contador = document.getElementById("contador");
const vazio = document.getElementById("vazio");
const toast = document.getElementById("toast");

const modal = document.getElementById("modalEditar");
const form = document.getElementById("formEditar");
const modalVoluntario = document.getElementById("modalVoluntario");
const modalErro = document.getElementById("modalErro");
const btnSalvar = document.getElementById("btnSalvar");

// ===== FUNÇÕES =====
function formatarData(iso) {
  if (!iso) return "-";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

// Evita que textos do banco virem HTML na tela
function escapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

// 220, 220, 250 -> "220 × 220 × 250 mm"
function areaImpressao(i) {
  if (!i.largura || !i.profundidade || !i.altura) return "-";
  return `${i.largura} × ${i.profundidade} × ${i.altura} mm`;
}

function filtrarImpressoras() {
  const termo = busca.value.trim().toLowerCase();
  const tecnologia = filtroTecnologia.value;

  let resultado = impressoras.filter(i => {
    const texto = `${i.modelo} ${i.voluntarioNome} ${i.voluntarioCidade || ""}`.toLowerCase();
    const bateTexto = texto.includes(termo);
    const bateTecnologia = tecnologia === "todas" || i.tecnologia === tecnologia;
    return bateTexto && bateTecnologia;
  });

  if (ordenar.value === "recentes") resultado.sort((a, b) => (b.cadastro || "").localeCompare(a.cadastro || ""));
  if (ordenar.value === "modelo") resultado.sort((a, b) => (a.modelo || "").localeCompare(b.modelo || ""));
  if (ordenar.value === "voluntario") resultado.sort((a, b) => (a.voluntarioNome || "").localeCompare(b.voluntarioNome || ""));

  return resultado;
}

function renderizar(idDestaque = null) {
  const itens = filtrarImpressoras();
  lista.innerHTML = "";

  itens.forEach(i => {
    const li = document.createElement("li");
    li.className = "impressora";
    if (i.id === idDestaque) li.classList.add("atualizada");
    li.dataset.id = i.id;
    li.innerHTML = `
      <div class="impressora-info">
        <div class="impressora-titulo">
          <h3>${escapar(i.modelo)}</h3>
          <span class="badge ${escapar(i.tecnologia)}">${escapar(i.tecnologia)}</span>
          <span class="impressora-codigo">#${i.id}</span>
        </div>
        <div class="impressora-detalhes">
          <span>Voluntário: <strong>${escapar(i.voluntarioNome)}</strong></span>
          <span>Cidade: <strong>${escapar(i.voluntarioCidade) || "-"}</strong></span>
          <span>Área: <strong>${areaImpressao(i)}</strong></span>
          <span>Materiais: <strong>${escapar(i.materiais) || "-"}</strong></span>
        </div>
      </div>
      <div class="impressora-acoes">
        <button class="btn btn-secundario" data-acao="detalhes">Detalhes</button>
        <button class="btn btn-editar" data-acao="editar">Editar</button>
        <button class="btn btn-perigo" data-acao="remover">Remover</button>
      </div>
    `;
    lista.appendChild(li);
  });

  contador.textContent = `${itens.length} impressora(s) encontrada(s)`;
  vazio.textContent = "Nenhuma impressora encontrada.";
  vazio.hidden = itens.length > 0;
}

// Mostra um aviso rápido na parte de baixo da tela. Ex: mostrarToast("Salvo!");
function mostrarToast(mensagem, erro = false) {
  toast.textContent = mensagem;
  toast.classList.toggle("erro", erro);
  toast.classList.add("visivel");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("visivel"), 2500);
}

// ===== MODAL DE EDIÇÃO =====

// O bico só faz sentido em impressoras FDM
function atualizarCampoBico() {
  const ehResina = form.tecnologia.value === "Resina";
  form.bico.disabled = ehResina;
  if (ehResina) form.bico.value = "";
}

function abrirModalEdicao(impressora) {
  idEmEdicao = impressora.id;

  form.modelo.value = impressora.modelo ?? "";
  form.tecnologia.value = impressora.tecnologia === "Resina" ? "Resina" : "FDM";
  form.bico.value = impressora.bico ?? "";
  form.largura.value = impressora.largura ?? "";
  form.profundidade.value = impressora.profundidade ?? "";
  form.altura.value = impressora.altura ?? "";
  form.materiais.value = impressora.materiais ?? "";
  form.obs.value = impressora.obs ?? "";

  modalVoluntario.textContent = `#${impressora.id} · Voluntário: ${impressora.voluntarioNome || "-"}`;
  modalErro.hidden = true;
  form.querySelectorAll(".invalido").forEach(c => c.classList.remove("invalido"));
  atualizarCampoBico();

  modal.showModal();
  form.modelo.focus();
}

function fecharModal() {
  modal.close();
  idEmEdicao = null;
}

function mostrarErroModal(mensagem, campo = null) {
  modalErro.textContent = mensagem;
  modalErro.hidden = false;
  if (campo) {
    campo.classList.add("invalido");
    campo.focus();
  }
}

// Converte "" -> null e texto -> número
function numeroOuNulo(valor) {
  if (valor === "" || valor == null) return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : NaN;
}

// Lê e valida o formulário. Retorna os campos ou null se algo estiver errado.
function lerFormulario() {
  form.querySelectorAll(".invalido").forEach(c => c.classList.remove("invalido"));
  modalErro.hidden = true;

  const campos = {
    modelo: form.modelo.value.trim(),
    tecnologia: form.tecnologia.value,
    bico: numeroOuNulo(form.bico.value),
    largura: numeroOuNulo(form.largura.value),
    profundidade: numeroOuNulo(form.profundidade.value),
    altura: numeroOuNulo(form.altura.value),
    materiais: form.materiais.value.trim(),
    obs: form.obs.value.trim()
  };

  if (!campos.modelo) {
    mostrarErroModal("Informe o modelo da impressora.", form.modelo);
    return null;
  }

  for (const nome of ["largura", "profundidade", "altura", "bico"]) {
    const valor = campos[nome];
    if (Number.isNaN(valor) || (valor !== null && valor <= 0)) {
      mostrarErroModal(`O campo "${nome}" precisa ser um número maior que zero.`, form[nome]);
      return null;
    }
  }

  if (campos.tecnologia === "Resina") campos.bico = null;
  return campos;
}

form.tecnologia.addEventListener("change", atualizarCampoBico);

form.addEventListener("submit", async e => {
  e.preventDefault();
  if (idEmEdicao == null) return;

  const campos = lerFormulario();
  if (!campos) return;

  const id = idEmEdicao;
  btnSalvar.disabled = true;
  btnSalvar.textContent = "Salvando...";

  try {
    const resposta = await atualizarImpressora(id, campos);

    // Se a API devolver a impressora atualizada, usa ela; senão usa o que foi enviado
    const atualizada = resposta && resposta.id ? resposta : campos;
    impressoras = impressoras.map(i => (i.id === id ? { ...i, ...atualizada, id } : i));

    fecharModal();
    renderizar(id);
    mostrarToast(`Impressora "${campos.modelo}" atualizada.`);
  } catch (erro) {
    mostrarErroModal(erro.message);
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.textContent = "Salvar alterações";
  }
});

// Botões "Cancelar" e "✕"
modal.querySelectorAll("[data-fechar]").forEach(b => b.addEventListener("click", fecharModal));

// Clicar fora da caixa fecha o modal
modal.addEventListener("click", e => {
  if (e.target === modal) fecharModal();
});

// Tecla Esc também limpa o estado
modal.addEventListener("cancel", () => { idEmEdicao = null; });

// ===== EVENTOS DA LISTA =====
lista.addEventListener("click", async e => {
  const botao = e.target.closest("button[data-acao]");
  if (!botao) return;

  const item = botao.closest(".impressora");
  const id = Number(item.dataset.id);
  const impressora = impressoras.find(i => i.id === id);
  if (!impressora) return;

  if (botao.dataset.acao === "detalhes") {
    const extra = item.querySelector(".impressora-extra");
    if (extra) {
      extra.remove();
      botao.textContent = "Detalhes";
    } else {
      const div = document.createElement("div");
      div.className = "impressora-extra";
      div.innerHTML = `
        <dl>
          <dt>Tecnologia:</dt><dd>${escapar(impressora.tecnologia)}</dd>
          <dt>Área de impressão:</dt><dd>${areaImpressao(impressora)}</dd>
          <dt>Bico:</dt><dd>${impressora.bico ? escapar(impressora.bico) + " mm" : "-"}</dd>
          <dt>Materiais:</dt><dd>${escapar(impressora.materiais) || "-"}</dd>
          <dt>Cadastrada em:</dt><dd>${formatarData(impressora.cadastro)}</dd>
          <dt>Voluntário:</dt><dd>${escapar(impressora.voluntarioNome)} (#${impressora.voluntarioId}, ${escapar(impressora.voluntarioStatus)})</dd>
          <dt>E-mail:</dt><dd>${escapar(impressora.voluntarioEmail) || "-"}</dd>
          <dt>Telefone:</dt><dd>${escapar(impressora.voluntarioTelefone) || "-"}</dd>
          <dt>Observações:</dt><dd>${escapar(impressora.obs) || "-"}</dd>
        </dl>
      `;
      item.appendChild(div);
      botao.textContent = "Fechar";
    }
  }

  if (botao.dataset.acao === "editar") {
    abrirModalEdicao(impressora);
  }

  if (botao.dataset.acao === "remover") {
    const ok = confirm(`Remover a impressora "${impressora.modelo}" de ${impressora.voluntarioNome}?\nEssa ação não pode ser desfeita.`);
    if (!ok) return;

    // Trava os botões do card enquanto remove
    item.querySelectorAll("button").forEach(b => (b.disabled = true));
    botao.textContent = "Removendo...";
    try {
      await removerImpressora(id);
      item.classList.add("saindo");
      setTimeout(() => {
        impressoras = impressoras.filter(i => i.id !== id);
        renderizar();
        mostrarToast(`Impressora "${impressora.modelo}" removida.`);
      }, 300);
    } catch (erro) {
      item.querySelectorAll("button").forEach(b => (b.disabled = false));
      botao.textContent = "Remover";
      mostrarToast(erro.message, true);
    }
  }
});

// ===== FILTROS =====
busca.addEventListener("input", () => renderizar());
filtroTecnologia.addEventListener("change", () => renderizar());
ordenar.addEventListener("change", () => renderizar());

// ===== DROPDOWNS DA NAVBAR =====
document.querySelectorAll(".dropdown > button").forEach(botao => {
  botao.addEventListener("click", e => {
    e.stopPropagation();
    const dropdown = botao.parentElement;
    const estavaAberto = dropdown.classList.contains("aberto");
    document.querySelectorAll(".dropdown.aberto").forEach(d => d.classList.remove("aberto"));
    if (!estavaAberto) dropdown.classList.add("aberto");
  });
});

document.addEventListener("click", () => {
  document.querySelectorAll(".dropdown.aberto").forEach(d => d.classList.remove("aberto"));
});

// Menu mobile
document.getElementById("menuToggle").addEventListener("click", e => {
  e.stopPropagation();
  document.getElementById("menu").classList.toggle("aberto");
});

// ===== INICIAR =====
async function iniciar() {
  try {
    impressoras = await buscarImpressoras();
    renderizar();
  } catch (erro) {
    contador.textContent = "";
    vazio.textContent = "Erro ao carregar as impressoras. Verifique se o backend está rodando.";
    vazio.hidden = false;
  }
}

iniciar();