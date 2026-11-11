# Material fornecido pela AACD

Para novos aceites sem doação, a preferência é obrigatória: retirada em unidade ou envio pelos Correios. A unidade de retirada é independente da unidade que receberá a peça pronta. O material precisa ser liberado pela equipe antes da retirada; esta funcionalidade não controla estoque de unidades.

No aceite, seleciona-se a impressora. Seu endereço cadastrado é a origem dos trajetos de carro do OpenRouteService até as unidades em `backend/config/unidades-aacd.js`. A menor distância é sugerida somente se todos os trajetos forem calculados; resultados parciais são identificados, permitindo seleção manual. O voluntário pode escolher outra unidade. Não se usam distâncias em linha reta como substituto.

Para Correios, o endereço da impressora serve como preenchimento inicial editável, e o voluntário informa destinatário e confere os campos obrigatórios. O endereço confirmado é salvo no pedido. A chave ORS permanece no servidor.

## Fluxo

1. Voluntário aceita a demanda e solicita o material. Pedido permanece Aceito.
2. Funcionário abre Lista de demandas → Preparar material. Informa gramas e, para retirada, horário e responsável. Para Correios, informa data da postagem e rastreio obrigatórios. O tipo de material vem da demanda.
3. Voluntário abre Meus Pedidos → Ver material e acompanha instruções ou rastreio.
4. Quando estiver com o material, confirma recebimento. Só então pode iniciar produção. O bloqueio também está no UPDATE do servidor.

O histórico registra liberação/postagem e recebimento. Apenas funcionários podem preparar; só o voluntário dono do pedido pode confirmar. Pedidos cancelados ou fora da etapa não aceitam essas operações. O fluxo da peça pronta permanece separado.

Execute `backend/scripts/material-aacd.sql` antes de iniciar a versão atualizada. A tabela tem uma solicitação por pedido, criada na mesma transação do aceite. Pedidos anteriores não recebem solicitações retroativas e mantêm seu comportamento. Quem doa material próprio continua podendo iniciar após o aceite.

Testes: rotas reais com tabelas temporárias MySQL, validação e rollback, autorização, bloqueio/liberação do início, Correios e retirada; navegador com respostas simuladas para escolha, recomendação, campos condicionais, preparação, confirmação e layout móvel. O cálculo real depende da precisão dos endereços e disponibilidade/cota do ORS.
