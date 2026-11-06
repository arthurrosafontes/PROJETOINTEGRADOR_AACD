// A rota de publicação guarda nome, paciente, entrega etc. no campo "observacoes",
// uma informação por linha ("Rótulo: valor"). Aqui essas linhas viram campos.
const ROTULOS_OBS = {
  nome: 'Nome da demanda',
  paciente: 'Paciente',
  formaEntrega: 'Forma de entrega',
  responsavel: 'Responsável',
  instrucoes: 'Instruções',
  observacoes: 'Observações'
};

function lerObservacoes(texto) {
  const campos = {};
  const linhas = String(texto || '').split('\n');
  let atual = null;
  for (const linha of linhas) {
    const chave = Object.keys(ROTULOS_OBS).find(k => linha.startsWith(`${ROTULOS_OBS[k]}:`));
    if (chave) {
      atual = chave;
      campos[chave] = linha.slice(ROTULOS_OBS[chave].length + 1).trim();
    } else if (atual) {
      campos[atual] += `\n${linha}`; // texto com quebra de linha continua no campo anterior
    }
  }
  return campos;
}

function montarObservacoes(campos) {
  return Object.keys(ROTULOS_OBS).map(k => `${ROTULOS_OBS[k]}: ${campos[k] || ''}`).join('\n');
}

module.exports = { lerObservacoes, montarObservacoes };
