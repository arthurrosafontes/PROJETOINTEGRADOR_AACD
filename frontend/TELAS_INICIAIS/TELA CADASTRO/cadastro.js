const form = document.getElementById("form-cadastro");
const mensagem = document.getElementById("mensagem");

const campos = {
  nome: document.getElementById("nome"),
  email: document.getElementById("email"),
  cnpj: document.getElementById("cnpj"),
  endereco: document.getElementById("endereco"),
  telefone: document.getElementById("telefone"),
  senha: document.getElementById("senha"),
  confirmarSenha: document.getElementById("confirmarSenha"),
};

/* ---------- Máscaras ---------- */

const soDigitos = (valor) => valor.replace(/\D/g, "");

function mascaraCNPJ(valor) {
  return soDigitos(valor)
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function mascaraTelefone(valor) {
  const d = soDigitos(valor).slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

campos.cnpj.addEventListener("input", (e) => {
  e.target.value = mascaraCNPJ(e.target.value);
});

campos.telefone.addEventListener("input", (e) => {
  e.target.value = mascaraTelefone(e.target.value);
});

/* ---------- Validações ---------- */

function cnpjValido(cnpj) {
  const n = soDigitos(cnpj);
  if (n.length !== 14 || /^(\d)\1+$/.test(n)) return false;

  const calcDigito = (base) => {
    let pesos = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split("").reduce((acc, dig, i) => acc + dig * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const d1 = calcDigito(n.slice(0, 12));
  const d2 = calcDigito(n.slice(0, 12) + d1);
  return n.endsWith(`${d1}${d2}`);
}

const regras = {
  nome: (v) => {
    const nome = v.trim();
    if (!nome) return "Informe o nome do voluntário.";
    if (nome.length < 3) return "O nome deve ter pelo menos 3 letras.";
    if (!/^[A-Za-zÀ-ÿ' -]+$/.test(nome)) return "Use apenas letras no nome.";
    return "";
  },
  email: (v) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? "" : "Informe um email válido.",
  cnpj: (v) => (cnpjValido(v) ? "" : "CNPJ inválido."),
  endereco: (v) => (v.trim().length >= 5 ? "" : "Informe o endereço."),
  telefone: (v) => {
    const d = soDigitos(v).length;
    return d === 10 || d === 11 ? "" : "Telefone incompleto.";
  },
  senha: (v) => (v.length >= 6 ? "" : "A senha deve ter pelo menos 6 caracteres."),
  confirmarSenha: (v) =>
    v && v === campos.senha.value ? "" : "As senhas não conferem.",
};

function validarCampo(nomeCampo) {
  const input = campos[nomeCampo];
  const erro = regras[nomeCampo](input.value);
  const span = document.querySelector(`[data-erro-de="${nomeCampo}"]`);
  span.textContent = erro;
  input.classList.toggle("invalido", Boolean(erro));
  return !erro;
}

// Valida ao sair do campo e limpa o erro enquanto digita
Object.keys(campos).forEach((nomeCampo) => {
  campos[nomeCampo].addEventListener("blur", () => validarCampo(nomeCampo));
  campos[nomeCampo].addEventListener("input", () => {
    if (campos[nomeCampo].classList.contains("invalido")) validarCampo(nomeCampo);
  });
});

/* ---------- Envio ---------- */

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  mensagem.textContent = "";

  const tudoValido = Object.keys(campos)
    .map(validarCampo)
    .every(Boolean);

  if (!tudoValido) {
    mensagem.textContent = "Corrija os campos destacados.";
    return;
  }

  const dados = {
    nome: campos.nome.value.trim(),
    email: campos.email.value.trim(),
    cnpj: soDigitos(campos.cnpj.value),
    endereco: campos.endereco.value.trim(),
    telefone: soDigitos(campos.telefone.value),
    senha: campos.senha.value,
  };

  // TODO: trocar pela URL da sua API
  // try {
  //   const resp = await fetch("/api/voluntarios", {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify(dados),
  //   });
  //   if (!resp.ok) throw new Error();
  // } catch {
  //   mensagem.textContent = "Erro ao cadastrar. Tente novamente.";
  //   return;
  // }

  console.log("Cadastro enviado:", { ...dados, senha: "***" });
  mensagem.textContent = `Cadastro de ${dados.nome} realizado com sucesso!`;
  form.reset();
});

/* ---------- Voltar ---------- */

document.getElementById("voltar").addEventListener("click", (e) => {
  e.preventDefault();
  history.back();
});