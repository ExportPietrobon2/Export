import { montarCabecalho } from '/JS/core/cabecalho.js'
import { getPerfil, exigirPapel } from '/JS/core/auth.js'

const EMAILS_TAREFAS = [
  'export@pietrobon.com.br',
  'export2@pietrobon.com.br',
  'joaoantonio@pietrobon.com.br',
  'export3@pietrobon.com.br'
]

const NOMES = {
  'export@pietrobon.com.br':      { nome: 'Diego Diniz',   iniciais: 'DD' },
  'export2@pietrobon.com.br':     { nome: 'Kauã Mello',    iniciais: 'KM' },
  'joaoantonio@pietrobon.com.br': { nome: 'João Antonio',  iniciais: 'JA' },
  'export3@pietrobon.com.br':     { nome: 'Bernardo',      iniciais: 'BE' }
}

const URGENCIAS = [
  { k: 'urgente', label: 'Urgente', cor: '#E8313A', bg: '#fef2f2' },
  { k: 'alta',    label: 'Alta',    cor: '#f59332', bg: '#fff8f0' },
  { k: 'normal',  label: 'Normal',  cor: '#64748b', bg: '#f8fafc' },
  { k: 'baixa',   label: 'Baixa',   cor: '#3b82f6', bg: '#eff6ff' }
]

const LABEL_COL = { a_fazer: 'A Fazer', em_progresso: 'Em Progresso', concluido: 'Concluído' }
const COR_COL   = { a_fazer: '#94a3b8', em_progresso: '#3b82f6', concluido: '#16a34a' }
const COLUNAS   = ['a_fazer', 'em_progresso', 'concluido']

let tarefas    = []
let modalBS    = null
let emailAtual = ''

async function requisitar(metodo, rota, corpo) {
  const token = sessionStorage.getItem('token') || localStorage.getItem('token_deposito')
  const opts = { method: metodo, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
  if (corpo) opts.body = JSON.stringify(corpo)
  try {
    const resp = await fetch(rota, opts)
    const json = await resp.json()
    if (!resp.ok) return { erro: json.erro || `Erro ${resp.status}` }
    return json
  } catch { return { erro: 'Sem conexão com o servidor.' } }
}

async function carregarTarefas() {
  const dados = await requisitar('GET', '/api/tarefas')
  if (Array.isArray(dados)) { tarefas = dados; renderizarBoard() }
}

function chipStatus(coluna) {
  const cor   = COR_COL[coluna] || '#94a3b8'
  const label = LABEL_COL[coluna] || coluna
  return `<span style="display:inline-block;font-size:.65rem;font-weight:700;
    background:${cor}22;color:${cor};border:1px solid ${cor}44;
    border-radius:999px;padding:1px 8px;white-space:nowrap">${label}</span>`
}

function chipPrazo(prazoStr) {
  if (!prazoStr) return ''
  const prazo = String(prazoStr).slice(0, 10)
  const hoje  = new Date().toISOString().slice(0, 10)
  let cor = '#64748b', fw = '500'
  if (prazo < hoje)   { cor = '#b91c1c'; fw = '700' }
  else if (prazo === hoje) { cor = '#c2680a'; fw = '700' }
  const [y, m, d] = prazo.split('-')
  return `<span style="font-size:.7rem;color:${cor};font-weight:${fw}">📅 ${d}/${m}/${y}</span>`
}

function cardHtml(t) {
  const concluida = t.coluna === 'concluido'
  return `<div class="tarefa-card${concluida ? ' concluida' : ''}"
    id="card-${t.id}" data-id="${t.id}">
    <div class="card-topo">
      <div class="card-titulo${concluida ? ' riscado' : ''}">${escHtml(t.titulo)}</div>
      <div class="card-acoes">
        <button class="btn-card" title="Editar"  onclick="abrirModal(${t.id})">✏️</button>
        <button class="btn-card excluir" title="Excluir" onclick="excluirTarefa(${t.id})">🗑</button>
      </div>
    </div>
    ${t.descricao ? `<div class="card-desc">${escHtml(t.descricao)}</div>` : ''}
    <div class="card-rodape">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        ${chipStatus(t.coluna)}
        ${chipPrazo(t.prazo)}
      </div>
      <div style="display:flex;gap:4px">${setas(t)}</div>
    </div>
  </div>`
}

function setas(t) {
  const idx = COLUNAS.indexOf(t.coluna)
  const esq = idx > 0
    ? `<button class="btn-card" title="← ${LABEL_COL[COLUNAS[idx-1]]}" onclick="moverTarefa(${t.id},'${COLUNAS[idx-1]}')">◀</button>` : ''
  const dir = idx < COLUNAS.length - 1
    ? `<button class="btn-card" title="→ ${LABEL_COL[COLUNAS[idx+1]]}" onclick="moverTarefa(${t.id},'${COLUNAS[idx+1]}')">▶</button>` : ''
  return esq + dir
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

window.renderizarBoard = function() {
  const busca        = (document.getElementById('busca')?.value || '').toLowerCase()
  const filtroResp   = document.getElementById('filtro-responsavel')?.value || ''
  const filtroStatus = document.getElementById('filtro-status')?.value || ''

  const filtradas = tarefas.filter(t => {
    if (busca && !t.titulo.toLowerCase().includes(busca) && !(t.descricao||'').toLowerCase().includes(busca)) return false
    if (filtroResp   && t.responsavel !== filtroResp)  return false
    if (filtroStatus && t.coluna      !== filtroStatus) return false
    return true
  })

  const usuariosParaMostrar = filtroResp
    ? [filtroResp]
    : [emailAtual, ...EMAILS_TAREFAS.filter(e => e !== emailAtual)]

  const board = document.getElementById('board')
  board.innerHTML = ''

  usuariosParaMostrar.forEach(email => {
    const u      = NOMES[email] || { nome: email, iniciais: '?' }
    const isVoce = email === emailAtual
    const minhas = filtradas.filter(t => (t.responsavel || '') === email)
    const total  = minhas.length

    const section = document.createElement('div')
    section.className = 'usuario-section'
    section.dataset.email = email

    const corAvatar = isVoce ? 'linear-gradient(110deg,#E8313A,#F0503A)' : '#64748b'

    section.innerHTML = `
      <div class="usuario-section-header${isVoce ? ' header-voce' : ''}">
        <span class="u-avatar" style="background:${corAvatar}">${u.iniciais}</span>
        <span class="u-nome">${u.nome}${isVoce ? ' <span class="grupo-voce">você</span>' : ''}</span>
        <span class="u-total">${total} tarefa${total !== 1 ? 's' : ''}</span>
      </div>
      <div class="urgencia-columns">
        ${URGENCIAS.map(urg => {
          const items = minhas.filter(t => t.prioridade === urg.k)
          const cards = items.length
            ? items.map(t => cardHtml(t)).join('')
            : `<div class="urgencia-vazia">Nenhuma</div>`
          return `
            <div class="urgencia-col" style="--urg-cor:${urg.cor};--urg-bg:${urg.bg}">
              <div class="urgencia-col-header">
                <span class="urgencia-dot"></span>
                ${urg.label}
                <span class="urgencia-count">${items.length}</span>
              </div>
              <div class="urgencia-cards">${cards}</div>
              <button class="btn-nova-tarefa" onclick="abrirModal(null,'a_fazer','${email}','${urg.k}')">＋</button>
            </div>`
        }).join('')}
      </div>`

    board.appendChild(section)
  })

  // Sem responsável
  if (!filtroResp) {
    const semDono = filtradas.filter(t => !t.responsavel)
    if (semDono.length) {
      const sec = document.createElement('div')
      sec.className = 'usuario-section'
      const cards = semDono.map(t => cardHtml(t)).join('')
      sec.innerHTML = `
        <div class="usuario-section-header">
          <span class="u-avatar" style="background:#94a3b8">?</span>
          <span class="u-nome">Sem responsável</span>
          <span class="u-total">${semDono.length}</span>
        </div>
        <div class="urgencia-columns">
          ${URGENCIAS.map(urg => {
            const items = semDono.filter(t => t.prioridade === urg.k)
            return `<div class="urgencia-col" style="--urg-cor:${urg.cor};--urg-bg:${urg.bg}">
              <div class="urgencia-col-header"><span class="urgencia-dot"></span>${urg.label}<span class="urgencia-count">${items.length}</span></div>
              <div class="urgencia-cards">${items.length ? items.map(t => cardHtml(t)).join('') : '<div class="urgencia-vazia">Nenhuma</div>'}</div>
              <button class="btn-nova-tarefa" onclick="abrirModal(null,'a_fazer','','${urg.k}')">＋</button>
            </div>`
          }).join('')}
        </div>`
      board.appendChild(sec)
    }
  }
}

window.moverTarefa = async function(id, novaColuna) {
  const t = tarefas.find(x => x.id === id)
  if (!t || t.coluna === novaColuna) return
  t.coluna = novaColuna; renderizarBoard()
  const res = await requisitar('PATCH', `/api/tarefas/${id}`, { coluna: novaColuna })
  if (res?.erro) { alert(res.erro); await carregarTarefas() }
}

window.abrirModal = function(id, colunaInicial, responsavelInicial, prioridadeInicial) {
  const t = id ? tarefas.find(x => x.id === id) : null
  document.getElementById('modal-titulo-label').textContent = t ? 'Editar Tarefa' : 'Nova Tarefa'
  document.getElementById('modal-id').value          = t?.id    || ''
  document.getElementById('modal-titulo').value      = t?.titulo || ''
  document.getElementById('modal-descricao').value   = t?.descricao || ''
  document.getElementById('modal-prioridade').value  = t?.prioridade || prioridadeInicial || 'normal'
  document.getElementById('modal-coluna').value      = t?.coluna    || colunaInicial     || 'a_fazer'
  document.getElementById('modal-responsavel').value = t?.responsavel || responsavelInicial || emailAtual || ''
  document.getElementById('modal-prazo').value       = t?.prazo ? String(t.prazo).slice(0, 10) : ''
  if (!modalBS) modalBS = new bootstrap.Modal(document.getElementById('modal-tarefa'))
  modalBS.show()
  setTimeout(() => document.getElementById('modal-titulo').focus(), 350)
}

window.salvarTarefa = async function() {
  const titulo      = document.getElementById('modal-titulo').value.trim()
  const responsavel = document.getElementById('modal-responsavel').value
  if (!titulo)      { alert('Informe o título da tarefa.'); return }
  if (!responsavel) { alert('Selecione um responsável.'); document.getElementById('modal-responsavel').focus(); return }

  const btn = document.getElementById('btn-salvar-tarefa')
  btn.disabled = true; btn.textContent = 'Salvando...'

  const id    = document.getElementById('modal-id').value
  const dados = {
    titulo, responsavel,
    descricao:  document.getElementById('modal-descricao').value.trim() || null,
    prioridade: document.getElementById('modal-prioridade').value,
    coluna:     document.getElementById('modal-coluna').value,
    prazo:      document.getElementById('modal-prazo').value || null
  }
  const res = id
    ? await requisitar('PATCH', `/api/tarefas/${id}`, dados)
    : await requisitar('POST',  '/api/tarefas', dados)

  btn.disabled = false; btn.textContent = 'Salvar'
  if (res?.erro) { alert(res.erro); return }
  modalBS?.hide()
  await carregarTarefas()
  window.toast?.success(id ? 'Tarefa atualizada!' : 'Tarefa criada!')
}

window.excluirTarefa = async function(id) {
  if (!confirm('Excluir esta tarefa?')) return
  tarefas = tarefas.filter(t => t.id !== id); renderizarBoard()
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
  document.getElementById('modal-tarefa').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') salvarTarefa()
  })
  await carregarTarefas()
}

iniciar()