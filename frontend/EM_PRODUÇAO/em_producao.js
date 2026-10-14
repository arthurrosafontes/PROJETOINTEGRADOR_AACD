// ===== DADOS DE EXEMPLO =====
// Depois você pode trocar isso por um fetch() para a sua API.
const producao = [
  { id: 1018, paciente: "Ana Lima", peca: "Prótese de dedo", entrega: "2026-10-05", material: "PLA", impressora: "Ender 3 V2", progresso: 70, obs: "Tamanho P, mão esquerda." },
  { id: 1015, paciente: "Beatriz Rocha", peca: "Prótese de mão", entrega: "2026-10-08", material: "PETG", impressora: "Bambu Lab P1S", progresso: 45, obs: "Escala 105%." },
  { id: 1012, paciente: "João Pereira", peca: "Prótese de antebraço", entrega: "2026-10-12", material: "PLA", impressora: "Ender 3 V2", progresso: 85, obs: "Imprimir em duas partes." },
  { id: 1010, paciente: "Maria Souza", peca: "Prótese de mão", entrega: "2026-10-30", material: "PLA", impressora: "Bambu Lab P1S", progresso: 20, obs: "Cor azul, se possível." },
  { id: 1008, paciente: "Lucas Oliveira", peca: "Prótese de braço", entrega: "2026-11-02", material: "PETG", impressora: "Ender 3 V2", progresso: 10, obs: "Arquivo STL anexado ao pedido." },
  { id: 1005, paciente: "Carlos Mendes", peca: "Órtese de punho", entrega: "2026-11-15", material: "TPU", impressora: "Bambu Lab P1S", progresso: 0, obs: "Material flexível obrigatório." },
];

// ===== ELEMENTOS =====
const lista = document.getElementById("listaProducao");
const busca = document.getElementById("busca");
const vazio = document.getElementById("vazio");
const toast = document.getElementById("toast");

// ===== FUNÇÕES =====
function formatarData(iso) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

// Diferença em dias entre hoje e a data de entrega (negativo = atrasado)
function diasParaEntrega(iso) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const entrega = new Date(ano, mes - 1, dia);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((entrega - hoje) / 86400000);
}

function textoStatus(dias) {
  if (dias < 0) return { texto: `Atrasado ${Math.abs(dias)} dia${Math.abs(dias) > 1 ? "s" : ""}`, classe: "atrasado" };
  if (dias === 0) return { texto: "Entrega hoje", classe: "hoje" };
  return { texto: `Falta${dias > 1 ? "m" : ""} ${dias} dia${dias > 1 ? "s" : ""}`, classe: "" };
}

function filtrarProducao() {
  const termo = busca.value.trim().toLowerCase();
  return producao
    .filter(p => p.paciente.toLowerCase().includes(termo))
    .sort((a, b) => a.entrega.localeCompare(b.entrega)); // mais urgentes primeiro
}

function renderizar() {
  const itens = filtrarProducao();
  lista.innerHTML = "";

  itens.forEach(p => {
    const status = textoStatus(diasParaEntrega(p.entrega));
    const li = document.createElement("li");
    li.className = "item-producao";
    li.dataset.id = p.id;
    li.innerHTML = `
      <div class="item-info">
        <h3>${p.paciente}</h3>
        <p>${p.peca}</p>
      </div>
      <div class="item-prazo">
        Entrega: ${formatarData(p.entrega)}
        <span class="item-status ${status.classe}">${status.texto}</span>
      </div>
      <button class="btn btn-secundario" data-acao="detalhes">Ver detalhes</button>
    `;
    lista.appendChild(li);
  });

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

  const item = botao.closest(".item-producao");
  const id = Number(item.dataset.id);
  const peca = producao.find(p => p.id === id);

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
          <dt>Pedido:</dt><dd>#${peca.id}</dd>
          <dt>Material:</dt><dd>${peca.material}</dd>
          <dt>Impressora:</dt><dd>${peca.impressora}</dd>
          <dt>Progresso:</dt><dd>${peca.progresso}%</dd>
          <dt>Observações:</dt><dd>${peca.obs}</dd>
        </dl>
        <button class="btn btn-primario" data-acao="concluir">Marcar como impressa</button>
      `;
      item.appendChild(div);
      botao.textContent = "Fechar";
    }
  }

  if (botao.dataset.acao === "concluir") {
    const indice = producao.findIndex(p => p.id === id);
    producao.splice(indice, 1);
    renderizar();
    mostrarToast(`Peça de ${peca.paciente} enviada para "Aguardando envio".`);
  }
});

// ===== BUSCA =====
busca.addEventListener("input", renderizar);

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