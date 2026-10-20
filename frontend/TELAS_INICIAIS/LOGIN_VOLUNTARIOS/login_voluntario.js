const form = document.getElementById('formLogin');
const email = document.getElementById('email');
const senha = document.getElementById('senha');
const erroEmail = document.getElementById('erroEmail');
const erroSenha = document.getElementById('erroSenha');
const erroLogin = document.getElementById('erroLogin');
const botao = form.querySelector('button[type="submit"]');

function erro(campo, destino, texto) {
  campo.classList.add('invalido');
  destino.textContent = texto;
}
function limpar(campo, destino) {
  campo.classList.remove('invalido');
  destino.textContent = '';
  erroLogin.textContent = '';
}
email.addEventListener('input', () => limpar(email, erroEmail));
senha.addEventListener('input', () => limpar(senha, erroSenha));

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  erroLogin.textContent = '';
  let valido = true;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    erro(email, erroEmail, 'Informe um e-mail válido.'); valido = false;
  }
  if (!senha.value) {
    erro(senha, erroSenha, 'Informe sua senha.'); valido = false;
  }
  if (!valido) return;
  botao.disabled = true;
  botao.textContent = 'Entrando...';
  try {
    const resposta = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value.trim(), senha: senha.value, perfil: 'voluntario' })
    });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível entrar.');
    // A tela de destino ainda precisará consultar /api/auth/me para proteger os recursos.
    window.location.href = '/frontend/VOLUNTARIO/CADASTRAR_IMPRESSORA/tela_cadastrar_impressora.html';
  } catch (e) {
    erroLogin.textContent = e.message || 'Falha de conexão com a API.';
  } finally {
    botao.disabled = false;
    botao.textContent = 'Entrar';
  }
});
