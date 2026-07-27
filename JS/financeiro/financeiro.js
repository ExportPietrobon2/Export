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
    custoCab = { nfe: d.nfe || '', materia_prima: d.materia_prima ?? '', imposto_importacao: d.imposto_importacao ?? '', ipi: d.ipi ?? '', pis: d.pis ?? '', cofins: d.cofins ?? '', icms: d.icms ?? '', quantidade_kg: d.quantidade_kg ?? '', unidade: d.unidade || 'KG', obs: d.obs || '' }
    custoDespesas = (d.despesas || []).map((x) => ({ nome: x.nome || '', valor: x.valor ?? '' }))
    custoSt = (d.st || []).map((x) => ({ produto: x.produto || '', ncm: x.ncm || '', base_icms: x.base_icms ?? '', icms_proprio: x.icms_proprio ?? '', aliquota: x.aliquota ?? '', ipi_destacado: x.ipi_destacado ?? '', mva: x.mva ?? '' }))
  } else {
    custoCab = { nfe: imp?.invoice || '', materia_prima: imp?.valor_reais ?? '', imposto_importacao: '', ipi: '', pis: '', cofins: '', icms: '', quantidade_kg: '', unidade: 'KG', obs: '' }
    custoDespesas = []
    custoSt = []
  }
  renderCustos()
}

function renderCustos() {
  const optImp = resumo.importacoes.map((i) => `<option value="${i.id}" ${String(i.id) === String(custoImpSel) ? 'selected' : ''}>${esc(i.invoice)} — ${esc(i.fornecedor_nome || '')}</option>`).join('')
  if (!custoImpSel) {
    $('area-fin').innerHTML = `<div class="card"><div class="card-body">
      <label class="form-label small mb-1">Importação</label>
      <select class="form-select form-select-sm" style="max-width:520px" onchange="custoSelImp(this.value)"><option value="">— selecione uma importação —</option>${optImp}</select>
      <p class="text-muted mt-3 mb-0">Escolha uma importação para calcular os custos de nacionalização (matéria-prima, impostos, despesas, ICMS-ST e custo por kg).</p>
    </div></div>`
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
        <div class="col-6 col-md-2"><label class="form-label small mb-0">NF-e</label><input class="form-control form-control-sm" value="${esc(custoCab.nfe || '')}" oninput="custoCabInput('nfe',this.value)"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Quantidade</label><input type="number" step="any" class="form-control form-control-sm" value="${custoCab.quantidade_kg ?? ''}" oninput="custoCabInput('quantidade_kg',this.value)"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Unidade</label><select class="form-select form-select-sm" onchange="custoCabInput('unidade',this.value)"><option value="KG" ${(custoCab.unidade || 'KG') === 'KG' ? 'selected' : ''}>KG</option><option value="UN" ${custoCab.unidade === 'UN' ? 'selected' : ''}>UN</option></select></div>
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
    </div></div>`
  atualizarResumoCusto()
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
  const NAVY = '#1f2d50', BORD = '#d5dae2', LBL = '#eef1f5'
  const pct = (v) => c.total > 0 ? (v / c.total * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '-'
  const th = `background:${NAVY};color:#fff;font-weight:bold;font-size:11px;padding:6px 10px`
  const tdL = `border:1px solid ${BORD};padding:5px 10px;font-size:11px`
  const tdR = `border:1px solid ${BORD};padding:5px 10px;font-size:11px;text-align:right`
  const g = (k) => parseFloat(custoCab[k]) || 0
  const linImp = (l, v) => `<tr><td style="${tdL}">${esc(l)}</td><td style="${tdR}">${brl(v)}</td><td style="${tdR}">${pct(v)}</td></tr>`
  const despRows = custoDespesas.filter((d) => (d.nome || '') || (parseFloat(d.valor) || 0)).map((d) => `<tr><td style="${tdL}">${esc(d.nome || '-')}</td><td style="${tdR}">${brl(d.valor)}</td></tr>`).join('') || `<tr><td style="${tdL}" colspan="2">—</td></tr>`
  const stRows = custoSt.filter((s) => (s.produto || '') || (parseFloat(s.base_icms) || 0)).map((s) => `<tr>
    <td style="${tdL}">${esc(s.produto || '-')}</td><td style="${tdL}">${esc(s.ncm || '-')}</td>
    <td style="${tdR}">${brl(s.base_icms)}</td><td style="${tdR}">${brl(s.icms_proprio)}</td>
    <td style="${tdR}">${numf(s.aliquota, 4)}</td><td style="${tdR}">${brl(s.ipi_destacado)}</td><td style="${tdR}">${numf(s.mva, 4)}</td>
    <td style="${tdR};font-weight:bold">${brl(stRecolher(s))}</td></tr>`).join('')
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid ${NAVY};padding-bottom:8px;margin-bottom:12px">
      <div><div style="font-weight:bold;font-size:14px">CUSTO DE IMPORTAÇÃO</div>
        <div style="font-size:11px;color:#333">Invoice ${esc(imp?.invoice || '')} · ${esc(imp?.fornecedor_nome || '')}</div>
        <div style="font-size:11px;color:#333">NF-e: ${esc(custoCab.nfe || '-')} · Qtd: ${esc(custoCab.quantidade_kg || '-')} ${esc(un)}</div>
      </div>
      <div style="font-weight:bold;font-size:15px;color:#c0392b">Pietrobon</div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
      <thead><tr><th style="${th};text-align:left">Custos e impostos</th><th style="${th};text-align:right">Valor R$</th><th style="${th};text-align:right">%</th></tr></thead>
      <tbody>
        ${linImp('Matéria-prima', g('materia_prima'))}${linImp('Imposto Importação', g('imposto_importacao'))}${linImp('ST Custo', c.stCusto)}
        ${linImp('IPI', g('ipi'))}${linImp('PIS', g('pis'))}${linImp('COFINS', g('cofins'))}${linImp('ICMS', g('icms'))}${linImp('Despesas', c.despTotal)}
        <tr style="background:${LBL};font-weight:bold"><td style="${tdL}">TOTAL PAGO</td><td style="${tdR}">${brl(c.total)}</td><td style="${tdR}">100%</td></tr>
      </tbody>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
      <thead><tr><th style="${th};text-align:left">Despesas</th><th style="${th};text-align:right">Valor R$</th></tr></thead>
      <tbody>${despRows}<tr style="background:${LBL};font-weight:bold"><td style="${tdL}">Total despesas</td><td style="${tdR}">${brl(c.despTotal)}</td></tr></tbody>
    </table>

    ${stRows ? `<table style="width:100%;border-collapse:collapse;margin-bottom:14px">
      <thead><tr><th style="${th};text-align:left">ICMS-ST — Produto</th><th style="${th}">NCM</th><th style="${th};text-align:right">Base ICMS</th><th style="${th};text-align:right">ICMS Próprio</th><th style="${th};text-align:right">Alíquota</th><th style="${th};text-align:right">IPI Dest.</th><th style="${th};text-align:right">MVA</th><th style="${th};text-align:right">ST a recolher</th></tr></thead>
      <tbody>${stRows}<tr style="background:${LBL};font-weight:bold"><td style="${tdL}" colspan="7">ST Custo (total)</td><td style="${tdR}">${brl(c.stCusto)}</td></tr></tbody>
    </table>` : ''}

    <table style="width:60%;border-collapse:collapse;margin-left:auto">
      <tr><td style="${tdL}">TOTAL PAGO</td><td style="${tdR}">${brl(c.total)}</td></tr>
      <tr><td style="${tdL};color:#1a7f37">(−) Créditos ICMS/IPI/PIS/COFINS</td><td style="${tdR};color:#1a7f37">${brl(c.credito)}</td></tr>
      <tr style="font-weight:bold"><td style="${tdL}">CUSTO COM CRÉDITO</td><td style="${tdR}">${brl(c.custoCredito)}</td></tr>
      <tr style="background:${NAVY};color:#fff;font-weight:bold"><td style="border:1px solid ${NAVY};padding:7px 10px;font-size:12px">CUSTO POR ${esc(un)}</td><td style="border:1px solid ${NAVY};padding:7px 10px;font-size:12px;text-align:right">${brl(c.custoKg)}</td></tr>
    </table>
    <div style="font-size:9.5px;color:#666;margin-top:14px">Emitido em ${new Date().toLocaleDateString('pt-BR')} · Pietrobon &amp; Cia Ltda</div>
  </div>`
  gerarPdfDeHtml(html, `Custo_${(imp?.invoice || 'importacao').replace(/\W+/g, '_')}.pdf`)
}

// ---------- Interface ----------
function montarInterface() {
  $('conteudo-fin').innerHTML = `
    <ul class="nav nav-tabs mb-3" id="tabs-fin">
      <li class="nav-item"><a class="nav-link active" href="#" data-aba="painel">Painel</a></li>
      <li class="nav-item"><a class="nav-link" href="#" data-aba="importacoes">Importações</a></li>
      <li class="nav-item"><a class="nav-link" href="#" data-aba="contratos">Contratos de Câmbio</a></li>
      <li class="nav-item"><a class="nav-link" href="#" data-aba="custos">Custos de Importação</a></li>
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