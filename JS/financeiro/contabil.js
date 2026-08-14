import { api } from '/JS/core/api.js'
import { exigirPapel } from '/JS/core/auth.js'
import { montarCabecalho } from '/JS/core/cabecalho.js'

const EMAILS_FINANCEIRO = ['export2@pietrobon.com.br', 'export@pietrobon.com.br', 'joaoantonio@pietrobon.com.br']
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const COLS = [
  { k: 'data',              t: 'Data',            tipo: 'date' },
  { k: 'nf',               t: 'NF' },
  { k: 'fatura',           t: 'Fatura' },
  { k: 'num_due',          t: 'Núm. DUE' },
  { k: 'data_due',         t: 'Data DUE',         tipo: 'date' },
  { k: 'num_conhecimento', t: 'Nº Conhec. Emb.' },
  { k: 'data_conhecimento',t: 'Data Conhec.',     tipo: 'date' },
  { k: 'tipo',             t: 'Tipo' },
  { k: 'valor_nfe',        t: 'Valor da NFE',     tipo: 'num' },
  { k: 'peso',             t: 'Peso (kg)',         tipo: 'num' },
  { k: 'vendedor',         t: 'Vendedor' },
  { k: 'produto',          t: 'Produto' },
  { k: 'pais',             t: 'País' }
]

let anoAtual    = new Date().getFullYear()
let dados       = []
let formAberto  = false
const abertos   = new Set()
const mesesAbertos = new Set([new Date().getMonth() + 1])

function dISO(v) { return v ? String(v).slice(0, 10) : '' }
function dBR(v) { const s = dISO(v); return s ? s.split('-').reverse().join('/') : '' }
function money(n) { return (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

async function carregarAnos() {
  const anos = await api.contabil.anos()
  const sel = document.getElementById('sel-ano')
  if (!sel || !Array.isArray(anos)) return
  sel.innerHTML = anos.map((a) => `<option value="${a}" ${a === anoAtual ? 'selected' : ''}>${a}</option>`).join('')
}

async function carregarDados() {
  const cont = document.getElementById('tabela-contabil')
  cont.innerHTML = '<p class="text-muted">Carregando...</p>'
  const rows = await api.contabil.listar(anoAtual)
  if (!Array.isArray(rows)) { cont.innerHTML = '<p class="text-danger">Erro ao carregar.</p>'; return }
  dados = rows
  renderTabela()
  renderResumo()
}

window.toggleMes = function(m) {
  if (mesesAbertos.has(m)) mesesAbertos.delete(m)
  else mesesAbertos.add(m)
  renderTabela()
}

window.expandirTodos = function() {
  for (let m = 1; m <= 12; m++) mesesAbertos.add(m)
  renderTabela()
}

window.recolherTodos = function() {
  mesesAbertos.clear()
  renderTabela()
}

window.toggleForm = function() {
  formAberto = !formAberto
  const form = document.getElementById('form-lancamento')
  const btn  = document.getElementById('btn-toggle-form')
  if (formAberto) {
    form.style.display = 'block'
    btn.textContent = '▲ Recolher'
  } else {
    form.style.display = 'none'
    btn.textContent = '➕ Nova nota'
  }
}

function alertasCampos(d) {
  const faltando = []
  if (!d.num_due)          faltando.push('DUE')
  if (!d.data_due)         faltando.push('Data DUE')
  if (!d.num_conhecimento) faltando.push('Conhec.')
  if (!d.data_conhecimento)faltando.push('Data Conhec.')
  if (!d.tipo)             faltando.push('Tipo')
  if (!d.vendedor)         faltando.push('Vendedor')
  if (!d.peso)             faltando.push('Peso')
  if (!faltando.length) return '<span class="badge bg-success">✔ Completo</span>'
  return `<span class="badge bg-warning text-dark" title="${faltando.join(', ')} não preenchido">⚠ ${faltando.length} campo${faltando.length > 1 ? 's' : ''}</span>`
}

function gerarFormEdicaoInline(d) {
  const campo = (col) => {
    const val = col.tipo === 'date' ? dISO(d[col.k]) : (d[col.k] == null ? '' : d[col.k])
    if (col.k === 'tipo') {
      return `<select id="ei-tipo-${d.id}" class="form-select form-select-sm">
        <option value="">—</option>
        ${['BL','CRT','DDE','SD'].map(o => `<option ${val===o?'selected':''}>${o}</option>`).join('')}
      </select>`
    }
    const type = col.tipo === 'date' ? 'date' : col.tipo === 'num' ? 'number' : 'text'
    const step = col.tipo === 'num' ? ' step="any"' : ''
    return `<input type="${type}"${step} id="ei-${col.k}-${d.id}" class="form-control form-control-sm" value="${val}">`
  }
  return `
    <div class="form-edicao-inline" id="form-inline-${d.id}">
      <div class="row g-2">
        ${COLS.map(col => `
          <div class="col-6 col-md-3">
            <label class="form-label small fw-semibold mb-1">${col.t}</label>
            ${campo(col)}
          </div>`).join('')}
      </div>
      <div class="d-flex gap-2 mt-3">
        <button class="btn btn-sm btn-ok-grande" onclick="salvarEdicaoInline(${d.id})">💾 Salvar</button>
        <button class="btn btn-sm btn-outline-secondary" onclick="fecharInline(${d.id})">Cancelar</button>
        <button class="btn btn-sm btn-outline-danger ms-auto" onclick="excluirNota(${d.id})">🗑 Excluir</button>
      </div>
    </div>`
}

function renderTabela() {
  const cont = document.getElementById('tabela-contabil')
  if (!dados.length) {
    cont.innerHTML = '<p class="text-muted fst-italic">Nenhuma nota lançada neste ano.</p>'
    return
  }

  let html = '<div class="meses-lista">'
  for (let m = 1; m <= 12; m++) {
    const doMes = dados.filter((d) => d.mes === m)
    if (!doMes.length) continue
    const aberto   = mesesAbertos.has(m)
    const totValor = doMes.reduce((s, d) => s + (Number(d.valor_nfe) || 0), 0)
    const totPeso  = doMes.reduce((s, d) => s + (Number(d.peso) || 0), 0)
    const temIncompleto = doMes.some(d => !d.num_due || !d.data_due || !d.num_conhecimento || !d.data_conhecimento || !d.tipo || !d.vendedor || !d.peso)

    html += `
      <div class="mes-section${aberto ? ' mes-aberto' : ''}">
        <button class="mes-header" onclick="toggleMes(${m})">
          <div class="mes-header-esq">
            <span class="mes-chevron">${aberto ? '▼' : '▶'}</span>
            <span class="mes-nome">${MESES[m-1]}</span>
            <span class="mes-qtd">${doMes.length} nota${doMes.length > 1 ? 's' : ''}</span>
            ${temIncompleto ? '<span class="badge bg-warning text-dark ms-1" style="font-size:.65rem">⚠ Incompleto</span>' : ''}
          </div>
          <div class="mes-header-dir">
            <span class="mes-valor-total">R$ ${money(totValor)}</span>
            <span class="mes-peso-total">${money(totPeso)} kg</span>
          </div>
        </button>
        ${aberto ? `
          <div class="mes-body">
            ${doMes.map(d => {
              const estaAberto = abertos.has(d.id)
              return `
                <div class="nota-card" id="card-nota-${d.id}">
                  <div class="nota-card-linha">
                    <div class="nota-info-grupo">
                      <span class="nota-fatura">${d.fatura || '—'}</span>
                      <span class="nota-detalhe">NF ${d.nf || '—'}</span>
                      ${d.data ? `<span class="nota-detalhe">${dBR(d.data)}</span>` : ''}
                      ${d.pais ? `<span class="badge bg-secondary nota-pais">${d.pais}</span>` : ''}
                      ${d.produto ? `<span class="nota-detalhe">${d.produto}</span>` : ''}
                      ${alertasCampos(d)}
                    </div>
                    <div class="nota-acoes">
                      <span class="nota-valor">R$ ${money(d.valor_nfe)}</span>
                      <button class="btn btn-sm btn-outline-primary btn-editar-nota"
                        onclick="toggleInline(${d.id})">
                        ${estaAberto ? 'Fechar ▴' : 'Editar ▾'}
                      </button>
                    </div>
                  </div>
                  ${estaAberto ? gerarFormEdicaoInline(d) : ''}
                </div>`
            }).join('')}
          </div>` : ''}
      </div>`
  }
  html += '</div>'
  cont.innerHTML = html
}

window.toggleInline = function(id) {
  if (abertos.has(id)) abertos.delete(id)
  else abertos.add(id)
  renderTabela()
  setTimeout(() => {
    const card = document.getElementById(`card-nota-${id}`)
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, 50)
}

window.fecharInline = function(id) { abertos.delete(id); renderTabela() }

window.salvarEdicaoInline = async function(id) {
  const d = dados.find(x => x.id === id)
  if (!d) return
  const g = (k) => { const el = document.getElementById(`ei-${k}-${id}`); return el ? el.value || null : null }
  const dataVal = g('data')
  const mes = dataVal ? (new Date(dataVal + 'T00:00:00').getMonth() + 1) : d.mes
  const registro = { ano: anoAtual, mes, data: g('data'), nf: g('nf'), fatura: g('fatura'), num_due: g('num_due'), data_due: g('data_due'), num_conhecimento: g('num_conhecimento'), data_conhecimento: g('data_conhecimento'), tipo: g('tipo'), valor_nfe: g('valor_nfe'), peso: g('peso'), vendedor: g('vendedor'), produto: g('produto'), pais: g('pais') }
  const btn = document.querySelector(`#form-inline-${id} .btn-ok-grande`)
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...' }
  const r = await api.contabil.editar(id, registro)
  if (r?.erro) { alert(r.erro || 'Erro ao salvar.'); if (btn) { btn.disabled = false; btn.textContent = '💾 Salvar' }; return }
  abertos.delete(id)
  await carregarAnos()
  carregarDados()
}

window.excluirNota = async function(id) {
  if (!confirm('Excluir esta nota?')) return
  const r = await api.contabil.excluir(id)
  if (r?.erro) { alert('Erro ao excluir.'); return }
  abertos.delete(id)
  carregarDados()
}

function renderResumo() {
  const totalValor = dados.reduce((s, d) => s + (Number(d.valor_nfe) || 0), 0)
  const totalPeso  = dados.reduce((s, d) => s + (Number(d.peso) || 0), 0)
  const totalNotas = dados.length
  const porMes = MESES.map((nome, i) => {
    const doMes = dados.filter((d) => d.mes === i + 1)
    return { nome, valor: doMes.reduce((s, d) => s + (Number(d.valor_nfe) || 0), 0), peso: doMes.reduce((s, d) => s + (Number(d.peso) || 0), 0), qtd: doMes.length }
  })

  document.getElementById('resumo-contabil').innerHTML = `
    <div class="row g-3 mb-4">
      <div class="col-6 col-md-3"><div class="card"><div class="card-body text-center py-3">
        <div class="small text-muted mb-1">Valor Comercializado</div>
        <div class="fw-bold fs-5 text-success">R$ ${money(totalValor)}</div>
      </div></div></div>
      <div class="col-6 col-md-3"><div class="card"><div class="card-body text-center py-3">
        <div class="small text-muted mb-1">Kilos Produzidos</div>
        <div class="fw-bold fs-5">${money(totalPeso)} kg</div>
      </div></div></div>
      <div class="col-6 col-md-3"><div class="card"><div class="card-body text-center py-3">
        <div class="small text-muted mb-1">Notas no ano</div>
        <div class="fw-bold fs-5">${totalNotas}</div>
      </div></div></div>
      <div class="col-6 col-md-3"><div class="card"><div class="card-body text-center py-3">
        <div class="small text-muted mb-1">Média por nota</div>
        <div class="fw-bold fs-5">R$ ${money(totalNotas ? totalValor / totalNotas : 0)}</div>
      </div></div></div>
    </div>
    <div class="card mb-4"><div class="card-body py-2">
      <details>
        <summary class="secao-titulo-card mb-0" style="cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;padding:6px 0">
          <span style="font-size:.85rem;color:#94a3b8">▶</span>
          Vendas por mês — ${anoAtual}
        </summary>
        <div class="table-responsive mt-3">
          <table class="table table-sm mb-0" style="font-size:.85rem">
            <thead><tr><th>Mês</th><th class="text-end">Notas</th><th class="text-end">Valor</th><th class="text-end">Peso (kg)</th></tr></thead>
            <tbody>
              ${porMes.filter(m => m.qtd).map(m => `
                <tr>
                  <td>${m.nome}</td>
                  <td class="text-end">${m.qtd}</td>
                  <td class="text-end">R$ ${money(m.valor)}</td>
                  <td class="text-end">${money(m.peso)}</td>
                </tr>`).join('')}
              <tr class="fw-bold" style="background:#fbeaea">
                <td>TOTAL</td>
                <td class="text-end">${totalNotas}</td>
                <td class="text-end">R$ ${money(totalValor)}</td>
                <td class="text-end">${money(totalPeso)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div></div>`
}

async function salvarNota() {
  const dataVal = document.getElementById('f-data').value
  const mes = dataVal ? (new Date(dataVal + 'T00:00:00').getMonth() + 1) : parseInt(document.getElementById('f-mes').value)
  if (!mes) { alert('Informe a Data (ou o mês) da nota.'); return }
  const registro = { ano: anoAtual, mes }
  COLS.forEach(c => { registro[c.k] = document.getElementById('f-' + c.k)?.value || null })
  const btn = document.getElementById('btn-salvar-nota')
  btn.disabled = true
  const r = await api.contabil.criar(registro)
  btn.disabled = false
  if (r?.erro) { alert(r.erro || 'Erro ao salvar.'); return }
  if (mes) mesesAbertos.add(mes)
  COLS.forEach(c => { const el = document.getElementById('f-' + c.k); if (el) el.value = '' })
  await carregarAnos()
  carregarDados()
}

const COR_AZUL  = 'FF000080'
const COR_VERDE = 'FF99CC00'
const COR_TOTAL = 'FFD9E1F2'
const BORDA = { top: { style: 'thin', color: { argb: 'FF808080' } }, left: { style: 'thin', color: { argb: 'FF808080' } }, bottom: { style: 'thin', color: { argb: 'FF808080' } }, right: { style: 'thin', color: { argb: 'FF808080' } } }
function preencher(cell, argb) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } } }

async function exportarExcel() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(String(anoAtual), { views: [{ showGridLines: false }] })
  const nc = COLS.length
  const LARGURAS = { data:14, nf:13, fatura:14, num_due:20, data_due:14, num_conhecimento:20, data_conhecimento:15, tipo:8, valor_nfe:16, peso:13, vendedor:20, produto:25, pais:18 }
  COLS.forEach((c, i) => { ws.getColumn(i+1).width = LARGURAS[c.k] || 15 })
  const totalValor = dados.reduce((s, d) => s + (Number(d.valor_nfe) || 0), 0)
  const totalPeso  = dados.reduce((s, d) => s + (Number(d.peso) || 0), 0)
  ws.mergeCells(1, 1, 1, nc)
  const c1 = ws.getCell(1, 1)
  c1.value = 'FATURAMENTO NFe — ' + anoAtual; c1.font = { bold: true, size: 16, color: { argb: COR_AZUL } }; c1.alignment = { horizontal: 'center', vertical: 'middle' }; ws.getRow(1).height = 30
  ws.mergeCells(2, 1, 2, nc)
  const c2 = ws.getCell(2, 1)
  c2.value = 'Total: R$ ' + money(totalValor) + '  •  Kilos: ' + money(totalPeso) + ' kg  •  Notas: ' + dados.length
  c2.font = { size: 10, italic: true, color: { argb: 'FF555555' } }; c2.alignment = { horizontal: 'center', vertical: 'middle' }; ws.getRow(2).height = 18; ws.getRow(3).height = 8
  let r = 4
  for (let m = 1; m <= 12; m++) {
    const doMes = dados.filter(d => d.mes === m)
    if (!doMes.length) continue
    const tv = doMes.reduce((s, d) => s + (Number(d.valor_nfe) || 0), 0)
    const tp = doMes.reduce((s, d) => s + (Number(d.peso) || 0), 0)
    ws.mergeCells(r, 1, r, nc); const cm = ws.getCell(r, 1)
    cm.value = MESES[m-1].toUpperCase() + '   —   ' + doMes.length + ' nota' + (doMes.length>1?'s':'') + '   •   R$ ' + money(tv) + '   •   ' + money(tp) + ' kg'
    cm.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }; preencher(cm, COR_AZUL); cm.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }; ws.getRow(r).height = 22; r++
    COLS.forEach((c, i) => { const cell = ws.getCell(r, i+1); cell.value = c.t; cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } }; preencher(cell, '2C3E50'); cell.border = BORDA; cell.alignment = { horizontal: 'center', vertical: 'middle' } })
    ws.getRow(r).height = 18; r++
    doMes.forEach((d, idx) => {
      ws.getRow(r).height = 16
      COLS.forEach((c, i) => {
        const cell = ws.getCell(r, i+1); let v = d[c.k]
        if (c.tipo === 'date') { cell.value = dBR(v) } else if (c.tipo === 'num') { cell.value = Number(v) || 0; cell.numFmt = '#,##0.00' } else { cell.value = v == null ? '' : v }
        cell.font = { size: 10, color: { argb: 'FF111111' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF5F5F5' } }; cell.border = BORDA; cell.alignment = { horizontal: c.tipo === 'num' ? 'right' : 'left', vertical: 'middle' }
      }); r++
    })
    ws.getRow(r).height = 16
    for (let i = 1; i <= nc; i++) { const cell = ws.getCell(r, i); preencher(cell, COR_TOTAL); cell.border = BORDA; cell.font = { bold: true, size: 10 } }
    ws.mergeCells(r, 1, r, 8); const lt = ws.getCell(r, 1); lt.value = 'TOTAL ' + MESES[m-1]; lt.alignment = { horizontal: 'right', vertical: 'middle' }
    const cv = ws.getCell(r, 9); cv.value = tv; cv.numFmt = '#,##0.00'; cv.alignment = { horizontal: 'right', vertical: 'middle' }
    const cp = ws.getCell(r, 10); cp.value = tp; cp.numFmt = '#,##0.00'; cp.alignment = { horizontal: 'right', vertical: 'middle' }
    r++; ws.getRow(r).height = 10; r++
  }
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'Faturamento_NFe_' + anoAtual + '.xlsx'; a.click(); URL.revokeObjectURL(url)
}

function exportarPDF() {
  const totalValor = dados.reduce((s,d) => s+(Number(d.valor_nfe)||0), 0)
  const totalPeso  = dados.reduce((s,d) => s+(Number(d.peso)||0), 0)
  let secoes = ''
  for (let m = 1; m <= 12; m++) {
    const doMes = dados.filter(d => d.mes === m); if (!doMes.length) continue
    const tv = doMes.reduce((s,d) => s+(Number(d.valor_nfe)||0), 0)
    const tp = doMes.reduce((s,d) => s+(Number(d.peso)||0), 0)
    const linhas = doMes.map(d => '<tr><td>'+dBR(d.data)+'</td><td>'+(d.nf||'')+'</td><td><strong>'+(d.fatura||'')+'</strong></td><td>'+(d.num_due||'')+'</td><td>'+dBR(d.data_due)+'</td><td>'+(d.num_conhecimento||'')+'</td><td>'+dBR(d.data_conhecimento)+'</td><td>'+(d.tipo||'')+'</td><td class="num">R$ '+money(d.valor_nfe)+'</td><td class="num">'+money(d.peso)+'</td><td>'+(d.vendedor||'')+'</td><td>'+(d.produto||'')+'</td><td>'+(d.pais||'')+'</td></tr>').join('')
    secoes += '<div class="mes-bloco"><div class="mes-header"><span>'+MESES[m-1].toUpperCase()+'</span><span>'+doMes.length+' nota'+(doMes.length>1?'s':'')+' &middot; R$ '+money(tv)+' &middot; '+money(tp)+' kg</span></div><table><thead><tr><th>Data</th><th>NF</th><th>Fatura</th><th>Núm. DUE</th><th>Data DUE</th><th>Nº Conhec.</th><th>Data Conhec.</th><th>Tipo</th><th class="num">Valor NFE</th><th class="num">Peso (kg)</th><th>Vendedor</th><th>Produto</th><th>País</th></tr></thead><tbody>'+linhas+'</tbody><tfoot><tr><td colspan="8" style="text-align:right;font-weight:700">TOTAL '+MESES[m-1]+'</td><td class="num" style="font-weight:700">R$ '+money(tv)+'</td><td class="num" style="font-weight:700">'+money(tp)+' kg</td><td colspan="3"></td></tr></tfoot></table></div>'
  }
  const linhasMes = MESES.map((nome,i) => { const doMes=dados.filter(d=>d.mes===i+1); if(!doMes.length) return ''; const v=doMes.reduce((s,d)=>s+(Number(d.valor_nfe)||0),0); const p=doMes.reduce((s,d)=>s+(Number(d.peso)||0),0); return '<tr><td>'+nome+'</td><td class="num">'+doMes.length+'</td><td class="num">R$ '+money(v)+'</td><td class="num">'+money(p)+' kg</td></tr>' }).join('')
  const css = '* { margin:0; padding:0; box-sizing:border-box; } body { font-family:Arial,sans-serif; font-size:8.5pt; color:#111; } .cabecalho { background:#C0392B; color:#fff; padding:12px 20px; display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; } .cabecalho h1 { font-size:14pt; font-weight:700; } .mes-bloco { margin:0 20px 20px; page-break-inside:avoid; } .mes-header { background:#1A1A2E; color:#fff; padding:6px 10px; font-size:9pt; font-weight:700; display:flex; justify-content:space-between; border-radius:4px 4px 0 0; } table { width:100%; border-collapse:collapse; font-size:7.5pt; } thead tr { background:#2C3E50; color:#fff; } thead th { padding:4px 5px; text-align:left; font-weight:600; border:1px solid #455; white-space:nowrap; } tbody tr:nth-child(even) { background:#F8F9FA; } tbody td { padding:3px 5px; border:1px solid #DDD; vertical-align:top; } tfoot tr { background:#D9E1F2; } tfoot td { padding:4px 5px; border:1px solid #BCC; font-size:8pt; } .num { text-align:right; white-space:nowrap; } .rodape-resumo { margin:0 20px; page-break-before:always; } @media print { body{font-size:7.5pt;} .cabecalho,.mes-header,thead,tfoot,tbody tr:nth-child(even){-webkit-print-color-adjust:exact;print-color-adjust:exact;} } @page { size:A4 landscape; margin:10mm; }'
  const hoje = new Date().toLocaleDateString('pt-BR')
  const html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Faturamento NFe '+anoAtual+'</title><style>'+css+'</style></head><body><div class="cabecalho"><div><h1>Faturamento NFe &mdash; '+anoAtual+'</h1><p>PIETROBON &amp; CIA. LTDA. &nbsp;&middot;&nbsp; Gerado em '+hoje+'</p></div><div style="text-align:right"><div style="font-size:13pt;font-weight:700">R$ '+money(totalValor)+'</div><div style="opacity:.85;font-size:9pt">'+money(totalPeso)+' kg &nbsp;&middot;&nbsp; '+dados.length+' notas</div></div></div>'+secoes+'<div class="rodape-resumo"><h2 style="font-size:11pt;color:#C0392B;margin-bottom:8px;border-bottom:2px solid #C0392B;padding-bottom:4px">Vendas por Mês &mdash; '+anoAtual+'</h2><table><thead><tr><th>Mês</th><th class="num">Notas</th><th class="num">Valor</th><th class="num">Peso</th></tr></thead><tbody>'+linhasMes+'</tbody><tfoot><tr><td><strong>TOTAL</strong></td><td class="num"><strong>'+dados.length+'</strong></td><td class="num"><strong>R$ '+money(totalValor)+'</strong></td><td class="num"><strong>'+money(totalPeso)+' kg</strong></td></tr></tfoot></table></div><script>window.onload=function(){window.print()}<\/script></body></html>'
  const janela = window.open('', '_blank'); janela.document.write(html); janela.document.close()
}

function montarInterface() {
  const cont = document.getElementById('conteudo-contabil')
  cont.innerHTML = `
    <style>
      .barra-controles { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:20px; background:#fff; border:1px solid #e4e7ef; border-radius:14px; padding:14px 18px; box-shadow:0 1px 3px rgba(15,23,42,.05); }
      .barra-dir  { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
      .barra-esq  { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }

      #form-lancamento { display:none; background:#fff; border:1px solid #e4e7ef; border-radius:14px; padding:20px; margin-bottom:20px; box-shadow:0 1px 3px rgba(15,23,42,.05); }

      .meses-lista { display:flex; flex-direction:column; gap:8px; }

      .mes-section { background:#fff; border:1px solid #e4e7ef; border-radius:14px; overflow:hidden; box-shadow:0 1px 3px rgba(15,23,42,.05); transition:box-shadow .18s; }
      .mes-section.mes-aberto { box-shadow:0 4px 16px rgba(15,23,42,.09); }

      .mes-header { width:100%; border:none; background:transparent; display:flex; align-items:center; justify-content:space-between; padding:14px 18px; cursor:pointer; text-align:left; gap:12px; transition:background .12s; }
      .mes-header:hover { background:#fafbfd; }
      .mes-aberto .mes-header { background:#fafbfd; border-bottom:1px solid #e4e7ef; }

      .mes-header-esq { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
      .mes-header-dir { display:flex; align-items:center; gap:16px; flex-shrink:0; }

      .mes-chevron  { font-size:.75rem; color:#94a3b8; width:14px; text-align:center; transition:transform .2s; }
      .mes-nome     { font-weight:700; font-size:.95rem; color:#1c2230; }
      .mes-qtd      { font-size:.78rem; color:#94a3b8; font-weight:500; }
      .mes-valor-total { font-weight:700; color:#16a34a; font-size:.92rem; }
      .mes-peso-total  { font-size:.78rem; color:#64748b; }

      .mes-body { padding:12px 14px 10px; display:flex; flex-direction:column; gap:8px; }

      .nota-card { background:#fafbfd; border:1px solid #e4e7ef; border-radius:10px; overflow:hidden; }
      .nota-card-linha { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:11px 14px; flex-wrap:wrap; }
      .nota-info-grupo { display:flex; align-items:center; gap:8px; flex-wrap:wrap; flex:1; }
      .nota-fatura  { font-weight:700; color:#1c2230; font-size:.875rem; }
      .nota-detalhe { font-size:.78rem; color:#64748b; }
      .nota-pais    { font-size:.7rem !important; }
      .nota-acoes   { display:flex; align-items:center; gap:10px; flex-shrink:0; }
      .nota-valor   { font-weight:700; color:#16a34a; font-size:.875rem; }
      .btn-editar-nota { font-size:.78rem; padding:3px 10px; }

      .form-edicao-inline { padding:16px; border-top:1px solid #e4e7ef; background:#fff; }

      @media (max-width:576px) {
        .mes-header-dir { flex-direction:column; align-items:flex-end; gap:2px; }
        .nota-card-linha { flex-direction:column; align-items:flex-start; }
        .nota-acoes { width:100%; justify-content:space-between; }
      }
    </style>

    <div class="barra-controles">
      <div class="barra-esq">
        <button id="btn-toggle-form" class="btn btn-pietrobon" onclick="toggleForm()">➕ Nova nota</button>
        <div class="d-flex align-items-center gap-2">
          <label class="small fw-semibold mb-0 text-muted">Ano:</label>
          <select id="sel-ano" class="form-select form-select-sm" style="width:90px"></select>
          <button id="btn-add-ano" class="btn btn-sm btn-outline-secondary">+ Ano</button>
        </div>
      </div>
      <div class="barra-dir">
        <button class="btn btn-sm btn-outline-secondary" onclick="expandirTodos()">Expandir todos</button>
        <button class="btn btn-sm btn-outline-secondary" onclick="recolherTodos()">Recolher todos</button>
        <button id="btn-excel" class="btn btn-sm btn-outline-success">Excel</button>
        <button id="btn-pdf"   class="btn btn-sm btn-outline-danger">PDF</button>
      </div>
    </div>

    <div id="form-lancamento">
      <h5 class="secao-titulo-card mb-3">Lançar nota fiscal</h5>
      <div class="row g-2">
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Data</label><input type="date" id="f-data" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Mês (se sem data)</label><select id="f-mes" class="form-select form-select-sm"><option value="">—</option>${MESES.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('')}</select></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">NF</label><input type="text" id="f-nf" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Fatura</label><input type="text" id="f-fatura" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Núm. DUE</label><input type="text" id="f-num_due" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Data DUE</label><input type="date" id="f-data_due" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Nº Conhec. Emb.</label><input type="text" id="f-num_conhecimento" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Data Conhec.</label><input type="date" id="f-data_conhecimento" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Tipo</label><select id="f-tipo" class="form-select form-select-sm"><option value="">—</option><option>BL</option><option>CRT</option><option>DDE</option><option>SD</option></select></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Valor da NFE</label><input type="number" step="any" id="f-valor_nfe" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Peso (kg)</label><input type="number" step="any" id="f-peso" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Vendedor</label><input type="text" id="f-vendedor" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-3"><label class="form-label small mb-0">Produto</label><input type="text" id="f-produto" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">País</label><input type="text" id="f-pais" class="form-control form-control-sm"></div>
      </div>
      <div class="mt-3 d-flex gap-2">
        <button id="btn-salvar-nota" class="btn btn-ok-grande">➕ Lançar nota</button>
        <button class="btn btn-outline-secondary" onclick="toggleForm()">Cancelar</button>
      </div>
    </div>

    <div id="resumo-contabil"></div>
    <div id="tabela-contabil"></div>`

  document.getElementById('sel-ano').addEventListener('change', (e) => {
    anoAtual = parseInt(e.target.value)
    mesesAbertos.clear()
    mesesAbertos.add(new Date().getMonth() + 1)
    carregarDados()
  })
  document.getElementById('btn-add-ano').addEventListener('click', () => {
    const resp = prompt('Digite o ano que deseja abrir:', String(new Date().getFullYear() + 1))
    if (!resp) return
    const ano = parseInt(resp)
    if (!ano || ano < 2000 || ano > 2100) { alert('Ano inválido.'); return }
    const sel = document.getElementById('sel-ano')
    if (![...sel.options].some(o => parseInt(o.value) === ano)) {
      const o = document.createElement('option'); o.value = ano; o.textContent = ano; sel.appendChild(o)
      const opts = [...sel.options].sort((a,b) => parseInt(b.value) - parseInt(a.value)); sel.innerHTML = ''; opts.forEach(op => sel.appendChild(op))
    }
    sel.value = ano; anoAtual = ano; mesesAbertos.clear(); mesesAbertos.add(new Date().getMonth() + 1)
    carregarDados()
  })
  document.getElementById('btn-salvar-nota').addEventListener('click', salvarNota)
  document.getElementById('btn-excel').addEventListener('click', exportarExcel)
  document.getElementById('btn-pdf').addEventListener('click', exportarPDF)
}

async function iniciar() {
  const perfil = exigirPapel(['admin'])
  if (!perfil) return
  if (!EMAILS_FINANCEIRO.includes((perfil.email || '').toLowerCase())) { window.location.href = '/HTML/producao/admin.html'; return }
  montarCabecalho(perfil.papel)
  montarInterface()
  await carregarAnos()
  carregarDados()
}

iniciar()