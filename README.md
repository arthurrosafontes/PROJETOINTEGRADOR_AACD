# PROJETOINTEGRADOR_AACD
Projeto da Facul

## Frontend (SPA)

O frontend é uma Single Page Application em HTML, CSS e JavaScript puros (sem frameworks).

```
frontend/
├── index.html            ← todas as telas (cada uma é um <main data-rota="...">)
├── css/                 ← tema, telas, componentes e preferências
├── img/                  ← logo, foto do hospital e favicon
└── js/
    ├── utilitarios.js    ← funções compartilhadas (toast, máscaras, confirmação…)
    ├── api.js            ← transporte HTTP e endereço da API
    ├── api/              ← chamadas por área do Hub
    ├── roteador.js       ← troca de telas pelo endereço (#/rota)
    └── telas/            ← um arquivo por tela
```

Para rodar: abra `frontend/index.html` com o Live Server (porta 5501) e suba o backend com `node server.js`.

Rotas principais: `#/` (início), `#/funcionario/login`, `#/voluntario/login`, `#/voluntario/cadastro`,
`#/voluntario/pedidos-disponiveis`, `#/voluntario/pedidos-aceitos`, `#/voluntario/producao`,
`#/voluntario/impressora/cadastrar`, `#/funcionario/demandas/cadastrar`, `#/funcionario/voluntarios`,
`#/funcionario/impressoras`.

## Backend

`server.js` conecta o MongoDB, inicia o servidor e ativa as filas de notificações e exclusão de contas. `backend/app.js` configura o Express e registra as rotas. `backend/routes/` reúne as rotas por área, com regras compartilhadas em `backend/services/`. O aplicativo usa MySQL e MongoDB. O arquivo em `backend/legado/` guarda a versão anterior em SQLite.
