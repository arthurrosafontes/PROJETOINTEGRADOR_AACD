const form = document.getElementById('formLogin');
const email = document.getElementById('email');
const senha = document.getElementById('senha');
const erroEmail = document.getElementById('erroEmail');
const erroSenha = document.getElementById('erroSenha');

function mostrarErro(campo, elementoErro, mensagem) {
  campo.classList.add('invalido');
  elementoErro.textContent = mensagem;
}

function limparErro(campo, elementoErro) {
  campo.classList.remove('invalido');
  elementoErro.textContent = '';
}

email.addEventListener('input', () => limparErro(email, erroEmail));
senha.addEventListener('input', () => limparErro(senha, erroSenha));

form.addEventListener('submit', (evento) => {
  let valido = true;
  const valorEmail = email.value.trim();

  if (valorEmail === '') {
    mostrarErro(email, erroEmail, 'Informe seu e-mail.');
    valido = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valorEmail)) {
    mostrarErro(email, erroEmail, 'E-mail inválido.');
    valido = false;
  }

  if (senha.value === '') {
    mostrarErro(senha, erroSenha, 'Informe sua senha.');
    valido = false;
  }

  // Só bloqueia o envio se tiver erro
  if (!valido) evento.preventDefault();
});
