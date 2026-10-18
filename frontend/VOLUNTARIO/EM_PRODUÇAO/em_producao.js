// =====================================================
// TELA: Em Produção (frontend)
// Este arquivo só cuida da tela. Os dados vêm da API
// (backend/server.js), que lê e grava no banco de dados.
// =====================================================

// Endereço da API. Troque se o backend rodar em outra porta/servidor.
const API_URL = "http://localhost:3000/api";

// Lista que vem da API. Formato de cada peça:
// { id, paciente, peca, status, entrega, enviado, concluido, material, impressora, progresso, obs }
// status: "Em produção" | "Aguardando validação" | "Concluída"
let producao = [];

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

// ===== CHAMADAS À API =====
async function buscarProducao() {
  const resposta = await fetch(`${API_URL}/producao`);
  if (!resposta.ok) throw new Error("Não foi possível carregar as peças.");
  return resposta.json();
}

async function enviarParaValidacao(id) {
  const resposta = await fetch(`${API_URL}/producao/${id}/enviar`, { method: "PATCH" });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.erro || "Não foi possível enviar a peça.");
  return dados; // peça já atualizada
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
          <h3>${escapar(p.paciente)}</h3>
          <span class="badge ${infoStatus[p.status].classe}">${escapar(p.status)}</span>
        </div>
        <p>${escapar(p.peca)}</p>
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
  vazio.textContent = "Nenhuma peça encontrada.";
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
lista.addEventListener("click", async e => {
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
          <dt>Material:</dt><dd>${escapar(peca.material) || "-"}</dd>
          <dt>Impressora:</dt><dd>${escapar(peca.impressora) || "-"}</dd>
          <dt>Progresso:</dt><dd>${peca.progresso}%</dd>
          <dt>Prazo:</dt><dd>${formatarData(peca.entrega)}</dd>
          <dt>Observações:</dt><dd>${escapar(peca.obs) || "-"}</dd>
        </dl>
        ${botaoEnviar}
      `;
      item.appendChild(div);
      botao.textContent = "Fechar";
    }
  }

  if (botao.dataset.acao === "enviar") {
    botao.disabled = true;
    botao.textContent = "Enviando...";
    try {
      const atualizada = await enviarParaValidacao(id);
      Object.assign(peca, atualizada);
      renderizar();
      mostrarToast(`Peça de ${peca.paciente} enviada para validação.`);
    } catch (erro) {
      botao.disabled = false;
      botao.textContent = "Enviar para validação";
      mostrarToast(erro.message);
    }
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
async function iniciar() {
  try {
    producao = await buscarProducao();
    selecionarStatus(statusDoEndereco());
  } catch (erro) {
    vazio.textContent = "Erro ao carregar as peças. Verifique se o backend está rodando.";
    vazio.hidden = false;
  }
}

iniciar();