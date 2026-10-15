// ===== DADOS DE EXEMPLO =====
// Depois você pode trocar isso por um fetch() para a sua API.
// O paciente aparece só pelo código, para proteger a privacidade.
const pedidosAceitos = [
  { id: 1024, produto: "Órtese de punho", regiao: "Membro superior", aceito: "2026-10-09", status: "Pendente", paciente: "PAC-0842", material: "PLA", quantidade: 1, prazo: "2026-10-20", obs: "Tamanho M, lado direito." },
  { id: 1025, produto: "Prótese ortopédica", regiao: "Membro inferior", aceito: "2026-10-08", status: "Em produção", paciente: "PAC-0517", material: "PETG", quantidade: 1, prazo: "2026-10-25", obs: "Imprimir em duas partes." },
  { id: 1026, produto: "Palmilha ortopédica", regiao: "Apoio plantar", aceito: "2026-10-06", status: "Concluído", paciente: "PAC-0233", material: "TPU", quantidade: 2, prazo: "2026-10-12", obs: "Par completo, tamanho 38." },
];

// Classe CSS de cada status
const classeStatus = { "Pendente": "pendente", "Em produção": "producao", "Concluído": "concluido" };

let statusSelecionado = "todos";

// ===== ELEMENTOS =====
const lista = document.getElementById("listaPedidos");
const busca = document.getElementById("busca");
const abas = document.querySelectorAll(".aba");
const vazio = document.getElementById("vazio");
const toast = document.getElementById("toast");

// ===== FUNÇÕES =====
function formatarData(iso) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function filtrarPedidos() {
  const termo = busca.value.trim().toLowerCase().replace("#", "");

  return pedidosAceitos
    .filter(p => {
      const bateTexto = String(p.id).includes(termo) || p.produto.toLowerCase().includes(termo);
      const bateStatus = statusSelecionado === "todos" || p.status === statusSelecionado;
      return bateTexto && bateStatus;
    })
    .sort((a, b) => b.aceito.localeCompare(a.aceito)); // aceitos mais recentes primeiro
}

function atualizarContadores() {
  document.querySelectorAll("[data-contador]").forEach(span => {
    const status = span.dataset.contador;
    span.textContent = status === "todos"
      ? pedidosAceitos.length
      : pedidosAceitos.filter(p => p.status === status).length;
  });
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
        <h3>Pedido #${p.id}</h3>
        <p>${p.produto} · ${p.regiao}</p>
      </div>
      <div class="pedido-data">
        <span>Aceito em ${formatarData(p.aceito)}</span>
        <span class="badge ${classeStatus[p.status]}">${p.status}</span>
      </div>
      <button class="btn btn-secundario" data-acao="detalhes">Ver detalhes</button>
    `;
    lista.appendChild(li);
  });

  atualizarContadores();
  vazio.hidden = itens.length > 0;
}

function mostrarToast(mensagem) {
  toast.textContent = mensagem;
  toast.classList.add("visivel");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("visivel"), 2500);
}

// ===== EVENTOS DA LISTA =====
lista.addEventListener("click", e => {
  const botao = e.target.closest("button[data-acao]");
  if (!botao) return;

  const item = botao.closest(".pedido");
  const id = Number(item.dataset.id);
  const pedido = pedidosAceitos.find(p => p.id === id);

  if (botao.dataset.acao === "detalhes") {
    const extra = item.querySelector(".pedido-extra");
    if (extra) {
      extra.remove();
      botao.textContent = "Ver detalhes";
    } else {
      const div = document.createElement("div");
      div.className = "pedido-extra";
      div.innerHTML = `
        <dl>
          <dt>Paciente:</dt><dd>${pedido.paciente}</dd>
          <dt>Material:</dt><dd>${pedido.material}</dd>
          <dt>Quantidade:</dt><dd>${pedido.quantidade}</dd>
          <dt>Prazo:</dt><dd>${formatarData(pedido.prazo)}</dd>
          <dt>Observações:</dt><dd>${pedido.obs}</dd>
        </dl>
      `;
      item.appendChild(div);
      botao.textContent = "Fechar";
    }
  }
});

// ===== FILTROS =====
busca.addEventListener("input", renderizar);

abas.forEach(aba => {
  aba.addEventListener("click", () => {
    abas.forEach(a => a.classList.remove("ativa"));
    aba.classList.add("ativa");
    statusSelecionado = aba.dataset.status;
    renderizar();
  });
});

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
renderizar();