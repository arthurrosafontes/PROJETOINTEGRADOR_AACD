# Matchmaking AACD

## Regras implementadas

- Demanda aberta; voluntário ativo e homologado; impressora FDM com status Disponível.
- Material deve corresponder a um dos filamentos compatíveis (sem diferenciar caixa e acentos).
- Largura, profundidade e altura devem caber nos eixos cadastrados. Não girar nem dividir a peça automaticamente.
- Bico deve corresponder ao exigido. Ainda não existem campos de alternativas/tolerâncias aprovadas.
- Informação técnica ausente não é considerada compatibilidade comprovada.
- Equipamento compatível: 3 pontos técnicos (material, dimensões e bico).
- Distância do trajeto de carro: até 10 km +5; até 25 +4; até 50 +3; até 100 +2; acima +1.
- Ordenação: compatíveis primeiro, maior pontuação, menor distância, nome e ID.
- Distância ausente: zero ponto de distância e indicação explícita de não calculada. Não significa distância zero ou incompatibilidade técnica. Classificação parcial nunca é apresentada como completa.
- Não há atribuição automática. O voluntário confirma o aceite, inclusive a decisão de doar material.

## Onde usar

Funcionário: Lista de demandas → demanda Aberta → Ver compatibilidade.
Voluntário: Pedidos disponíveis mostra apenas demandas tecnicamente compatíveis. Aceitar abre a seleção dos próprios equipamentos em ordem de pontuação.
No cadastro da demanda, escolher uma das nove unidades sugeridas em Local de entrega. Na edição, informar o mesmo nome. Endereços foram fornecidos pelo responsável pelo projeto em 10/11/2026; ficam em backend/config/unidades-aacd.js.
Locais antigos não reconhecidos são preservados, mas não recebem uma unidade presumida.

## Ativar rotas reais

1. Criar conta e chave no portal oficial https://account.heigit.org/.
2. Adicionar ORS_API_KEY=sua_chave ao .env local do backend. Não publicar a chave nem colocá-la no frontend.
3. Reiniciar node server.js.
4. Preencher corretamente endereço, número, cidade e estado das impressoras e selecionar a unidade de destino da demanda.
5. Consultar Ver compatibilidade e conferir as distâncias antes de usar a classificação operacionalmente.

O backend usa geocodificação para localizar endereços e /v2/matrix/driving-car para obter quilômetros pela malha viária. Trata-se do trajeto calculado pelo provedor, não de garantia do menor percurso possível nem de cálculo de frete dos Correios. Rotas não consideram trânsito em tempo real nesta implementação.
Sem chave, os filtros técnicos funcionam. Falhas, limite do serviço, endereço ambíguo ou rota inexistente não geram distância inventada. Resultados ficam em cache somente na memória por 15 minutos (até 1000 entradas); consultas idênticas em andamento são agrupadas. Há limite local de 20 chamadas externas/minuto, timeout por chamada de 8 segundos e lotes de até 40 origens para um destino. Grandes conjuntos podem produzir classificação parcial; nova consulta reaproveita os resultados temporários.
Cada impressora é comparada até a unidade selecionada, no sentido impressora → AACD. Endereços são enviados ao OpenRouteService somente para calcular a localização; nenhum nome de paciente é enviado. A resposta ao navegador não expõe endereços privados das impressoras ou a chave.

## Validação e limites

Testes automatizados com dados fictícios cobrem filtros, limites das faixas de distância, desempate, permissões, falhas do provedor, ausência de chave e proteção do aceite. Rotas reais dependem de chave e de verificação dos endereços no provedor.
O cálculo temporal da capacidade, tolerâncias de bico/camada e estoque de material não foram presumidos. Configurações de qualidade não recebem pontos sem regras aprovadas.

Documentação do provedor:
- https://giscience.github.io/openrouteservice/api-reference/endpoints/matrix/
- https://giscience.github.io/openrouteservice/api-reference/endpoints/geocoder/
