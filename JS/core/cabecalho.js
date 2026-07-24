import { sair, getPerfil } from '/JS/core/auth.js'
import { api } from '/JS/core/api.js'
import { iniciarChat } from '/JS/core/chat.js'

const EMAILS_FINANCEIRO = ['export2@pietrobon.com.br', 'export@pietrobon.com.br', 'joaoantonio@pietrobon.com.br']

async function carregarBadgesPendencias() {
 try {
 const p = await api.pendencias()
 if (!p || p.erro) return
 const add = (href, n, cor) => {
 if (!n) return
 const link = document.querySelector(`#menu-principal a[href="${href}"]`)
 if (!link) return
 const b = document.createElement('span')
 b.className = `badge rounded-pill ${cor} ms-2`
 b.style.fontSize = '0.68rem'
 b.textContent = n
 link.appendChild(b)
 }
 add('/HTML/estoque/almoxarifado.html', p.estoqueNaoDeclarado, 'bg-warning text-dark')
 add('/HTML/estoque/embarques.html', p.embarquesPendentes, 'bg-secondary')
 add('/HTML/estoque/compras.html', (p.pedidosCompra || 0) + (p.comprasAtrasadas || 0), 'bg-danger')
 } catch (e) { /* silencioso */ }
}

export function montarCabecalho(papel) {
 const paginaAtual = document.body.dataset.pagina
 const perfil = getPerfil()
 const emailAtual = perfil ? (perfil.email || '').toLowerCase() : ''
 const ehContabil = EMAILS_FINANCEIRO.includes(emailAtual)
 const ehChecklist = ['export2@pietrobon.com.br', 'export@pietrobon.com.br'].includes(emailAtual)

 const brandHref = '/HTML/producao/admin.html'

 // Menu organizado por seções. Cada item pode ter "quando" para controlar acesso.
 const secoes = [
 { titulo: 'Produção', itens: [
 { href: '/HTML/producao/admin.html', texto: 'Visão Geral das PIs' },
 { href: '/HTML/producao/cadastro.html', texto: 'Cadastrar PIs' },
 { href: '/HTML/producao/ordem-producao.html', texto: 'Ordem de Produção', quando: ehContabil },
 { href: '/HTML/producao/checklist.html', texto: 'Check-list de Expedição', quando: ehChecklist }
 ] },
 { titulo: 'Estoque & Compras', itens: [
 { href: '/HTML/estoque/almoxarifado.html', texto: 'Almoxarifado' },
 { href: '/HTML/estoque/recebimento.html', texto: 'Recebimento B2' },
 { href: '/HTML/estoque/referencia.html', texto: 'Rendimentos' },
 { href: '/HTML/estoque/embarques.html', texto: 'Embarques' },
 { href: '/HTML/estoque/compras.html', texto: 'Compras' }
 ] },
 { titulo: 'Financeiro', quando: ehContabil, itens: [
 { href: '/HTML/financeiro/contabil.html', texto: 'Contábil / Faturamento' },
 { href: '/HTML/financeiro/exp-contabil.html', texto: 'Contab. de Exportação' },
 { href: '/HTML/financeiro/financeiro.html', texto: 'Financeiro (Importações)' }
 ] }
 ]

 const secoesMenu = secoes
 .filter((s) => s.quando !== false)
 .map((s) => {
 const itens = s.itens.filter((it) => it.quando !== false)
 if (!itens.length) return ''
 const linhas = itens.map((it) => `
 <li><a class="dropdown-item ${it.href.endsWith(paginaAtual) ? 'active' : ''}" href="${it.href}">${it.texto}</a></li>`).join('')
 return `
 <li><h6 class="dropdown-header text-uppercase fw-bold">${s.titulo}</h6></li>${linhas}
 <li><hr class="dropdown-divider"></li>`
 }).join('')

 const nav = document.createElement('nav')
 nav.className = 'navbar navbar-pietrobon sticky-top'
 nav.innerHTML = `
 <div class="container-fluid px-3"><a class="navbar-brand d-flex align-items-center gap-2" href="${brandHref}"><img src="/logo.png" alt="Pietrobon" style="height:36px;object-fit:contain;"></a><div class="d-flex align-items-center gap-2 ms-auto"><button id="btn-instalar-topo" title="Instalar app" style="display:none;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.4);border-radius:8px;color:#fff;padding:6px 12px;font-size:0.82rem;font-weight:600;cursor:pointer;">
 Instalar
 </button><div class="dropdown"><button class="btn btn-menu-pietrobon dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
 Menu
 </button><ul class="dropdown-menu dropdown-menu-end shadow" id="menu-principal">
 ${secoesMenu}
 <li><a class="dropdown-item text-danger fw-semibold" href="#" id="btn-sair">Sair</a></li></ul></div></div></div>
 `
 document.getElementById('cabecalho').appendChild(nav)
 document.getElementById('btn-sair').addEventListener('click', (e) => { e.preventDefault(); sair() })
 carregarBadgesPendencias()
 iniciarChat(papel)

 let promptInstalacao = null
 window.addEventListener('beforeinstallprompt', (e) => {
 e.preventDefault()
 promptInstalacao = e
 const btn = document.getElementById('btn-instalar-topo')
 if (btn) {
 btn.style.display = 'inline-block'
 btn.addEventListener('click', async () => {
 if (!promptInstalacao) return
 promptInstalacao.prompt()
 const { outcome } = await promptInstalacao.userChoice
 if (outcome === 'accepted') btn.style.display = 'none'
 promptInstalacao = null
 })
 }
 })
 window.addEventListener('appinstalled', () => {
 const btn = document.getElementById('btn-instalar-topo')
 if (btn) btn.style.display = 'none'
 })
}