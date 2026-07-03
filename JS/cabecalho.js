import { sair } from './auth.js'

export function montarCabecalho(papel) {
  const paginaAtual = document.body.dataset.pagina

  const todosLinks = [
    { href: '/HTML/cadastro.html', texto: 'Cadastro', papeis: ['admin'] },
    { href: '/HTML/recebimento.html', texto: 'Recebimento B2', papeis: ['admin', 'deposito'] },
    { href: '/HTML/almoxarifado.html', texto: 'Almoxarifado', papeis: ['admin', 'almoxarifado'] },
    { href: '/HTML/admin.html', texto: 'Painel Admin', papeis: ['admin'] }
  ]

  const nav = document.createElement('nav')
  nav.className = 'top-nav'

  const marca = document.createElement('span')
  marca.className = 'brand'
  marca.textContent = 'Controle de Insumos · Exportação'
  nav.appendChild(marca)

  const containerLinks = document.createElement('div')
  containerLinks.className = 'nav-links'

  todosLinks
    .filter((link) => link.papeis.includes(papel))
    .forEach((link) => {
      const a = document.createElement('a')
      a.href = link.href
      a.textContent = link.texto
      if (link.href.endsWith(paginaAtual)) a.className = 'active'
      containerLinks.appendChild(a)
    })

  const botaoSair = document.createElement('a')
  botaoSair.href = '#'
  botaoSair.className = 'link-sair'
  botaoSair.textContent = 'Sair'
  botaoSair.addEventListener('click', (e) => { e.preventDefault(); sair() })
  containerLinks.appendChild(botaoSair)

  nav.appendChild(containerLinks)
  document.getElementById('cabecalho').appendChild(nav)
}