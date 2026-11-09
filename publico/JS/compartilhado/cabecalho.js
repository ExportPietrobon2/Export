import { sair, obterPerfil } from '/JS/compartilhado/sessao.js'
import { api } from '/JS/compartilhado/api.js'
import { iniciarAvisos } from '/JS/compartilhado/avisos.js'
import { iniciarRecolhiveis } from '/JS/compartilhado/secoes-recolhiveis.js'

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

    adicionarBadge('/HTML/financeiro/importacoes.html', pendencias.importacoesVencidas, 'bg-danger')
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

    const token = sessionStorage.getItem('token')
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

  if (Notification.permission !== 'default') {
    btn.style.display = 'none'
    return
  }

  btn.style.display = 'inline-block'
  btn.title = 'Ativar notificações'
  btn.innerHTML = '🔔'
  btn.style.opacity = '1'
}

export function montarCabecalho() {
  iniciarAvisos()

  const paginaAtual = document.body.dataset.pagina
  obterPerfil()

  const secoes = [
    {
      titulo: 'Financeiro',
      itens: [
        { href: '/HTML/financeiro/painel.html', texto: 'Painel financeiro' },
        { href: '/HTML/financeiro/importacoes.html', texto: 'Importações e câmbio' },
        { href: '/HTML/financeiro/mensal-contabil.html', texto: 'Faturamento (NF-e)' },
        { href: '/HTML/financeiro/fechamento-contabil.html', texto: 'Fechamento contábil' },
        { href: '/HTML/financeiro/cadastros.html', texto: 'Clientes e fornecedores' }
      ]
    },
    {
      titulo: 'Exportação',
      itens: [
        { href: '/HTML/producao/checklist.html', texto: 'Check-list de expedição' },
        { href: '/HTML/tarefas/tarefas.html', texto: 'Quadro de tarefas' },
        { href: '/HTML/estoque/rendimentos.html', texto: 'Rendimentos' }
      ]
    }
  ]

  const htmlSecoes = secoes
    .filter((s) => s.quando !== false)
    .map((s) => {
      const itens = s.itens.filter((it) => it.quando !== false)
      if (!itens.length) return ''

      const linhas = itens
        .map(
          (it) => `
        <li>
          <a class="dropdown-item ${it.href.endsWith(paginaAtual) ? 'active' : ''}" href="${it.href}">
            ${it.texto}
          </a>
        </li>`
        )
        .join('')

      return `
        <li><h6 class="dropdown-header text-uppercase fw-bold">${s.titulo}</h6></li>
        ${linhas}
        <li><hr class="dropdown-divider"></li>`
    })
    .join('')

  const nav = document.createElement('nav')
  nav.className = 'navbar navbar-pietrobon sticky-top'
  nav.innerHTML = `
    <div class="container-fluid px-3">
      <a class="navbar-brand d-flex align-items-center gap-2" href="/HTML/financeiro/painel.html">
        <img src="/logo.png" alt="Hub de Exportações Pietrobon" style="height:36px;object-fit:contain;">
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
  iniciarRecolhiveis()

  const btnNotificacao = document.getElementById('btn-notificacao')
  if (btnNotificacao && 'Notification' in window && 'PushManager' in window) {
    atualizarBotaoNotificacao(btnNotificacao)

    if (Notification.permission === 'granted') {
      registrarNotificacaoPush().catch(() => {})
    }

    btnNotificacao.addEventListener('click', async () => {
      if (Notification.permission !== 'default') return
      btnNotificacao.disabled = true
      await registrarNotificacaoPush()
      btnNotificacao.disabled = false
      atualizarBotaoNotificacao(btnNotificacao)
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
