import { api } from '/JS/core/api.js'
import { exigirPapel } from '/JS/core/auth.js'
import { montarCabecalho } from '/JS/core/cabecalho.js'

const EMAILS_FINANCEIRO = ['export2@pietrobon.com.br', 'export@pietrobon.com.br', 'joaoantonio@pietrobon.com.br']

let resumo = null
let fornecedores = []
let aba = 'painel'
let editImp = null
let editForn = null
let editCt = null
let editPag = null
let custoImpSel = ''
let custoCab = {}
let custoDespesas = []
let custoSt = []
let comRepSel = ''
let comAno = ''
let comReps = []
let comFats = []

const $ = (id) => document.getElementById(id)
const brl = (n) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const numf = (n, d = 2) => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const dISO = (v) => v ? String(v).slice(0, 10) : ''
const dBR = (v) => { const s = dISO(v); return s ? s.split('-').reverse().join('/') : '-' }
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const STATUS_COR = { PAGO: 'bg-success', PARCIAL: 'bg-warning text-dark', DEVENDO: 'bg-danger' }

// Preenche a taxa de câmbio pela PTAX do Banco Central conforme a data informada.
async function autoPtax(dataId, taxaId, notaId) {
  const data = $(dataId).value
  const nota = $(notaId)
  if (!data) { if (nota) nota.textContent = ''; return }
  if (nota) { nota.textContent = 'Buscando PTAX...'; nota.className = 'small text-muted mt-1' }
  const r = await api.fin.ptax(data)
  if (r && !r.erro && r.taxa != null) {
    $(taxaId).value = r.taxa
    if (nota) { nota.textContent = `PTAX ${numf(r.taxa, 4)} (${dBR(r.dataCotacao)})`; nota.className = 'small text-success mt-1' }
  } else if (nota) {
    nota.textContent = 'PTAX indisponível — informe a taxa manualmente.'
    nota.className = 'small text-danger mt-1'
  }
}

async function carregar() {
  const r = await api.fin.resumo()
  if (!r || r.erro) { $('area-fin').innerHTML = `<p class="text-danger">${esc(r?.erro || 'Erro ao carregar.')}</p>`; return }
  resumo = r
  fornecedores = await api.fin.fornecedores()
  if (!Array.isArray(fornecedores)) fornecedores = []
  render()
}

function render() {
  if (aba === 'painel') renderPainel()
  else if (aba === 'importacoes') renderImportacoes()
  else if (aba === 'fornecedores') renderFornecedores()
  else if (aba === 'contratos') renderContratos()
  else if (aba === 'custos') renderCustos()
  else if (aba === 'comissoes') renderComissoes()
}

// ---------- PAINEL ----------
function renderPainel() {
  const c = resumo.contagem
  $('area-fin').innerHTML = `
    <div class="d-flex justify-content-end mb-2"><button class="btn btn-sm btn-outline-primary" id="btn-resumo-semanal">Enviar Resumo Semanal agora</button></div>
    <div class="row g-3 mb-3">
      <div class="col-6 col-md-3"><div class="card"><div class="card-body text-center py-3"><div class="small text-muted">Total Importado</div><div class="fw-bold fs-5">${brl(resumo.totalImportado)}</div></div></div></div>
      <div class="col-6 col-md-3"><div class="card"><div class="card-body text-center py-3"><div class="small text-muted">Total Pago</div><div class="fw-bold fs-5 text-success">${brl(resumo.totalPago)}</div></div></div></div>
      <div class="col-6 col-md-3"><div class="card"><div class="card-body text-center py-3"><div class="small text-muted">Saldo Devedor</div><div class="fw-bold fs-5 text-danger">${brl(resumo.saldoDevedor)}</div></div></div></div>
      <div class="col-6 col-md-3"><div class="card"><div class="card-body text-center py-3"><div class="small text-muted">Importações</div><div class="fw-bold fs-5">${resumo.qtd}</div>
        <div class="small text-muted">${c.DEVENDO} devendo · ${c.PARCIAL} parcial · ${c.PAGO} pago</div></div></div></div>
    </div>
    <div class="card"><div class="card-body">
      <h5 class="secao-titulo-card mb-2">Resumo por fornecedor</h5>
      <div class="table-responsive"><table class="table table-sm table-hover mb-0">
        <thead><tr><th>Fornecedor</th><th class="text-end">Importado</th><th class="text-end">Pago</th><th class="text-end">Saldo devedor</th></tr></thead>
        <tbody>${resumo.porFornecedor.map((p) => `<tr><td>${esc(p.fornecedor)}</td><td class="text-end">${brl(p.importado)}</td><td class="text-end">${brl(p.pago)}</td><td class="text-end fw-semibold ${p.saldo > 0.01 ? 'text-danger' : 'text-success'}">${brl(p.saldo)}</td></tr>`).join('')}
          <tr class="fw-bold" style="background:#f8fafc"><td>TOTAL</td><td class="text-end">${brl(resumo.totalImportado)}</td><td class="text-end">${brl(resumo.totalPago)}</td><td class="text-end">${brl(resumo.saldoDevedor)}</td></tr>
        </tbody></table></div>
    </div></div>`
  $('btn-resumo-semanal').addEventListener('click', async (e) => {
    e.target.disabled = true; e.target.textContent = 'Enviando...'
    const r = await api.fin.enviarResumoSemanal()
    e.target.disabled = false; e.target.textContent = 'Enviar Resumo Semanal agora'
    alert(r?.erro ? r.erro : 'Resumo enviado por e-mail.')
  })
}

// ---------- IMPORTAÇÕES ----------
function renderImportacoes() {
  const imps = resumo.importacoes
  const ed = editImp ? imps.find((x) => x.id === editImp) : null
  const optForn = fornecedores.map((f) => `<option value="${f.id}">${esc(f.nome)}</option>`).join('')
  $('area-fin').innerHTML = `
    <div class="card mb-3 ${ed ? 'border-primary' : ''}"><div class="card-body">
      <h5 class="secao-titulo-card mb-3">${ed ? 'Editar importação' : 'Nova importação'}</h5>
      <div class="row g-2">
        <div class="col-12 col-md-4"><label class="form-label small mb-0">Fornecedor</label><select id="i-fornecedor_id" class="form-select form-select-sm"><option value="">—</option>${optForn}</select></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Nº Invoice</label><input id="i-invoice" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Data</label><input type="date" id="i-data_invoice" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-4"><label class="form-label small mb-0">Mercadoria</label><input id="i-mercadoria" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Moeda</label><input id="i-moeda" class="form-control form-control-sm" value="USD"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Valor (moeda)</label><input type="number" step="any" id="i-valor_moeda" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Taxa câmbio</label><input type="number" step="any" id="i-taxa_cambio" class="form-control form-control-sm"><div id="i-taxa-nota" class="small text-muted mt-1"></div></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Banco</label><input id="i-banco" class="form-control form-control-sm" value="Santander"></div>
      </div>
      <button class="btn btn-ok-grande mt-3" id="btn-nova-imp">${ed ? 'Salvar alterações' : 'Lançar importação'}</button>
      ${ed ? '<button class="btn btn-outline-secondary mt-3 ms-2" id="btn-cancel-imp">Cancelar</button>' : ''}
    </div></div>
    <div class="card"><div class="table-responsive"><table class="table table-sm table-hover mb-0" style="font-size:.82rem">
      <thead><tr><th>Invoice</th><th>Fornecedor</th><th>Mercadoria</th><th class="text-end">Valor (moeda)</th><th class="text-end">Taxa</th><th class="text-end">Valor R$</th><th class="text-end">Pago R$</th><th class="text-end">Saldo R$</th><th>Status</th><th></th></tr></thead>
      <tbody>${imps.map((i) => `<tr class="${i.id === editImp ? 'table-primary' : ''}">
        <td class="fw-semibold">${esc(i.invoice)}</td>
        <td>${esc(i.fornecedor_nome || '-')}</td>
        <td>${esc(i.mercadoria || '-')}</td>
        <td class="text-end">${i.moeda || ''} ${numf(i.valor_moeda)}</td>
        <td class="text-end">${numf(i.taxa_cambio, 4)}</td>
        <td class="text-end">${brl(i.valor_reais)}</td>
        <td class="text-end">${brl(i.pago)}</td>
        <td class="text-end fw-semibold ${i.saldo > 0.01 ? 'text-danger' : 'text-success'}">${brl(i.saldo)}</td>
        <td><span class="badge ${STATUS_COR[i.status]}">${i.status}</span></td>
        <td style="white-space:nowrap"><button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="editarImp(${i.id})">Editar</button>
          <button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="abrirPagamentos(${i.id})">Pagamentos</button>
          <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="excluirImp(${i.id})">🗑</button></td>
      </tr>`).join('')}</tbody>
    </table></div></div>`
  if (ed) {
    $('i-fornecedor_id').value = ed.fornecedor_id || ''
    $('i-invoice').value = ed.invoice || ''
    $('i-data_invoice').value = dISO(ed.data_invoice)
    $('i-mercadoria').value = ed.mercadoria || ''
    $('i-moeda').value = ed.moeda || ''
    $('i-valor_moeda').value = ed.valor_moeda ?? ''
    $('i-taxa_cambio').value = ed.taxa_cambio ?? ''
    $('i-banco').value = ed.banco || ''
    $('btn-cancel-imp').addEventListener('click', () => { editImp = null; render() })
  }
  $('i-data_invoice').addEventListener('change', () => autoPtax('i-data_invoice', 'i-taxa_cambio', 'i-taxa-nota'))
  $('btn-nova-imp').addEventListener('click', ed ? salvarEdicaoImp : novaImportacao)
}

function coletarImp() {
  const dados = {}
  ;['fornecedor_id', 'invoice', 'data_invoice', 'mercadoria', 'moeda', 'valor_moeda', 'taxa_cambio', 'banco'].forEach((k) => { dados[k] = $('i-' + k).value })
  return dados
}

async function novaImportacao() {
  const dados = coletarImp()
  if (!dados.invoice) { alert('Informe o Nº do invoice.'); return }
  const r = await api.fin.criarImportacao(dados)
  if (r?.erro) { alert(r.erro); return }
  carregar()
}

async function salvarEdicaoImp() {
  const dados = coletarImp()
  if (!dados.invoice) { alert('Informe o Nº do invoice.'); return }
  const r = await api.fin.editarImportacao(editImp, dados)
  if (r?.erro) { alert(r.erro); return }
  editImp = null
  carregar()
}

window.editarImp = function (id) { editImp = id; aba = 'importacoes'; render(); window.scrollTo({ top: 0, behavior: 'smooth' }) }

window.excluirImp = async function (id) {
  if (!confirm('Excluir esta importação e todos os pagamentos/contratos dela?')) return
  await api.fin.excluirImportacao(id)
  carregar()
}

// ---------- PAGAMENTOS (modal) ----------
window.abrirPagamentos = function (id) { editPag = null; abrirPagamentosInner(id) }

async function abrirPagamentosInner(id) {
  const imp = resumo.importacoes.find((x) => x.id === id)
  if (!imp) return
  window._impAtual = id
  const pags = await api.fin.pagamentos(id)
  const lista = Array.isArray(pags) ? pags : []
  const cts = await api.fin.contratos(id)
  window._contratosImp = Array.isArray(cts) ? cts : []
  const mapaCt = {}
  window._contratosImp.forEach((c) => { mapaCt[c.id] = c })
  const optCt = window._contratosImp.map((c) => `<option value="${c.id}">Nº ${esc(c.num_contrato)} · ${brl(c.valor_reais)}${c.liquidado ? '' : ' (não liq.)'}</option>`).join('')
  const ep = editPag ? lista.find((p) => p.id === editPag) : null
  $('modal-fin-body').innerHTML = `
    <h5 class="mb-1">${esc(imp.invoice)} — ${esc(imp.fornecedor_nome || '')}</h5>
    <div class="small text-muted mb-3">Valor: <strong>${brl(imp.valor_reais)}</strong> · Pago: <strong>${brl(imp.pago)}</strong> · Saldo: <strong class="${imp.saldo > 0.01 ? 'text-danger' : 'text-success'}">${brl(imp.saldo)}</strong></div>
    <div class="row g-2 align-items-end mb-3 ${ep ? 'p-2 rounded border border-primary' : ''}">
      ${ep ? '<div class="col-12"><span class="badge bg-primary">Editando pagamento</span></div>' : ''}
      <div class="col-6 col-md-2"><label class="form-label small mb-0">Data</label><input type="date" id="p-data" class="form-control form-control-sm"></div>
      <div class="col-6 col-md-2"><label class="form-label small mb-0">Valor pago (USD)</label><input type="number" step="any" id="p-valor-usd" class="form-control form-control-sm"></div>
      <div class="col-6 col-md-2"><label class="form-label small mb-0">Valor pago (R$)</label><input type="number" step="any" id="p-valor" class="form-control form-control-sm"></div>
      <div class="col-6 col-md-3"><label class="form-label small mb-0">Contrato de câmbio</label><select id="p-contrato_id" class="form-select form-select-sm"><option value="">— nenhum —</option>${optCt}</select><div id="p-ct-nota" class="small text-muted mt-1"></div></div>
      <div class="col-6 col-md-3"><label class="form-label small mb-0">Forma</label><input id="p-forma" class="form-control form-control-sm" value="Câmbio Antecipado"></div>
      <div class="col-12"><label class="form-label small mb-0">Observação</label><input id="p-obs" class="form-control form-control-sm"></div>
    </div>
    <button class="btn btn-ok-grande" id="p-salvar">${ep ? 'Salvar alterações' : 'Registrar pagamento'}</button>
    ${ep ? '<button class="btn btn-outline-secondary ms-2" id="p-cancel">Cancelar</button>' : ''}
    <hr>
    <div id="p-lista"></div>`
  if (ep) {
    $('p-data').value = dISO(ep.data_pgto)
    $('p-valor').value = ep.valor_reais ?? ''
    $('p-valor-usd').value = ep.valor_moeda ?? ''
    $('p-forma').value = ep.forma || ''
    $('p-obs').value = ep.obs || ''
    $('p-contrato_id').value = ep.contrato_id || ''
    $('p-cancel').addEventListener('click', () => { editPag = null; abrirPagamentosInner(id) })
  } else {
    $('p-data').value = new Date().toISOString().slice(0, 10)
  }
  // Taxa usada na conversão: a do contrato selecionado, senão a da invoice
  const taxaPag = () => {
    const cid = $('p-contrato_id').value
    if (cid) { const c = window._contratosImp.find((x) => String(x.id) === String(cid)); if (c && Number(c.taxa) > 0) return Number(c.taxa) }
    return Number(imp.taxa_cambio) || 0
  }
  // USD digitado -> calcula R$
  $('p-valor-usd').addEventListener('input', () => {
    const t = taxaPag(); const u = parseFloat($('p-valor-usd').value)
    if (t > 0 && u >= 0) $('p-valor').value = (u * t).toFixed(2)
  })
  // R$ digitado -> calcula USD e sugere contrato cujo valor bate
  $('p-valor').addEventListener('input', () => {
    const t = taxaPag(); const v = parseFloat($('p-valor').value)
    if (t > 0 && v >= 0) $('p-valor-usd').value = (v / t).toFixed(2)
    if (!$('p-contrato_id').value && v > 0) {
      const match = window._contratosImp.find((c) => Math.abs((Number(c.valor_reais) || 0) - v) < 0.01)
      if (match) { $('p-contrato_id').value = match.id; $('p-ct-nota').textContent = `Vinculado ao contrato Nº ${match.num_contrato} (valor bate).` }
    }
  })
  // Trocar de contrato recalcula o R$ a partir do USD (nova taxa)
  $('p-contrato_id').addEventListener('change', () => {
    const t = taxaPag(); const u = parseFloat($('p-valor-usd').value)
    if (t > 0 && u >= 0) $('p-valor').value = (u * t).toFixed(2)
  })
  renderListaPag(lista, mapaCt)
  $('p-salvar').addEventListener('click', salvarPagamento)
  window._modalFin.show()
}

function renderListaPag(lista, mapaCt) {
  const el = $('p-lista')
  if (!lista.length) { el.innerHTML = '<p class="text-muted fst-italic mb-0">Nenhum pagamento registrado.</p>'; return }
  const ct = mapaCt || {}
  el.innerHTML = `<table class="table table-sm mb-0" style="font-size:.85rem"><thead><tr><th>Data</th><th class="text-end">Valor USD</th><th class="text-end">Valor R$</th><th>Contrato</th><th>Forma</th><th>Obs.</th><th></th></tr></thead>
    <tbody>${lista.map((p) => `<tr class="${p.id === editPag ? 'table-primary' : ''}"><td>${dBR(p.data_pgto)}</td><td class="text-end">${numf(p.valor_moeda)}</td><td class="text-end">${brl(p.valor_reais)}</td><td>${p.contrato_id && ct[p.contrato_id] ? 'Nº ' + esc(ct[p.contrato_id].num_contrato) : '-'}</td><td>${esc(p.forma || '-')}</td><td>${esc(p.obs || '-')}</td>
      <td class="text-end" style="white-space:nowrap"><button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="editarPag(${p.id})">Editar</button>
        <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="excluirPag(${p.id})">Excluir</button></td></tr>`).join('')}</tbody></table>`
}

window.editarPag = function (id) { editPag = id; abrirPagamentosInner(window._impAtual) }

async function salvarPagamento() {
  const dados = { importacao_id: window._impAtual, data_pgto: $('p-data').value, valor_reais: $('p-valor').value, valor_moeda: $('p-valor-usd').value, forma: $('p-forma').value, obs: $('p-obs').value, contrato_id: $('p-contrato_id').value || null }
  if (!(parseFloat(dados.valor_reais) >= 0)) { alert('Informe o valor.'); return }
  const r = editPag ? await api.fin.editarPagamento(editPag, dados) : await api.fin.criarPagamento(dados)
  if (r?.erro) { alert(r.erro); return }
  editPag = null
  await carregar()
  abrirPagamentosInner(window._impAtual)
}

window.excluirPag = async function (id) {
  if (!confirm('Excluir este pagamento?')) return
  await api.fin.excluirPagamento(id)
  if (editPag === id) editPag = null
  await carregar()
  abrirPagamentosInner(window._impAtual)
}

// ---------- FORNECEDORES ----------
function renderFornecedores() {
  const ed = editForn ? fornecedores.find((x) => x.id === editForn) : null
  $('area-fin').innerHTML = `
    <div class="card mb-3 ${ed ? 'border-primary' : ''}"><div class="card-body">
      <h5 class="secao-titulo-card mb-3">${ed ? 'Editar fornecedor' : 'Novo fornecedor'}</h5>
      <div class="row g-2">
        <div class="col-12 col-md-4"><label class="form-label small mb-0">Nome</label><input id="f-nome" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">País</label><input id="f-pais" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-1"><label class="form-label small mb-0">Moeda</label><input id="f-moeda" class="form-control form-control-sm" value="USD"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Contato</label><input id="f-contato" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-3"><label class="form-label small mb-0">E-mail</label><input id="f-email" class="form-control form-control-sm"></div>
        <div class="col-12"><label class="form-label small mb-0">Observações</label><input id="f-obs" class="form-control form-control-sm"></div>
      </div>
      <button class="btn btn-pietrobon btn-sm mt-3" id="btn-novo-forn">${ed ? 'Salvar alterações' : 'Adicionar fornecedor'}</button>
      ${ed ? '<button class="btn btn-outline-secondary btn-sm mt-3 ms-2" id="btn-cancel-forn">Cancelar</button>' : ''}
    </div></div>
    <div class="card"><div class="table-responsive"><table class="table table-sm table-hover mb-0" style="font-size:.85rem">
      <thead><tr><th>Fornecedor</th><th>País</th><th>Moeda</th><th>Contato</th><th>E-mail</th><th>Observações</th><th></th></tr></thead>
      <tbody>${fornecedores.map((f) => `<tr class="${f.id === editForn ? 'table-primary' : ''}"><td class="fw-semibold">${esc(f.nome)}</td><td>${esc(f.pais || '-')}</td><td>${esc(f.moeda || '-')}</td><td>${esc(f.contato || '-')}</td><td>${esc(f.email || '-')}</td><td>${esc(f.obs || '-')}</td>
        <td class="text-end" style="white-space:nowrap"><button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="editarForn(${f.id})">Editar</button>
          <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="excluirForn(${f.id})">🗑</button></td></tr>`).join('')}</tbody>
    </table></div></div>`
  if (ed) {
    ;['nome', 'pais', 'moeda', 'contato', 'email', 'obs'].forEach((k) => { $('f-' + k).value = ed[k] || '' })
    $('btn-cancel-forn').addEventListener('click', () => { editForn = null; render() })
  }
  $('btn-novo-forn').addEventListener('click', ed ? salvarEdicaoForn : novoFornecedor)
}

function coletarForn() {
  const dados = {}
  ;['nome', 'pais', 'moeda', 'contato', 'email', 'obs'].forEach((k) => { dados[k] = $('f-' + k).value })
  return dados
}

async function novoFornecedor() {
  const dados = coletarForn()
  if (!dados.nome.trim()) { alert('Informe o nome.'); return }
  const r = await api.fin.criarFornecedor(dados)
  if (r?.erro) { alert(r.erro); return }
  carregar()
}

async function salvarEdicaoForn() {
  const dados = coletarForn()
  if (!dados.nome.trim()) { alert('Informe o nome.'); return }
  const r = await api.fin.editarFornecedor(editForn, dados)
  if (r?.erro) { alert(r.erro); return }
  editForn = null
  carregar()
}

window.editarForn = function (id) { editForn = id; aba = 'fornecedores'; render(); window.scrollTo({ top: 0, behavior: 'smooth' }) }

window.excluirForn = async function (id) {
  if (!confirm('Excluir este fornecedor?')) return
  const r = await api.fin.excluirFornecedor(id)
  if (r?.erro) { alert(r.erro); return }
  carregar()
}

// ---------- CONTRATOS DE CÂMBIO ----------
async function renderContratos() {
  const contratos = await api.fin.contratos()
  const lista = Array.isArray(contratos) ? contratos : []
  const ed = editCt ? lista.find((x) => x.id === editCt) : null
  const optImp = resumo.importacoes.map((i) => `<option value="${i.id}">${esc(i.invoice)} — ${esc(i.fornecedor_nome || '')}</option>`).join('')
  $('area-fin').innerHTML = `
    <div class="card mb-3 ${ed ? 'border-primary' : ''}"><div class="card-body">
      <h5 class="secao-titulo-card mb-3">${ed ? 'Editar contrato de câmbio' : 'Novo contrato de câmbio'}</h5>
      <div class="row g-2">
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Nº Contrato</label><input id="ct-num_contrato" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Banco</label><input id="ct-banco" class="form-control form-control-sm" value="Santander"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Data fechamento</label><input type="date" id="ct-data_fechamento" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-1"><label class="form-label small mb-0">Moeda</label><input id="ct-moeda" class="form-control form-control-sm" value="USD"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Valor (moeda)</label><input type="number" step="any" id="ct-valor_moeda" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Taxa</label><input type="number" step="any" id="ct-taxa" class="form-control form-control-sm"><div id="ct-taxa-nota" class="small text-muted mt-1"></div></div>
        <div class="col-12 col-md-4"><label class="form-label small mb-0">Importação vinculada</label><select id="ct-importacao_id" class="form-select form-select-sm"><option value="">—</option>${optImp}</select></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Data liquidação</label><input type="date" id="ct-data_liquidacao" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2 d-flex align-items-end"><div class="form-check"><input class="form-check-input" type="checkbox" id="ct-liquidado" checked><label class="form-check-label small" for="ct-liquidado">Liquidado</label></div></div>
        <div class="col-12 col-md-4"><label class="form-label small mb-0">Observações</label><input id="ct-obs" class="form-control form-control-sm"></div>
      </div>
      <button class="btn btn-pietrobon btn-sm mt-3" id="btn-novo-ct">${ed ? 'Salvar alterações' : 'Adicionar contrato'}</button>
      ${ed ? '<button class="btn btn-outline-secondary btn-sm mt-3 ms-2" id="btn-cancel-ct">Cancelar</button>' : ''}
    </div></div>
    <div class="card"><div class="table-responsive"><table class="table table-sm table-hover mb-0" style="font-size:.82rem">
      <thead><tr><th>Nº Contrato</th><th>Banco</th><th>Fechamento</th><th class="text-end">Valor (moeda)</th><th class="text-end">Taxa</th><th class="text-end">Valor R$</th><th>Invoice</th><th>Liquidado</th><th></th></tr></thead>
      <tbody>${lista.map((c) => `<tr class="${c.id === editCt ? 'table-primary' : ''}"><td class="fw-semibold">${esc(c.num_contrato)}</td><td>${esc(c.banco || '-')}</td><td>${dBR(c.data_fechamento)}</td>
        <td class="text-end">${c.moeda || ''} ${numf(c.valor_moeda)}</td><td class="text-end">${numf(c.taxa, 4)}</td><td class="text-end">${brl(c.valor_reais)}</td>
        <td>${esc(c.invoice || '-')}</td><td>${c.liquidado ? '<span class="badge bg-success">Sim</span>' : '<span class="badge bg-secondary">Não</span>'}</td>
        <td class="text-end" style="white-space:nowrap"><button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="editarCt(${c.id})">Editar</button>
          <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="excluirCt(${c.id})">🗑</button></td></tr>`).join('')}</tbody>
    </table></div></div>`
  if (ed) {
    $('ct-num_contrato').value = ed.num_contrato || ''
    $('ct-banco').value = ed.banco || ''
    $('ct-data_fechamento').value = dISO(ed.data_fechamento)
    $('ct-moeda').value = ed.moeda || ''
    $('ct-valor_moeda').value = ed.valor_moeda ?? ''
    $('ct-taxa').value = ed.taxa ?? ''
    $('ct-importacao_id').value = ed.importacao_id || ''
    $('ct-data_liquidacao').value = dISO(ed.data_liquidacao)
    $('ct-liquidado').checked = !!ed.liquidado
    $('ct-obs').value = ed.obs || ''
    $('btn-cancel-ct').addEventListener('click', () => { editCt = null; renderContratos() })
  }
  $('ct-data_fechamento').addEventListener('change', () => autoPtax('ct-data_fechamento', 'ct-taxa', 'ct-taxa-nota'))
  $('btn-novo-ct').addEventListener('click', ed ? salvarEdicaoCt : novoContrato)
}

function coletarCt() {
  const dados = {}
  ;['num_contrato', 'banco', 'data_fechamento', 'moeda', 'valor_moeda', 'taxa', 'importacao_id', 'data_liquidacao', 'obs'].forEach((k) => { dados[k] = $('ct-' + k).value })
  dados.liquidado = $('ct-liquidado').checked
  return dados
}

async function novoContrato() {
  const dados = coletarCt()
  if (!dados.num_contrato) { alert('Informe o Nº do contrato.'); return }
  const r = await api.fin.criarContrato(dados)
  if (r?.erro) { alert(r.erro); return }
  renderContratos()
}

async function salvarEdicaoCt() {
  const dados = coletarCt()
  if (!dados.num_contrato) { alert('Informe o Nº do contrato.'); return }
  const r = await api.fin.editarContrato(editCt, dados)
  if (r?.erro) { alert(r.erro); return }
  editCt = null
  renderContratos()
}

window.editarCt = function (id) { editCt = id; renderContratos(); window.scrollTo({ top: 0, behavior: 'smooth' }) }

window.excluirCt = async function (id) {
  if (!confirm('Excluir este contrato?')) return
  await api.fin.excluirContrato(id)
  if (editCt === id) editCt = null
  renderContratos()
}

// ---------- CUSTOS DE IMPORTAÇÃO ----------
function stRecolher(it) {
  const bc = ((parseFloat(it.base_icms) || 0) + (parseFloat(it.ipi_destacado) || 0)) * (parseFloat(it.mva) || 0)
  return bc * (parseFloat(it.aliquota) || 0) - (parseFloat(it.icms_proprio) || 0)
}
function calcCusto() {
  const despTotal = custoDespesas.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0)
  const stCusto = custoSt.reduce((s, i) => s + stRecolher(i), 0)
  const g = (k) => parseFloat(custoCab[k]) || 0
  const total = g('materia_prima') + g('imposto_importacao') + stCusto + g('ipi') + g('pis') + g('cofins') + g('icms') + despTotal
  const credito = g('icms') + g('ipi') + g('pis') + g('cofins')
  const custoCredito = total - credito
  const kg = g('quantidade_kg')
  return { despTotal, stCusto, total, credito, custoCredito, custoKg: kg > 0 ? custoCredito / kg : 0 }
}

async function carregarCusto(impId) {
  custoImpSel = impId
  if (!impId) { custoCab = {}; custoDespesas = []; custoSt = []; renderCustos(); return }
  const imp = resumo.importacoes.find((x) => String(x.id) === String(impId))
  const d = await api.fin.custo(impId)
  if (d && !d.erro) {
    custoCab = { nfe: d.nfe || '', produto: d.produto || '', materia_prima: d.materia_prima ?? '', imposto_importacao: d.imposto_importacao ?? '', ipi: d.ipi ?? '', pis: d.pis ?? '', cofins: d.cofins ?? '', icms: d.icms ?? '', quantidade_kg: d.quantidade_kg ?? '', unidade: d.unidade || 'KG', obs: d.obs || '' }
    custoDespesas = (d.despesas || []).map((x) => ({ nome: x.nome || '', valor: x.valor ?? '' }))
    custoSt = (d.st || []).map((x) => ({ produto: x.produto || '', ncm: x.ncm || '', base_icms: x.base_icms ?? '', icms_proprio: x.icms_proprio ?? '', aliquota: x.aliquota ?? '', ipi_destacado: x.ipi_destacado ?? '', mva: x.mva ?? '' }))
  } else {
    custoCab = { nfe: imp?.invoice || '', produto: imp?.mercadoria || '', materia_prima: imp?.valor_reais ?? '', imposto_importacao: '', ipi: '', pis: '', cofins: '', icms: '', quantidade_kg: '', unidade: 'KG', obs: '' }
    custoDespesas = []
    custoSt = []
  }
  renderCustos()
}

function renderCustos() {
  const optImp = resumo.importacoes.map((i) => `<option value="${i.id}" ${String(i.id) === String(custoImpSel) ? 'selected' : ''}>${esc(i.invoice)} — ${esc(i.fornecedor_nome || '')}</option>`).join('')
  if (!custoImpSel) {
    $('area-fin').innerHTML = `<div class="card mb-3"><div class="card-body">
      <label class="form-label small mb-1">Importação</label>
      <select class="form-select form-select-sm" style="max-width:520px" onchange="custoSelImp(this.value)"><option value="">— selecione uma importação —</option>${optImp}</select>
      <p class="text-muted mt-3 mb-0">Escolha uma importação para calcular os custos de nacionalização (matéria-prima, impostos, despesas, ICMS-ST e custo por unidade).</p>
    </div></div>
    <div class="card"><div class="card-body"><h6 class="secao-titulo-card mb-2">Custos já salvos</h6><div id="custos-salvos"><p class="text-muted mb-0">Carregando...</p></div></div></div>`
    carregarCustosSalvos()
    return
  }
  const num = (k, label, prefill) => `<div class="col-6 col-md-3"><label class="form-label small mb-0">${label}</label><input type="number" step="any" class="form-control form-control-sm" value="${custoCab[k] ?? ''}" oninput="custoCabInput('${k}',this.value)" ${prefill || ''}></div>`
  const despRows = custoDespesas.map((d, i) => `<tr>
    <td><input class="form-control form-control-sm" value="${esc(d.nome)}" oninput="custoDespInput(${i},'nome',this.value)" placeholder="Ex: Frete marítimo"></td>
    <td style="width:160px"><input type="number" step="any" class="form-control form-control-sm text-end" value="${d.valor ?? ''}" oninput="custoDespInput(${i},'valor',this.value)"></td>
    <td style="width:40px"><button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="custoDelDesp(${i})">×</button></td></tr>`).join('')
  const stRows = custoSt.map((s, i) => `<tr>
    <td><input class="form-control form-control-sm" value="${esc(s.produto)}" oninput="custoStInput(${i},'produto',this.value)" placeholder="Produto"></td>
    <td style="width:110px"><input class="form-control form-control-sm" value="${esc(s.ncm)}" oninput="custoStInput(${i},'ncm',this.value)" placeholder="NCM"></td>
    <td style="width:120px"><input type="number" step="any" class="form-control form-control-sm text-end" value="${s.base_icms ?? ''}" oninput="custoStInput(${i},'base_icms',this.value)"></td>
    <td style="width:120px"><input type="number" step="any" class="form-control form-control-sm text-end" value="${s.icms_proprio ?? ''}" oninput="custoStInput(${i},'icms_proprio',this.value)"></td>
    <td style="width:90px"><input type="number" step="any" class="form-control form-control-sm text-end" value="${s.aliquota ?? ''}" oninput="custoStInput(${i},'aliquota',this.value)" placeholder="0.17"></td>
    <td style="width:110px"><input type="number" step="any" class="form-control form-control-sm text-end" value="${s.ipi_destacado ?? ''}" oninput="custoStInput(${i},'ipi_destacado',this.value)"></td>
    <td style="width:90px"><input type="number" step="any" class="form-control form-control-sm text-end" value="${s.mva ?? ''}" oninput="custoStInput(${i},'mva',this.value)" placeholder="1.66"></td>
    <td style="width:120px;text-align:right;font-weight:600" id="st-res-${i}">-</td>
    <td style="width:40px"><button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="custoDelSt(${i})">×</button></td></tr>`).join('')
  $('area-fin').innerHTML = `
    <div class="card mb-3"><div class="card-body">
      <div class="row g-2 align-items-end mb-2">
        <div class="col-12 col-md-6"><label class="form-label small mb-0">Importação</label>
          <select class="form-select form-select-sm" onchange="custoSelImp(this.value)"><option value="">— selecione —</option>${optImp}</select></div>
        <div class="col-12 col-md-6"><label class="form-label small mb-0">Produto</label><input class="form-control form-control-sm" value="${esc(custoCab.produto || '')}" oninput="custoCabInput('produto',this.value)" placeholder="Nome do produto importado"></div>
        <div class="col-6 col-md-4"><label class="form-label small mb-0">NF-e</label><input class="form-control form-control-sm" value="${esc(custoCab.nfe || '')}" oninput="custoCabInput('nfe',this.value)"></div>
        <div class="col-6 col-md-4"><label class="form-label small mb-0">Quantidade</label><input type="number" step="any" class="form-control form-control-sm" value="${custoCab.quantidade_kg ?? ''}" oninput="custoCabInput('quantidade_kg',this.value)"></div>
        <div class="col-6 col-md-4"><label class="form-label small mb-0">Unidade</label><select class="form-select form-select-sm" onchange="custoCabInput('unidade',this.value)"><option value="KG" ${(custoCab.unidade || 'KG') === 'KG' ? 'selected' : ''}>KG</option><option value="UN" ${custoCab.unidade === 'UN' ? 'selected' : ''}>UN</option></select></div>
      </div>
      <h6 class="secao-titulo-card mt-2 mb-2">Custos e impostos (R$)</h6>
      <div class="row g-2">
        ${num('materia_prima', 'Matéria-prima')}${num('imposto_importacao', 'Imposto Importação')}${num('ipi', 'IPI')}${num('pis', 'PIS')}
        ${num('cofins', 'COFINS')}${num('icms', 'ICMS')}
      </div>
    </div></div>

    <div class="card mb-3"><div class="card-body">
      <div class="d-flex justify-content-between align-items-center mb-2"><h6 class="secao-titulo-card mb-0">Despesas</h6>
        <button class="btn btn-sm btn-outline-primary" onclick="custoAddDesp()">+ Despesa</button></div>
      <table class="table table-sm mb-0"><thead><tr><th>Descrição</th><th class="text-end">Valor R$</th><th></th></tr></thead>
        <tbody>${despRows || '<tr><td colspan="3" class="text-muted fst-italic">Nenhuma despesa. Clique em “+ Despesa”.</td></tr>'}</tbody></table>
    </div></div>

    <div class="card mb-3"><div class="card-body">
      <div class="d-flex justify-content-between align-items-center mb-2"><h6 class="secao-titulo-card mb-0">ICMS-ST por item</h6>
        <button class="btn btn-sm btn-outline-primary" onclick="custoAddSt()">+ Item</button></div>
      <div class="table-responsive"><table class="table table-sm mb-0" style="font-size:.8rem"><thead><tr>
        <th>Produto</th><th>NCM</th><th class="text-end">Base ICMS</th><th class="text-end">ICMS Próprio</th><th class="text-end">Alíquota</th><th class="text-end">IPI Dest.</th><th class="text-end">MVA</th><th class="text-end">ST a recolher</th><th></th></tr></thead>
        <tbody>${stRows || '<tr><td colspan="9" class="text-muted fst-italic">Nenhum item de ST. O “ST Custo” fica zero.</td></tr>'}</tbody></table></div>
      <div class="small text-muted mt-1">ST a recolher = (Base ICMS + IPI) × MVA × Alíquota − ICMS Próprio. Alíquota e MVA em decimal (ex.: 0.17 e 1.66).</div>
    </div></div>

    <div class="card"><div class="card-body">
      <div id="c-resumo"></div>
      <button class="btn btn-ok-grande mt-3" onclick="salvarCusto()">Salvar custos</button>
      <button class="btn btn-outline-danger mt-3 ms-2" onclick="exportarCustoPDF()">Exportar PDF</button>
    </div></div>

    <div class="card mt-3"><div class="card-body"><h6 class="secao-titulo-card mb-2">Custos já salvos</h6><div id="custos-salvos"><p class="text-muted mb-0">Carregando...</p></div></div></div>`
  atualizarResumoCusto()
  carregarCustosSalvos()
}

async function carregarCustosSalvos() {
  const el = $('custos-salvos')
  if (!el) return
  const lista = await api.fin.custos()
  if (!Array.isArray(lista) || !lista.length) { el.innerHTML = '<p class="text-muted fst-italic mb-0">Nenhum custo salvo ainda.</p>'; return }
  el.innerHTML = `<div class="table-responsive"><table class="table table-sm table-hover mb-0" style="font-size:.85rem">
    <thead><tr><th>Invoice</th><th>Produto</th><th>Fornecedor</th><th class="text-end">Custo/un.</th><th class="text-end">Total pago</th><th></th></tr></thead>
    <tbody>${lista.map((c) => `<tr class="${String(c.importacao_id) === String(custoImpSel) ? 'table-primary' : ''}">
      <td class="fw-semibold">${esc(c.invoice || '-')}</td><td>${esc(c.produto || '-')}</td><td>${esc(c.fornecedor_nome || '-')}</td>
      <td class="text-end">${brl(c.calc ? c.calc.custoKg : 0)} <span class="text-muted">/${esc(c.unidade || 'KG')}</span></td>
      <td class="text-end">${brl(c.calc ? c.calc.total : 0)}</td>
      <td class="text-end" style="white-space:nowrap"><button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="custoSelImp('${c.importacao_id}')">Abrir</button>
        <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="excluirCustoSalvo('${c.importacao_id}')">🗑</button></td></tr>`).join('')}</tbody></table></div>`
}

window.excluirCustoSalvo = async (impId) => {
  if (!confirm('Excluir este custo salvo?')) return
  await api.fin.excluirCusto(impId)
  if (String(custoImpSel) === String(impId)) { custoImpSel = ''; custoCab = {}; custoDespesas = []; custoSt = [] }
  renderCustos()
}

function atualizarResumoCusto() {
  custoSt.forEach((s, i) => { const el = $('st-res-' + i); if (el) el.textContent = brl(stRecolher(s)) })
  const c = calcCusto()
  const el = $('c-resumo')
  if (!el) return
  const linha = (l, v, cls) => `<div class="d-flex justify-content-between py-1 ${cls || ''}"><span>${l}</span><strong>${v}</strong></div>`
  el.innerHTML = `
    ${linha('Total despesas', brl(c.despTotal))}
    ${linha('ST Custo (soma ICMS-ST)', brl(c.stCusto))}
    <hr class="my-2">
    ${linha('TOTAL PAGO', brl(c.total), 'fs-6')}
    ${linha('(−) Créditos ICMS/IPI/PIS/COFINS', brl(c.credito), 'text-success')}
    ${linha('CUSTO COM CRÉDITO', brl(c.custoCredito), 'fs-6 fw-bold')}
    <hr class="my-2">
    ${linha('CUSTO POR ' + (custoCab.unidade || 'KG'), brl(c.custoKg), 'fs-5 fw-bold text-primary')}`
}

window.custoSelImp = (v) => carregarCusto(v)
window.custoCabInput = (k, v) => { custoCab[k] = v; atualizarResumoCusto() }
window.custoDespInput = (i, k, v) => { custoDespesas[i][k] = v; atualizarResumoCusto() }
window.custoStInput = (i, k, v) => { custoSt[i][k] = v; atualizarResumoCusto() }
window.custoAddDesp = () => { custoDespesas.push({ nome: '', valor: '' }); renderCustos() }
window.custoDelDesp = (i) => { custoDespesas.splice(i, 1); renderCustos() }
window.custoAddSt = () => { custoSt.push({ produto: '', ncm: '', base_icms: '', icms_proprio: '', aliquota: '0.17', ipi_destacado: '', mva: '' }); renderCustos() }
window.custoDelSt = (i) => { custoSt.splice(i, 1); renderCustos() }
window.salvarCusto = async () => {
  if (!custoImpSel) { alert('Selecione uma importação.'); return }
  const dados = { ...custoCab, despesas: custoDespesas, st: custoSt }
  const r = await api.fin.salvarCusto(custoImpSel, dados)
  if (r?.erro) { alert(r.erro); return }
  alert('Custos salvos.')
}

// ---- PDF do custo de importação ----
function carregarScriptFin(src) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some((s) => s.src === src)) return resolve()
    const s = document.createElement('script'); s.src = src
    s.onload = () => resolve(); s.onerror = () => reject(new Error('Falha ao carregar ' + src))
    document.head.appendChild(s)
  })
}
async function garantirLibsPdf() {
  if (!window.html2canvas) await carregarScriptFin('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')
  if (!window.jspdf) await carregarScriptFin('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
}
async function gerarPdfDeHtml(html, nomeArquivo) {
  await garantirLibsPdf()
  const cont = document.createElement('div')
  cont.style.cssText = 'position:fixed;left:-10000px;top:0;width:780px;background:#fff;padding:24px'
  cont.innerHTML = html
  document.body.appendChild(cont)
  try {
    const canvas = await html2canvas(cont, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
    const { jsPDF } = window.jspdf
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageW = 210, pageH = 297
    const imgW = pageW, imgH = canvas.height * imgW / canvas.width
    let heightLeft = imgH, position = 0
    const img = canvas.toDataURL('image/jpeg', 0.92)
    pdf.addImage(img, 'JPEG', 0, position, imgW, imgH); heightLeft -= pageH
    while (heightLeft > 0) { position -= pageH; pdf.addPage(); pdf.addImage(img, 'JPEG', 0, position, imgW, imgH); heightLeft -= pageH }
    pdf.save(nomeArquivo)
  } catch (e) { alert('Erro ao gerar PDF: ' + e.message) } finally { document.body.removeChild(cont) }
}

window.exportarCustoPDF = async () => {
  if (!custoImpSel) { alert('Selecione uma importação.'); return }
  const imp = resumo.importacoes.find((x) => String(x.id) === String(custoImpSel))
  const c = calcCusto()
  const un = custoCab.unidade || 'KG'
  const CAB = '#404040', ZEBRA = '#f2f2f2', TOTAL = '#c9c9c9', BORDA = '1px solid #000'
  const pct = (v) => c.total > 0 ? (v / c.total * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '-'
  const th = `background:${CAB};color:#fff;font-weight:bold;border:${BORDA};padding:5px 6px;font-size:10px;text-align:center`
  const tdL = (bg) => `background:${bg};color:#000;border:${BORDA};padding:4px 6px;font-size:10px;text-align:left`
  const tdR = (bg) => `background:${bg};color:#000;border:${BORDA};padding:4px 6px;font-size:10px;text-align:right`
  const g = (k) => parseFloat(custoCab[k]) || 0
  const zeb = (i) => i % 2 ? ZEBRA : '#fff'
  const impLinhas = [['Matéria-prima', g('materia_prima')], ['Imposto Importação', g('imposto_importacao')], ['ST Custo', c.stCusto], ['IPI', g('ipi')], ['PIS', g('pis')], ['COFINS', g('cofins')], ['ICMS', g('icms')], ['Despesas', c.despTotal]]
  const impRows = impLinhas.map(([l, v], i) => `<tr><td style="${tdL(zeb(i))}">${esc(l)}</td><td style="${tdR(zeb(i))}">${brl(v)}</td><td style="${tdR(zeb(i))}">${pct(v)}</td></tr>`).join('')
  const despLista = custoDespesas.filter((d) => (d.nome || '') || (parseFloat(d.valor) || 0))
  const despRows = despLista.length ? despLista.map((d, i) => `<tr><td style="${tdL(zeb(i))}">${esc(d.nome || '-')}</td><td style="${tdR(zeb(i))}">${brl(d.valor)}</td></tr>`).join('') : `<tr><td style="${tdL('#fff')}" colspan="2">—</td></tr>`
  const stLista = custoSt.filter((s) => (s.produto || '') || (parseFloat(s.base_icms) || 0))
  const stRows = stLista.map((s, i) => `<tr>
    <td style="${tdL(zeb(i))}">${esc(s.produto || '-')}</td><td style="${tdL(zeb(i))}">${esc(s.ncm || '-')}</td>
    <td style="${tdR(zeb(i))}">${brl(s.base_icms)}</td><td style="${tdR(zeb(i))}">${brl(s.icms_proprio)}</td>
    <td style="${tdR(zeb(i))}">${numf(s.aliquota, 4)}</td><td style="${tdR(zeb(i))}">${brl(s.ipi_destacado)}</td><td style="${tdR(zeb(i))}">${numf(s.mva, 4)}</td>
    <td style="${tdR(zeb(i))};font-weight:bold">${brl(stRecolher(s))}</td></tr>`).join('')
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#000">
    <h2 style="text-align:center;margin:0 0 2px;font-size:16px">CUSTO DE IMPORTAÇÃO</h2>
    ${custoCab.produto ? `<div style="text-align:center;font-weight:bold;font-size:12px;margin-bottom:2px">${esc(custoCab.produto)}</div>` : ''}
    <div style="text-align:center;font-size:10px;color:#333;margin-bottom:12px">Invoice ${esc(imp?.invoice || '')} · ${esc(imp?.fornecedor_nome || '')} · NF-e: ${esc(custoCab.nfe || '-')} · Qtd: ${esc(custoCab.quantidade_kg || '-')} ${esc(un)}</div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
      <thead><tr><th style="${th};text-align:left">Custos e impostos</th><th style="${th}">Valor R$</th><th style="${th}">%</th></tr></thead>
      <tbody>${impRows}
        <tr><td style="${tdL(TOTAL)};font-weight:bold">TOTAL PAGO</td><td style="${tdR(TOTAL)};font-weight:bold">${brl(c.total)}</td><td style="${tdR(TOTAL)};font-weight:bold">100%</td></tr>
      </tbody>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
      <thead><tr><th style="${th};text-align:left">Despesas</th><th style="${th}">Valor R$</th></tr></thead>
      <tbody>${despRows}<tr><td style="${tdL(TOTAL)};font-weight:bold">Total despesas</td><td style="${tdR(TOTAL)};font-weight:bold">${brl(c.despTotal)}</td></tr></tbody>
    </table>

    ${stRows ? `<table style="width:100%;border-collapse:collapse;margin-bottom:14px">
      <thead><tr><th style="${th};text-align:left">ICMS-ST — Produto</th><th style="${th}">NCM</th><th style="${th}">Base ICMS</th><th style="${th}">ICMS Próprio</th><th style="${th}">Alíquota</th><th style="${th}">IPI Dest.</th><th style="${th}">MVA</th><th style="${th}">ST a recolher</th></tr></thead>
      <tbody>${stRows}<tr><td style="${tdL(TOTAL)};font-weight:bold" colspan="7">ST Custo (total)</td><td style="${tdR(TOTAL)};font-weight:bold">${brl(c.stCusto)}</td></tr></tbody>
    </table>` : ''}

    <table style="width:55%;border-collapse:collapse;margin-left:auto">
      <tr><td style="${tdL('#fff')}">TOTAL PAGO</td><td style="${tdR('#fff')}">${brl(c.total)}</td></tr>
      <tr><td style="${tdL('#fff')}">(−) Créditos ICMS/IPI/PIS/COFINS</td><td style="${tdR('#fff')}">${brl(c.credito)}</td></tr>
      <tr><td style="${tdL(ZEBRA)};font-weight:bold">CUSTO COM CRÉDITO</td><td style="${tdR(ZEBRA)};font-weight:bold">${brl(c.custoCredito)}</td></tr>
      <tr><td style="${tdL(TOTAL)};font-weight:bold;font-size:12px">CUSTO POR ${esc(un)}</td><td style="${tdR(TOTAL)};font-weight:bold;font-size:12px">${brl(c.custoKg)}</td></tr>
    </table>
    <div style="font-size:9px;color:#555;margin-top:14px;text-align:center">Emitido em ${new Date().toLocaleDateString('pt-BR')} · Pietrobon &amp; Cia Ltda</div>
  </div>`
  gerarPdfDeHtml(html, `Custo_${(imp?.invoice || 'importacao').replace(/\W+/g, '_')}.pdf`)
}

// ---------- COMISSÕES ----------
function calcLanc(l) {
  const usd = parseFloat(l.valor_usd) || 0, taxa = parseFloat(l.taxa) || 0, frete = parseFloat(l.frete) || 0, pct = parseFloat(l.pct) || 0
  const valorReais = usd * taxa
  const comissao = valorReais * pct - frete * taxa * pct
  const umDoze = comissao / 12
  const totalNf = comissao + umDoze
  const nfValor = (l.nf_valor === '' || l.nf_valor == null) ? null : parseFloat(l.nf_valor)
  const semNf = !(l.nf_numero && String(l.nf_numero).trim())
  const divergente = nfValor != null && Math.abs(nfValor - totalNf) > 0.02
  return { valorReais, comissao, umDoze, totalNf, nfValor, semNf, divergente, dif: nfValor != null ? nfValor - totalNf : 0 }
}

function setModalTitulo(t) { const el = document.querySelector('#modal-fin .modal-title'); if (el) el.textContent = t }

async function renderComissoes() {
  if (!comReps.length) { const r = await api.fin.representantes(); comReps = Array.isArray(r) ? r : [] }
  const optRep = comReps.map((r) => `<option value="${r.id}" ${String(r.id) === String(comRepSel) ? 'selected' : ''}>${esc(r.nome)}</option>`).join('')
  const cab = `<div class="card mb-3"><div class="card-body">
    <div class="row g-2 align-items-end">
      <div class="col-12 col-md-5"><label class="form-label small mb-0">Representante</label>
        <select class="form-select form-select-sm" onchange="comSelRep(this.value)"><option value="">— selecione —</option>${optRep}</select></div>
      <div class="col-6 col-md-2"><label class="form-label small mb-0">Ano</label><input class="form-control form-control-sm" value="${esc(comAno)}" placeholder="Todos" oninput="comSetAno(this.value)"></div>
      <div class="col-6 col-md-5 text-end"><button class="btn btn-sm btn-outline-primary" onclick="comNovoRep()">+ Representante</button>
        ${comRepSel ? '<button class="btn btn-sm btn-outline-danger ms-1" onclick="comDelRep()">Excluir repres.</button>' : ''}</div>
    </div>
  </div></div>`
  if (!comRepSel) { $('area-fin').innerHTML = cab + '<p class="text-muted">Selecione um representante para ver as faturas e comissões.</p>'; return }
  comFats = await api.fin.comFaturas(comRepSel, comAno) || []
  if (!Array.isArray(comFats)) comFats = []
  const tot = comFats.reduce((a, f) => ({ com: a.com + f.totalComissao, nf: a.nf + f.totalNf, sem: a.sem + f.qtdSemNf, div: a.div + f.qtdDivergente }), { com: 0, nf: 0, sem: 0, div: 0 })
  const resumo = `<div class="row g-2 mb-3">
    <div class="col-6 col-md-3"><div class="card"><div class="card-body py-2 text-center"><div class="small text-muted">Total comissão</div><div class="fw-bold">${brl(tot.com)}</div></div></div></div>
    <div class="col-6 col-md-3"><div class="card"><div class="card-body py-2 text-center"><div class="small text-muted">Total NF esperado</div><div class="fw-bold">${brl(tot.nf)}</div></div></div></div>
    <div class="col-6 col-md-3"><div class="card"><div class="card-body py-2 text-center"><div class="small text-muted">Sem NF</div><div class="fw-bold ${tot.sem ? 'text-warning' : ''}">${tot.sem}</div></div></div></div>
    <div class="col-6 col-md-3"><div class="card"><div class="card-body py-2 text-center"><div class="small text-muted">Divergências</div><div class="fw-bold ${tot.div ? 'text-danger' : ''}">${tot.div}</div></div></div></div>
  </div>`
  const faturasHtml = comFats.map((f) => cardFatura(f)).join('') || '<p class="text-muted">Nenhuma fatura. Adicione a primeira.</p>'
  $('area-fin').innerHTML = cab + resumo +
    `<div class="d-flex justify-content-end gap-2 mb-2">
      <button class="btn btn-outline-success" onclick="comExportarExcel()">Excel</button>
      <button class="btn btn-outline-danger" onclick="comExportarPDF()">PDF</button>
      <button class="btn btn-ok-grande" onclick="comAddFatura()">+ Fatura</button></div>` + faturasHtml
}

async function garantirExcel() { if (!window.ExcelJS) await carregarScriptFin('https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js') }
function comRepNome() { const r = comReps.find((x) => String(x.id) === String(comRepSel)); return r ? r.nome : 'Representante' }

window.comExportarExcel = async () => {
  if (!comFats.length) { alert('Nada para exportar.'); return }
  await garantirExcel()
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(`${comRepNome()} ${comAno || ''}`.slice(0, 31))
  const cabs = ['Fatura', 'Pais', 'Valor da Invoice', 'Data Contrato', 'Valor U$ Contrato', 'Tx Contrato', 'Frete na Invoice', 'Valor R$ Contrato', 'Dct Frete', 'Valor Comissão NF', 'Situação NF', 'Nº NF', 'Observações']
  const hr = ws.addRow(cabs)
  hr.eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF404040' } }; c.alignment = { horizontal: 'center' } })
  comFats.forEach((f) => {
    (f.lancamentos || []).forEach((l, i) => {
      const c = l.calc
      ws.addRow([i === 0 ? f.fatura : '', i === 0 ? f.pais : '', i === 0 ? Number(f.valor_invoice) || 0 : '',
        l.data_contrato ? new Date(l.data_contrato) : '', Number(l.valor_usd) || 0, Number(l.taxa) || 0, Number(l.frete) || 0,
        c.valorReais, Number(l.frete) * Number(l.taxa) * Number(l.pct) || 0, c.comissao, l.situacao || '', l.nf_numero || '', l.obs || ''])
    })
    const sr = ws.addRow(['Situação Fatura/Cliente:', '', f.saldoUsd])
    sr.getCell(1).font = { bold: true }
    ws.addRow([])
  })
  ws.columns.forEach((col, i) => { col.width = [12, 14, 15, 13, 15, 11, 14, 16, 11, 16, 14, 10, 24][i] || 12 })
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Comissoes_${comRepNome().replace(/\W+/g, '_')}${comAno ? '_' + comAno : ''}.xlsx`; a.click(); URL.revokeObjectURL(a.href)
}

window.comExportarPDF = async () => {
  if (!comFats.length) { alert('Nada para exportar.'); return }
  const CAB = '#404040', ZEBRA = '#f2f2f2', TOTAL = '#c9c9c9', BORDA = '1px solid #000'
  const th = `background:${CAB};color:#fff;font-weight:bold;border:${BORDA};padding:4px 5px;font-size:9px;text-align:center`
  const tdL = (bg) => `background:${bg};color:#000;border:${BORDA};padding:3px 5px;font-size:9px;text-align:left`
  const tdR = (bg) => `background:${bg};color:#000;border:${BORDA};padding:3px 5px;font-size:9px;text-align:right`
  let corpo = ''
  comFats.forEach((f) => {
    corpo += `<tr><td style="${tdL(TOTAL)};font-weight:bold" colspan="9">Fatura ${esc(f.fatura || '-')} · ${esc(f.pais || '-')} · ${esc(f.cliente || '-')} · Invoice US$ ${numf(f.valor_invoice)} · Saldo US$ ${numf(f.saldoUsd)}</td></tr>`
    ;(f.lancamentos || []).forEach((l, i) => {
      const c = l.calc, bg = i % 2 ? ZEBRA : '#fff'
      const sit = c.divergente ? 'DIVERGE' : (c.semNf ? 'SEM NF' : (l.situacao || ''))
      corpo += `<tr>
        <td style="${tdL(bg)}">${dBR(l.data_contrato)}</td><td style="${tdR(bg)}">${numf(l.valor_usd)}</td><td style="${tdR(bg)}">${numf(l.taxa, 4)}</td>
        <td style="${tdR(bg)}">${brl(c.valorReais)}</td><td style="${tdR(bg)}">${numf((parseFloat(l.pct) || 0) * 100, 2)}%</td>
        <td style="${tdR(bg)}">${brl(c.comissao)}</td><td style="${tdR(bg)}">${brl(c.totalNf)}</td>
        <td style="${tdL(bg)}">${esc(l.nf_numero || '-')}</td><td style="${tdL(bg)}">${esc(sit)}</td></tr>`
    })
  })
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#000">
    <h2 style="text-align:center;margin:0 0 2px;font-size:15px">RELATÓRIO DE COMISSÕES</h2>
    <div style="text-align:center;font-size:10px;color:#333;margin-bottom:10px">${esc(comRepNome())}${comAno ? ' · ' + esc(comAno) : ''}</div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr><th style="${th}">Data</th><th style="${th}">US$</th><th style="${th}">Taxa</th><th style="${th}">R$</th><th style="${th}">%</th><th style="${th}">Comissão</th><th style="${th}">Total NF</th><th style="${th}">Nº NF</th><th style="${th}">Situação</th></tr></thead>
      <tbody>${corpo}</tbody>
    </table>
    <div style="font-size:9px;color:#555;margin-top:12px;text-align:center">Emitido em ${new Date().toLocaleDateString('pt-BR')} · Pietrobon &amp; Cia Ltda</div>
  </div>`
  gerarPdfDeHtml(html, `Comissoes_${comRepNome().replace(/\W+/g, '_')}${comAno ? '_' + comAno : ''}.pdf`)
}

function cardFatura(f) {
  const th = 'padding:4px 6px;font-size:.75rem'
  const linhas = (f.lancamentos || []).map((l) => {
    const c = l.calc
    const alerta = c.divergente ? `<span class="badge bg-danger">Difere ${brl(c.dif)}</span>` : (c.semNf ? '<span class="badge bg-warning text-dark">Sem NF</span>' : '<span class="badge bg-success">OK</span>')
    return `<tr>
      <td style="${th}">${dBR(l.data_contrato)}</td>
      <td style="${th};text-align:right">${numf(l.valor_usd)}</td>
      <td style="${th};text-align:right">${numf(l.taxa, 4)}</td>
      <td style="${th};text-align:right">${brl(c.valorReais)}</td>
      <td style="${th};text-align:right">${numf((parseFloat(l.pct) || 0) * 100, 2)}%</td>
      <td style="${th};text-align:right">${brl(c.comissao)}</td>
      <td style="${th};text-align:right">${brl(c.totalNf)}</td>
      <td style="${th}">${esc(l.nf_numero || '-')}</td>
      <td style="${th};text-align:right">${c.nfValor != null ? brl(c.nfValor) : '-'}</td>
      <td style="${th}">${alerta}</td>
      <td style="${th};white-space:nowrap"><button class="btn btn-sm btn-outline-secondary py-0 px-1" onclick="comEditLanc(${l.id})">✎</button>
        <button class="btn btn-sm btn-outline-danger py-0 px-1" onclick="comDelLanc(${l.id})">×</button></td>
    </tr>`
  }).join('')
  const saldo = f.saldoUsd
  return `<div class="card mb-2"><div class="card-body">
    <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
      <div><span class="fw-bold">Fatura ${esc(f.fatura || '-')}</span> · ${esc(f.pais || '-')} · ${esc(f.cliente || '-')}
        <div class="small text-muted">Invoice US$ ${numf(f.valor_invoice)} · Saldo US$ <span class="${saldo > 0.01 ? 'text-danger fw-semibold' : 'text-success'}">${numf(saldo)}</span>
          ${f.qtdSemNf ? ` · <span class="text-warning">${f.qtdSemNf} sem NF</span>` : ''}${f.qtdDivergente ? ` · <span class="text-danger">${f.qtdDivergente} divergência(s)</span>` : ''}</div></div>
      <div class="text-nowrap"><button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="comAddLanc(${f.id})">+ Lançamento</button>
        <button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="comEditFatura(${f.id})">Editar</button>
        <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="comDelFatura(${f.id})">🗑</button></div>
    </div>
    <div class="table-responsive"><table class="table table-sm table-hover mb-0" style="font-size:.8rem">
      <thead><tr><th style="${th}">Data</th><th style="${th};text-align:right">US$</th><th style="${th};text-align:right">Taxa</th><th style="${th};text-align:right">R$</th><th style="${th};text-align:right">%</th><th style="${th};text-align:right">Comissão</th><th style="${th};text-align:right">Total NF</th><th style="${th}">Nº NF</th><th style="${th};text-align:right">Valor NF</th><th style="${th}">Situação</th><th style="${th}"></th></tr></thead>
      <tbody>${linhas || `<tr><td colspan="11" class="text-muted fst-italic" style="${th}">Sem lançamentos.</td></tr>`}</tbody>
    </table></div>
  </div></div>`
}

window.comSelRep = (v) => { comRepSel = v; renderComissoes() }
window.comSetAno = (v) => { comAno = v.trim(); clearTimeout(window._comAnoT); window._comAnoT = setTimeout(renderComissoes, 500) }
window.comNovoRep = async () => {
  const nome = prompt('Nome do representante:')
  if (!nome || !nome.trim()) return
  const r = await api.fin.criarRepresentante(nome.trim())
  if (r?.erro) { alert(r.erro); return }
  comReps = []; comRepSel = String(r.id); renderComissoes()
}
window.comDelRep = async () => {
  if (!confirm('Excluir este representante e TODAS as faturas/lançamentos dele?')) return
  await api.fin.excluirRepresentante(comRepSel)
  comReps = []; comRepSel = ''; renderComissoes()
}

function modalFatura(f) {
  setModalTitulo(f ? 'Editar fatura' : 'Nova fatura')
  $('modal-fin-body').innerHTML = `
    <div class="row g-2">
      <div class="col-6 col-md-3"><label class="form-label small mb-0">Fatura</label><input id="mf-fatura" class="form-control form-control-sm" value="${f ? esc(f.fatura || '') : ''}"></div>
      <div class="col-6 col-md-3"><label class="form-label small mb-0">Ano</label><input id="mf-ano" class="form-control form-control-sm" value="${f ? esc(f.ano || '') : (comAno || new Date().getFullYear())}"></div>
      <div class="col-6 col-md-3"><label class="form-label small mb-0">País</label><input id="mf-pais" class="form-control form-control-sm" value="${f ? esc(f.pais || '') : ''}"></div>
      <div class="col-6 col-md-3"><label class="form-label small mb-0">Cliente</label><input id="mf-cliente" class="form-control form-control-sm" value="${f ? esc(f.cliente || '') : ''}"></div>
      <div class="col-6 col-md-4"><label class="form-label small mb-0">Valor Invoice (US$)</label><input type="number" step="any" id="mf-valor" class="form-control form-control-sm" value="${f ? (f.valor_invoice ?? '') : ''}"></div>
    </div>
    <button class="btn btn-ok-grande mt-3" id="mf-salvar">Salvar</button>`
  $('mf-salvar').addEventListener('click', async () => {
    const dados = { representante_id: comRepSel, fatura: $('mf-fatura').value, ano: $('mf-ano').value, pais: $('mf-pais').value, cliente: $('mf-cliente').value, valor_invoice: $('mf-valor').value }
    const r = f ? await api.fin.editarComFatura(f.id, dados) : await api.fin.criarComFatura(dados)
    if (r?.erro) { alert(r.erro); return }
    window._modalFin.hide(); renderComissoes()
  })
  window._modalFin.show()
}
window.comAddFatura = () => modalFatura(null)
window.comEditFatura = (id) => modalFatura(comFats.find((x) => x.id === id))
window.comDelFatura = async (id) => { if (!confirm('Excluir esta fatura e seus lançamentos?')) return; await api.fin.excluirComFatura(id); renderComissoes() }

function modalLanc(fatId, l) {
  setModalTitulo(l ? 'Editar lançamento' : 'Novo lançamento')
  const v = (k, d = '') => l ? (l[k] ?? d) : d
  $('modal-fin-body').innerHTML = `
    <div class="row g-2">
      <div class="col-6 col-md-3"><label class="form-label small mb-0">Data contrato</label><input type="date" id="ml-data" class="form-control form-control-sm" value="${l ? dISO(l.data_contrato) : ''}"></div>
      <div class="col-6 col-md-3"><label class="form-label small mb-0">Valor US$</label><input type="number" step="any" id="ml-usd" class="form-control form-control-sm" value="${v('valor_usd')}"></div>
      <div class="col-6 col-md-3"><label class="form-label small mb-0">Taxa</label><input type="number" step="any" id="ml-taxa" class="form-control form-control-sm" value="${v('taxa')}"></div>
      <div class="col-6 col-md-3"><label class="form-label small mb-0">Frete (US$)</label><input type="number" step="any" id="ml-frete" class="form-control form-control-sm" value="${v('frete', 0)}"></div>
      <div class="col-6 col-md-3"><label class="form-label small mb-0">% comissão</label><input type="number" step="any" id="ml-pct" class="form-control form-control-sm" value="${l ? (l.pct ?? 0.05) : 0.05}"></div>
      <div class="col-6 col-md-3"><label class="form-label small mb-0">Situação</label><select id="ml-sit" class="form-select form-select-sm"><option ${v('situacao') === 'AGUARDANDO NF' ? 'selected' : ''}>AGUARDANDO NF</option><option ${v('situacao') === 'PAGO' ? 'selected' : ''}>PAGO</option></select></div>
      <div class="col-6 col-md-3"><label class="form-label small mb-0">Nº NF</label><input id="ml-nfn" class="form-control form-control-sm" value="${esc(v('nf_numero'))}"></div>
      <div class="col-6 col-md-3"><label class="form-label small mb-0">Valor NF (R$)</label><input type="number" step="any" id="ml-nfv" class="form-control form-control-sm" value="${v('nf_valor')}"></div>
      <div class="col-12"><label class="form-label small mb-0">Observações</label><input id="ml-obs" class="form-control form-control-sm" value="${esc(v('obs'))}"></div>
    </div>
    <div id="ml-calc" class="mt-3 p-2 rounded" style="background:#f8fafc"></div>
    <button class="btn btn-ok-grande mt-3" id="ml-salvar">Salvar</button>`
  const coleta = () => ({ valor_usd: $('ml-usd').value, taxa: $('ml-taxa').value, frete: $('ml-frete').value, pct: $('ml-pct').value, nf_valor: $('ml-nfv').value, nf_numero: $('ml-nfn').value })
  const recalc = () => {
    const c = calcLanc(coleta())
    const al = c.divergente ? `<span class="text-danger fw-bold">Divergência: ${brl(c.dif)}</span>` : (c.nfValor != null ? '<span class="text-success fw-bold">Valor NF confere</span>' : (c.semNf ? '<span class="text-warning">Sem NF lançada</span>' : ''))
    $('ml-calc').innerHTML = `Valor R$: <strong>${brl(c.valorReais)}</strong> · Comissão: <strong>${brl(c.comissao)}</strong> · +1/12: <strong>${brl(c.umDoze)}</strong> · Total NF esperado: <strong>${brl(c.totalNf)}</strong><br>${al}`
  }
  ;['ml-usd', 'ml-taxa', 'ml-frete', 'ml-pct', 'ml-nfv', 'ml-nfn'].forEach((id) => $(id).addEventListener('input', recalc))
  recalc()
  $('ml-salvar').addEventListener('click', async () => {
    const dados = { fatura_id: fatId, data_contrato: $('ml-data').value, valor_usd: $('ml-usd').value, taxa: $('ml-taxa').value, frete: $('ml-frete').value, pct: $('ml-pct').value, situacao: $('ml-sit').value, nf_numero: $('ml-nfn').value, nf_valor: $('ml-nfv').value, obs: $('ml-obs').value }
    const r = l ? await api.fin.editarComLanc(l.id, dados) : await api.fin.criarComLanc(dados)
    if (r?.erro) { alert(r.erro); return }
    window._modalFin.hide(); renderComissoes()
  })
  window._modalFin.show()
}
window.comAddLanc = (fatId) => modalLanc(fatId, null)
window.comEditLanc = (id) => {
  for (const f of comFats) { const l = (f.lancamentos || []).find((x) => x.id === id); if (l) return modalLanc(f.id, l) }
}
window.comDelLanc = async (id) => { if (!confirm('Excluir este lançamento?')) return; await api.fin.excluirComLanc(id); renderComissoes() }

// ---------- Interface ----------
function montarInterface() {
  $('conteudo-fin').innerHTML = `
    <ul class="nav nav-tabs mb-3" id="tabs-fin">
      <li class="nav-item"><a class="nav-link active" href="#" data-aba="painel">Painel</a></li>
      <li class="nav-item"><a class="nav-link" href="#" data-aba="importacoes">Importações</a></li>
      <li class="nav-item"><a class="nav-link" href="#" data-aba="contratos">Contratos de Câmbio</a></li>
      <li class="nav-item"><a class="nav-link" href="#" data-aba="custos">Custos de Importação</a></li>
      <li class="nav-item"><a class="nav-link" href="#" data-aba="comissoes">Comissões</a></li>
      <li class="nav-item"><a class="nav-link" href="#" data-aba="fornecedores">Fornecedores</a></li>
    </ul>
    <div id="area-fin"><p class="text-muted">Carregando...</p></div>
    <div class="modal fade" id="modal-fin" tabindex="-1"><div class="modal-dialog modal-lg modal-dialog-scrollable">
      <div class="modal-content"><div class="modal-header"><h6 class="modal-title fw-bold">Pagamentos da importação</h6>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body" id="modal-fin-body"></div></div></div></div>`
  window._modalFin = new bootstrap.Modal($('modal-fin'))
  document.querySelectorAll('#tabs-fin .nav-link').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault()
      document.querySelectorAll('#tabs-fin .nav-link').forEach((x) => x.classList.remove('active'))
      a.classList.add('active')
      aba = a.dataset.aba
      editImp = null; editForn = null; editCt = null
      render()
    })
  })
}

async function iniciar() {
  const perfil = exigirPapel(['admin'])
  if (!perfil) return
  if (!EMAILS_FINANCEIRO.includes((perfil.email || '').toLowerCase())) { window.location.href = '/HTML/producao/admin.html'; return }
  montarCabecalho(perfil.papel)
  montarInterface()
  carregar()
}

iniciar()