const express = require('express')
const path = require('path')
const { prepararBanco } = require('./servicos/estrutura-banco')

const app = express()
app.use(express.json({ limit: '20mb' }))
app.use(express.urlencoded({ limit: '20mb', extended: true }))

const PASTA_PUBLICA = path.join(__dirname, '..', 'publico')

const PAGINA_INICIAL = '/HTML/financeiro/painel.html'

const ENDERECOS_ANTIGOS = {
  '/HTML/producao/admin.html': PAGINA_INICIAL,
  '/HTML/producao/visao-geral.html': PAGINA_INICIAL,
  '/HTML/producao/cadastro.html': PAGINA_INICIAL,
  '/HTML/estoque/almoxarifado.html': PAGINA_INICIAL,
  '/HTML/estoque/compras.html': PAGINA_INICIAL,
  '/HTML/estoque/embarques.html': PAGINA_INICIAL,
  '/HTML/estoque/recebimento.html': PAGINA_INICIAL,
  '/HTML/estoque/referencia.html': '/HTML/estoque/rendimentos.html',
  '/HTML/financeiro/contabil.html': '/HTML/financeiro/mensal-contabil.html',
  '/HTML/financeiro/exp-contabil.html': '/HTML/financeiro/fechamento-contabil.html',
  '/HTML/financeiro/financeiro.html': '/HTML/financeiro/importacoes.html'
}
app.use((req, res, next) => {
  const novo = ENDERECOS_ANTIGOS[req.path]
  if (novo) return res.redirect(301, novo)
  next()
})
app.use(express.static(PASTA_PUBLICA))

app.use(require('./rotas/notificacoes'))
app.use(require('./rotas/login'))
app.use(require('./rotas/usuarios'))
app.use(require('./rotas/painel'))
app.use(require('./rotas/cadastros'))
app.use(require('./rotas/mensal-contabil'))
app.use(require('./rotas/fechamento-contabil'))
app.use(require('./rotas/importacoes'))
app.use(require('./rotas/custos-importacao'))
app.use(require('./rotas/checklist'))
app.use(require('./rotas/tarefas'))

app.get('*', (req, res) => {
  res.sendFile(path.join(PASTA_PUBLICA, 'index.html'))
})

app.use((err, req, res, next) => {
  console.error('Erro na requisição:', err && err.message ? err.message : err)
  if (!res.headersSent) res.status(500).json({ erro: 'Erro no servidor. Tente novamente.' })
})

process.on('unhandledRejection', (err) => {
  console.error('Erro não tratado (promise):', err && err.message ? err.message : err)
})
process.on('uncaughtException', (err) => {
  console.error('Exceção não tratada:', err && err.message ? err.message : err)
})

const PORTA = process.env.PORT || 8080
prepararBanco().finally(() => {
  app.listen(PORTA, '0.0.0.0', () => console.log(`Servidor rodando na porta ${PORTA}`))
})
