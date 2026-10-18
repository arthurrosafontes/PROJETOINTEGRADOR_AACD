// =====================================================
// TELA: Pedidos Disponíveis (frontend)
// Este arquivo só cuida da tela. Os dados vêm da API
// (backend/server.js), que lê e grava no banco de dados.
// =====================================================

// Endereço da API. Troque se o backend rodar em outra porta/servidor.
const API_URL = "http://localhost:3000/api";

// Lista que vem da API. Formato de cada pedido:
// { id, peca, material, quantidade, prazo, criado, prioridade, tempo, obs }
let pedidos = [];

const pesoPrioridade = { Alta: 3, Média: 2, Baixa: 1 };

// ===== ELEMENTOS =====
const lista = document.getElementById("listaPedidos");
const busca = document.getElementById("busca");
const filtroPrioridade = document.getElementById("filtroPrioridade");
const ordenar = document.getElementById("ordenar");
const contador = document.getElementById("contador");
const vazio = document.getElementById("vazio");
const toast = document.getElementById("toast");

// ===== CHAMADAS À API =====
async function buscarDisponiveis() {
  const resposta = await fetch(`${API_URL}/disponiveis`);
  if (!resposta.ok) throw new Error("Não foi possível carregar os pedidos.");
  return resposta.json();
}

async function aceitarPedido(id) {
  const resposta = await fetch(`${API_URL}/disponiveis/${id}/aceitar`, { method: "PATCH" });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.erro || "Não foi possível aceitar o pedido.");
  return dados;
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

function filtrarPedidos() {
  const termo = busca.value.trim().toLowerCase();
  const prioridade = filtroPrioridade.value;

  let resultado = pedidos.filter(p => {
    const bateTexto = p.peca.toLowerCase().includes(termo) || String(p.id).includes(termo);
    const batePrioridade = prioridade === "todas" || p.prioridade === prioridade;
    return bateTexto && batePrioridade;
  });

  if (ordenar.value === "recentes") resultado.sort((a, b) => b.criado.localeCompare(a.criado));
  if (ordenar.value === "antigos") resultado.sort((a, b) => a.criado.localeCompare(b.criado));
  if (ordenar.value === "prioridade") resultado.sort((a, b) => pesoPrioridade[b.prioridade] - pesoPrioridade[a.prioridade]);

  return resultado;
}

function renderizar() {
  const itens = filtrarPedidos();
  lista.innerHTML = "";

  itens.forEach(p => {
    const li = document.createElement("li");
    li.className = "pedido";
    li.dataset.id = p.id;
    li.innerHTML = `
      <div class="pedido-info">
        <div class="pedido-titulo">
          <h3>${escapar(p.peca)}</h3>
          <span class="badge ${escapar(p.prioridade)}">${escapar(p.prioridade)}</span>
          <span class="pedido-codigo">#${p.id}</span>
        </div>
        <div class="pedido-detalhes">
          <span>Material: <strong>${escapar(p.material)}</strong></span>
          <span>Qtd: <strong>${p.quantidade}</strong></span>
          <span>Tempo estimado: <strong>${escapar(p.tempo)}</strong></span>
          <span>Prazo: <strong>${formatarData(p.prazo)}</strong></span>
        </div>
      </div>
      <div class="pedido-acoes">
        <button class="btn btn-secundario" data-acao="detalhes">Detalhes</button>
        <button class="btn btn-primario" data-acao="aceitar">Aceitar</button>
      </div>
    `;
    lista.appendChild(li);
  });

  contador.textContent = `${itens.length} pedido(s) disponível(is)`;
  vazio.textContent = "Nenhum pedido encontrado.";
  vazio.hidden = itens.length > 0;
}

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

  const item = botao.closest(".pedido");
  const id = Number(item.dataset.id);
  const pedido = pedidos.find(p => p.id === id);

  if (botao.dataset.acao === "detalhes") {
    const extra = item.querySelector(".pedido-extra");
    if (extra) {
      extra.remove();
      botao.textContent = "Detalhes";
    } else {
      const div = document.createElement("div");
      div.className = "pedido-extra";
      div.innerHTML = `<strong>Observações:</strong> ${escapar(pedido.obs) || "-"}<br><strong>Criado em:</strong> ${formatarData(pedido.criado)}`;
      item.appendChild(div);
      botao.textContent = "Fechar";
    }
  }

  if (botao.dataset.acao === "aceitar") {
    botao.disabled = true;
    botao.textContent = "Aceitando...";
    try {
      await aceitarPedido(id);
      item.classList.add("saindo");
      setTimeout(() => {
        pedidos = pedidos.filter(p => p.id !== id);
        renderizar();
        mostrarToast(`Pedido #${id} aceito! Veja em "Meus pedidos".`);
      }, 300);
    } catch (erro) {
      botao.disabled = false;
      botao.textContent = "Aceitar";
      mostrarToast(erro.message);
    }
  }
});

// ===== FILTROS =====
busca.addEventListener("input", renderizar);
filtroPrioridade.addEventListener("change", renderizar);
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
    pedidos = await buscarDisponiveis();
    renderizar();
  } catch (erro) {
    contador.textContent = "";
    vazio.textContent = "Erro ao carregar os pedidos. Verifique se o backend está rodando.";
    vazio.hidden = false;
  }
}

iniciar();