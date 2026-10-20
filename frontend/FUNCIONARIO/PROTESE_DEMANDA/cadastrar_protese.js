// =====================================================
// TELA: Cadastro de demanda (frontend)
// Este arquivo só cuida da tela. As próteses cadastradas e a
// publicação da demanda passam pela API (backend/server.js).
// O rascunho continua no navegador (localStorage), porque é
// só de quem está preenchendo.
// =====================================================

// Endereço da API. Troque se o backend rodar em outra porta/servidor.
const API_URL = "http://localhost:3000/api";

// ===== PRÓTESES JÁ CADASTRADAS =====
// Vêm da API. Formato de cada uma:
// { id, codigo, nome, tipo, regiao, filamento, bico, largura, profundidade, altura, horas, minutos }
// (bico, horas e minutos podem vir null: o banco ainda não guarda esses dados)
let protesesCadastradas = [];

// ===== CONFIGURAÇÃO DAS ETAPAS =====
// Cada etapa lista os campos obrigatórios que precisam ser validados antes de avançar.
const etapasConfig = [
  { nome: "Identificação da Demanda", campos: ["nome", "quantidade"] },
  { nome: "Informações Gerais", campos: ["tipo", "regiao", "paciente", "prioridade"] },
  { nome: "Especificações de Impressão", campos: ["filamento", "bico", "largura", "profundidade", "altura", "tempoHoras"] },
  { nome: "Entrega", campos: ["prazo", "formaEntrega", "unidade", "responsavel"] },
];

// Campos que são salvos no rascunho
const camposRascunho = [
  "nome", "protese", "quantidade",
  "tipo", "regiao", "paciente", "prioridade", "observacoes",
  "filamento", "bico", "largura", "profundidade", "altura", "tempoHoras", "tempoMinutos",
  "prazo", "formaEntrega", "unidade", "responsavel", "instrucoes",
];

// Campos de medida (precisam ser maiores que zero)
const camposMedida = ["largura", "profundidade", "altura"];

let etapaAtual = 0;
let etapaMaxima = 0; // etapa mais avançada que o usuário já alcançou
let publicando = false;

// ===== ELEMENTOS =====
const form = document.getElementById("formDemanda");
const passos = document.querySelectorAll(".passo");
const botoesEtapa = document.querySelectorAll(".etapa");
const btnProximo = document.getElementById("btnProximo");
const btnRascunho = document.getElementById("btnRascunho");
const btnCancelar = document.getElementById("btnCancelar");
const btnVoltar = document.getElementById("btnVoltar");
const tituloEtapa = document.getElementById("tituloEtapa");
const toast = document.getElementById("toast");
const selectProtese = document.getElementById("protese");

// ===== CHAMADAS À API =====
async function buscarProteses() {
  const resposta = await fetch(`${API_URL}/proteses`);
  if (!resposta.ok) throw new Error("Não foi possível carregar as próteses.");
  return resposta.json();
}

async function enviarDemanda(demanda) {
  const resposta = await fetch(`${API_URL}/demandas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(demanda),
  });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.erro || "Não foi possível publicar a demanda.");
  return dados; // demanda salva, já com id
}

// ===== FUNÇÕES =====
function valor(id) {
  return document.getElementById(id).value.trim();
}

function hojeISO() {
  const hoje = new Date();
  hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
  return hoje.toISOString().slice(0, 10);
}

// Tempo total de impressão em minutos
function tempoTotalMin() {
  const h = Number(document.getElementById("tempoHoras").value) || 0;
  const m = Number(document.getElementById("tempoMinutos").value) || 0;
  return h * 60 + m;
}

function campoValido(id) {
  const campo = document.getElementById(id);
  let ok = campo.value.trim() !== "";

  if (id === "paciente") ok = /^PAC-\d{3,}$/i.test(campo.value.trim());
  if (id === "quantidade" && ok) ok = Number.isInteger(Number(campo.value)) && Number(campo.value) > 0;
  if (camposMedida.includes(id) && ok) ok = Number(campo.value) > 0;
  if (id === "prazo" && ok) ok = campo.value >= hojeISO();

  // Tempo estimado: horas + minutos (o campo "tempoHoras" valida os dois)
  if (id === "tempoHoras") {
    const h = Number(campo.value);
    const m = Number(document.getElementById("tempoMinutos").value) || 0;
    ok = h >= 0 && m >= 0 && m < 60 && tempoTotalMin() > 0;
  }

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
  btnProximo.textContent = ultima ? "Publicar demanda" : "Próximo →";
  btnVoltar.hidden = indice === 0;            // "Voltar" só aparece a partir da etapa 2
  tituloEtapa.textContent = etapasConfig[indice].nome; // título dentro do cartão

  const primeiroCampo = passos[indice].querySelector("input, select, textarea");
  if (primeiroCampo) primeiroCampo.focus();
}

// ===== PRÓTESES CADASTRADAS =====
function carregarProteses() {
  const atual = selectProtese.value;
  selectProtese.innerHTML = '<option value="">Selecione uma prótese cadastrada</option>';
  protesesCadastradas.forEach(p => {
    const opcao = document.createElement("option");
    opcao.value = p.id;
    opcao.textContent = `${p.codigo || p.id} — ${p.nome}`;
    selectProtese.appendChild(opcao);
  });
  selectProtese.value = atual;
}

// Coloca um valor num campo. Se for um <select> que não tem essa opção
// (ex: região "Cotovelo" vinda do banco), a opção é criada na hora.
function definirCampo(id, valorNovo) {
  const campo = document.getElementById(id);
  const texto = valorNovo === null || valorNovo === undefined ? "" : String(valorNovo);

  if (campo.tagName === "SELECT" && texto !== "" &&
      ![...campo.options].some(o => o.value === texto)) {
    const opcao = document.createElement("option");
    opcao.value = texto;
    opcao.textContent = texto;
    campo.appendChild(opcao);
  }

  campo.value = texto;
  campo.closest(".campo").classList.remove("invalido");
}

// Preenche os campos da peça com os dados da prótese escolhida (tudo continua editável)
function preencherComProtese(id) {
  const p = protesesCadastradas.find(item => String(item.id) === String(id));
  if (!p) return;

  definirCampo("tipo", p.tipo);
  definirCampo("regiao", p.regiao);
  definirCampo("filamento", p.filamento);
  definirCampo("bico", p.bico);
  definirCampo("largura", p.largura);
  definirCampo("profundidade", p.profundidade);
  definirCampo("altura", p.altura);
  definirCampo("tempoHoras", p.horas);
  definirCampo("tempoMinutos", p.minutos);

  if (!valor("nome")) document.getElementById("nome").value = `Demanda – ${p.nome}`;

  // O banco ainda não guarda bico nem tempo de impressão: avisa o que falta preencher
  const faltam = [];
  if (p.bico === null || p.bico === undefined) faltam.push("bico");
  if (p.horas === null || p.horas === undefined) faltam.push("tempo de impressão");
  mostrarToast(faltam.length
    ? `Dados de "${p.nome}" preenchidos. Falta informar: ${faltam.join(" e ")}.`
    : `Dados de "${p.nome}" preenchidos.`);
}

// Junta os dados do formulário. O id e a data de criação quem define é a API.
function montarDemanda() {
  const arquivo = document.getElementById("arquivo").files[0];
  return {
    nome: valor("nome"),
    proteseId: valor("protese"),
    quantidade: Number(valor("quantidade")),
    tipo: valor("tipo"),
    regiao: valor("regiao"),
    paciente: valor("paciente").toUpperCase(),
    prioridade: valor("prioridade"),
    arquivo: arquivo ? arquivo.name : "",
    observacoes: valor("observacoes"),
    impressao: {
      filamento: valor("filamento"),
      bico: Number(valor("bico")),            // mm
      largura: Number(valor("largura")),      // mm
      profundidade: Number(valor("profundidade")), // mm
      altura: Number(valor("altura")),        // mm
      tempoEstimadoMin: tempoTotalMin(),      // minutos por unidade
    },
    entrega: {
      prazo: valor("prazo"),
      forma: valor("formaEntrega"),
      local: valor("unidade"),
      responsavel: valor("responsavel"),
      instrucoes: valor("instrucoes"),
    },
  };
}

// ===== RASCUNHO (fica só neste navegador) =====
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
    etapaMaxima = Math.min(rascunho.etapa || 0, etapasConfig.length - 1);
    mostrarToast("Rascunho carregado.");
  } catch (e) {
    // Sem rascunho salvo: começa vazio
  }
}

function apagarRascunho() {
  try { localStorage.removeItem("rascunhoDemanda"); } catch (e) {}
}

// ===== PUBLICAR =====
async function publicar() {
  if (publicando) return;
  publicando = true;
  btnProximo.disabled = true;
  btnProximo.textContent = "Publicando...";

  try {
    const salva = await enviarDemanda(montarDemanda());

    apagarRascunho();
    mostrarToast(`Demanda "${salva.nome}" publicada para os voluntários!`);
    form.reset();
    document.querySelectorAll(".invalido").forEach(c => c.classList.remove("invalido"));
    etapaMaxima = 0;
    irParaEtapa(0);
  } catch (erro) {
    mostrarToast(erro.message);
    btnProximo.textContent = "Publicar demanda";
  } finally {
    publicando = false;
    btnProximo.disabled = false;
  }
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

// "Cancelar" sempre volta para o hub; "Voltar" volta uma etapa
btnCancelar.addEventListener("click", () => {
  window.location.href = "/frontend/HUB_FUNCIONARIO/tela_hub_funcionario.html";
});

btnVoltar.addEventListener("click", () => {
  if (etapaAtual > 0) irParaEtapa(etapaAtual - 1);
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
  if (container && container.classList.contains("invalido")) {
    // horas e minutos são validados juntos pelo campo "tempoHoras"
    campoValido(e.target.id === "tempoMinutos" ? "tempoHoras" : e.target.id);
  }
});

// Ao escolher uma prótese cadastrada, preenche os dados da peça
selectProtese.addEventListener("change", () => preencherComProtese(selectProtese.value));

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
async function iniciar() {
  try {
    protesesCadastradas = await buscarProteses();
  } catch (erro) {
    mostrarToast("Não foi possível carregar as próteses cadastradas.");
  }
  carregarProteses();   // o rascunho pode ter uma prótese escolhida, então carrega antes
  carregarRascunho();
  irParaEtapa(0);
}

iniciar();