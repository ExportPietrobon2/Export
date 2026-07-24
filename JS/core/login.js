import { api } from '/JS/core/api.js'
import { getPerfil, salvarToken } from '/JS/core/auth.js'

const paginaPorPapel = {
  admin: '/HTML/producao/admin.html',
  almoxarifado: '/HTML/estoque/almoxarifado.html',
  deposito: '/HTML/estoque/recebimento.html',
  convidado: '/HTML/producao/admin.html',
  gerente_producao: '/HTML/estoque/embarques.html',
  compras: '/HTML/estoque/compras.html',
  compras_aromas: '/HTML/estoque/compras.html'
}

function redirecionarSeLogado() {
  const perfil = getPerfil()
  if (perfil && paginaPorPapel[perfil.papel]) {
    window.location.href = paginaPorPapel[perfil.papel]
  }
}

document.getElementById('form-login').addEventListener('submit', async (evento) => {
  evento.preventDefault()
  const email = document.getElementById('campo-email').value.trim()
  const senha = document.getElementById('campo-senha').value
  const mensagemErro = document.getElementById('mensagem-erro')
  mensagemErro.textContent = ''

  const resultado = await api.login(email, senha)

  if (resultado.erro) {
    mensagemErro.textContent = resultado.erro
    return
  }

  salvarToken(resultado.token, resultado.papel)
  window.location.href = paginaPorPapel[resultado.papel]
})

redirecionarSeLogado()