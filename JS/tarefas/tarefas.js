import { montarCabecalho } from '/JS/core/cabecalho.js'
import { getPerfil, exigirPapel } from '/JS/core/auth.js'

const EMAILS_TAREFAS = [
  'export@pietrobon.com.br',
  'export2@pietrobon.com.br',
  'joaoantonio@pietrobon.com.br',
  'auxiliarexp@pietrobon.com.br'
]

const NOMES = {
  'export@pietrobon.com.br':       { nome: 'Export',    iniciais: 'EX' },
  'export2@pietrobon.com.br':      { nome: 'Export 2',  iniciais: 'E2' },
  'joaoantonio@pietrobon.com.br':  { nome: 'João',      iniciais: 'JA' },
  'auxiliarexp@pietrobon.com.br':  { nome: 'Auxiliar',  iniciais: 'AX' }
}

const COLUNAS = ['a_fazer', 'em_progresso', 'concluido']

let tarefas = []
let modalBS = null
let emailAtual = ''

async function requisitar(metodo, rota, corpo) {
  const token = sessionStorage.getItem('token') || localStorage.getItem('token_deposito')
  const opts = {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  }
  if (corpo) opts.body = JSON.stringify(corpo)
  try {
    const resp = await fetch(rota, opts)
    const json = await resp.json()
    if (!resp.ok) return { erro: json.erro || `Erro ${resp.status}` }
    return json
  } catch {
    return { erro: 'Sem conexão com o servidor.' }
  }
}

async function carregarTarefas() {
  const dados = await requisitar('GET', '/api/tarefas')
  if (Array.isArray(dados)) {
    tarefas = dados
    renderizarBoard()
  }
}

function agruparPorUsuario(items) {
  const filtroAtivo = document.getElementById('filtro-responsavel')?.value || ''
  if (filtroAtivo) return [{ email: filtroAtivo, items }]

  const grupos = []
  const ordem = [emailAtual, ...EMAILS_TAREFAS.filter(e => e !== emailAtual)]

  for (const email of ordem) {
    const doUsuario = items.filter(t => (t.responsavel || '').toLowerCase() === email)
    if (doUsuario.length) grupos.push({ email, items: doUsuario })
  }

  const semDono = items.filter(t => !t.responsavel || !NOMES[t.responsavel])
  if (semDono.length) grupos.push({ email: null, items: semDono })

  return grupos
}

function cabecalhoGrupoHtml(email) {
  if (!email) {
    return `<div class="grupo-header"><span class="grupo-avatar" style="background:#94a3b8">—</span><span class="grupo-nome">Sem responsável</span></div>`
  }
  const u = NOMES[email]
  if (!u) return ''
  const isVoce = email === emailAtual
  const label = isVoce ? `${u.nome} <span class="grupo-voce">você</span>` : u.nome
  const corAvatar = isVoce ? 'linear-gradient(110deg,#E8313A,#F0503A)' : '#64748b'
  return `<div class="grupo-header${isVoce ? ' grupo-header-voce' : ''}">
    <span class="grupo-avatar" style="background:${corAvatar}">${u.iniciais}</span>
    <span class="grupo-nome">${label}</span>
  </div>`
}

window.renderizarBoard = function() {
  const busca = (document.getElementById('busca')?.value || '').toLowerCase()
  const filtroResp = document.getElementById('filtro-responsavel')?.value || ''
  const filtroPrior = document.getElementById('filtro-prioridade')?.value || ''

  const filtradas = tarefas.filter((t) => {
    if (busca && !t.titulo.toLowerCase().includes(busca) && !(t.descricao || '').toLowerCase().includes(busca)) return false
    if (filtroResp && t.responsavel !== filtroResp) return false
    if (filtroPrior && t.prioridade !== filtroPrior) return false
    return true
  })

  COLUNAS.forEach((col) => {
    const cont = document.getElementById(`cards-${col}`)
    const badge = document.getElementById(`badge-${col}`)
    const items = filtradas.filter((t) => t.coluna === col)
    badge.textContent = items.length

    if (!items.length) {
      cont.innerHTML = `<div class="empty-coluna">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12h8M12 8v8"/></svg>
        <div>Nenhuma tarefa aqui</div>
      </div>`
      return
    }

    const grupos = agruparPorUsuario(items)
    const mostrarCabecalho = grupos.length > 1 || !filtroResp

    cont.innerHTML = grupos.map(g => `
      <div class="grupo-section">
        ${mostrarCabecalho ? cabecalhoGrupoHtml(g.email) : ''}
        <div class="grupo-cards">${g.items.map(cardHtml).join('')}</div>
      </div>
    `).join('')

    items.forEach((t) => setupCardDrag(t.id))
  })

  setupColunasDrop()
}

function cardHtml(t) {
  const prazoHtml = t.prazo ? chipPrazo(t.prazo) : ''
  const concluida = t.coluna === 'concluido' ? 'concluida' : ''
  const setasHtml = setas(t)

  return `<div class="tarefa-card prioridade-${t.prioridade} ${concluida}"
    draggable="true" id="card-${t.id}" data-id="${t.id}">
    <div class="card-topo">
      <div class="card-titulo">${escHtml(t.titulo)}</div>
      <div class="card-acoes">
        <button class="btn-card" title="Editar" onclick="abrirModal(${t.id})">✏️</button>
        <button class="btn-card excluir" title="Excluir" onclick="excluirTarefa(${t.id})">🗑</button>
      </div>
    </div>
    ${t.descricao ? `<div class="card-desc">${escHtml(t.descricao)}</div>` : ''}
    <div class="card-rodape">
      <div class="card-meta">
        <span class="chip-prioridade chip-${t.prioridade}">${labelPrioridade(t.prioridade)}</span>
        ${prazoHtml}
      </div>
      <div style="display:flex;gap:4px;">${setasHtml}</div>
    </div>
  </div>`
}

function setas(t) {
  const idx = COLUNAS.indexOf(t.coluna)
  const esq = idx > 0
    ? `<button class="btn-card" title="Mover para ${labelColuna(COLUNAS[idx-1])}" onclick="moverTarefa(${t.id},'${COLUNAS[idx-1]}')">◀</button>`
    : ''
  const dir = idx < COLUNAS.length - 1
    ? `<button class="btn-card" title="Mover para ${labelColuna(COLUNAS[idx+1])}" onclick="moverTarefa(${t.id},'${COLUNAS[idx+1]}')">▶</button>`
    : ''
  return esq + dir
}

function chipPrazo(prazoStr) {
  const hoje = new Date().toISOString().slice(0, 10)
  let cls = 'chip-prazo'
  if (prazoStr < hoje) cls += ' vencido'
  else if (prazoStr === hoje) cls += ' hoje'
  const [y, m, d] = prazoStr.split('-')
  return `<span class="${cls}">📅 ${d}/${m}/${y}</span>`
}

function labelPrioridade(p) {
  return { baixa: 'Baixa', normal: 'Normal', alta: 'Alta', urgente: 'Urgente' }[p] || p
}

function labelColuna(c) {
  return { a_fazer: 'A Fazer', em_progresso: 'Em Progresso', concluido: 'Concluído' }[c] || c
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function setupCardDrag(id) {
  const el = document.getElementById(`card-${id}`)
  if (!el) return
  el.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', String(id))
    setTimeout(() => el.classList.add('dragging'), 0)
  })
  el.addEventListener('dragend', () => el.classList.remove('dragging'))
}

function setupColunasDrop() {
  COLUNAS.forEach((col) => {
    const el = document.getElementById(`col-${col}`)
    if (!el) return
    el.ondragover = (e) => { e.preventDefault(); el.classList.add('drag-over') }
    el.ondragleave = () => el.classList.remove('drag-over')
    el.ondrop = (e) => {
      e.preventDefault()
      el.classList.remove('drag-over')
      const id = parseInt(e.dataTransfer.getData('text/plain'))
      if (id) moverTarefa(id, col)
    }
  })
}

window.moverTarefa = async function(id, novaColuna) {
  const t = tarefas.find((x) => x.id === id)
  if (!t || t.coluna === novaColuna) return
  t.coluna = novaColuna
  renderizarBoard()
  const res = await requisitar('PATCH', `/api/tarefas/${id}`, { coluna: novaColuna })
  if (res?.erro) { alert(res.erro); await carregarTarefas() }
}

window.abrirModal = function(id, colunaInicial) {
  const t = id ? tarefas.find((x) => x.id === id) : null
  document.getElementById('modal-titulo-label').textContent = t ? 'Editar Tarefa' : 'Nova Tarefa'
  document.getElementById('modal-id').value = t?.id || ''
  document.getElementById('modal-titulo').value = t?.titulo || ''
  document.getElementById('modal-descricao').value = t?.descricao || ''
  document.getElementById('modal-prioridade').value = t?.prioridade || 'normal'
  document.getElementById('modal-coluna').value = t?.coluna || colunaInicial || 'a_fazer'
  document.getElementById('modal-responsavel').value = t?.responsavel || ''
  document.getElementById('modal-prazo').value = t?.prazo ? t.prazo.slice(0, 10) : ''
  if (!modalBS) modalBS = new bootstrap.Modal(document.getElementById('modal-tarefa'))
  modalBS.show()
  setTimeout(() => document.getElementById('modal-titulo').focus(), 350)
}

window.salvarTarefa = async function() {
  const titulo = document.getElementById('modal-titulo').value.trim()
  if (!titulo) { alert('Informe o título da tarefa.'); return }

  const btn = document.getElementById('btn-salvar-tarefa')
  btn.disabled = true
  btn.textContent = 'Salvando...'

  const id = document.getElementById('modal-id').value
  const dados = {
    titulo,
    descricao: document.getElementById('modal-descricao').value.trim() || null,
    prioridade: document.getElementById('modal-prioridade').value,
    coluna: document.getElementById('modal-coluna').value,
    responsavel: document.getElementById('modal-responsavel').value || null,
    prazo: document.getElementById('modal-prazo').value || null
  }

  const res = id
    ? await requisitar('PATCH', `/api/tarefas/${id}`, dados)
    : await requisitar('POST', '/api/tarefas', dados)

  btn.disabled = false
  btn.textContent = 'Salvar'
  if (res?.erro) { alert(res.erro); return }

  modalBS?.hide()
  await carregarTarefas()
  window.toast?.success(id ? 'Tarefa atualizada!' : 'Tarefa criada!')
}

window.excluirTarefa = async function(id) {
  if (!confirm('Excluir esta tarefa?')) return
  tarefas = tarefas.filter((t) => t.id !== id)
  renderizarBoard()
  const res = await requisitar('DELETE', `/api/tarefas/${id}`)
  if (res?.erro) { alert(res.erro); await carregarTarefas(); return }
  window.toast?.success('Tarefa excluída.')
}

async function iniciar() {
  const perfil = exigirPapel('todos')
  if (!perfil) return
  if (!EMAILS_TAREFAS.includes((perfil.email || '').toLowerCase())) {
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:Inter,sans-serif;color:#64748b;">Acesso restrito.</div>'
    return
  }
  emailAtual = (perfil.email || '').toLowerCase()
  montarCabecalho(perfil.papel)
  document.getElementById('modal-tarefa').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') salvarTarefa()
  })
  await carregarTarefas()
}

iniciar()