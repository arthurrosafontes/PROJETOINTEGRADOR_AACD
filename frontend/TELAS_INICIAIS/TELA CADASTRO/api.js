// API do cadastro de voluntários. Ajuste a URL caso seu servidor utilize outra porta.
const Api = {
  async buscarCep(cep) {
    const response = await fetch(`https://viacep.com.br/ws/${encodeURIComponent(cep)}/json/`);
    if (!response.ok) throw new Error('Falha na consulta do CEP.');
    const data = await response.json();
    if (data.erro) return null;
    return { rua: data.logradouro || '', bairro: data.bairro || '', cidade: data.localidade || '', uf: data.uf || '' };
  },
  async cadastrarVoluntario(dados) {
    const payload = {
      nome: dados.nome,
      email: dados.email,
      telefone: dados.telefone,
      senha: dados.senha,
      confirmar_senha: dados.confirmarSenha,
      tipo_voluntario: dados.tipo_voluntario,
      cpf_cnpj: dados.documento.replace(/\D/g, ''),
      razao_social: dados.tipo_voluntario === 'Pessoa fisica' ? null : dados.nome,
      cep: dados.cep,
      logradouro: dados.rua,
      numero: dados.numero,
      complemento: dados.complemento,
      bairro: dados.bairro,
      cidade: dados.cidade,
      estado: dados.uf
    };
    const response = await fetch('http://localhost:3000/api/voluntarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.erro || 'Erro ao cadastrar voluntário.');
    return result;
  }
};
