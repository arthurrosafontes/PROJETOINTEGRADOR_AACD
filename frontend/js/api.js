"use strict";

AACD.transporteApi = (() => {
  // Usa o mesmo nome de máquina da página (localhost ou 127.0.0.1). Assim o cookie
  // de login é aceito pelo navegador, que trata localhost e 127.0.0.1 como sites diferentes.
  const HOST = location.hostname || "localhost";
  const API_URL = `http://${HOST}:3000/api`;

  // Faz a requisição, converte a resposta em JSON e transforma
  // respostas de erro (4xx/5xx) em exceções com a mensagem do servidor.
  async function requisitar(caminho, { metodo = "GET", corpo, comCookie = false, erroPadrao } = {}) {
    const opcoes = { method: metodo, headers: {} };
    if (corpo instanceof FormData) {
      opcoes.body = corpo; // o navegador define o Content-Type (multipart) sozinho
    } else if (corpo !== undefined) {
      opcoes.headers["Content-Type"] = "application/json";
      opcoes.body = JSON.stringify(corpo);
    }
    if (comCookie) opcoes.credentials = "include";

    let resposta;
    try {
      resposta = await fetch(`${API_URL}${caminho}`, opcoes);
    } catch {
      throw new Error("Não foi possível conectar ao servidor. Verifique se o backend está rodando.");
    }

    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.erro || erroPadrao || "Erro ao comunicar com o servidor.");
    return dados;
  }

  return { API_URL, requisitar };
})();

AACD.api = {};
