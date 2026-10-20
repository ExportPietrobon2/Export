# Hub de Exportações Pietrobon

Sistema web para controle do ciclo dos pedidos de exportação (PI): cadastro, insumos, compras, recebimento, estoque, embarque, checklist e financeiro.

## Como executar

```bash
npm install
npm start
```

O servidor sobe na porta definida em `PORT` (padrão 8080). As credenciais do banco e dos serviços externos vêm das variáveis de ambiente (`MYSQLHOST`, `MYSQLUSER`, `JWT_SECRET` etc.).

## Estrutura

```
publico/                    Tudo que o navegador recebe (telas)
  index.html                Tela de login
  CSS/estilo.css            Arquivo principal: importa todos os estilos na ordem certa
  CSS/base/                 Variáveis, layout geral, tipografia, impressão e celular
  CSS/componentes/          Peças usadas em várias telas (menu, cards, botões, tabelas,
                            avisos, alertas, filtros, painel lateral, seções recolhíveis)
  CSS/telas/                Estilos de uma tela específica (login, almoxarifado, visão geral)
  HTML/<módulo>/*.html      Uma página por tela
  JS/comum/                 Código usado por todas as telas
    api.js                  Chamadas ao servidor (fetch com o token)
    sessao.js               Guarda, lê e apaga o login do usuário no navegador
    login.js                Script da tela de login
    cabecalho.js            Menu e cabeçalho de todas as páginas
    constantes.js           Tipos de insumo, rótulos de status e formatação
    avisos.js               Mensagens de aviso na tela
    alertas.js              Regras de alerta de embarque e de pendências
    demandas.js             Formulário de pedidos de compra
    painel.js               Painel lateral de detalhes
    pais-ano.js             Filtro por país e ano
    recolher.js             Seções que abrem e fecham
  JS/<módulo>/*.js          Script de cada tela, com o mesmo nome do HTML
  sw.js, manifest.json      PWA: instalação no celular e notificações

src/                        Servidor (Node.js + Express)
  servidor.js               Ponto de entrada: configura o Express e liga as rotas
  config/banco.js           Conexão com o MySQL
  middlewares/autenticacao.js   Confere o token e o perfil antes de cada rota
  rotas/<módulo>.js         Endereços da API de cada módulo
  servicos/                 Funções reutilizadas pelas rotas
    notificacoes.js         Push e e-mail
    arquivos.js             Upload de fotos (Cloudinary)
    importacoes.js          Cálculos e resumo semanal das importações
  rotinas/alertas.js        Verificações automáticas diárias
```

## Fluxo de uma requisição

Tela (`publico/JS/...`) → `api.js` envia o token → `src/servidor.js` → `rotas/<módulo>.js` → `autenticacao.js` confere o perfil → consulta no MySQL (`config/banco.js`) → resposta em JSON para a tela.
