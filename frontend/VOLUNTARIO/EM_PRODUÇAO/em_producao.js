// ===== DADOS DE EXEMPLO =====
// Depois você pode trocar isso por um fetch() para a sua API.
// status: "Em produção" | "Aguardando validação" | "Concluída"
// enviado: data em que a peça foi enviada para a equipe validar
// concluido: data em que a equipe aprovou a peça
const producao = [
  { id: 1018, paciente: "Ana Lima", peca: "Prótese de dedo", status: "Em produção", entrega: "2026-10-05", material: "PLA", impressora: "Ender 3 V2", progresso: 70, obs: "Tamanho P, mão esquerda." },
  { id: 1015, paciente: "Beatriz Rocha", peca: "Prótese de mão", status: "Em produção", entrega: "2026-10-08", material: "PETG", impressora: "Bambu Lab P1S", progresso: 45, obs: "Escala 105%." },
  { id: 1012, paciente: "João Pereira", peca: "Prótese de antebraço", status: "Em produção", entrega: "2026-10-12", material: "PLA", impressora: "Ender 3 V2", progresso: 85, obs: "Imprimir em duas partes." },
  { id: 1010, paciente: "Maria Souza", peca: "Prótese de mão", status: "Em produção", entrega: "2026-10-30", material: "PLA", impressora: "Bambu Lab P1S", progresso: 20, obs: "Cor azul, se possível." },
  { id: 1008, paciente: "Lucas Oliveira", peca: "Prótese de braço", status: "Em produção", entrega: "2026-11-02", material: "PETG", impressora: "Ender 3 V2", progresso: 10, obs: "Arquivo STL anexado ao pedido." },
  { id: 1005, paciente: "Carlos Mendes", peca: "Órtese de punho", status: "Em produção", entrega: "2026-11-15", material: "TPU", impressora: "Bambu Lab P1S", progresso: 0, obs: "Material flexível obrigatório." },
  { id: 1003, paciente: "Paula Nunes", peca: "Adaptador de talher", status: "Aguardando validação", entrega: "2026-10-20", enviado: "2026-10-13", material: "PETG", impressora: "Ender 3 V2", progresso: 100, obs: "Três unidades, cor azul." },
  { id: 1001, paciente: "Rodrigo Silva", peca: "Órtese de dedo", status: "Aguardando validação", entrega: "2026-10-22", enviado: "2026-10-14", material: "PLA", impressora: "Bambu Lab P1S", progresso: 100, obs: "Tamanhos P e M." },
  { id: 998, paciente: "Mariana Alves", peca: "Palmilha ortopédica", status: "Concluída", entrega: "2026-10-10", enviado: "2026-10-06", concluido: "2026-10-09", material: "TPU", impressora: "Ender 3 V2", progresso: 100, obs: "Par completo, tamanho 38." },
  { id: 995, paciente: "Tiago Santos", peca: "Engrossador de lápis", status: "Concluída", entrega: "2026-10-03", enviado: "2026-09-29", concluido: "2026-10-01", material: "TPU", impressora: "Bambu Lab P1S", progresso: 100, obs: "Cinco unidades." },
];

// Título, texto e classe CSS de cada status
const infoStatus = {
  "todos": { titulo: "Minha Produção", subtitulo: "Todas as peças que você imprimiu ou está imprimindo." },
  "Em produção": { titulo: "Em Produção", subtitulo: "Peças que você está imprimindo agora.", classe: "producao" },
  "Aguardando validação": { titulo: "Aguardando Validação", subtitulo: "Peças impressas que a equipe da AACD está conferindo.", classe: "validacao" },
  "Concluída": { titulo: "Concluídas", subtitulo: "Peças aprovadas pela equipe. Obrigado pela ajuda!", classe: "concluida" },
};

// Endereço (#) de cada aba, para os links do menu abrirem a aba certa
const hashPorStatus = {
  "todos": "todos",
  "Em produção": "em-producao",
  "Aguardando validação": "aguardando-validacao",
  "Concluída": "concluidas",
};

let statusSelecionado = "Em produção";

// ===== ELEMENTOS =====
const lista = document.getElementById("listaProducao");
const busca = document.getElementById("busca");
const abas = document.querySelectorAll(".aba");
const titulo = document.getElementById("titulo");
const subtitulo = document.getElementById("subtitulo");
const vazio = document.getElementById("vazio");
const toast = document.getElementById("toast");

// ===== FUNÇÕES =====
function formatarData(iso) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function hojeISO() {
  const hoje = new Date();
  hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
  return hoje.toISOString().slice(0, 10);
}

// Diferença em dias entre hoje e a data de entrega (negativo = atrasado)
function diasParaEntrega(iso) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const entrega = new Date(ano, mes - 1, dia);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((entrega - hoje) / 86400000);
}

// Texto da direita do card, que muda conforme o status da peça
function textoPrazo(p) {
  if (p.status === "Aguardando validação") {
    return { linha: `Enviada em: ${formatarData(p.enviado)}`, texto: "Em análise pela equipe", classe: "validacao" };
  }
  if (p.status === "Concluída") {
    return { linha: `Concluída em: ${formatarData(p.concluido)}`, texto: "Validada pela AACD", classe: "concluida" };
  }

  const dias = diasParaEntrega(p.entrega);
  const linha = `Entrega: ${formatarData(p.entrega)}`;
  if (dias < 0) return { linha, texto: `Atrasado ${Math.abs(dias)} dia${Math.abs(dias) > 1 ? "s" : ""}`, classe: "atrasado" };
  if (dias === 0) return { linha, texto: "Entrega hoje", classe: "hoje" };
  return { linha, texto: `Falta${dias > 1 ? "m" : ""} ${dias} dia${dias > 1 ? "s" : ""}`, classe: "" };
}

function filtrarProducao() {
  const termo = busca.value.trim().toLowerCase();
  return producao
    .filter(p => {
      const bateTexto = p.paciente.toLowerCase().includes(termo);
      const bateStatus = statusSelecionado === "todos" || p.status === statusSelecionado;
      return bateTexto && bateStatus;
    })
    .sort((a, b) => a.entrega.localeCompare(b.entrega)); // mais urgentes primeiro
}

function atualizarContadores() {
  document.querySelectorAll("[data-contador]").forEach(span => {
    const status = span.dataset.contador;
    span.textContent = status === "todos"
      ? producao.length
      : producao.filter(p => p.status === status).length;
  });
}

function renderizar() {
  const itens = filtrarProducao();
  lista.innerHTML = "";

  itens.forEach(p => {
    const prazo = textoPrazo(p);
    const li = document.createElement("li");
    li.className = "item-producao";
    li.dataset.id = p.id;
    li.innerHTML = `
      <div class="item-info">
        <div class="item-titulo">
          <h3>${p.paciente}</h3>
          <span class="badge ${infoStatus[p.status].classe}">${p.status}</span>
        </div>
        <p>${p.peca}</p>
      </div>
      <div class="item-prazo">
        ${prazo.linha}
        <span class="item-status ${prazo.classe}">${prazo.texto}</span>
      </div>
      <button class="btn btn-secundario" data-acao="detalhes">Ver detalhes</button>
    `;
    lista.appendChild(li);
  });

  titulo.textContent = infoStatus[statusSelecionado].titulo;
  subtitulo.textContent = infoStatus[statusSelecionado].subtitulo;
  atualizarContadores();
  vazio.hidden = itens.length > 0;
}

function selecionarStatus(status) {
  statusSelecionado = status;
  abas.forEach(a => a.classList.toggle("ativa", a.dataset.status === status));
  history.replaceState(null, "", "#" + hashPorStatus[status]);
  renderizar();
}

// Mostra um aviso rápido na parte de baixo da tela. Ex: mostrarToast("Salvo!");
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
      // Só as peças em produção podem ser enviadas para validação
      const botaoEnviar = peca.status === "Em produção"
        ? `<button class="btn btn-primario" data-acao="enviar">Enviar para validação</button>`
        : "";
      const div = document.createElement("div");
      div.className = "item-extra";
      div.innerHTML = `
        <dl>
          <dt>Pedido:</dt><dd>#${peca.id}</dd>
          <dt>Material:</dt><dd>${peca.material}</dd>
          <dt>Impressora:</dt><dd>${peca.impressora}</dd>
          <dt>Progresso:</dt><dd>${peca.progresso}%</dd>
          <dt>Prazo:</dt><dd>${formatarData(peca.entrega)}</dd>
          <dt>Observações:</dt><dd>${peca.obs}</dd>
        </dl>
        ${botaoEnviar}
      `;
      item.appendChild(div);
      botao.textContent = "Fechar";
    }
  }

  if (botao.dataset.acao === "enviar") {
    peca.status = "Aguardando validação";
    peca.enviado = hojeISO();
    peca.progresso = 100;
    renderizar();
    mostrarToast(`Peça de ${peca.paciente} enviada para validação.`);
  }
});

// ===== FILTROS =====
busca.addEventListener("input", renderizar);

abas.forEach(aba => {
  aba.addEventListener("click", () => selecionarStatus(aba.dataset.status));
});

// Abre a aba que veio no endereço (ex: tela_em_producao.html#concluidas)
function statusDoEndereco() {
  const hash = location.hash.replace("#", "");
  return Object.keys(hashPorStatus).find(s => hashPorStatus[s] === hash) || "Em produção";
}
window.addEventListener("hashchange", () => selecionarStatus(statusDoEndereco()));

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
selecionarStatus(statusDoEndereco());