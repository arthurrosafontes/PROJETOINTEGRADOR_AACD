// =====================================================
// TELA: Voluntários (frontend)
// Este arquivo só cuida da tela. Os dados vêm da API
// (backend/server.js), que lê e grava no banco de dados.
// =====================================================

// Endereço da API. Troque se o backend rodar em outra porta/servidor.
const API_URL = "http://localhost:3000/api";

// Lista que vem da API. Formato de cada voluntário:
// { id, nome, cidade, status, impressoras, materiais, entregues, emProducao, email, telefone, cadastro }
// status: "Pendente" | "Ativo" | "Inativo"
let voluntarios = [];

// Texto do botão e do aviso de cada status.
// (Qual é o próximo status quem decide é a API.)
const acaoPorStatus = {
  Pendente: { texto: "Aprovar", aviso: "aprovado(a)" },
  Ativo: { texto: "Desativar", aviso: "desativado(a)" },
  Inativo: { texto: "Reativar", aviso: "reativado(a)" },
};

// ===== ELEMENTOS =====
const lista = document.getElementById("listaVoluntarios");
const busca = document.getElementById("busca");
const filtroStatus = document.getElementById("filtroStatus");
const ordenar = document.getElementById("ordenar");
const contador = document.getElementById("contador");
const vazio = document.getElementById("vazio");
const toast = document.getElementById("toast");

// ===== CHAMADAS À API =====
async function buscarVoluntarios() {
  const resposta = await fetch(`${API_URL}/voluntarios`);
  if (!resposta.ok) throw new Error("Não foi possível carregar os voluntários.");
  return resposta.json();
}

async function mudarStatus(id) {
  const resposta = await fetch(`${API_URL}/voluntarios/${id}/status`, { method: "PATCH" });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.erro || "Não foi possível mudar o status.");
  return dados; // voluntário já atualizado
}

// ===== FUNÇÕES DA TELA =====
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

// "Rafael Martins" -> "RM"
function iniciais(nome) {
  const partes = nome.trim().split(" ");
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

function filtrarVoluntarios() {
  const termo = busca.value.trim().toLowerCase();
  const status = filtroStatus.value;

  let resultado = voluntarios.filter(v => {
    const bateTexto = v.nome.toLowerCase().includes(termo) || (v.cidade || "").toLowerCase().includes(termo);
    const bateStatus = status === "todos" || v.status === status;
    return bateTexto && bateStatus;
  });

  if (ordenar.value === "nome") resultado.sort((a, b) => a.nome.localeCompare(b.nome));
  if (ordenar.value === "entregas") resultado.sort((a, b) => b.entregues - a.entregues);
  if (ordenar.value === "recentes") resultado.sort((a, b) => b.cadastro.localeCompare(a.cadastro));

  return resultado;
}

function renderizar() {
  const itens = filtrarVoluntarios();
  lista.innerHTML = "";

  itens.forEach(v => {
    const acao = acaoPorStatus[v.status];
    const li = document.createElement("li");
    li.className = `voluntario ${v.status}`;
    li.dataset.id = v.id;
    li.innerHTML = `
      <div class="voluntario-iniciais">${escapar(iniciais(v.nome))}</div>
      <div class="voluntario-info">
        <div class="voluntario-titulo">
          <h3>${escapar(v.nome)}</h3>
          <span class="badge ${v.status}">${escapar(v.status)}</span>
          <span class="voluntario-codigo">#${v.id}</span>
        </div>
        <div class="voluntario-detalhes">
          <span>Cidade: <strong>${escapar(v.cidade)}</strong></span>
          <span>Peças entregues: <strong>${v.entregues}</strong></span>
          <span>Em produção: <strong>${v.emProducao}</strong></span>
          <span>Desde: <strong>${formatarData(v.cadastro)}</strong></span>
        </div>
      </div>
      <div class="voluntario-acoes">
        <button class="btn btn-secundario" data-acao="detalhes">Detalhes</button>
        <button class="btn btn-primario" data-acao="status">${acao.texto}</button>
      </div>
    `;
    lista.appendChild(li);
  });

  contador.textContent = `${itens.length} voluntário(s) encontrado(s)`;
  vazio.textContent = "Nenhum voluntário encontrado.";
  vazio.hidden = itens.length > 0;
}

// Mostra um aviso rápido na parte de baixo da tela. Ex: mostrarToast("Salvo!");
function mostrarToast(mensagem) {
  toast.textContent = mensagem;
  toast.classList.add("visivel");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("visivel"), 2500);
}

// ===== EVENTOS DA LISTA =====
lista.addEventListener("click", async e => {
  const botao = e.target.closest("button[data-acao]");
  if (!botao) return;

  const item = botao.closest(".voluntario");
  const id = Number(item.dataset.id);
  const voluntario = voluntarios.find(v => v.id === id);

  if (botao.dataset.acao === "detalhes") {
    const extra = item.querySelector(".voluntario-extra");
    if (extra) {
      extra.remove();
      botao.textContent = "Detalhes";
    } else {
      const div = document.createElement("div");
      div.className = "voluntario-extra";
      div.innerHTML = `
        <dl>
          <dt>E-mail:</dt><dd>${escapar(voluntario.email) || "-"}</dd>
          <dt>Telefone:</dt><dd>${escapar(voluntario.telefone) || "-"}</dd>
          <dt>Impressoras:</dt><dd>${escapar(voluntario.impressoras) || "-"}</dd>
          <dt>Materiais:</dt><dd>${escapar(voluntario.materiais) || "-"}</dd>
        </dl>
      `;
      item.appendChild(div);
      botao.textContent = "Fechar";
    }
  }

  if (botao.dataset.acao === "status") {
    const acao = acaoPorStatus[voluntario.status];
    const textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.textContent = "Salvando...";
    try {
      const atualizado = await mudarStatus(id);
      Object.assign(voluntario, atualizado);
      renderizar();
      mostrarToast(`${voluntario.nome} foi ${acao.aviso}.`);
    } catch (erro) {
      botao.disabled = false;
      botao.textContent = textoOriginal;
      mostrarToast(erro.message);
    }
  }
});

// ===== FILTROS =====
busca.addEventListener("input", renderizar);
filtroStatus.addEventListener("change", renderizar);
ordenar.addEventListener("change", renderizar);

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
    voluntarios = await buscarVoluntarios();
    renderizar();
  } catch (erro) {
    contador.textContent = "";
    vazio.textContent = "Erro ao carregar os voluntários. Verifique se o backend está rodando.";
    vazio.hidden = false;
  }
}

iniciar();