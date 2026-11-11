// Chamadas feitas somente no servidor. Não logar URLs, endereços ou a chave.
function criarCliente({ chave = process.env.ORS_API_KEY, fetchImpl = global.fetch, agora = Date.now } = {}) {
  const cache = new Map(), pendentes = new Map();
  let chamadas = [], suspensoAte = 0;
  const configurado = !!chave?.trim();
  async function consultar(caminho, body) {
    const t = agora(); chamadas = chamadas.filter(v => t-v < 60000);
    if (!configurado || t < suspensoAte || chamadas.length >= 20) throw Error('Serviço de rotas indisponível ou limite de consultas atingido.');
    chamadas.push(t);
    const r = await fetchImpl('https://api.heigit.org'+caminho, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: chave, ...(body ? {'Content-Type':'application/json'} : {}) },
      ...(body ? {body:JSON.stringify(body)} : {}), signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) { if ([401,403,429].includes(r.status)) suspensoAte=agora()+60000; throw Error('Não foi possível consultar o serviço de rotas.'); }
    return r.json();
  }
  async function memo(chaveCache, obter) {
    const anterior=cache.get(chaveCache);
    if(anterior && anterior.ate>agora())return anterior.valor;
    if(pendentes.has(chaveCache))return pendentes.get(chaveCache);
    const promessa=(async()=>{
      const valor=await obter();
      if(cache.size>=1000)cache.delete(cache.keys().next().value);
      cache.set(chaveCache,{valor,ate:agora()+15*60000});return valor;
    })();
    pendentes.set(chaveCache,promessa);
    try{return await promessa;}finally{pendentes.delete(chaveCache);}
  }
  async function coordenadas(endereco) {
    return memo('geo:'+endereco,async()=>{
      const q=new URLSearchParams({text:endereco,'boundary.country':'BRA',size:'2'});
      const r=await consultar('/pelias/v1/search?'+q);
      const f=r.features?.[0], props=f?.properties, xy=f?.geometry?.coordinates;
      // Não usar centro de cidade/CEP como se fosse endereço preciso.
      if(!props || !Number.isFinite(Number(props.confidence)) || Number(props.confidence)<0.8 || !['address','venue'].includes(props.layer) ||
        !Array.isArray(xy) || xy.length<2 || !xy.every(Number.isFinite) || Math.abs(xy[0])>180 || Math.abs(xy[1])>90) return null;
      const segundo=r.features?.[1];
      if(segundo && Number(segundo.properties?.confidence)>=Number(props.confidence) &&
         JSON.stringify(segundo.geometry?.coordinates)!==JSON.stringify(xy))return null;
      return xy;
    });
  }
  async function matriz(origens, destino) {
    return memo('rotas:'+JSON.stringify([origens,destino]),async()=>{
      const r=await consultar('/openrouteservice/v2/matrix/driving-car',{
        locations:[...origens,destino],sources:origens.map((_,i)=>String(i)),destinations:[String(origens.length)],metrics:['distance'],units:'km'
      });
      return origens.map((_,i)=>{const n=r.distances?.[i]?.[0];return typeof n==='number' && Number.isFinite(n) && n>=0 ? n : null;});
    });
  }
  async function matrizDestinos(origem, destinos) {
    return memo('destinos:'+JSON.stringify([origem,destinos]),async()=>{
      const r=await consultar('/openrouteservice/v2/matrix/driving-car',{
        locations:[origem,...destinos],sources:['0'],destinations:destinos.map((_,i)=>String(i+1)),metrics:['distance'],units:'km'
      });
      return destinos.map((_,i)=>{const n=r.distances?.[0]?.[i];return typeof n==='number' && Number.isFinite(n) && n>=0 ? n : null;});
    });
  }
  return { configurado, coordenadas, matriz, matrizDestinos };
}
module.exports={criarCliente};
