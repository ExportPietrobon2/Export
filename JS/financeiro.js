import { api } from './api.js'
import { exigirPapel } from './auth.js'
import { montarCabecalho } from './cabecalho.js'

const EMAILS_FINANCEIRO = ['export2@pietrobon.com.br', 'export@pietrobon.com.br', 'joaoantonio@pietrobon.com.br']

let resumo = null
let fornecedores = []
let aba = 'painel'

const $ = (id) => document.getElementById(id)
const brl = (n) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const numf = (n, d = 2) => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const dISO = (v) => v ? String(v).slice(0, 10) : ''
const dBR = (v) => { const s = dISO(v); return s ? s.split('-').reverse().join('/') : '-' }
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const STATUS_COR = { PAGO: 'bg-success', PARCIAL: 'bg-warning text-dark', DEVENDO: 'bg-danger' }

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
}

// ---------- PAINEL ----------
function renderPainel() {
  const c = resumo.contagem
  $('area-fin').innerHTML = `
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
}

// ---------- IMPORTAÇÕES ----------
function renderImportacoes() {
  const imps = resumo.importacoes
  const optForn = fornecedores.map((f) => `<option value="${f.id}">${esc(f.nome)}</option>`).join('')
  $('area-fin').innerHTML = `
    <div class="card mb-3"><div class="card-body">
      <h5 class="secao-titulo-card mb-3">Nova importação</h5>
      <div class="row g-2">
        <div class="col-12 col-md-4"><label class="form-label small mb-0">Fornecedor</label><select id="i-fornecedor_id" class="form-select form-select-sm"><option value="">—</option>${optForn}</select></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Nº Invoice</label><input id="i-invoice" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Data</label><input type="date" id="i-data_invoice" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-4"><label class="form-label small mb-0">Mercadoria</label><input id="i-mercadoria" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Moeda</label><input id="i-moeda" class="form-control form-control-sm" value="USD"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Valor (moeda)</label><input type="number" step="any" id="i-valor_moeda" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Taxa câmbio</label><input type="number" step="any" id="i-taxa_cambio" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Banco</label><input id="i-banco" class="form-control form-control-sm" value="Santander"></div>
      </div>
      <button class="btn btn-ok-grande mt-3" id="btn-nova-imp">Lançar importação</button>
    </div></div>
    <div class="card"><div class="table-responsive"><table class="table table-sm table-hover mb-0" style="font-size:.82rem">
      <thead><tr><th>Invoice</th><th>Fornecedor</th><th>Mercadoria</th><th class="text-end">Valor (moeda)</th><th class="text-end">Taxa</th><th class="text-end">Valor R$</th><th class="text-end">Pago R$</th><th class="text-end">Saldo R$</th><th>Status</th><th></th></tr></thead>
      <tbody>${imps.map((i) => `<tr>
        <td class="fw-semibold">${esc(i.invoice)}</td>
        <td>${esc(i.fornecedor_nome || '-')}</td>
        <td>${esc(i.mercadoria || '-')}</td>
        <td class="text-end">${i.moeda || ''} ${numf(i.valor_moeda)}</td>
        <td class="text-end">${numf(i.taxa_cambio, 4)}</td>
        <td class="text-end">${brl(i.valor_reais)}</td>
        <td class="text-end">${brl(i.pago)}</td>
        <td class="text-end fw-semibold ${i.saldo > 0.01 ? 'text-danger' : 'text-success'}">${brl(i.saldo)}</td>
        <td><span class="badge ${STATUS_COR[i.status]}">${i.status}</span></td>
        <td style="white-space:nowrap"><button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="abrirPagamentos(${i.id})">Pagamentos</button>
          <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="excluirImp(${i.id})">🗑</button></td>
      </tr>`).join('')}</tbody>
    </table></div></div>`
  $('btn-nova-imp').addEventListener('click', novaImportacao)
}

async function novaImportacao() {
  const dados = {}
  ;['fornecedor_id', 'invoice', 'data_invoice', 'mercadoria', 'moeda', 'valor_moeda', 'taxa_cambio', 'banco'].forEach((k) => { dados[k] = $('i-' + k).value })
  if (!dados.invoice) { alert('Informe o Nº do invoice.'); return }
  const r = await api.fin.criarImportacao(dados)
  if (r?.erro) { alert(r.erro); return }
  carregar()
}

window.excluirImp = async function (id) {
  if (!confirm('Excluir esta importação e todos os pagamentos/contratos dela?')) return
  await api.fin.excluirImportacao(id)
  carregar()
}

// ---------- PAGAMENTOS (modal) ----------
window.abrirPagamentos = async function (id) {
  const imp = resumo.importacoes.find((x) => x.id === id)
  if (!imp) return
  window._impAtual = id
  const pags = await api.fin.pagamentos(id)
  const lista = Array.isArray(pags) ? pags : []
  $('modal-fin-body').innerHTML = `
    <h5 class="mb-1">${esc(imp.invoice)} — ${esc(imp.fornecedor_nome || '')}</h5>
    <div class="small text-muted mb-3">Valor: <strong>${brl(imp.valor_reais)}</strong> · Pago: <strong>${brl(imp.pago)}</strong> · Saldo: <strong class="${imp.saldo > 0.01 ? 'text-danger' : 'text-success'}">${brl(imp.saldo)}</strong></div>
    <div class="row g-2 align-items-end mb-3">
      <div class="col-6 col-md-3"><label class="form-label small mb-0">Data</label><input type="date" id="p-data" class="form-control form-control-sm"></div>
      <div class="col-6 col-md-3"><label class="form-label small mb-0">Valor pago (R$)</label><input type="number" step="any" id="p-valor" class="form-control form-control-sm"></div>
      <div class="col-6 col-md-3"><label class="form-label small mb-0">Forma</label><input id="p-forma" class="form-control form-control-sm" value="Câmbio Antecipado"></div>
      <div class="col-6 col-md-3"><label class="form-label small mb-0">Observação</label><input id="p-obs" class="form-control form-control-sm"></div>
    </div>
    <button class="btn btn-ok-grande" id="p-salvar">Registrar pagamento</button>
    <hr>
    <div id="p-lista"></div>`
  $('p-data').value = new Date().toISOString().slice(0, 10)
  renderListaPag(lista)
  $('p-salvar').addEventListener('click', salvarPagamento)
  window._modalFin.show()
}

function renderListaPag(lista) {
  const el = $('p-lista')
  if (!lista.length) { el.innerHTML = '<p class="text-muted fst-italic mb-0">Nenhum pagamento registrado.</p>'; return }
  el.innerHTML = `<table class="table table-sm mb-0" style="font-size:.85rem"><thead><tr><th>Data</th><th class="text-end">Valor R$</th><th>Forma</th><th>Obs.</th><th></th></tr></thead>
    <tbody>${lista.map((p) => `<tr><td>${dBR(p.data_pgto)}</td><td class="text-end">${brl(p.valor_reais)}</td><td>${esc(p.forma || '-')}</td><td>${esc(p.obs || '-')}</td>
      <td class="text-end"><button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="excluirPag(${p.id})">Excluir</button></td></tr>`).join('')}</tbody></table>`
}

async function salvarPagamento() {
  const dados = { importacao_id: window._impAtual, data_pgto: $('p-data').value, valor_reais: $('p-valor').value, forma: $('p-forma').value, obs: $('p-obs').value }
  if (!(parseFloat(dados.valor_reais) >= 0)) { alert('Informe o valor.'); return }
  const r = await api.fin.criarPagamento(dados)
  if (r?.erro) { alert(r.erro); return }
  await carregar()
  abrirPagamentos(window._impAtual)
}

window.excluirPag = async function (id) {
  if (!confirm('Excluir este pagamento?')) return
  await api.fin.excluirPagamento(id)
  await carregar()
  abrirPagamentos(window._impAtual)
}

// ---------- FORNECEDORES ----------
function renderFornecedores() {
  $('area-fin').innerHTML = `
    <div class="card mb-3"><div class="card-body">
      <h5 class="secao-titulo-card mb-3">Novo fornecedor</h5>
      <div class="row g-2">
        <div class="col-12 col-md-4"><label class="form-label small mb-0">Nome</label><input id="f-nome" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">País</label><input id="f-pais" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-1"><label class="form-label small mb-0">Moeda</label><input id="f-moeda" class="form-control form-control-sm" value="USD"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Contato</label><input id="f-contato" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-3"><label class="form-label small mb-0">E-mail</label><input id="f-email" class="form-control form-control-sm"></div>
        <div class="col-12"><label class="form-label small mb-0">Observações</label><input id="f-obs" class="form-control form-control-sm"></div>
      </div>
      <button class="btn btn-pietrobon btn-sm mt-3" id="btn-novo-forn">Adicionar fornecedor</button>
    </div></div>
    <div class="card"><div class="table-responsive"><table class="table table-sm table-hover mb-0" style="font-size:.85rem">
      <thead><tr><th>Fornecedor</th><th>País</th><th>Moeda</th><th>Contato</th><th>E-mail</th><th>Observações</th><th></th></tr></thead>
      <tbody>${fornecedores.map((f) => `<tr><td class="fw-semibold">${esc(f.nome)}</td><td>${esc(f.pais || '-')}</td><td>${esc(f.moeda || '-')}</td><td>${esc(f.contato || '-')}</td><td>${esc(f.email || '-')}</td><td>${esc(f.obs || '-')}</td>
        <td class="text-end"><button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="excluirForn(${f.id})">🗑</button></td></tr>`).join('')}</tbody>
    </table></div></div>`
  $('btn-novo-forn').addEventListener('click', novoFornecedor)
}

async function novoFornecedor() {
  const dados = {}
  ;['nome', 'pais', 'moeda', 'contato', 'email', 'obs'].forEach((k) => { dados[k] = $('f-' + k).value })
  if (!dados.nome.trim()) { alert('Informe o nome.'); return }
  const r = await api.fin.criarFornecedor(dados)
  if (r?.erro) { alert(r.erro); return }
  carregar()
}

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
  const optImp = resumo.importacoes.map((i) => `<option value="${i.id}">${esc(i.invoice)} — ${esc(i.fornecedor_nome || '')}</option>`).join('')
  $('area-fin').innerHTML = `
    <div class="card mb-3"><div class="card-body">
      <h5 class="secao-titulo-card mb-3">Novo contrato de câmbio</h5>
      <div class="row g-2">
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Nº Contrato</label><input id="ct-num_contrato" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Banco</label><input id="ct-banco" class="form-control form-control-sm" value="Santander"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Data fechamento</label><input type="date" id="ct-data_fechamento" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-1"><label class="form-label small mb-0">Moeda</label><input id="ct-moeda" class="form-control form-control-sm" value="USD"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Valor (moeda)</label><input type="number" step="any" id="ct-valor_moeda" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-1"><label class="form-label small mb-0">Taxa</label><input type="number" step="any" id="ct-taxa" class="form-control form-control-sm"></div>
        <div class="col-12 col-md-4"><label class="form-label small mb-0">Importação vinculada</label><select id="ct-importacao_id" class="form-select form-select-sm"><option value="">—</option>${optImp}</select></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Data liquidação</label><input type="date" id="ct-data_liquidacao" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2 d-flex align-items-end"><div class="form-check"><input class="form-check-input" type="checkbox" id="ct-liquidado" checked><label class="form-check-label small" for="ct-liquidado">Liquidado</label></div></div>
        <div class="col-12 col-md-4"><label class="form-label small mb-0">Observações</label><input id="ct-obs" class="form-control form-control-sm"></div>
      </div>
      <button class="btn btn-pietrobon btn-sm mt-3" id="btn-novo-ct">Adicionar contrato</button>
    </div></div>
    <div class="card"><div class="table-responsive"><table class="table table-sm table-hover mb-0" style="font-size:.82rem">
      <thead><tr><th>Nº Contrato</th><th>Banco</th><th>Fechamento</th><th class="text-end">Valor (moeda)</th><th class="text-end">Taxa</th><th class="text-end">Valor R$</th><th>Invoice</th><th>Liquidado</th><th></th></tr></thead>
      <tbody>${lista.map((c) => `<tr><td class="fw-semibold">${esc(c.num_contrato)}</td><td>${esc(c.banco || '-')}</td><td>${dBR(c.data_fechamento)}</td>
        <td class="text-end">${c.moeda || ''} ${numf(c.valor_moeda)}</td><td class="text-end">${numf(c.taxa, 4)}</td><td class="text-end">${brl(c.valor_reais)}</td>
        <td>${esc(c.invoice || '-')}</td><td>${c.liquidado ? '<span class="badge bg-success">Sim</span>' : '<span class="badge bg-secondary">Não</span>'}</td>
        <td class="text-end"><button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="excluirCt(${c.id})">🗑</button></td></tr>`).join('')}</tbody>
    </table></div></div>`
  $('btn-novo-ct').addEventListener('click', novoContrato)
}

async function novoContrato() {
  const dados = {}
  ;['num_contrato', 'banco', 'data_fechamento', 'moeda', 'valor_moeda', 'taxa', 'importacao_id', 'data_liquidacao', 'obs'].forEach((k) => { dados[k] = $('ct-' + k).value })
  dados.liquidado = $('ct-liquidado').checked
  if (!dados.num_contrato) { alert('Informe o Nº do contrato.'); return }
  const r = await api.fin.criarContrato(dados)
  if (r?.erro) { alert(r.erro); return }
  renderContratos()
}

window.excluirCt = async function (id) {
  if (!confirm('Excluir este contrato?')) return
  await api.fin.excluirContrato(id)
  renderContratos()
}

// ---------- Interface ----------
function montarInterface() {
  $('conteudo-fin').innerHTML = `
    <ul class="nav nav-tabs mb-3" id="tabs-fin">
      <li class="nav-item"><a class="nav-link active" href="#" data-aba="painel">Painel</a></li>
      <li class="nav-item"><a class="nav-link" href="#" data-aba="importacoes">Importações</a></li>
      <li class="nav-item"><a class="nav-link" href="#" data-aba="contratos">Contratos de Câmbio</a></li>
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
      render()
    })
  })
}

async function iniciar() {
  const perfil = exigirPapel(['admin'])
  if (!perfil) return
  if (!EMAILS_FINANCEIRO.includes((perfil.email || '').toLowerCase())) { window.location.href = '/HTML/admin.html'; return }
  montarCabecalho(perfil.papel)
  montarInterface()
  carregar()
}

iniciar()