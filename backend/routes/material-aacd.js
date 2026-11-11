const express = require('express');
const unidades = require('../config/unidades-aacd');
const { criarCliente } = require('../services/rotas-ors');
const camposMaterial = `(SELECT JSON_OBJECT('modalidade',m.modalidade,'unidadeId',m.unidade_id,
 'unidade',m.unidade_nome,'endereco',m.endereco,'status',m.status,'material',m.material,
 'gramas',m.quantidade_gramas,'dataPostagem',DATE_FORMAT(m.data_postagem,'%Y-%m-%d'),
 'rastreio',m.codigo_rastreio,'horario',m.horario_retirada,'responsavel',m.responsavel,
 'observacoes',m.observacoes,'funcionario',m.nome_funcionario,
 'recebidoEm',DATE_FORMAT(m.data_recebimento,'%Y-%m-%dT%H:%i:%sZ'))
 FROM material_pedido m WHERE m.id_pedido=pp.id_pedido) AS materialAacd`;
// Aplicado no mesmo UPDATE que inicia a produção, evitando uma janela entre consulta e escrita.
const condicaoInicio = `NOT EXISTS (SELECT 1 FROM material_pedido mp WHERE mp.id_pedido=pp.id_pedido AND mp.status <> 'Material recebido')`;
function texto(v,max,obrigatorio=true) {
  if (typeof v!=='string' || v.trim().length>max || (obrigatorio&&!v.trim())) throw Error('Confira os campos obrigatórios do material.');
  return v.trim();
}
function validarSolicitacao(v) {
  if(!v || !['Retirada na AACD','Envio pelos Correios'].includes(v.modalidade))throw Error('Escolha como receber o material da AACD.');
  if(v.modalidade==='Retirada na AACD') {
    const u=unidades.find(u=>u.id===v.unidadeId);
    if(!u)throw Error('Selecione uma unidade AACD para retirada.');
    return {modalidade:v.modalidade,unidade:u,endereco:u.endereco};
  }
  const e=v.endereco || {};
  const nome=texto(e.destinatario,150),logradouro=texto(e.logradouro,150),numero=texto(e.numero,20),bairro=texto(e.bairro,100),cidade=texto(e.cidade,100),estado=texto(e.estado,2).toUpperCase(),cep=texto(e.cep,9).replace(/\D/g,'');
  if(!/^[A-Z]{2}$/.test(estado)||!/^\d{8}$/.test(cep))throw Error('Informe UF e CEP válidos para o envio do material.');
  const complemento=texto(e.complemento||'',100,false);
  return {modalidade:v.modalidade,unidade:null,endereco:[nome,`${logradouro}, ${numero}`,complemento,bairro,`${cidade} — ${estado}`,`CEP ${cep}`].filter(Boolean).join('\n')};
}
async function registrarSolicitacao(c,id,material,v) {
  await c.execute(`INSERT INTO material_pedido(id_pedido,modalidade,unidade_id,unidade_nome,endereco,material,data_solicitacao) VALUES(?,?,?,?,?,?,UTC_TIMESTAMP())`,[id,v.modalidade,v.unidade?.id||null,v.unidade?.nome||null,v.endereco,material]);
}
function criarRouter({pool=require('../config/mysql'),auth=require('../middleware/autenticacao'),Impressora=require('../models/FichaTecnicaImpressora'),ors=criarCliente()}={}) {
  const router=express.Router();
  router.use(auth.exigirAutenticacao);
  router.get('/material/unidades/:impressoraId',auth.exigirPerfil('voluntario'),async(req,res)=>{
    if(!/^[a-f0-9]{24}$/i.test(req.params.impressoraId))return res.status(400).json({erro:'Impressora inválida.'});
    try {
      const i=await Impressora.findOne({_id:req.params.impressoraId,id_voluntario:req.usuario.id_voluntario}).lean();
      if(!i)return res.status(404).json({erro:'Impressora não encontrada.'});
      const e=i.localizacao?.endereco||{};
      const lista=unidades.map(({id,nome,endereco})=>({id,nome,endereco,distanciaKm:null}));
      let aviso='',completo=false;
      if(!ors.configurado)aviso='Cálculo de distância indisponível. Escolha a unidade para retirada.';
      else if(!e.logradouro||!e.numero||!e.cidade||!e.estado)aviso='Complete o endereço da impressora para calcular os trajetos. Você pode escolher a unidade manualmente.';
      else try {
        const origem=await ors.coordenadas([e.logradouro,e.numero,e.cidade,e.estado,e.cep,'Brasil'].filter(Boolean).join(', '));
        if(!origem){const erro=Error('Endereço da impressora sem localização precisa.');erro.code='ORIGEM_IMPRECISA';throw erro;}
        const pontos=await Promise.allSettled(unidades.map(u=>ors.coordenadas(u.endereco)));
        const localizadas=pontos.map((r,n)=>({xy:r.status==='fulfilled'?r.value:null,n})).filter(r=>r.xy);
        if(localizadas.length){
          const dist=await ors.matrizDestinos(origem,localizadas.map(r=>r.xy));
          localizadas.forEach((r,n)=>{lista[r.n].distanciaKm=dist[n];});
        }
        completo=lista.every(u=>u.distanciaKm!==null);
        if(!completo)aviso='Alguns trajetos não puderam ser calculados. As distâncias disponíveis são parciais; escolha a unidade desejada.';
      }catch(erro){aviso=erro.code==='ORIGEM_IMPRECISA'
        ? 'O endereço da impressora não foi localizado com precisão suficiente. Confira rua, número, cidade e CEP no cadastro ou escolha a unidade manualmente.'
        : 'Não foi possível calcular os trajetos agora. Escolha a unidade manualmente.';}
      lista.sort((a,b)=>(a.distanciaKm??Infinity)-(b.distanciaKm??Infinity)||a.nome.localeCompare(b.nome));
      res.set('Cache-Control','no-store').json({unidades:lista,sugerida:completo?lista[0].id:null,aviso,enderecoImpressora:e,fonte:'© openrouteservice.org · OpenStreetMap contributors'});
    }catch{res.status(500).json({erro:'Não foi possível consultar as unidades.'});}
  });
  router.patch('/:id/material/preparar',auth.exigirPerfil('funcionario'),async(req,res)=>{
    let c;
    try {
      const id=Number(req.params.id),b=req.body||{};
      if(!Number.isSafeInteger(id)||id<=0)return res.status(400).json({erro:'Pedido inválido.'});
      const gramas=Number(b.gramas);
      if(!Number.isFinite(gramas)||gramas<=0||gramas>99999999.99||Math.abs(gramas*100-Math.round(gramas*100))>1e-6)return res.status(400).json({erro:'Informe a quantidade em gramas, com até duas casas decimais.'});
      let obs;try{obs=texto(b.observacoes||'',1000,false);}catch(e){return res.status(400).json({erro:e.message});}
      c=await pool.getConnection();await c.beginTransaction();
      const [[p]]=await c.execute(`SELECT pp.id_demanda,pp.status AS pedidoStatus,d.status AS demandaStatus,m.*,DATE_FORMAT(m.data_solicitacao,'%Y-%m-%dT%H:%i:%sZ') AS solicitacaoUTC FROM pedido_producao pp JOIN demanda d ON d.id_demanda=pp.id_demanda JOIN material_pedido m ON m.id_pedido=pp.id_pedido WHERE pp.id_pedido=? FOR UPDATE`,[id]);
      if(!p||p.status!=='Aguardando preparação'||p.demandaStatus!=='Aceita'||p.pedidoStatus!=='Aceito') {await c.rollback();return res.status(p?409:404).json({erro:'O material não está aguardando preparação ou o pedido não está mais aceito.'});}
      let data=null,rastreio=null,horario=null,responsavel=null;
      try {
        if(p.modalidade==='Envio pelos Correios'){
          data=texto(b.data,10);rastreio=texto(b.rastreio,80);
          const dia=new Date(data+'T12:00:00Z'),hoje=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
          const solicitacao=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date(p.solicitacaoUTC));
          if(!/^\d{4}-\d{2}-\d{2}$/.test(data)||!Number.isFinite(dia.getTime())||dia.toISOString().slice(0,10)!==data||data>hoje||data<solicitacao)throw Error('A postagem deve ser entre a solicitação do material e hoje.');
        }else{horario=texto(b.horario,200);responsavel=texto(b.responsavel,150);}
      }catch(e){await c.rollback();return res.status(400).json({erro:e.message});}
      const status=p.modalidade==='Envio pelos Correios'?'Material enviado':'Disponível para retirada';
      await c.execute(`UPDATE material_pedido SET status=?,quantidade_gramas=?,data_postagem=?,codigo_rastreio=?,horario_retirada=?,responsavel=?,observacoes=?,preparado_por=?,nome_funcionario=?,data_preparacao=UTC_TIMESTAMP() WHERE id_pedido=?`,[status,gramas,data,rastreio,horario,responsavel,obs,req.usuario.id_usuario,req.usuario.nome,id]);
      await c.execute(`INSERT INTO historico_producao(id_pedido,id_demanda,id_usuario,status,descricao) VALUES(?,?,?,'Aceito',?)`,[id,p.id_demanda,req.usuario.id_usuario,status+' — material da AACD']);
      await c.commit();res.json({id,status});
    }catch{if(c)await c.rollback().catch(()=>{});res.status(500).json({erro:'Não foi possível registrar o fornecimento do material. Atualize o pedido antes de tentar novamente.'});}finally{c?.release();}
  });
  router.patch('/:id/material/receber',auth.exigirPerfil('voluntario'),async(req,res)=>{
    const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<=0)return res.status(400).json({erro:'Pedido inválido.'});
    let c;
    try{
      c=await pool.getConnection();await c.beginTransaction();
      const [[p]]=await c.execute(`SELECT pp.id_demanda,pp.status AS pedidoStatus,d.status AS demandaStatus,m.status FROM pedido_producao pp JOIN demanda d ON d.id_demanda=pp.id_demanda JOIN material_pedido m ON m.id_pedido=pp.id_pedido WHERE pp.id_pedido=? AND pp.id_voluntario=? FOR UPDATE`,[id,req.usuario.id_voluntario]);
      if(!p||p.pedidoStatus!=='Aceito'||p.demandaStatus!=='Aceita'||!['Disponível para retirada','Material enviado'].includes(p.status)){await c.rollback();return res.status(p?409:404).json({erro:'O material ainda não está disponível para confirmar recebimento.'});}
      await c.execute("UPDATE material_pedido SET status='Material recebido',data_recebimento=UTC_TIMESTAMP() WHERE id_pedido=?",[id]);
      await c.execute(`INSERT INTO historico_producao(id_pedido,id_demanda,id_usuario,status,descricao) VALUES(?,?,?,'Aceito','Voluntário confirmou recebimento do material da AACD')`,[id,p.id_demanda,req.usuario.id_usuario]);
      await c.commit();res.json({id,status:'Material recebido'});
    }catch{if(c)await c.rollback().catch(()=>{});res.status(500).json({erro:'Não foi possível confirmar o recebimento do material.'});}finally{c?.release();}
  });
  return router;
}
module.exports={criarRouter,camposMaterial,condicaoInicio,validarSolicitacao,registrarSolicitacao};
