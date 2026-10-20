const express = require('express')
const path = require('path')

const app = express()
app.use(express.json({ limit: '20mb' }))
app.use(express.urlencoded({ limit: '20mb', extended: true }))

const PASTA_PUBLICA = path.join(__dirname, '..', 'publico')
app.use(express.static(PASTA_PUBLICA))

app.use(require('./rotas/notificacoes'))
app.use(require('./rotas/login'))
app.use(require('./rotas/pedidos'))
app.use(require('./rotas/produtos'))
app.use(require('./rotas/recebimentos'))
app.use(require('./rotas/usuarios'))
app.use(require('./rotas/estoque'))
app.use(require('./rotas/alertas'))
app.use(require('./rotas/compras'))
app.use(require('./rotas/demandas'))
app.use(require('./rotas/contabil'))
app.use(require('./rotas/exportacao-contabil'))
app.use(require('./rotas/financeiro'))
app.use(require('./rotas/custos-importacao'))
app.use(require('./rotas/checklist'))
app.use(require('./rotas/tarefas'))
app.use(require('./rotas/catalogo'))

require('./rotinas/alertas')

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
app.listen(PORTA, '0.0.0.0', () => console.log(`Servidor rodando na porta ${PORTA}`))
