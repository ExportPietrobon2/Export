import { api } from '/JS/core/api.js'
import { exigirPapel } from '/JS/core/auth.js'
import { montarCabecalho } from '/JS/core/cabecalho.js'

const EMAILS_FINANCEIRO = ['export2@pietrobon.com.br', 'export@pietrobon.com.br', 'joaoantonio@pietrobon.com.br']
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const COLS = [
  { k: 'data',             t: 'Data',            tipo: 'date' },
  { k: 'nf',              t: 'NF' },
  { k: 'fatura',          t: 'Fatura' },
  { k: 'num_due',         t: 'Núm. DUE' },
  { k: 'data_due',        t: 'Data DUE',         tipo: 'date' },
  { k: 'num_conhecimento',t: 'Nº Conhec. Emb.' },
  { k: 'data_conhecimento',t: 'Data Conhec.',    tipo: 'date' },
  { k: 'tipo',            t: 'Tipo' },
  { k: 'valor_nfe',       t: 'Valor da NFE',     tipo: 'num' },
  { k: 'peso',            t: 'Peso (kg)',         tipo: 'num' },
  { k: 'vendedor',        t: 'Vendedor' },
  { k: 'produto',         t: 'Produto' },
  { k: 'pais',            t: 'País' }
]

let anoAtual = new Date().getFullYear()
let dados = []
const abertos = new Set()

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
    <div class="border-top pt-3 mt-1 bg-light rounded-bottom-3 px-3 pb-3" id="form-inline-${d.id}">
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

  let html = ''
  for (let m = 1; m <= 12; m++) {
    const doMes = dados.filter((d) => d.mes === m)
    if (!doMes.length) continue
    const totValor = doMes.reduce((s, d) => s + (Number(d.valor_nfe) || 0), 0)
    const totPeso  = doMes.reduce((s, d) => s + (Number(d.peso) || 0), 0)

    html += `
      <div class="mb-4">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h5 class="secao-titulo-card mb-0">
            ${MESES[m-1]}
            <span class="text-muted fw-normal" style="font-size:.85rem">(${doMes.length} nota${doMes.length > 1 ? 's' : ''})</span>
          </h5>
          <div class="text-end small">
            <span class="text-muted">Total:</span>
            <strong class="ms-1 text-success">R$ ${money(totValor)}</strong>
            <span class="text-muted ms-3">Peso:</span>
            <strong class="ms-1">${money(totPeso)} kg</strong>
          </div>
        </div>
        ${doMes.map(d => {
          const estaAberto = abertos.has(d.id)
          return `
            <div class="card mb-2 border-0 shadow-sm" id="card-nota-${d.id}">
              <div class="card-body py-2 px-3">
                <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div class="d-flex align-items-center gap-3 flex-wrap">
                    <span class="fw-bold">${d.fatura || '—'}</span>
                    <span class="text-muted small">NF ${d.nf || '—'}</span>
                    <span class="badge bg-secondary">${d.pais || '—'}</span>
                    ${d.produto ? `<span class="text-muted small">${d.produto}</span>` : ''}
                    ${d.data ? `<span class="text-muted small">${dBR(d.data)}</span>` : ''}
                    ${(() => {
                      const faltando = []
                      if (!d.num_due)          faltando.push('DUE')
                      if (!d.data_due)         faltando.push('Data DUE')
                      if (!d.num_conhecimento) faltando.push('Conhec.')
                      if (!d.data_conhecimento)faltando.push('Data Conhec.')
                      if (!d.tipo)             faltando.push('Tipo')
                      if (!d.vendedor)         faltando.push('Vendedor')
                      if (!d.peso)             faltando.push('Peso')
                      if (!faltando.length) return '<span class="badge bg-success" title="Todos os campos preenchidos">✔ Completo</span>'
                      return faltando.map(f => `<span class="badge bg-warning text-dark" title="Não preenchido">⚠ ${f}</span>`).join('')
                    })()}
                  </div>
                  <div class="d-flex align-items-center gap-3">
                    <span class="fw-semibold text-success">R$ ${money(d.valor_nfe)}</span>
                    <button class="btn btn-sm btn-outline-primary py-0 px-2"
                      onclick="toggleInline(${d.id})">
                      ${estaAberto ? 'Fechar ▴' : 'Editar ▾'}
                    </button>
                  </div>
                </div>
              </div>
              ${estaAberto ? gerarFormEdicaoInline(d) : ''}
            </div>`
        }).join('')}
      </div>`
  }
  cont.innerHTML = html
}

window.toggleInline = function(id) {
  if (abertos.has(id)) {
    abertos.delete(id)
  } else {
    abertos.add(id)
  }
  renderTabela()
  // Scroll suave até o card
  setTimeout(() => {
    const card = document.getElementById(`card-nota-${id}`)
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, 50)
}

window.fecharInline = function(id) {
  abertos.delete(id)
  renderTabela()
}

window.salvarEdicaoInline = async function(id) {
  const d = dados.find(x => x.id === id)
  if (!d) return

  const g = (k) => {
    const el = document.getElementById(`ei-${k}-${id}`)
    return el ? el.value || null : null
  }

  const dataVal = g('data')
  const mes = dataVal ? (new Date(dataVal + 'T00:00:00').getMonth() + 1) : d.mes

  // Campos que não estão no form inline → manter valor original do banco
  const registro = {
    ano: anoAtual,
    mes,
    data:              g('data'),
    nf:                g('nf'),
    fatura:            g('fatura'),
    num_due:           g('num_due'),
    data_due:          g('data_due'),
    num_conhecimento:  g('num_conhecimento'),
    data_conhecimento: g('data_conhecimento'),
    tipo:              g('tipo'),
    valor_nfe:         g('valor_nfe'),
    peso:              g('peso'),
    vendedor:          g('vendedor'),
    produto:           g('produto'),
    pais:              g('pais')
  }

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
    return {
      nome,
      valor: doMes.reduce((s, d) => s + (Number(d.valor_nfe) || 0), 0),
      peso:  doMes.reduce((s, d) => s + (Number(d.peso) || 0), 0),
      qtd:   doMes.length
    }
  })

  document.getElementById('resumo-contabil').innerHTML = `
    <div class="row g-3 mb-3">
      <div class="col-6 col-md-3"><div class="card"><div class="card-body text-center py-3">
        <div class="small text-muted">Valor Comercializado</div>
        <div class="fw-bold fs-5 text-success">R$ ${money(totalValor)}</div>
      </div></div></div>
      <div class="col-6 col-md-3"><div class="card"><div class="card-body text-center py-3">
        <div class="small text-muted">Kilos Produzidos</div>
        <div class="fw-bold fs-5">${money(totalPeso)} kg</div>
      </div></div></div>
      <div class="col-6 col-md-3"><div class="card"><div class="card-body text-center py-3">
        <div class="small text-muted">Notas no ano</div>
        <div class="fw-bold fs-5">${totalNotas}</div>
      </div></div></div>
      <div class="col-6 col-md-3"><div class="card"><div class="card-body text-center py-3">
        <div class="small text-muted">Média por nota</div>
        <div class="fw-bold fs-5">R$ ${money(totalNotas ? totalValor / totalNotas : 0)}</div>
      </div></div></div>
    </div>
    <div class="card mb-4"><div class="card-body">
      <h5 class="secao-titulo-card mb-2">Vendas por mês — ${anoAtual}</h5>
      <div class="table-responsive"><table class="table table-sm mb-0" style="font-size:.85rem">
        <thead><tr>
          <th>Mês</th>
          <th class="text-end">Notas</th>
          <th class="text-end">Valor comercializado</th>
          <th class="text-end">Peso (kg)</th>
        </tr></thead>
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
      </table></div>
    </div></div>`
}

async function salvarNota() {
  const dataVal = document.getElementById('f-data').value
  const mes = dataVal
    ? (new Date(dataVal + 'T00:00:00').getMonth() + 1)
    : parseInt(document.getElementById('f-mes').value)
  if (!mes) { alert('Informe a Data (ou o mês) da nota.'); return }

  const registro = { ano: anoAtual, mes }
  COLS.forEach(c => { registro[c.k] = document.getElementById('f-' + c.k)?.value || null })

  const btn = document.getElementById('btn-salvar-nota')
  btn.disabled = true
  const r = await api.contabil.criar(registro)
  btn.disabled = false
  if (r?.erro) { alert(r.erro || 'Erro ao salvar.'); return }

  COLS.forEach(c => { const el = document.getElementById('f-' + c.k); if (el) el.value = '' })
  await carregarAnos()
  carregarDados()
}

const COR_AZUL  = 'FF000080'
const COR_VERDE = 'FF99CC00'
const COR_TOTAL = 'FFD9E1F2'
const BORDA = {
  top:    { style: 'thin', color: { argb: 'FF808080' } },
  left:   { style: 'thin', color: { argb: 'FF808080' } },
  bottom: { style: 'thin', color: { argb: 'FF808080' } },
  right:  { style: 'thin', color: { argb: 'FF808080' } }
}
function preencher(cell, argb) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } } }

async function exportarExcel() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(String(anoAtual), { views: [{ showGridLines: false }] })
  const nc = COLS.length
  const LARGURAS = { data:14, nf:13, fatura:14, num_due:20, data_due:14, num_conhecimento:20, data_conhecimento:15, tipo:8, valor_nfe:16, peso:13, vendedor:20, produto:25, pais:18 }
  COLS.forEach((c, i) => { ws.getColumn(i+1).width = LARGURAS[c.k] || 15 })

  const c1 = ws.getCell(1, 1)
  ws.mergeCells(1, 1, 1, nc)
  c1.value = 'FATURAMENTO NFe — ' + anoAtual
  c1.font = { bold: true, size: 16, color: { argb: COR_AZUL } }
  c1.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 30

  const totalValor = dados.reduce((s, d) => s + (Number(d.valor_nfe) || 0), 0)
  const totalPeso  = dados.reduce((s, d) => s + (Number(d.peso) || 0), 0)
  ws.mergeCells(2, 1, 2, nc)
  const c2 = ws.getCell(2, 1)
  c2.value = 'Total do ano: R$ ' + money(totalValor) + '   •   Kilos: ' + money(totalPeso) + ' kg   •   Notas: ' + dados.length
  c2.font = { size: 10, italic: true, color: { argb: 'FF555555' } }
  c2.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(2).height = 18
  ws.getRow(3).height = 8

  let r = 4
  for (let m = 1; m <= 12; m++) {
    const doMes = dados.filter(d => d.mes === m)
    if (!doMes.length) continue
    const tv = doMes.reduce((s, d) => s + (Number(d.valor_nfe) || 0), 0)
    const tp = doMes.reduce((s, d) => s + (Number(d.peso) || 0), 0)

    // Cabeçalho do mês
    ws.mergeCells(r, 1, r, nc)
    const cm = ws.getCell(r, 1)
    cm.value = MESES[m-1].toUpperCase() + '   —   ' + doMes.length + ' nota' + (doMes.length>1?'s':'') + '   •   R$ ' + money(tv) + '   •   ' + money(tp) + ' kg'
    cm.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
    preencher(cm, COR_AZUL.replace('FF','FF'))
    cm.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    ws.getRow(r).height = 22
    r++

    // Cabeçalho colunas
    COLS.forEach((c, i) => {
      const cell = ws.getCell(r, i+1)
      cell.value = c.t
      cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
      preencher(cell, '2C3E50')
      cell.border = BORDA
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false }
    })
    ws.getRow(r).height = 18
    r++

    // Linhas de dados
    doMes.forEach((d, idx) => {
      ws.getRow(r).height = 16
      COLS.forEach((c, i) => {
        const cell = ws.getCell(r, i+1)
        let v = d[c.k]
        if (c.tipo === 'date')     { cell.value = dBR(v) }
        else if (c.tipo === 'num') { cell.value = Number(v) || 0; cell.numFmt = '#,##0.00' }
        else                       { cell.value = v == null ? '' : v }
        cell.font = { size: 10, color: { argb: 'FF111111' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF5F5F5' } }
        cell.border = BORDA
        cell.alignment = { horizontal: c.tipo === 'num' ? 'right' : 'left', vertical: 'middle' }
      })
      r++
    })

    // Linha de total do mês
    ws.getRow(r).height = 16
    for (let i = 1; i <= nc; i++) {
      const cell = ws.getCell(r, i)
      preencher(cell, COR_TOTAL)
      cell.border = BORDA
      cell.font = { bold: true, size: 10 }
    }
    ws.mergeCells(r, 1, r, 8)
    const lt = ws.getCell(r, 1)
    lt.value = 'TOTAL ' + MESES[m-1]
    lt.alignment = { horizontal: 'right', vertical: 'middle' }
    const cv = ws.getCell(r, 9); cv.value = tv; cv.numFmt = '#,##0.00'; cv.alignment = { horizontal: 'right', vertical: 'middle' }
    const cp = ws.getCell(r, 10); cp.value = tp; cp.numFmt = '#,##0.00'; cp.alignment = { horizontal: 'right', vertical: 'middle' }
    r++

    // Espaço entre meses
    ws.getRow(r).height = 10
    r++
  }

  // Resumo anual
  r++
  ws.mergeCells(r, 1, r, 4)
  const rh = ws.getCell(r, 1)
  rh.value = 'VENDAS POR MÊS — ' + anoAtual
  rh.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
  preencher(rh, COR_AZUL)
  rh.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  ws.getRow(r).height = 22
  r++

  ;['Mês', 'Notas', 'Valor (R$)', 'Peso (kg)'].forEach((h, i) => {
    const cell = ws.getCell(r, i+1)
    cell.value = h; cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    preencher(cell, '2C3E50'); cell.border = BORDA
    cell.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle' }
  })
  ws.getRow(r).height = 18; r++

  for (let m = 1; m <= 12; m++) {
    const doMes = dados.filter(d => d.mes === m)
    if (!doMes.length) continue
    const v = doMes.reduce((s,d) => s+(Number(d.valor_nfe)||0), 0)
    const p = doMes.reduce((s,d) => s+(Number(d.peso)||0), 0)
    const vals = [MESES[m-1], doMes.length, v, p]
    ws.getRow(r).height = 16
    vals.forEach((val, i) => {
      const cell = ws.getCell(r, i+1)
      cell.value = val
      if (i >= 2) cell.numFmt = '#,##0.00'
      cell.font = { size: 10 }
      preencher(cell, COR_VERDE)
      cell.border = BORDA
      cell.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle' }
    })
    r++
  }
  ws.getRow(r).height = 16
  const totais = ['TOTAL', dados.length, totalValor, totalPeso]
  totais.forEach((val, i) => {
    const cell = ws.getCell(r, i+1)
    cell.value = val; cell.font = { bold: true, size: 10 }
    if (i >= 2) cell.numFmt = '#,##0.00'
    preencher(cell, COR_TOTAL); cell.border = BORDA
    cell.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle' }
  })

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'Faturamento_NFe_' + anoAtual + '.xlsx'; a.click()
  URL.revokeObjectURL(url)
}

function exportarPDF() {
  var totalValor = dados.reduce(function(s,d){ return s+(Number(d.valor_nfe)||0) }, 0)
  var totalPeso  = dados.reduce(function(s,d){ return s+(Number(d.peso)||0) }, 0)

  var secoes = ''
  for (var m = 1; m <= 12; m++) {
    var doMes = dados.filter(function(d){ return d.mes === m })
    if (!doMes.length) continue
    var tv = doMes.reduce(function(s,d){ return s+(Number(d.valor_nfe)||0) }, 0)
    var tp = doMes.reduce(function(s,d){ return s+(Number(d.peso)||0) }, 0)

    var linhas = doMes.map(function(d) {
      return '<tr>' +
        '<td>' + dBR(d.data) + '</td>' +
        '<td>' + (d.nf||'') + '</td>' +
        '<td><strong>' + (d.fatura||'') + '</strong></td>' +
        '<td>' + (d.num_due||'') + '</td>' +
        '<td>' + dBR(d.data_due) + '</td>' +
        '<td>' + (d.num_conhecimento||'') + '</td>' +
        '<td>' + dBR(d.data_conhecimento) + '</td>' +
        '<td>' + (d.tipo||'') + '</td>' +
        '<td class="num">R$ ' + money(d.valor_nfe) + '</td>' +
        '<td class="num">' + money(d.peso) + '</td>' +
        '<td>' + (d.vendedor||'') + '</td>' +
        '<td>' + (d.produto||'') + '</td>' +
        '<td>' + (d.pais||'') + '</td>' +
        '</tr>'
    }).join('')

    secoes += '<div class="mes-bloco">' +
      '<div class="mes-header">' +
        '<span>' + MESES[m-1].toUpperCase() + '</span>' +
        '<span>' + doMes.length + ' nota' + (doMes.length>1?'s':'') + ' &nbsp;&middot;&nbsp; R$ ' + money(tv) + ' &nbsp;&middot;&nbsp; ' + money(tp) + ' kg</span>' +
      '</div>' +
      '<table><thead><tr>' +
        '<th>Data</th><th>NF</th><th>Fatura</th><th>N&uacute;m. DUE</th><th>Data DUE</th>' +
        '<th>N&ordm; Conhec.</th><th>Data Conhec.</th><th>Tipo</th>' +
        '<th class="num">Valor NFE</th><th class="num">Peso (kg)</th>' +
        '<th>Vendedor</th><th>Produto</th><th>Pa&iacute;s</th>' +
      '</tr></thead><tbody>' + linhas + '</tbody>' +
      '<tfoot><tr>' +
        '<td colspan="8" style="text-align:right;font-weight:700">TOTAL ' + MESES[m-1] + '</td>' +
        '<td class="num" style="font-weight:700">R$ ' + money(tv) + '</td>' +
        '<td class="num" style="font-weight:700">' + money(tp) + ' kg</td>' +
        '<td colspan="3"></td>' +
      '</tr></tfoot></table></div>'
  }

  var resumoCards = MESES.map(function(nome, i) {
    var doMes = dados.filter(function(d){ return d.mes === i+1 })
    if (!doMes.length) return ''
    var v = doMes.reduce(function(s,d){ return s+(Number(d.valor_nfe)||0) }, 0)
    return '<div class="resumo-card"><div class="label">' + nome + '</div><div class="valor">R$ ' + money(v) + '</div></div>'
  }).join('')

  var linhasMes = MESES.map(function(nome, i) {
    var doMes = dados.filter(function(d){ return d.mes === i+1 })
    if (!doMes.length) return ''
    var v = doMes.reduce(function(s,d){ return s+(Number(d.valor_nfe)||0) }, 0)
    var p = doMes.reduce(function(s,d){ return s+(Number(d.peso)||0) }, 0)
    return '<tr><td>' + nome + '</td><td class="num">' + doMes.length + '</td><td class="num">R$ ' + money(v) + '</td><td class="num">' + money(p) + ' kg</td></tr>'
  }).join('')

  var css = [
    '* { margin:0; padding:0; box-sizing:border-box; }',
    'body { font-family:Arial,sans-serif; font-size:8.5pt; color:#111; }',
    '.cabecalho { background:#C0392B; color:#fff; padding:12px 20px; display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }',
    '.cabecalho h1 { font-size:14pt; font-weight:700; }',
    '.cabecalho p { font-size:9pt; opacity:.85; margin-top:2px; }',
    '.resumo { display:flex; gap:12px; padding:0 20px 16px; flex-wrap:wrap; }',
    '.resumo-card { border:1px solid #ddd; border-radius:6px; padding:8px 14px; flex:1; min-width:120px; }',
    '.resumo-card .label { font-size:7.5pt; color:#666; }',
    '.resumo-card .valor { font-size:10pt; font-weight:700; color:#C0392B; margin-top:2px; }',
    '.mes-bloco { margin:0 20px 20px; page-break-inside:avoid; }',
    '.mes-header { background:#1A1A2E; color:#fff; padding:6px 10px; font-size:9pt; font-weight:700; display:flex; justify-content:space-between; border-radius:4px 4px 0 0; }',
    'table { width:100%; border-collapse:collapse; font-size:7.5pt; }',
    'thead tr { background:#2C3E50; color:#fff; }',
    'thead th { padding:4px 5px; text-align:left; font-weight:600; border:1px solid #455; white-space:nowrap; }',
    'tbody tr:nth-child(even) { background:#F8F9FA; }',
    'tbody td { padding:3px 5px; border:1px solid #DDD; vertical-align:top; }',
    'tfoot tr { background:#D9E1F2; }',
    'tfoot td { padding:4px 5px; border:1px solid #BCC; font-size:8pt; }',
    '.num { text-align:right; white-space:nowrap; }',
    '.rodape-resumo { margin:0 20px; page-break-before:always; }',
    '.rodape-resumo h2 { font-size:11pt; color:#C0392B; margin-bottom:8px; border-bottom:2px solid #C0392B; padding-bottom:4px; }',
    '.rodape-resumo table { max-width:400px; }',
    '@media print { body{font-size:7.5pt;} .cabecalho,.mes-header,thead,tfoot,tbody tr:nth-child(even){-webkit-print-color-adjust:exact;print-color-adjust:exact;} }',
    '@page { size:A4 landscape; margin:10mm; }'
  ].join('\n')

  var hoje = new Date().toLocaleDateString('pt-BR')
  var html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">' +
    '<title>Faturamento NFe ' + anoAtual + '</title>' +
    '<style>' + css + '</style></head><body>' +
    '<div class="cabecalho">' +
      '<div><h1>Faturamento NFe &mdash; ' + anoAtual + '</h1>' +
      '<p>PIETROBON &amp; CIA. LTDA. &nbsp;&middot;&nbsp; Gerado em ' + hoje + '</p></div>' +
      '<div style="text-align:right">' +
        '<div style="font-size:13pt;font-weight:700">R$ ' + money(totalValor) + '</div>' +
        '<div style="opacity:.85;font-size:9pt">' + money(totalPeso) + ' kg &nbsp;&middot;&nbsp; ' + dados.length + ' notas</div>' +
      '</div>' +
    '</div>' +
    '<div class="resumo">' + resumoCards + '</div>' +
    secoes +
    '<div class="rodape-resumo">' +
      '<h2>Vendas por M&ecirc;s &mdash; ' + anoAtual + '</h2>' +
      '<table><thead><tr><th>M&ecirc;s</th><th class="num">Notas</th><th class="num">Valor</th><th class="num">Peso</th></tr></thead>' +
      '<tbody>' + linhasMes + '</tbody>' +
      '<tfoot><tr><td><strong>TOTAL</strong></td><td class="num"><strong>' + dados.length + '</strong></td>' +
        '<td class="num"><strong>R$ ' + money(totalValor) + '</strong></td>' +
        '<td class="num"><strong>' + money(totalPeso) + ' kg</strong></td></tr></tfoot>' +
      '</table></div>' +
    '<script>window.onload=function(){window.print()}<\/script>' +
    '</body></html>'

  var janela = window.open('', '_blank')
  janela.document.write(html)
  janela.document.close()
}


function montarInterface() {
  const cont = document.getElementById('conteudo-contabil')
  cont.innerHTML = `
    <div class="card mb-4 no-print"><div class="card-body">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h5 class="secao-titulo-card mb-0">➕ Lançar nota fiscal</h5>
        <div class="d-flex align-items-center gap-2">
          <label class="small fw-semibold mb-0">Ano:</label>
          <select id="sel-ano" class="form-select form-select-sm" style="width:100px;padding-right:30px"></select>
          <button id="btn-add-ano" type="button" class="btn btn-sm btn-outline-secondary" title="Adicionar um ano novo">+ Ano</button>
        </div>
      </div>
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
      <div class="mt-3">
        <button id="btn-salvar-nota" class="btn btn-ok-grande">➕ Lançar nota</button>
      </div>
    </div></div>

    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
      <h4 class="fw-bold mb-0">Faturamento ${anoAtual}</h4>
      <div class="d-flex gap-2 no-print">
        <button id="btn-excel" class="btn btn-sm btn-outline-success">Exportar Excel</button>
        <button id="btn-pdf" class="btn btn-sm btn-outline-danger">Exportar PDF</button>
      </div>
    </div>
    <div id="resumo-contabil"></div>
    <div id="tabela-contabil"></div>`

  document.getElementById('sel-ano').addEventListener('change', (e) => {
    anoAtual = parseInt(e.target.value)
    document.querySelector('#conteudo-contabil h4').textContent = 'Faturamento ' + anoAtual
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
      const opts = [...sel.options].sort((a,b) => parseInt(b.value) - parseInt(a.value))
      sel.innerHTML = ''; opts.forEach(op => sel.appendChild(op))
    }
    sel.value = ano; anoAtual = ano
    document.querySelector('#conteudo-contabil h4').textContent = 'Faturamento ' + anoAtual
    carregarDados()
  })
  document.getElementById('btn-salvar-nota').addEventListener('click', salvarNota)
  document.getElementById('btn-excel').addEventListener('click', exportarExcel)
  document.getElementById('btn-pdf').addEventListener('click', exportarPDF)
}

async function iniciar() {
  const perfil = exigirPapel(['admin'])
  if (!perfil) return
  if (!EMAILS_FINANCEIRO.includes((perfil.email || '').toLowerCase())) {
    window.location.href = '/HTML/producao/admin.html'
    return
  }
  montarCabecalho(perfil.papel)
  montarInterface()
  await carregarAnos()
  carregarDados()
}

iniciar()