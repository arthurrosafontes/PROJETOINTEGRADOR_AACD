/* =========================================================
   telas/acesso.js — login (funcionário e voluntário),
   "esqueci a senha" e "mudança de senha"
   ========================================================= */
"use strict";

(() => {
  const { $, emailValido, mostrarToast, sessao } = AACD.util;

  // Marca/desmarca um campo como inválido e escreve a mensagem
  function erroCampo(campo, destino, texto) {
    campo.setAttribute("aria-invalid", texto ? "true" : "false");
    if (destino) destino.textContent = texto;
    return !texto;
  }

  // Login genérico usado pelas duas telas
  async function entrar({ form, email, senha, perfil, mensagem, destino }) {
    const botao = form.querySelector('button[type="submit"]');
    botao.disabled = true;
    botao.textContent = "Entrando...";
    try {
      const resultado = await AACD.api.login(email, senha, perfil);
      // A verificação de permissões também acontece no servidor.
      const usuario = resultado.usuario;
      if (!usuario || usuario.perfil !== perfil) {
        mensagem.textContent = perfil === "funcionario"
          ? "Esta conta não possui acesso de funcionário AACD."
          : "Esta conta não possui acesso de voluntário.";
        return;
      }
      sessao.salvar(usuario);
      form.reset();
      location.hash = destino;
    } catch (erro) {
      mensagem.textContent = erro.message;
    } finally {
      botao.disabled = false;
      botao.textContent = "Entrar";
    }
  }

  // ===== LOGIN DO FUNCIONÁRIO =====
  AACD.telas["tela-login-funcionario"] = {
    iniciar() {
      const form = $("form-login-funcionario");
      const email = $("lf-email");
      const senha = $("lf-senha");
      const mensagem = $("lf-mensagem");

      [email, senha].forEach(campo => campo.addEventListener("input", () => {
        mensagem.textContent = "";
        campo.removeAttribute("aria-invalid");
      }));

      form.addEventListener("submit", (evento) => {
        evento.preventDefault();
        mensagem.textContent = "";
        if (!emailValido(email.value)) {
          erroCampo(email, mensagem, "Informe um e-mail válido.");
          return email.focus();
        }
        if (!senha.value) {
          erroCampo(senha, mensagem, "Informe sua senha.");
          return senha.focus();
        }
        entrar({
          form, perfil: "funcionario", mensagem, destino: "#/funcionario",
          email: email.value.trim().toLowerCase(), senha: senha.value
        });
      });
    }
  };

  // ===== LOGIN DO VOLUNTÁRIO =====
  AACD.telas["tela-login-voluntario"] = {
    iniciar() {
      const form = $("form-login-voluntario");
      const email = $("lv-email");
      const senha = $("lv-senha");
      const erroEmail = $("lv-erro-email");
      const erroSenha = $("lv-erro-senha");
      const mensagem = $("lv-mensagem");

      email.addEventListener("input", () => { erroCampo(email, erroEmail, ""); mensagem.textContent = ""; });
      senha.addEventListener("input", () => { erroCampo(senha, erroSenha, ""); mensagem.textContent = ""; });

      form.addEventListener("submit", (evento) => {
        evento.preventDefault();
        mensagem.textContent = "";
        const okEmail = erroCampo(email, erroEmail, emailValido(email.value) ? "" : "Informe um e-mail válido.");
        const okSenha = erroCampo(senha, erroSenha, senha.value ? "" : "Informe sua senha.");
        if (!okEmail) return email.focus();
        if (!okSenha) return senha.focus();
        entrar({
          form, perfil: "voluntario", mensagem, destino: "#/voluntario/impressora/cadastrar",
          email: email.value.trim().toLowerCase(), senha: senha.value
        });
      });
    }
  };

  // ===== ESQUECI A SENHA (serve para os dois perfis) =====
  AACD.telas["tela-esqueci-senha"] = {
    iniciar() {
      const form = $("form-esqueci-senha");
      const email = $("es-email");
      const erro = $("es-erro");

      email.addEventListener("input", () => erroCampo(email, erro, ""));

      // O servidor ainda não tem a rota de envio de código.
      $("es-reenviar").addEventListener("click", () => {
        if (!erroCampo(email, erro, emailValido(email.value) ? "" : "Informe um e-mail válido.")) return email.focus();
        mostrarToast("O envio de código ainda não está disponível no servidor.");
      });

      form.addEventListener("submit", (evento) => {
        evento.preventDefault();
        if (!erroCampo(email, erro, emailValido(email.value) ? "" : "Informe um e-mail válido.")) return email.focus();
        form.reset();
        location.hash = "#/mudar-senha";
      });
    },
    // O link "voltar" leva ao login do perfil certo
    aoEntrar(_parametros, rota) {
      $("es-voltar").href = rota.startsWith("/funcionario") ? "#/funcionario/login" : "#/voluntario/login";
    }
  };

  // ===== MUDANÇA DE SENHA =====
  AACD.telas["tela-mudar-senha"] = {
    iniciar() {
      const form = $("form-mudar-senha");
      const senha = $("ms-senha");
      const confirmar = $("ms-confirmar");
      const erroSenha = $("ms-erro-senha");
      const erroConfirmar = $("ms-erro-confirmar");

      senha.addEventListener("input", () => erroCampo(senha, erroSenha, ""));
      confirmar.addEventListener("input", () => erroCampo(confirmar, erroConfirmar, ""));

      form.addEventListener("submit", (evento) => {
        evento.preventDefault();
        const okSenha = erroCampo(senha, erroSenha, senha.value.length >= 8 ? "" : "A senha precisa ter ao menos 8 caracteres.");
        const okConfirmar = erroCampo(confirmar, erroConfirmar, confirmar.value === senha.value ? "" : "As senhas não coincidem.");
        if (!okSenha) return senha.focus();
        if (!okConfirmar) return confirmar.focus();
        // O servidor ainda não tem a rota de troca de senha: por enquanto só volta ao início.
        form.reset();
        location.hash = "#/";
      });
    }
  };
})();
