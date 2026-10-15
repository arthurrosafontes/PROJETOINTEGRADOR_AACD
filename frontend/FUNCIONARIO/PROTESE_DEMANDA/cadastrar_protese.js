// ===== CONFIGURAÇÃO DAS ETAPAS =====
// Cada etapa lista os campos obrigatórios que precisam ser validados antes de avançar.
const etapasConfig = [
  { nome: "Identificação da Demanda", campos: ["nome"] },
  { nome: "Informações Gerais", campos: ["tipo", "regiao", "paciente", "quantidade", "prioridade"] },
  { nome: "Entrega", campos: ["prazo", "formaEntrega", "unidade", "responsavel"] },
];

// Campos que são salvos no rascunho
const camposRascunho = ["nome", "tipo", "regiao", "paciente", "quantidade", "prioridade", "material", "observacoes", "prazo", "formaEntrega", "unidade", "responsavel", "instrucoes"];

let etapaAtual = 0;
let etapaMaxima = 0; // etapa mais avançada que o usuário já alcançou

// ===== ELEMENTOS =====
const form = document.getElementById("formDemanda");
const passos = document.querySelectorAll(".passo");
const botoesEtapa = document.querySelectorAll(".etapa");
const btnProximo = document.getElementById("btnProximo");
const btnRascunho = document.getElementById("btnRascunho");
const btnCancelar = document.getElementById("btnCancelar");
const toast = document.getElementById("toast");

// ===== FUNÇÕES =====
function valor(id) {
  return document.getElementById(id).value.trim();
}

function hojeISO() {
  const hoje = new Date();
  hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
  return hoje.toISOString().slice(0, 10);
}

function campoValido(id) {
  const campo = document.getElementById(id);
  let ok = campo.value.trim() !== "";

  if (id === "paciente") ok = /^PAC-\d{3,}$/i.test(campo.value.trim());
  if (id === "quantidade" && ok) ok = Number(campo.value) > 0;
  if (id === "prazo" && ok) ok = campo.value >= hojeISO();

  campo.closest(".campo").classList.toggle("invalido", !ok);
  return ok;
}

function validarEtapa(indice) {
  let primeiroInvalido = null;

  etapasConfig[indice].campos.forEach(id => {
    if (!campoValido(id) && !primeiroInvalido) primeiroInvalido = document.getElementById(id);
  });

  if (primeiroInvalido) primeiroInvalido.focus();
  return !primeiroInvalido;
}

function irParaEtapa(indice) {
  etapaAtual = indice;
  etapaMaxima = Math.max(etapaMaxima, indice);

  passos.forEach((p, i) => p.classList.toggle("ativo", i === indice));

  botoesEtapa.forEach((b, i) => {
    b.classList.toggle("ativa", i === indice);
    b.classList.toggle("concluida", i < etapaMaxima && i !== indice);
    b.disabled = i > etapaMaxima;
  });

  const ultima = indice === etapasConfig.length - 1;
  btnProximo.textContent = ultima ? "Publicar demanda" : "Próximo";
  btnCancelar.textContent = indice === 0 ? "Cancelar" : "Voltar";

  const primeiroCampo = passos[indice].querySelector("input, select, textarea");
  if (primeiroCampo) primeiroCampo.focus();
}

function montarDemanda() {
  const arquivo = document.getElementById("arquivo").files[0];
  return {
    id: Date.now(),
    nome: valor("nome"),
    tipo: valor("tipo"),
    regiao: valor("regiao"),
    paciente: valor("paciente").toUpperCase(),
    quantidade: Number(valor("quantidade")),
    prioridade: valor("prioridade"),
    material: valor("material"),
    arquivo: arquivo ? arquivo.name : "",
    observacoes: valor("observacoes"),
    entrega: {
      prazo: valor("prazo"),
      forma: valor("formaEntrega"),
      unidade: valor("unidade"),
      responsavel: valor("responsavel"),
      instrucoes: valor("instrucoes"),
    },
    criado: hojeISO(),
  };
}

function salvarRascunho() {
  const rascunho = { etapa: etapaMaxima };
  camposRascunho.forEach(id => rascunho[id] = document.getElementById(id).value);
  try {
    localStorage.setItem("rascunhoDemanda", JSON.stringify(rascunho));
    mostrarToast("Rascunho salvo.");
  } catch (e) {
    mostrarToast("Não foi possível salvar o rascunho.");
  }
}

function carregarRascunho() {
  try {
    const rascunho = JSON.parse(localStorage.getItem("rascunhoDemanda"));
    if (!rascunho) return;
    camposRascunho.forEach(id => {
      if (rascunho[id] !== undefined) document.getElementById(id).value = rascunho[id];
    });
    etapaMaxima = rascunho.etapa || 0;
    mostrarToast("Rascunho carregado.");
  } catch (e) {
    // Sem rascunho salvo: começa vazio
  }
}

function apagarRascunho() {
  try { localStorage.removeItem("rascunhoDemanda"); } catch (e) {}
}

function publicar() {
  const demanda = montarDemanda();

  // Depois você pode trocar isso por um fetch() para a sua API, por exemplo:
  // fetch("/api/demandas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(demanda) })
  try {
    const salvas = JSON.parse(localStorage.getItem("demandas") || "[]");
    salvas.push(demanda);
    localStorage.setItem("demandas", JSON.stringify(salvas));
  } catch (e) {
    console.warn("Não foi possível salvar no navegador.", e);
  }

  apagarRascunho();
  mostrarToast(`Demanda "${demanda.nome}" publicada para os voluntários!`);
  form.reset();
  document.querySelectorAll(".invalido").forEach(c => c.classList.remove("invalido"));
  etapaMaxima = 0;
  irParaEtapa(0);
}

// Mostra um aviso rápido na parte de baixo da tela. Ex: mostrarToast("Salvo!");
function mostrarToast(mensagem) {
  toast.textContent = mensagem;
  toast.classList.add("visivel");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("visivel"), 2500);
}

// ===== EVENTOS DO FORMULÁRIO =====
btnProximo.addEventListener("click", () => {
  if (!validarEtapa(etapaAtual)) return;
  if (etapaAtual === etapasConfig.length - 1) publicar();
  else irParaEtapa(etapaAtual + 1);
});

btnRascunho.addEventListener("click", salvarRascunho);

// Na primeira etapa "Cancelar" volta para o hub; nas outras vira "Voltar"
btnCancelar.addEventListener("click", () => {
  if (etapaAtual > 0) irParaEtapa(etapaAtual - 1);
  else window.location.href = "/frontend/HUB_FUNCIONARIO/tela_hub_funcionario.html";
});

// Clicar no nome da etapa (só nas que já foram alcançadas)
botoesEtapa.forEach(botao => {
  botao.addEventListener("click", () => {
    const destino = Number(botao.dataset.etapa);
    if (destino > etapaMaxima) return;
    if (destino > etapaAtual && !validarEtapa(etapaAtual)) return;
    irParaEtapa(destino);
  });
});

// Enter avança para a próxima etapa (menos dentro de textarea)
form.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "file") {
    e.preventDefault();
    btnProximo.click();
  }
});

// Remove o aviso de erro assim que o usuário corrige o campo
form.addEventListener("input", e => {
  const container = e.target.closest(".campo");
  if (container && container.classList.contains("invalido")) campoValido(e.target.id);
});

// Código do paciente sempre em maiúsculo
document.getElementById("paciente").addEventListener("input", e => {
  e.target.value = e.target.value.toUpperCase();
});

// Não deixa escolher prazo no passado
document.getElementById("prazo").min = hojeISO();

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
carregarRascunho();
irParaEtapa(0);