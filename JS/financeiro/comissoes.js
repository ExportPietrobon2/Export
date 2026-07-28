import { api } from '/JS/core/api.js'
import { exigirPapel } from '/JS/core/auth.js'
import { montarCabecalho } from '/JS/core/cabecalho.js'

const EMAILS_FINANCEIRO = ['export2@pietrobon.com.br', 'export@pietrobon.com.br', 'joaoantonio@pietrobon.com.br']

const $ = (id) => document.getElementById(id)
const brl = (n) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const numf = (n, d = 2) => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const dISO = (v) => v ? String(v).slice(0, 10) : ''
const dBR = (v) => { const s = dISO(v); return s ? s.split('-').reverse().join('/') : '-' }
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

let comRepSel = ''
let comAno = ''
let comReps = []
let comFats = []
let modal = null

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

function setModalTitulo(t) { const el = document.querySelector('#modal-com .modal-title'); if (el) el.textContent = t }

async function render() {
  if (!comReps.length) { const r = await api.fin.representantes(); comReps = Array.isArray(r) ? r : [] }
  const optRep = comReps.map((r) => `<option value="${r.id}" ${String(r.id) === String(comRepSel) ? 'selected' : ''}>${esc(r.nome)}</option>`).join('')
  const cab = `<div class="card mb-3"><div class="card-body">
    <div class="row g-2 align-items-end">
      <div class="col-12 col-md-5"><label class="form-label small mb-0">Representante</label>
        <select class="form-select form-select-sm" onchange="comSelRep(this.value)"><option value="">— selecione —</option>${optRep}</select></div>
      <div class="col-6 col-md-2"><label class="form-label small mb-0">Ano</label><input class="form-control form-control-sm" value="${esc(comAno)}" placeholder="Todos" oninput="comSetAno(this.value)"></div>
      <div class="col-12 col-md-5 text-end">
        <button class="btn btn-sm btn-outline-primary" onclick="comNovoRep()">+ Representante</button>
        <button class="btn btn-sm btn-outline-success ms-1" onclick="comImportar()">Importar planilha</button>
        ${comRepSel ? '<button class="btn btn-sm btn-outline-danger ms-1" onclick="comDelRep()">Excluir repres.</button>' : ''}</div>
    </div>
    <input type="file" id="com-file" accept=".xlsx" style="display:none">
  </div></div>`
  if (!comRepSel) { $('conteudo-com').innerHTML = cab + '<p class="text-muted">Selecione um representante para ver as faturas e comissões, ou importe uma planilha.</p>'; ligarFile(); return }
  comFats = await api.fin.comFaturas(comRepSel, comAno) || []
  if (!Array.isArray(comFats)) comFats = []
  const tot = comFats.reduce((a, f) => ({ com: a.com + f.totalComissao, nf: a.nf + f.totalNf, sem: a.sem + f.qtdSemNf, div: a.div + f.qtdDivergente }), { com: 0, nf: 0, sem: 0, div: 0 })
  const resumo = `<div class="row g-2 mb-3">
    <div class="col-6 col-md-3"><div class="card"><div class="card-body py-2 text-center"><div class="small text-muted">Total comissão</div><div class="fw-bold">${brl(tot.com)}</div></div></div></div>
    <div class="col-6 col-md-3"><div class="card"><div class="card-body py-2 text-center"><div class="small text-muted">Total NF esperado</div><div class="fw-bold">${brl(tot.nf)}</div></div></div></div>
    <div class="col-6 col-md-3"><div class="card"><div class="card-body py-2 text-center"><div class="small text-muted">Sem NF</div><div class="fw-bold ${tot.sem ? 'text-warning' : ''}">${tot.sem}</div></div></div></div>
    <div class="col-6 col-md-3"><div class="card"><div class="card-body py-2 text-center"><div class="small text-muted">Divergências</div><div class="fw-bold ${tot.div ? 'text-danger' : ''}">${tot.div}</div></div></div></div>
  </div>`
  const faturasHtml = comFats.map((f) => cardFatura(f)).join('') || '<p class="text-muted">Nenhuma fatura. Adicione a primeira ou importe uma planilha.</p>'
  $('conteudo-com').innerHTML = cab + resumo +
    `<div class="d-flex justify-content-end gap-2 mb-2">
      <button class="btn btn-outline-success" onclick="comExportarExcel()">Excel</button>
      <button class="btn btn-outline-danger" onclick="comExportarPDF()">PDF</button>
      <button class="btn btn-ok-grande" onclick="comAddFatura()">+ Fatura</button></div>` + faturasHtml
  ligarFile()
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

window.comSelRep = (v) => { comRepSel = v; render() }
window.comSetAno = (v) => { comAno = v.trim(); clearTimeout(window._comAnoT); window._comAnoT = setTimeout(render, 500) }
window.comNovoRep = async () => {
  const nome = prompt('Nome do representante:')
  if (!nome || !nome.trim()) return
  const r = await api.fin.criarRepresentante(nome.trim())
  if (r?.erro) { alert(r.erro); return }
  comReps = []; comRepSel = String(r.id); render()
}
window.comDelRep = async () => {
  if (!confirm('Excluir este representante e TODAS as faturas/lançamentos dele?')) return
  await api.fin.excluirRepresentante(comRepSel)
  comReps = []; comRepSel = ''; render()
}

function modalFatura(f) {
  setModalTitulo(f ? 'Editar fatura' : 'Nova fatura')
  $('modal-com-body').innerHTML = `
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
    modal.hide(); render()
  })
  modal.show()
}
window.comAddFatura = () => modalFatura(null)
window.comEditFatura = (id) => modalFatura(comFats.find((x) => x.id === id))
window.comDelFatura = async (id) => { if (!confirm('Excluir esta fatura e seus lançamentos?')) return; await api.fin.excluirComFatura(id); render() }

function modalLanc(fatId, l) {
  setModalTitulo(l ? 'Editar lançamento' : 'Novo lançamento')
  const v = (k, d = '') => l ? (l[k] ?? d) : d
  $('modal-com-body').innerHTML = `
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
    modal.hide(); render()
  })
  modal.show()
}
window.comAddLanc = (fatId) => modalLanc(fatId, null)
window.comEditLanc = (id) => {
  for (const f of comFats) { const l = (f.lancamentos || []).find((x) => x.id === id); if (l) return modalLanc(f.id, l) }
}
window.comDelLanc = async (id) => { if (!confirm('Excluir este lançamento?')) return; await api.fin.excluirComLanc(id); render() }

// ---- Exportações ----
function carregarScript(src) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some((s) => s.src === src)) return resolve()
    const s = document.createElement('script'); s.src = src
    s.onload = () => resolve(); s.onerror = () => reject(new Error('Falha ao carregar ' + src))
    document.head.appendChild(s)
  })
}
async function garantirLibsPdf() {
  if (!window.html2canvas) await carregarScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')
  if (!window.jspdf) await carregarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
}
async function garantirExcel() { if (!window.ExcelJS) await carregarScript('https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js') }
async function gerarPdfDeHtml(html, nome) {
  await garantirLibsPdf()
  const cont = document.createElement('div')
  cont.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;background:#fff;padding:24px'
  cont.innerHTML = html
  document.body.appendChild(cont)
  try {
    const canvas = await html2canvas(cont, { scale: 2, backgroundColor: '#ffffff' })
    const { jsPDF } = window.jspdf
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageW = 210, pageH = 297
    const imgW = pageW, imgH = canvas.height * imgW / canvas.width
    let heightLeft = imgH, position = 0
    const img = canvas.toDataURL('image/jpeg', 0.92)
    pdf.addImage(img, 'JPEG', 0, position, imgW, imgH); heightLeft -= pageH
    while (heightLeft > 0) { position -= pageH; pdf.addPage(); pdf.addImage(img, 'JPEG', 0, position, imgW, imgH); heightLeft -= pageH }
    pdf.save(nome)
  } catch (e) { alert('Erro ao gerar PDF: ' + e.message) } finally { document.body.removeChild(cont) }
}
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

// ---- Importar planilha ----
function ligarFile() {
  const inp = $('com-file')
  if (inp) inp.onchange = onArquivo
}
window.comImportar = () => {
  if (!comRepSel) { alert('Selecione (ou crie) o representante antes de importar.'); return }
  $('com-file').click()
}
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
function acharCol(headers, ...alvos) {
  for (let i = 0; i < headers.length; i++) { const h = norm(headers[i]); if (alvos.some((a) => h.includes(a))) return i }
  return -1
}
function toISO(v) {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = String(v).trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})[/](\d{1,2})[/](\d{2,4})/); if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` }
  return null
}
const num = (v) => { if (v == null || v === '') return 0; const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.')); return isNaN(parseFloat(v)) ? (isNaN(n) ? 0 : n) : parseFloat(v) }

async function onArquivo(ev) {
  const file = ev.target.files[0]
  if (!file) return
  await garantirExcel()
  const buf = await file.arrayBuffer()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf)
  const faturas = []
  wb.eachSheet((ws) => {
    const anoM = String(ws.name).match(/(20\d{2})/)
    const ano = anoM ? parseInt(anoM[1]) : null
    const headers = []
    ws.getRow(1).eachCell({ includeEmpty: true }, (c, n) => { headers[n - 1] = c.value })
    const cFat = acharCol(headers, 'fatura'), cPais = acharCol(headers, 'pais'), cInv = acharCol(headers, 'valor da invoice', 'invoice')
    const cData = acharCol(headers, 'data'), cUsd = acharCol(headers, 'u$', 'us$', 'valor u'), cTaxa = acharCol(headers, 'tx', 'taxa')
    const cFrete = acharCol(headers, 'frete'), cRs = acharCol(headers, 'valor r$', 'valor r'), cCom = acharCol(headers, 'comiss')
    const cSit = acharCol(headers, 'situacao nf', 'situacao'), cNf = acharCol(headers, 'n nf', 'nº nf', 'no nf', 'nf'), cObs = acharCol(headers, 'observ')
    if (cFat < 0) return
    let atual = null
    const val = (row, i) => i >= 0 ? row.getCell(i + 1).value : null
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r)
      const aRaw = val(row, cFat)
      const a = aRaw == null ? '' : String(aRaw).trim()
      if (norm(a).startsWith('situacao fatura')) continue
      const usd = num(val(row, cUsd)), data = toISO(val(row, cData))
      if (a && !norm(a).startsWith('situacao')) {
        atual = { fatura: a, pais: cPais >= 0 ? (val(row, cPais) || '') : '', cliente: '', valor_invoice: num(val(row, cInv)), ano, lancamentos: [] }
        faturas.push(atual)
      }
      if (atual && (usd || data)) {
        const taxa = num(val(row, cTaxa)), frete = num(val(row, cFrete))
        const rs = cRs >= 0 ? num(val(row, cRs)) : usd * taxa
        const com = cCom >= 0 ? num(val(row, cCom)) : 0
        const denom = rs - frete * taxa
        const pct = com && denom ? com / denom : 0.05
        atual.lancamentos.push({
          data_contrato: data, valor_usd: usd, taxa, frete, pct,
          situacao: cSit >= 0 ? String(val(row, cSit) || '').trim() : '',
          nf_numero: cNf >= 0 ? String(val(row, cNf) || '').trim() : '',
          obs: cObs >= 0 ? String(val(row, cObs) || '').trim() : ''
        })
      }
    }
  })
  ev.target.value = ''
  const nLanc = faturas.reduce((s, f) => s + f.lancamentos.length, 0)
  if (!faturas.length) { alert('Não encontrei faturas nesta planilha. Verifique se é o relatório de comissões.'); return }
  if (!confirm(`Importar ${faturas.length} faturas e ${nLanc} lançamentos para "${comRepNome()}"?\nFaturas já existentes (mesmo ano/número) serão substituídas.`)) return
  const r = await api.fin.importarComissoes({ representante_id: comRepSel, substituir: true, faturas })
  if (r?.erro) { alert(r.erro); return }
  alert(`Importado: ${r.faturas} faturas e ${r.lancamentos} lançamentos.`)
  render()
}

async function iniciar() {
  const perfil = exigirPapel(['admin'])
  if (!perfil) return
  if (!EMAILS_FINANCEIRO.includes((perfil.email || '').toLowerCase())) { window.location.href = '/HTML/producao/admin.html'; return }
  montarCabecalho(perfil.papel)
  modal = new bootstrap.Modal($('modal-com'))
  render()
}

iniciar()