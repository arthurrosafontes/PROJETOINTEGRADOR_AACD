// ===== DADOS DE EXEMPLO =====
// Depois você pode trocar isso por um fetch() para a sua API.
const pedidos = [
  { id: 1024, peca: "Órtese de punho", icone: "✋", material: "PLA", quantidade: 1, prazo: "2026-10-15", criado: "2026-10-08", prioridade: "Alta", tempo: "4h", obs: "Tamanho M, lado direito." },
  { id: 1023, peca: "Adaptador de talher", icone: "🍴", material: "PETG", quantidade: 3, prazo: "2026-10-20", criado: "2026-10-07", prioridade: "Média", tempo: "1h30", obs: "Cor azul, se possível." },
  { id: 1022, peca: "Mão protética infantil", icone: "🖐️", material: "PLA", quantidade: 1, prazo: "2026-10-14", criado: "2026-10-06", prioridade: "Alta", tempo: "12h", obs: "Escala 110%. Arquivo STL anexado ao pedido." },
  { id: 1021, peca: "Engrossador de lápis", icone: "✏️", material: "TPU", quantidade: 5, prazo: "2026-10-30", criado: "2026-10-05", prioridade: "Baixa", tempo: "45min", obs: "Material flexível obrigatório." },
  { id: 1020, peca: "Suporte para celular adaptado", icone: "📱", material: "PLA", quantidade: 2, prazo: "2026-10-25", criado: "2026-10-04", prioridade: "Média", tempo: "3h", obs: "Para uso em cadeira de rodas." },
  { id: 1019, peca: "Órtese de dedo", icone: "☝️", material: "PETG", quantidade: 2, prazo: "2026-11-02", criado: "2026-10-02", prioridade: "Baixa", tempo: "40min", obs: "Tamanhos P e M." },
];

const pesoPrioridade = { Alta: 3, Média: 2, Baixa: 1 };

// ===== ELEMENTOS =====
const lista = document.getElementById("listaPedidos");
const busca = document.getElementById("busca");
const filtroPrioridade = document.getElementById("filtroPrioridade");
const ordenar = document.getElementById("ordenar");
const contador = document.getElementById("contador");
const vazio = document.getElementById("vazio");
const toast = document.getElementById("toast");

// ===== FUNÇÕES =====
function formatarData(iso) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
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
      <div class="pedido-icone">${p.icone}</div>
      <div class="pedido-info">
        <div class="pedido-titulo">
          <h3>${p.peca}</h3>
          <span class="badge ${p.prioridade}">${p.prioridade}</span>
          <span class="pedido-codigo">#${p.id}</span>
        </div>
        <div class="pedido-detalhes">
          <span>Material: <strong>${p.material}</strong></span>
          <span>Qtd: <strong>${p.quantidade}</strong></span>
          <span>Tempo estimado: <strong>${p.tempo}</strong></span>
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
  const pedido = pedidos.find(p => p.id === id);

  if (botao.dataset.acao === "detalhes") {
    const extra = item.querySelector(".pedido-extra");
    if (extra) {
      extra.remove();
      botao.textContent = "Detalhes";
    } else {
      const div = document.createElement("div");
      div.className = "pedido-extra";
      div.innerHTML = `<strong>Observações:</strong> ${pedido.obs}<br><strong>Criado em:</strong> ${formatarData(pedido.criado)}`;
      item.appendChild(div);
      botao.textContent = "Fechar";
    }
  }

  if (botao.dataset.acao === "aceitar") {
    item.classList.add("saindo");
    setTimeout(() => {
      const indice = pedidos.findIndex(p => p.id === id);
      pedidos.splice(indice, 1);
      renderizar();
      mostrarToast(`Pedido #${id} aceito! Veja em "Meus pedidos".`);
    }, 300);
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
renderizar();