const { registrar } = require('../services/notificacoes');
const express = require('express');
const { avaliar, pontosDistancia, ordenar, normalizar } = require('../services/compatibilidade');
const { criarCliente } = require('../services/rotas-ors');
const unidades = require('../config/unidades-aacd');
function criarRouter({ pool = require('../config/mysql'), Impressora = require('../models/FichaTecnicaImpressora'),
  auth = require('../middleware/autenticacao'), ors = criarCliente() } = {}) {
  const router=express.Router();
  router.use(auth.exigirAutenticacao);
  router.get('/unidades', (req,res)=>res.json(unidades.map(({id,nome,endereco})=>({id,nome,endereco}))));
  router.post('/demandas/:id/convites', auth.exigirPerfil('funcionario'), async (req, res) => {
    const id = Number(req.params.id), impressoraId = req.body?.impressoraId;
    if (!Number.isSafeInteger(id) || id <= 0 || typeof impressoraId !== 'string' || !/^[a-f0-9]{24}$/i.test(impressoraId)) {
      return res.status(400).json({ erro: 'Demanda ou impressora inválida.' });
    }
    let conexao;
    try {
      const impressora = await Impressora.findOne({ _id: impressoraId }).lean();
      conexao = await pool.getConnection();
      await conexao.beginTransaction();
      const [[demanda]] = await conexao.execute('SELECT * FROM demanda WHERE id_demanda = ? FOR UPDATE', [id]);
      if (!demanda || demanda.status !== 'Aberta' || !impressora || !avaliar(demanda, impressora).compativel) {
        await conexao.rollback();
        return res.status(409).json({ erro: 'A demanda deixou de estar aberta ou a impressora ficou incompatível.' });
      }
      const [[voluntario]] = await conexao.execute(`SELECT v.id_usuario FROM voluntario v JOIN usuario u ON u.id_usuario = v.id_usuario
        WHERE v.id_voluntario = ? AND v.status_homologacao = 'Aprovado' AND u.status = 'Ativo'`, [impressora.id_voluntario]);
      if (!voluntario) {
        await conexao.rollback();
        return res.status(409).json({ erro: 'O voluntário precisa estar ativo e aprovado.' });
      }
      const nome = String(impressora.nome_da_impressora || impressora.modelo_da_impressora || 'sua impressora').slice(0, 120);
      const registrados = await registrar(conexao, voluntario.id_usuario, 'convite:' + id,
        'A AACD escolheu a impressora ' + nome + ' no matchmaking da demanda #' + id + '. Abra os pedidos disponíveis para avaliar e aceitar o convite.', 'convite');
      await conexao.commit();
      res.json({ mensagem: registrados ? 'Convite registrado. O voluntário recebe pelos canais habilitados.' : 'O voluntário não tem um canal de aviso ativo.' });
    } catch (erro) {
      if (conexao) await conexao.rollback().catch(() => {});
      console.error('Falha ao registrar convite AACD:', erro.code || erro.name);
      res.status(500).json({ erro: 'Não foi possível registrar o convite.' });
    } finally { conexao?.release(); }
  });
  router.get('/demandas/:id', async(req,res)=>{
    if(!['funcionario','voluntario'].includes(req.usuario.perfil))return res.sendStatus(403);
    const id=Number(req.params.id);
    if(!Number.isSafeInteger(id)||id<=0)return res.status(400).json({erro:'Demanda inválida.'});
    try{
      const [[demanda]]=await pool.execute('SELECT * FROM demanda WHERE id_demanda = ?', [id]);
      if(!demanda)return res.status(404).json({erro:'Demanda não encontrada.'});
      if(demanda.status!=='Aberta')return res.status(409).json({erro:'O matchmaking está disponível somente para demandas abertas.'});
      const funcionario=req.usuario.perfil==='funcionario';
      const impressoras=await Impressora.find(funcionario?{}:{id_voluntario:req.usuario.id_voluntario}).lean();
      const ids=[...new Set(impressoras.map(i=>Number(i.id_voluntario)).filter(Number.isSafeInteger))];
      const usuarios=new Map();
      if(ids.length){
        const [rows]=await pool.query(`SELECT v.id_voluntario, v.status_homologacao, u.nome, u.status FROM voluntario v JOIN usuario u ON u.id_usuario=v.id_usuario WHERE v.id_voluntario IN (${ids.map(()=>'?').join(',')})`,ids);
        for(const u of rows)usuarios.set(Number(u.id_voluntario),u);
      }
      const candidatos=impressoras.map(i=>{
        const v=usuarios.get(Number(i.id_voluntario));
        const a=avaliar(demanda,i);
        if(!v || normalizar(v.status)!=='ativo' || normalizar(v.status_homologacao)!=='aprovado'){
          a.compativel=false;a.pontosTecnicos=0;a.motivos.push('Voluntário não está ativo e homologado.');
        }
        return {id:String(i._id),nome:i.nome_da_impressora||i.modelo_da_impressora,voluntario:funcionario?v?.nome:undefined,
          ...a,distanciaKm:null,pontosDistancia:0,pontos:a.pontosTecnicos,situacaoDistancia:'Não calculada',endereco:i.localizacao?.endereco};
      });
      const local=normalizar(demanda.local_entrega);
      const unidade=unidades.find(u=>[u.id,u.nome,u.endereco,...(u.aliases||[])].some(s=>normalizar(s)===local));
      let aviso='';
      if(!candidatos.some(c=>c.compativel))aviso='Nenhuma impressora atende a todos os requisitos técnicos. Os trajetos são calculados somente para equipamentos compatíveis. Confira os motivos abaixo.';
      else if(!unidade)aviso='Selecione uma unidade AACD cadastrada no local de entrega da demanda para calcular trajetos.';
      else if(!ors.configurado)aviso='Distância ainda não calculada: a integração com o serviço de rotas aguarda configuração. A compatibilidade técnica já está disponível.';
      else {
        const limite=Date.now()+20000;
        try{
          const destino=await ors.coordenadas(unidade.endereco);
          if(!destino)aviso='O endereço da unidade não foi localizado com precisão. Confira o cadastro antes de classificar por distância.';
          else {
            const localizados=[];
            for(const candidato of candidatos.filter(c=>c.compativel)){
              if(Date.now()>limite){aviso='Cálculo de distância parcial. Consulte novamente para completar os trajetos.';break;}
              const e=candidato.endereco;
              if(!e?.logradouro || !e.numero || !e.cidade || !e.estado){candidato.situacaoDistancia='Endereço incompleto';continue;}
              const xy=await ors.coordenadas([e.logradouro,e.numero,e.cidade,e.estado,e.cep,'Brasil'].filter(Boolean).join(', '));
              if(xy)localizados.push({candidato,xy});else candidato.situacaoDistancia='Endereço não localizado com precisão';
            }
            for(let pos=0;pos<localizados.length;pos+=40){
              const lote=localizados.slice(pos,pos+40);
              const distancias=await ors.matriz(lote.map(x=>x.xy),destino);
              lote.forEach(({candidato},index)=>{
                candidato.distanciaKm=distancias[index];
                candidato.situacaoDistancia=distancias[index]===null?'Trajeto não encontrado':'Calculada por trajeto de carro';
                candidato.pontosDistancia=pontosDistancia(distancias[index]);candidato.pontos+=candidato.pontosDistancia;
              });
            }
          }
        }catch{aviso='Não foi possível completar os trajetos agora. A classificação por distância está incompleta; a compatibilidade técnica foi mantida.';}
      }
      const compativeis=candidatos.filter(c=>c.compativel);
      const completo=compativeis.length>0 && compativeis.every(c=>c.distanciaKm!==null);
      if(!completo && !aviso && compativeis.length)aviso='Alguns trajetos não puderam ser calculados. A ordem por distância é parcial.';
      res.set('Cache-Control','no-store');
      return res.json({demandaId:id,unidade:unidade?{nome:unidade.nome,endereco:unidade.endereco}:null,aviso,
        classificacaoCompleta:completo,fonte:'© openrouteservice.org · © OpenStreetMap contributors',
        regras:'Obrigatórios: voluntário ativo e aprovado, impressora FDM disponível, material, volume e bico. 3 pontos técnicos + distância: até 10 km = 5; até 25 = 4; até 50 = 3; até 100 = 2; acima = 1. Sem trajeto = 0 (não calculado).',
        candidatos:candidatos.sort(ordenar).map(({endereco,...c})=>c)});
    }catch(erro){console.error('Falha no matchmaking:',erro.message);res.status(500).json({erro:'Não foi possível consultar a compatibilidade agora.'});}
  });
  return router;
}
module.exports={criarRouter};
