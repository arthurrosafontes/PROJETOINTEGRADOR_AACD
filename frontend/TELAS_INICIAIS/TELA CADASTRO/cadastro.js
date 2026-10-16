/* =========================================================
   tela.js — comportamento da tela de cadastro
   (breadcrumb, máscaras, validações e navegação entre etapas)
   Depende de api.js, que precisa ser carregado antes.
   ========================================================= */

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const $ = id => document.getElementById(id);
const ufSelect = $("uf");
UFS.forEach(uf => ufSelect.add(new Option(uf, uf)));

/* ---------- Máscaras ---------- */
const digits = v => v.replace(/\D/g, "");
const masks = {
  cnpj: v => digits(v).slice(0,14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2"),
  telefone: v => {
    const d = digits(v).slice(0,11);
    if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
    return d.replace(/^(\d{2})(\d{5})(\d)/, "($1) $2-$3");
  },
  cep: v => digits(v).slice(0,8).replace(/^(\d{5})(\d)/, "$1-$2"),
};
Object.keys(masks).forEach(id => {
  $(id).addEventListener("input", e => { e.target.value = masks[id](e.target.value); });
});

/* ---------- Preenchimento do endereço pelo CEP ---------- */
const cepStatus = $("cepStatus");
$("cep").addEventListener("input", async e => {
  const cep = digits(e.target.value);
  if (cep.length !== 8) { cepStatus.textContent = ""; return; }
  cepStatus.textContent = "Buscando...";
  try {
    const endereco = await Api.buscarCep(cep);
    if (!endereco) throw new Error();
    $("rua").value = endereco.rua;
    $("bairro").value = endereco.bairro;
    $("cidade").value = endereco.cidade;
    $("uf").value = endereco.uf;
    cepStatus.textContent = "✓";
    setError($("cep"), "");
    $("numero").focus();
  } catch {
    cepStatus.textContent = "";
    setError($("cep"), "CEP não encontrado. Preencha o endereço manualmente.");
  }
});

/* ---------- Validação ---------- */
function setError(input, msg) {
  const span = input.closest(".field").querySelector(".error");
  span.textContent = msg;
  input.classList.toggle("invalid", !!msg);
  return !msg;
}

function cnpjValido(c) {
  c = digits(c);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = n => {
    let soma = 0, pos = n - 7;
    for (let i = n; i >= 1; i--) {
      soma += c[n - i] * pos--;
      if (pos < 2) pos = 9;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) == c[12] && calc(13) == c[13];
}

const rules = {
  0: [
    ["nome", v => v.trim().length >= 3 || "Informe o nome do voluntário."],
    ["email", v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || "Email inválido."],
    ["cnpj", v => cnpjValido(v) || "CNPJ inválido."],
    ["telefone", v => digits(v).length >= 10 || "Telefone inválido."],
  ],
  1: [
    ["cep", v => digits(v).length === 8 || "CEP inválido."],
    ["rua", v => v.trim() !== "" || "Informe a rua."],
    ["numero", v => v.trim() !== "" || "Informe o número."],
    ["bairro", v => v.trim() !== "" || "Informe o bairro."],
    ["cidade", v => v.trim() !== "" || "Informe a cidade."],
    ["uf", v => v !== "" || "Selecione a UF."],
  ],
  2: [
    ["senha", v => v.length >= 8 || "A senha precisa ter ao menos 8 caracteres."],
    ["confirmarSenha", v => v === $("senha").value || "As senhas não coincidem."],
  ],
};

function validarEtapa(n) {
  let ok = true;
  (rules[n] || []).forEach(([id, fn]) => {
    const r = fn($(id).value);
    if (!setError($(id), r === true ? "" : r)) ok = false;
  });
  return ok;
}

/* ---------- Navegação / breadcrumb ---------- */
let etapa = 0;
const total = 3;
const steps = document.querySelectorAll(".step");
const crumbs = document.querySelectorAll("#breadcrumb li");

function irPara(n) {
  etapa = n;
  $("erroEnvio").textContent = "";
  steps.forEach(s => s.classList.toggle("active", +s.dataset.step === n));
  crumbs.forEach(li => {
    const i = +li.dataset.step;
    li.classList.toggle("active", i === n);
    li.classList.toggle("done", i < n && n < total);
    li.querySelector("button").setAttribute("aria-current", i === n ? "step" : "false");
  });
  $("btnAnterior").style.visibility = n > 0 && n < total ? "visible" : "hidden";
  $("btnProximo").textContent = n === total - 1 ? "Cadastrar" : "Próximo";
  $("actions").style.display = n === total ? "none" : "flex";
  const first = steps[n].querySelector("input, select");
  if (first) first.focus();
}

crumbs.forEach(li => li.querySelector("button").addEventListener("click", () => {
  const i = +li.dataset.step;
  if (i < etapa) irPara(i); // só volta para etapas já concluídas
}));

$("btnAnterior").addEventListener("click", () => irPara(etapa - 1));

/* ---------- Envio ---------- */
$("form").addEventListener("submit", async e => {
  e.preventDefault();
  if (!validarEtapa(etapa)) return;
  if (etapa < total - 1) return irPara(etapa + 1);

  const dados = Object.fromEntries(
    [...$("form").querySelectorAll("input, select")]
      .filter(el => el.id !== "confirmarSenha")
      .map(el => [el.id, el.value])
  );

  const btn = $("btnProximo");
  btn.disabled = true;
  btn.textContent = "Enviando...";
  try {
    await Api.cadastrarVoluntario(dados);
    irPara(total);
  } catch (err) {
    $("erroEnvio").textContent = err.message || "Erro ao cadastrar. Tente novamente.";
  } finally {
    btn.disabled = false;
    if (etapa !== total) btn.textContent = "Cadastrar";
  }
});

/* ---------- Link voltar ---------- */
$("linkVoltar").addEventListener("click", e => {
  e.preventDefault();
  history.back();
});

irPara(0);