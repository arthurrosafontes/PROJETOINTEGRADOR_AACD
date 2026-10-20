const form = document.getElementById("formLogin");
const campoEmail = document.getElementById("email");
const campoSenha = document.getElementById("senha");
const mensagem = document.getElementById("mensagem");
const botaoEntrar = form.querySelector(".card-form__botao");

const API_LOGIN = "http://localhost:3000/api/auth/login";
const PAGINA_APOS_LOGIN = "/frontend/FUNCIONARIO/HUB_FUNCIONARIO/tela_hub_funcionario.html";

function mostrarErro(texto) {
  mensagem.textContent = texto;
}

[campoEmail, campoSenha].forEach(campo => {
  campo.addEventListener("input", () => mostrarErro(""));
});

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarErro("");

  const email = campoEmail.value.trim().toLowerCase();
  const senha = campoSenha.value;

  if (!email || !campoEmail.checkValidity()) {
    mostrarErro("Informe um e-mail válido.");
    campoEmail.focus();
    return;
  }
  if (!senha) {
    mostrarErro("Informe sua senha.");
    campoSenha.focus();
    return;
  }

  botaoEntrar.disabled = true;
  botaoEntrar.textContent = "Entrando...";

  try {
    const resposta = await fetch(API_LOGIN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, senha, perfil: "funcionario" })
    });

    const resultado = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      throw new Error(resultado.erro || "Não foi possível fazer login.");
    }

    // A verificação de permissões precisa acontecer também no servidor.
    const usuario = resultado.usuario;
if (!usuario || usuario.perfil !== "funcionario") {
    mostrarErro("Esta conta não possui acesso de funcionário AACD.");
    return;
}
    window.location.href = PAGINA_APOS_LOGIN;
  } catch (erro) {
    mostrarErro(erro.message || "Erro ao conectar ao servidor.");
  } finally {
    botaoEntrar.disabled = false;
    botaoEntrar.textContent = "Entrar";
  }
});
