import { api } from '/JS/compartilhado/api.js'
import { $, iniciarPagina, esc, pill, avisar, normalizar, painelLateral } from '/JS/financeiro/comum.js'

let aba = location.hash === '#fornecedores' ? 'fornecedores' : 'clientes'
let clientes = []
let fornecedores = []
let busca = ''
let mostrarInativos = false

async function carregar() {
  const [c, f] = await Promise.all([api.cadastros.clientes(), api.cadastros.fornecedores()])
  clientes = Array.isArray(c) ? c : []
  fornecedores = Array.isArray(f) ? f : []
  render()
}

function render() {
  document.querySelectorAll('#abas-cad button').forEach((b) => b.classList.toggle('ativo', b.dataset.aba === aba))
  const ehCliente = aba === 'clientes'
  const base = ehCliente ? clientes : fornecedores
  const b = normalizar(busca)
  const lista = base.filter(
    (x) =>
      (mostrarInativos || x.ativo) &&
      (!b || normalizar(`${x.nome} ${x.pais} ${x.contato || ''} ${x.email || ''}`).includes(b))
  )
  const inativos = base.filter((x) => !x.ativo).length
  $('area-cad').innerHTML = `
    <div class="fin-barra">
      <input class="form-control form-control-sm busca" id="c-busca" placeholder="Buscar por nome ou país" value="${esc(busca)}">
      ${inativos ? `<button class="fin-chip ${mostrarInativos ? 'ativo' : ''}" id="c-inativos">Inativos (${inativos})</button>` : ''}
      <button class="btn btn-pietrobon btn-sm ms-auto" id="c-novo">+ Novo ${ehCliente ? 'cliente' : 'fornecedor'}</button>
    </div>
    <div class="fin-cartao"><div class="table-responsive"><table class="fin-tabela">
      <thead><tr><th>Nome</th><th>País</th>${ehCliente ? '<th class="num">Notas</th>' : '<th>Moeda</th><th class="oculta-celular">Contato</th><th class="num">Importações</th>'}<th>Situação</th></tr></thead>
      <tbody>${
        lista.length
          ? lista
              .map(
                (x) => `<tr class="clicavel" data-id="${x.id}">
          <td class="texto-forte">${esc(x.nome)}</td><td>${esc(x.pais || '—')}</td>
          ${ehCliente ? `<td class="num">${x.qtd_notas || 0}</td>` : `<td>${esc(x.moeda || 'USD')}</td><td class="oculta-celular">${esc(x.contato || '')}${x.email ? `<div class="texto-sub">${esc(x.email)}</div>` : ''}</td><td class="num">${x.qtd_importacoes || 0}</td>`}
          <td>${x.ativo ? pill('Ativo', 'quitada') : pill('Inativo', 'neutro')}</td>
        </tr>`
              )
              .join('')
          : `<tr><td colspan="6"><div class="fin-vazio">Nenhum ${ehCliente ? 'cliente' : 'fornecedor'} encontrado.</div></td></tr>`
      }</tbody></table></div></div>`
  $('c-busca').addEventListener('input', (e) => {
    busca = e.target.value
    const pos = e.target.selectionStart
    render()
    $('c-busca').focus()
    $('c-busca').setSelectionRange(pos, pos)
  })
  if ($('c-inativos'))
    $('c-inativos').addEventListener('click', () => {
      mostrarInativos = !mostrarInativos
      render()
    })
  $('c-novo').addEventListener('click', () => abrirForm(null))
  document
    .querySelectorAll('tr[data-id]')
    .forEach((tr) => tr.addEventListener('click', () => abrirForm(Number(tr.dataset.id))))
}

function abrirForm(id) {
  const ehCliente = aba === 'clientes'
  const ed = id ? (ehCliente ? clientes : fornecedores).find((x) => x.id === id) : null
  const p = painelLateral('painel-cadastro', ed ? ed.nome : ehCliente ? 'Novo cliente' : 'Novo fornecedor')
  p.corpo.innerHTML = `
    <div class="row g-2">
      <div class="col-12"><label class="form-label">Nome</label><input id="x-nome" class="form-control form-control-sm" value="${esc(ed?.nome || '')}"></div>
      <div class="col-6"><label class="form-label">País</label><input id="x-pais" class="form-control form-control-sm" value="${esc(ed?.pais || '')}"></div>
      ${
        ehCliente
          ? ''
          : `<div class="col-6"><label class="form-label">Moeda</label><select id="x-moeda" class="form-select form-select-sm">${['USD', 'EUR', 'CNY', 'BRL'].map((m) => `<option ${(ed?.moeda || 'USD') === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="col-6"><label class="form-label">Contato</label><input id="x-contato" class="form-control form-control-sm" value="${esc(ed?.contato || '')}"></div>
      <div class="col-6"><label class="form-label">E-mail</label><input id="x-email" class="form-control form-control-sm" value="${esc(ed?.email || '')}"></div>
      <div class="col-12"><label class="form-label">Observações</label><input id="x-obs" class="form-control form-control-sm" value="${esc(ed?.obs || '')}"></div>`
      }
    </div>
    <div class="d-flex flex-wrap gap-2 mt-4">
      <button class="btn btn-ok-grande" id="x-salvar">${ed ? 'Salvar alterações' : 'Cadastrar'}</button>
      ${ed ? `<button class="btn btn-outline-secondary" id="x-ativo">${ed.ativo ? 'Desativar' : 'Reativar'}</button>` : ''}
      ${ed && !ehCliente && !Number(ed.qtd_importacoes) ? '<button class="btn btn-outline-danger ms-auto" id="x-excluir">Excluir</button>' : ''}
    </div>
    ${ed ? '<div class="texto-sub mt-3">Desativar esconde o cadastro das listas de seleção, mas mantém o histórico e os saldos.</div>' : ''}`
  const coletar = () => {
    const d = { nome: $('x-nome').value, pais: $('x-pais').value }
    if (!ehCliente) ['moeda', 'contato', 'email', 'obs'].forEach((k) => (d[k] = $('x-' + k).value))
    return d
  }
  $('x-salvar').addEventListener('click', async () => {
    const dados = coletar()
    const r = ehCliente
      ? ed
        ? await api.cadastros.editarCliente(ed.id, dados)
        : await api.cadastros.criarCliente(dados)
      : ed
        ? await api.cadastros.editarFornecedor(ed.id, dados)
        : await api.cadastros.criarFornecedor(dados)
    if (r?.erro) return avisar(r.erro, 'error')
    p.fechar()
    avisar('Cadastro salvo.')
    carregar()
  })
  if ($('x-ativo'))
    $('x-ativo').addEventListener('click', async () => {
      const r = ehCliente
        ? await api.cadastros.editarCliente(ed.id, { ativo: !ed.ativo })
        : await api.cadastros.editarFornecedor(ed.id, { ativo: !ed.ativo })
      if (r?.erro) return avisar(r.erro, 'error')
      p.fechar()
      carregar()
    })
  if ($('x-excluir'))
    $('x-excluir').addEventListener('click', async () => {
      if (!confirm(`Excluir ${ed.nome}?`)) return
      const r = await api.cadastros.excluirFornecedor(ed.id)
      if (r?.erro) return avisar(r.erro, 'error')
      p.fechar()
      carregar()
    })
  p.abrir()
  setTimeout(() => $('x-nome').focus(), 300)
}

function iniciar() {
  if (!iniciarPagina()) return
  $('conteudo-cadastros').innerHTML = `
    <div class="fin-abas" id="abas-cad">
      <button data-aba="clientes">Clientes</button>
      <button data-aba="fornecedores">Fornecedores</button>
    </div>
    <div id="area-cad"><p class="text-muted">Carregando...</p></div>`
  document.querySelectorAll('#abas-cad button').forEach((b) =>
    b.addEventListener('click', () => {
      aba = b.dataset.aba
      busca = ''
      mostrarInativos = false
      history.replaceState(null, '', '#' + aba)
      render()
    })
  )
  carregar()
}

iniciar()
