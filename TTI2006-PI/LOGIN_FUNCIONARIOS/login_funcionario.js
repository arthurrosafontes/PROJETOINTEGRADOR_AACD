const form = document.getElementById("formLogin");
const campoEmail = document.getElementById("email");
const campoSenha = document.getElementById("senha");
const mensagem = document.getElementById("mensagem");
const botaoEntrar = form.querySelector(".botao-entrar");
const esqueciSenha = document.getElementById("esqueciSenha");

// Página para onde o funcionário vai depois de entrar (ajuste conforme seu projeto)
const PAGINA_APOS_LOGIN = "painel-funcionario.html";

function mostrarErro(texto, campo) {
  mensagem.textContent = texto;
  if (campo) {
    campo.classList.add("erro");
    campo.focus();
  }
}

function limparErros() {
  mensagem.textContent = "";
  campoEmail.classList.remove("erro");
  campoSenha.classList.remove("erro");
}

// Limpa o erro assim que a pessoa volta a digitar
[campoEmail, campoSenha].forEach((campo) => {
  campo.addEventListener("input", () => {
    campo.classList.remove("erro");
    mensagem.textContent = "";
  });
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  limparErros();

  const email = campoEmail.value.trim();
  const senha = campoSenha.value;

  if (!email) {
    return mostrarErro("Informe seu email AACD.", campoEmail);
  }
  if (!campoEmail.checkValidity()) {
    return mostrarErro("Digite um email válido.", campoEmail);
  }
  if (!senha) {
    return mostrarErro("Digite sua senha.", campoSenha);
  }

  // Aqui entra a chamada ao seu servidor para validar o login.
  // Por enquanto, apenas simula o envio e redireciona.
  botaoEntrar.disabled = true;
  botaoEntrar.textContent = "Entrando...";

  setTimeout(() => {
    window.location.href = PAGINA_APOS_LOGIN;
  }, 800);
});

esqueciSenha.addEventListener("click", (e) => {
  e.preventDefault();
  const email = campoEmail.value.trim();

  if (!email || !campoEmail.checkValidity()) {
    return mostrarErro("Digite seu email acima para recuperar a senha.", campoEmail);
  }

  mensagem.textContent = `Enviamos as instruções de recuperação para ${email}.`;
});