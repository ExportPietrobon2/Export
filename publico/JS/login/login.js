import { api } from '/JS/compartilhado/api.js'
import { obterPerfil, salvarToken } from '/JS/compartilhado/sessao.js'

const paginaPorPapel = {
  admin: '/HTML/producao/visao-geral.html',
  almoxarifado: '/HTML/estoque/almoxarifado.html',
  deposito: '/HTML/estoque/recebimento.html',
  convidado: '/HTML/producao/visao-geral.html',
  gerente_producao: '/HTML/estoque/embarques.html',
  compras: '/HTML/estoque/compras.html',
  compras_aromas: '/HTML/estoque/compras.html',
  auxiliar: '/HTML/tarefas/tarefas.html'
}

function redirecionarSeJaLogado() {
  const perfil = obterPerfil()
  if (perfil && paginaPorPapel[perfil.papel]) {
    window.location.href = paginaPorPapel[perfil.papel]
  }
}

document.getElementById('form-login').addEventListener('submit', async (evento) => {
  evento.preventDefault()

  const email = document.getElementById('campo-email').value.trim()
  const senha = document.getElementById('campo-senha').value
  const msgErro = document.getElementById('mensagem-erro')

  msgErro.textContent = ''

  const resultado = await api.login(email, senha)

  if (resultado.erro) {
    msgErro.textContent = resultado.erro
    return
  }

  salvarToken(resultado.token, resultado.papel)
  window.location.href = paginaPorPapel[resultado.papel]
})

redirecionarSeJaLogado()
