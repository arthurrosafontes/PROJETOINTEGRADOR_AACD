// =====================================================
// TELA: Pedidos Aceitos (frontend)
// Este arquivo só cuida da tela. Os dados vêm da API
// (backend/), que lê e grava no banco de dados.
// =====================================================

// Endereço da API. Troque se o backend rodar em outra porta/servidor.
const API_URL = "http://localhost:3000/api";

// Lista que vem da API. Formato de cada pedido:
// { id, produto, categoria, status, aceito_em, material, prazo, obs }
// status: "Pendente" | "Em produção" | "Concluído" | "Recusado"
let pedidos = [];
let statusSelecionado = "todos";

// Classe CSS do badge de cada status
const classeStatus = {
  "Pendente": "pendente",
  "Em produção": "producao",
  "Concluído": "concluido",
  "Recusado": "recusado",
};

// ===== ELEMENTOS =====
const lista = document.getElementById("listaPedidos");
const busca = document.getElementById("busca");
const abas = document.querySelectorAll(".aba");
const vazio = document.getElementById("vazio");
const toast = document.getElementById("toast");

// ===== CHAMADAS À API =====
async function buscarPedidos() {
  const resposta = await fetch(`${API_URL}/pedidos`);
  if (!resposta.ok) throw new Error("Não foi possível carregar os pedidos.");
  return resposta.json();
}

async function aceitarPedido(id) {
  const resposta = await fetch(`${API_URL}/pedidos/${id}/aceitar`, { method: "PATCH" });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.erro || "Não foi possível aceitar o pedido.");
  return dados; // pedido já atualizado
}

async function recusarPedido(id) {
  const resposta = await fetch(`${API_URL}/pedidos/${id}/recusar`, { method: "PATCH" });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.erro || "Não foi possível recusar o pedido.");
  return dados; // pedido já atualizado
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
  return pedidos.filter(p => {
    const bateTexto =
      String(p.id).includes(termo) ||
      p.produto.toLowerCase().includes(termo) ||
      p.categoria.toLowerCase().includes(termo);
    const bateStatus = statusSelecionado === "todos" || p.status === statusSelecionado;
    return bateTexto && bateStatus;
  });
}

function atualizarContadores() {
  document.querySelectorAll("[data-contador]").forEach(span => {
    const status = span.dataset.contador;
    span.textContent = status === "todos"
      ? pedidos.length
      : pedidos.filter(p => p.status === status).length;
  });
}

function renderizar() {
  const itens = filtrarPedidos();
  lista.innerHTML = "";

  itens.forEach(p => {
    // Os botões "Aceitar" e "Recusar" só aparecem nos pedidos pendentes
    const botoesDecisao = p.status === "Pendente"
      ? `<button class="btn btn-primario" data-acao="aceitar">Aceitar</button>
         <button class="btn btn-recusar" data-acao="recusar">Recusar</button>`
      : "";

    const li = document.createElement("li");
    li.className = "item-pedido";
    li.dataset.id = p.id;
    li.innerHTML = `
      <div class="item-info">
        <h3>Pedido #${p.id}</h3>
        <p>${escapar(p.produto)} · ${escapar(p.categoria)}</p>
      </div>
      <div class="item-data">
        Aceito em ${formatarData(p.aceito_em)}
        <span class="badge ${classeStatus[p.status] || ""}">${escapar(p.status)}</span>
      </div>
      <div class="item-acoes">
        ${botoesDecisao}
        <button class="btn btn-secundario" data-acao="detalhes">Ver detalhes</button>
      </div>
    `;
    lista.appendChild(li);
  });

  vazio.classList.remove("erro");
  vazio.textContent = "Nenhum pedido encontrado.";
  vazio.hidden = itens.length > 0;
  atualizarContadores();
}

function selecionarStatus(status) {
  statusSelecionado = status;
  abas.forEach(a => a.classList.toggle("ativa", a.dataset.status === status));
  renderizar();
}

function mostrarToast(mensagem, erro = false) {
  toast.textContent = mensagem;
  toast.classList.toggle("erro", erro);
  toast.classList.add("visivel");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("visivel"), 2500);
}

// ===== EVENTOS DA LISTA =====
lista.addEventListener("click", async e => {
  const botao = e.target.closest("button[data-acao]");
  if (!botao) return;

  const item = botao.closest(".item-pedido");
  const id = Number(item.dataset.id);
  const pedido = pedidos.find(p => p.id === id);

  if (botao.dataset.acao === "aceitar") {
    botao.disabled = true;
    botao.textContent = "Aceitando...";
    try {
      const atualizado = await aceitarPedido(id);
      Object.assign(pedido, atualizado);
      renderizar();
      mostrarToast(`Pedido #${id} aceito.`);
    } catch (erro) {
      botao.disabled = false;
      botao.textContent = "Aceitar";
      mostrarToast(erro.message, true);
    }
  }

  if (botao.dataset.acao === "recusar") {
    if (!confirm(`Tem certeza que deseja recusar o pedido #${id}?`)) return;

    botao.disabled = true;
    botao.textContent = "Recusando...";
    try {
      const atualizado = await recusarPedido(id);
      Object.assign(pedido, atualizado);
      renderizar();
      mostrarToast(`Pedido #${id} recusado.`);
    } catch (erro) {
      botao.disabled = false;
      botao.textContent = "Recusar";
      mostrarToast(erro.message, true);
    }
  }

  if (botao.dataset.acao === "detalhes") {
    const extra = item.querySelector(".item-extra");
    if (extra) {
      extra.remove();
      botao.textContent = "Ver detalhes";
    } else {
      const div = document.createElement("div");
      div.className = "item-extra";
      div.innerHTML = `
        <dl>
          <dt>Produto:</dt><dd>${escapar(pedido.produto)}</dd>
          <dt>Categoria:</dt><dd>${escapar(pedido.categoria)}</dd>
          <dt>Material:</dt><dd>${escapar(pedido.material) || "-"}</dd>
          <dt>Prazo:</dt><dd>${formatarData(pedido.prazo)}</dd>
          <dt>Observações:</dt><dd>${escapar(pedido.obs) || "-"}</dd>
        </dl>
      `;
      item.appendChild(div);
      botao.textContent = "Fechar";
    }
  }
});

// ===== FILTROS =====
busca.addEventListener("input", renderizar);
abas.forEach(aba => aba.addEventListener("click", () => selecionarStatus(aba.dataset.status)));

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

document.getElementById("menuToggle").addEventListener("click", e => {
  e.stopPropagation();
  document.getElementById("menu").classList.toggle("aberto");
});

// ===== INICIAR =====
async function iniciar() {
  try {
    pedidos = await buscarPedidos();
    renderizar();
  } catch (erro) {
    vazio.textContent = "Erro ao carregar os pedidos. Verifique se o backend está rodando.";
    vazio.classList.add("erro");
    vazio.hidden = false;
  }
}

iniciar();