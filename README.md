# PROJETOINTEGRADOR_AACD
Projeto da Facul

## Frontend (SPA)

O frontend é uma Single Page Application em HTML, CSS e JavaScript puros (sem frameworks).

```
frontend/
├── index.html            ← todas as telas (cada uma é um <main data-rota="...">)
├── css/estilos.css       ← estilos de todas as telas
├── img/                  ← logo, foto do hospital e favicon
└── js/
    ├── utilitarios.js    ← funções compartilhadas (toast, máscaras, confirmação…)
    ├── api.js            ← TODAS as chamadas ao backend (troque API_URL aqui)
    ├── roteador.js       ← troca de telas pelo endereço (#/rota)
    └── telas/            ← um arquivo por tela
```

Para rodar: abra `frontend/index.html` com o Live Server (porta 5501) e suba o backend com `node server.js`.

Rotas principais: `#/` (início), `#/funcionario/login`, `#/voluntario/login`, `#/voluntario/cadastro`,
`#/voluntario/pedidos-disponiveis`, `#/voluntario/pedidos-aceitos`, `#/voluntario/producao`,
`#/voluntario/impressora/cadastrar`, `#/funcionario/demandas/cadastrar`, `#/funcionario/voluntarios`,
`#/funcionario/impressoras`.

> `backend/legado/servidor_sqlite_telas.js` é o servidor SQLite que estava salvo por engano em
> `frontend/FUNCIONARIO/VIZUALIZAR_IMPRESSORA_CADASTRADA/api.js`. Ele foi movido sem alterações,
> pois é o único que implementa as rotas de pedidos, produção, próteses e demandas.
