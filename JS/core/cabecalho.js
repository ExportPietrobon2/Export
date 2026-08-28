import { sair, getPerfil } from '/JS/core/auth.js'
import { api } from '/JS/core/api.js'
import { iniciarToast } from '/JS/core/toast.js'


const EMAILS_TAREFAS = [
  'export@pietrobon.com.br',
  'export2@pietrobon.com.br',
  'joaoantonio@pietrobon.com.br',
  'export3@pietrobon.com.br'
]

const EMAILS_FINANCEIRO = [
  'export2@pietrobon.com.br',
  'export@pietrobon.com.br',
  'joaoantonio@pietrobon.com.br'
]

async function carregarBadgesPendencias() {
  try {
    const pendencias = await api.pendencias()
    if (!pendencias || pendencias.erro) return

    const adicionarBadge = (href, quantidade, cor) => {
      if (!quantidade) return
      const link = document.querySelector(`#menu-principal a[href="${href}"]`)
      if (!link) return
      const badge = document.createElement('span')
      badge.className = `badge rounded-pill ${cor} ms-2`
      badge.style.fontSize = '0.68rem'
      badge.textContent = quantidade
      link.appendChild(badge)
    }

    adicionarBadge('/HTML/estoque/almoxarifado.html', pendencias.estoqueNaoDeclarado, 'bg-warning text-dark')
    adicionarBadge('/HTML/estoque/embarques.html', pendencias.embarquesPendentes, 'bg-secondary')
    adicionarBadge(
      '/HTML/estoque/compras.html',
      (pendencias.pedidosCompra || 0) + (pendencias.comprasAtrasadas || 0),
      'bg-danger'
    )
    adicionarBadge('/HTML/tarefas/tarefas.html', pendencias.tarefasPendentes, 'bg-primary')
  } catch (_) {}
}

async function registrarNotificacaoPush() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false

    const sw = await navigator.serviceWorker.ready
    const permissao = await Notification.requestPermission()
    if (permissao !== 'granted') return false

    const { key } = await fetch('/api/push/vapid-public').then((r) => r.json())
    const raw = atob(key.replace(/-/g, '+').replace(/_/g, '/'))
    const chaveVapid = new Uint8Array([...raw].map((c) => c.charCodeAt(0)))

    const inscricao = await sw.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: chaveVapid
    })

    const token = sessionStorage.getItem('token') || localStorage.getItem('token_deposito')
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(inscricao.toJSON())
    })

    return true
  } catch (_) {
    return false
  }
}

async function atualizarBotaoNotificacao(btn) {
  if (!('Notification' in window) || !('PushManager' in window)) {
    btn.style.display = 'none'
    return
  }

  if (Notification.permission === 'granted') {
    btn.title = 'Notificações ativadas'
    btn.innerHTML = '🔔'
    btn.style.opacity = '1'
  } else {
    btn.title = 'Ativar notificações'
    btn.innerHTML = '🔕'
    btn.style.opacity = '0.7'
  }
}

export function montarCabecalho(papel) {
  iniciarToast()

  const paginaAtual = document.body.dataset.pagina
  const perfil = getPerfil()
  const emailAtual = perfil ? (perfil.email || '').toLowerCase() : ''
  const temAcessoFinanceiro = EMAILS_FINANCEIRO.includes(emailAtual)
  const temAcessoTarefas = EMAILS_TAREFAS.includes(emailAtual)
  const temAcessoChecklist = [
    'export2@pietrobon.com.br',
    'export@pietrobon.com.br'
  ].includes(emailAtual)

  const secoes = [
    {
      titulo: 'Produção',
      itens: [
        { href: '/HTML/producao/admin.html', texto: 'Visão Geral das PIs' },
        { href: '/HTML/producao/cadastro.html', texto: 'Cadastrar PI' },
        { href: '/HTML/producao/checklist.html', texto: 'Check-list de Expedição', quando: temAcessoChecklist }
      ]
    },
    {
      titulo: 'Estoque e Compras',
      itens: [
        { href: '/HTML/estoque/almoxarifado.html', texto: 'Almoxarifado' },
        { href: '/HTML/estoque/recebimento.html', texto: 'Recebimentos' },
        { href: '/HTML/estoque/referencia.html', texto: 'Rendimentos' },
        { href: '/HTML/estoque/embarques.html', texto: 'Embarques' },
        { href: '/HTML/estoque/compras.html', texto: 'Compras' }
      ]
    },
    {
      titulo: 'Financeiro',
      quando: temAcessoFinanceiro,
      itens: [
        { href: '/HTML/financeiro/contabil.html', texto: 'Mensal Contabil' },
        { href: '/HTML/financeiro/exp-contabil.html', texto: 'Fechamento Contabil' },
        { href: '/HTML/financeiro/financeiro.html', texto: 'Importações' },
      ]
    }
    ,
    {
      titulo: 'Tarefas Exportação',
      quando: temAcessoTarefas,
      itens: [
        { href: '/HTML/tarefas/tarefas.html', texto: 'Quadro de Tarefas' }
      ]
    }
  ]

  const htmlSecoes = secoes
    .filter((s) => s.quando !== false)
    .map((s) => {
      const itens = s.itens.filter((it) => it.quando !== false)
      if (!itens.length) return ''

      const linhas = itens.map((it) => `
        <li>
          <a class="dropdown-item ${it.href.endsWith(paginaAtual) ? 'active' : ''}" href="${it.href}">
            ${it.texto}
          </a>
        </li>`).join('')

      return `
        <li><h6 class="dropdown-header text-uppercase fw-bold">${s.titulo}</h6></li>
        ${linhas}
        <li><hr class="dropdown-divider"></li>`
    }).join('')

  const nav = document.createElement('nav')
  nav.className = 'navbar navbar-pietrobon sticky-top'
  nav.innerHTML = `
    <div class="container-fluid px-3">
      <a class="navbar-brand d-flex align-items-center gap-2" href="/HTML/producao/admin.html">
        <img src="/logo.png" alt="Pietrobon" style="height:36px;object-fit:contain;">
      </a>
      <div class="d-flex align-items-center gap-2 ms-auto">
        <button id="btn-notificacao" title="Ativar notificações"
          style="display:none;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.4);
          border-radius:8px;color:#fff;padding:6px 10px;font-size:1rem;cursor:pointer;">🔕</button>
        <button id="btn-instalar" title="Instalar app"
          style="display:none;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.4);
          border-radius:8px;color:#fff;padding:6px 12px;font-size:0.82rem;font-weight:600;cursor:pointer;">
          Instalar
        </button>
        <div class="dropdown">
          <button class="btn btn-menu-pietrobon dropdown-toggle" type="button"
            data-bs-toggle="dropdown" aria-expanded="false">
            Menu
          </button>
          <ul class="dropdown-menu dropdown-menu-end shadow" id="menu-principal">
            ${htmlSecoes}
            <li><a class="dropdown-item text-danger fw-semibold" href="#" id="btn-sair">Sair</a></li>
          </ul>
        </div>
      </div>
    </div>`

  document.getElementById('cabecalho').appendChild(nav)
  document.getElementById('btn-sair').addEventListener('click', (e) => {
    e.preventDefault()
    sair()
  })

  carregarBadgesPendencias()

  const btnNotificacao = document.getElementById('btn-notificacao')
  if (btnNotificacao && 'Notification' in window && 'PushManager' in window) {
    btnNotificacao.style.display = 'inline-block'
    atualizarBotaoNotificacao(btnNotificacao)

    if (Notification.permission === 'granted') {
      registrarNotificacaoPush().catch(() => {})
    }

    btnNotificacao.addEventListener('click', async () => {
      if (Notification.permission === 'granted') return
      btnNotificacao.disabled = true
      const ok = await registrarNotificacaoPush()
      btnNotificacao.disabled = false
      atualizarBotaoNotificacao(btnNotificacao)
      if (ok) btnNotificacao.title = 'Notificações ativadas!'
    })
  }

  let promptInstalacao = null
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    promptInstalacao = e
    const btn = document.getElementById('btn-instalar')
    if (!btn) return
    btn.style.display = 'inline-block'
    btn.addEventListener('click', async () => {
      if (!promptInstalacao) return
      promptInstalacao.prompt()
      const { outcome } = await promptInstalacao.userChoice
      if (outcome === 'accepted') btn.style.display = 'none'
      promptInstalacao = null
    })
  })

  window.addEventListener('appinstalled', () => {
    const btn = document.getElementById('btn-instalar')
    if (btn) btn.style.display = 'none'
  })
}