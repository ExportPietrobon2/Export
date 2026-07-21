import { api } from './api.js'
import { exigirPapel } from './auth.js'
import { montarCabecalho } from './cabecalho.js'

const EMAIL_CONTABIL = 'export2@pietrobon.com.br'
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const COLS = [
  { k: 'data', t: 'Data', tipo: 'date' },
  { k: 'nf', t: 'NF' },
  { k: 'fatura', t: 'Fatura' },
  { k: 'num_due', t: 'Núm. DUE' },
  { k: 'data_due', t: 'Data DUE', tipo: 'date' },
  { k: 'num_conhecimento', t: 'Nº Conhec. Emb.' },
  { k: 'data_conhecimento', t: 'Data Conhec.', tipo: 'date' },
  { k: 'tipo', t: 'Tipo' },
  { k: 'valor_nfe', t: 'Valor da NFE', tipo: 'num' },
  { k: 'peso', t: 'Peso', tipo: 'num' },
  { k: 'vendedor', t: 'Vendedor' },
  { k: 'produto', t: 'Produto' },
  { k: 'pais', t: 'País' }
]

let anoAtual = new Date().getFullYear()
let dados = []
let editandoId = null

function dISO(v) { return v ? String(v).slice(0, 10) : '' }
function dBR(v) { const s = dISO(v); return s ? s.split('-').reverse().join('/') : '' }
function money(n) { return (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function peso(n) { return (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

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

function renderTabela() {
  const cont = document.getElementById('tabela-contabil')
  if (!dados.length) {
    cont.innerHTML = '<p class="text-muted fst-italic">Nenhuma nota lançada neste ano. Use o formulário acima para começar.</p>'
    return
  }
  let html = ''
  for (let m = 1; m <= 12; m++) {
    const doMes = dados.filter((d) => d.mes === m)
    if (!doMes.length) continue
    const totValor = doMes.reduce((s, d) => s + (Number(d.valor_nfe) || 0), 0)
    const totPeso = doMes.reduce((s, d) => s + (Number(d.peso) || 0), 0)
    html += `
      <div class="mb-3">
        <h5 class="secao-titulo-card mb-2">${MESES[m - 1]} <span class="text-muted" style="font-weight:400">(${doMes.length} nota${doMes.length > 1 ? 's' : ''})</span></h5>
        <div class="card"><div class="table-responsive"><table class="table table-sm table-hover mb-0" style="font-size:.82rem">
          <thead><tr>${COLS.map((c) => `<th class="${c.tipo === 'num' ? 'text-end' : ''}">${c.t}</th>`).join('')}<th class="no-print text-center">Ações</th></tr></thead>
          <tbody>
            ${doMes.map((d) => `<tr>
              ${COLS.map((c) => {
                let v = d[c.k]
                if (c.tipo === 'date') v = dBR(v)
                else if (c.tipo === 'num') v = money(v)
                return `<td class="${c.tipo === 'num' ? 'text-end' : ''}">${v == null ? '' : v}</td>`
              }).join('')}
              <td class="no-print text-center" style="white-space:nowrap">
                <button class="btn btn-sm btn-outline-primary py-0 px-1" onclick="editarNota(${d.id})" title="Editar">✏️</button>
                <button class="btn btn-sm btn-outline-danger py-0 px-1" onclick="excluirNota(${d.id})" title="Excluir">🗑</button>
              </td>
            </tr>`).join('')}
            <tr class="fw-bold" style="background:#fbeaea">
              <td colspan="8" class="text-end">Total ${MESES[m - 1]}:</td>
              <td class="text-end">${money(totValor)}</td>
              <td class="text-end">${peso(totPeso)}</td>
              <td colspan="3"></td><td class="no-print"></td>
            </tr>
          </tbody>
        </table></div></div>
      </div>`
  }
  cont.innerHTML = html
}

function renderResumo() {
  const totalValor = dados.reduce((s, d) => s + (Number(d.valor_nfe) || 0), 0)
  const totalPeso = dados.reduce((s, d) => s + (Number(d.peso) || 0), 0)
  const totalNotas = dados.length

  const porMes = MESES.map((nome, i) => {
    const doMes = dados.filter((d) => d.mes === i + 1)
    return { nome, valor: doMes.reduce((s, d) => s + (Number(d.valor_nfe) || 0), 0), peso: doMes.reduce((s, d) => s + (Number(d.peso) || 0), 0), qtd: doMes.length }
  })

  document.getElementById('resumo-contabil').innerHTML = `
    <div class="row g-3 mb-3">
      <div class="col-6 col-md-3"><div class="card"><div class="card-body text-center py-3">
        <div class="small text-muted">Valor Comercializado</div><div class="fw-bold fs-5 text-success">R$ ${money(totalValor)}</div></div></div></div>
      <div class="col-6 col-md-3"><div class="card"><div class="card-body text-center py-3">
        <div class="small text-muted">Kilos Produzidos</div><div class="fw-bold fs-5">${peso(totalPeso)} kg</div></div></div></div>
      <div class="col-6 col-md-3"><div class="card"><div class="card-body text-center py-3">
        <div class="small text-muted">Notas no ano</div><div class="fw-bold fs-5">${totalNotas}</div></div></div></div>
      <div class="col-6 col-md-3"><div class="card"><div class="card-body text-center py-3">
        <div class="small text-muted">Média por nota</div><div class="fw-bold fs-5">R$ ${money(totalNotas ? totalValor / totalNotas : 0)}</div></div></div></div>
    </div>
    <div class="card mb-4"><div class="card-body">
      <h5 class="secao-titulo-card mb-2">Vendas por mês — ${anoAtual}</h5>
      <div class="table-responsive"><table class="table table-sm mb-0" style="font-size:.85rem">
        <thead><tr><th>Mês</th><th class="text-end">Notas</th><th class="text-end">Valor comercializado</th><th class="text-end">Peso (kg)</th></tr></thead>
        <tbody>${porMes.filter((m) => m.qtd).map((m) => `<tr><td>${m.nome}</td><td class="text-end">${m.qtd}</td><td class="text-end">R$ ${money(m.valor)}</td><td class="text-end">${peso(m.peso)}</td></tr>`).join('')}
          <tr class="fw-bold" style="background:#fbeaea"><td>TOTAL</td><td class="text-end">${totalNotas}</td><td class="text-end">R$ ${money(totalValor)}</td><td class="text-end">${peso(totalPeso)}</td></tr>
        </tbody>
      </table></div>
    </div></div>`
}

function limparForm() {
  editandoId = null
  COLS.forEach((c) => { const el = document.getElementById('f-' + c.k); if (el) el.value = '' })
  document.getElementById('btn-salvar-nota').textContent = '➕ Lançar nota'
  document.getElementById('cancelar-edicao').style.display = 'none'
}

async function salvarNota() {
  const dataVal = document.getElementById('f-data').value
  const mes = dataVal ? (new Date(dataVal + 'T00:00:00').getMonth() + 1) : parseInt(document.getElementById('f-mes').value)
  if (!mes) { alert('Informe a Data (ou o mês) da nota.'); return }
  const registro = { ano: anoAtual, mes }
  COLS.forEach((c) => { registro[c.k] = document.getElementById('f-' + c.k).value || null })
  const btn = document.getElementById('btn-salvar-nota')
  btn.disabled = true
  const r = editandoId ? await api.contabil.editar(editandoId, registro) : await api.contabil.criar(registro)
  btn.disabled = false
  if (r?.erro) { alert(r.erro || 'Erro ao salvar.'); return }
  limparForm()
  await carregarAnos()
  carregarDados()
}

window.editarNota = function (id) {
  const d = dados.find((x) => x.id === id)
  if (!d) return
  editandoId = id
  COLS.forEach((c) => {
    const el = document.getElementById('f-' + c.k)
    if (!el) return
    el.value = c.tipo === 'date' ? dISO(d[c.k]) : (d[c.k] == null ? '' : d[c.k])
  })
  document.getElementById('f-mes').value = d.mes
  document.getElementById('btn-salvar-nota').textContent = '💾 Salvar alteração'
  document.getElementById('cancelar-edicao').style.display = 'inline-block'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

window.excluirNota = async function (id) {
  if (!confirm('Excluir esta nota?')) return
  const r = await api.contabil.excluir(id)
  if (r?.erro) { alert('Erro ao excluir.'); return }
  carregarDados()
}

// ---------- Exportar Excel (mesmo padrão da planilha) ----------
function exportarExcel() {
  const aoa = []
  aoa.push([`FATURAMENTO NFe — ${anoAtual}`])
  aoa.push([])
  const header = COLS.map((c) => c.t)
  for (let m = 1; m <= 12; m++) {
    const doMes = dados.filter((d) => d.mes === m)
    if (!doMes.length) continue
    aoa.push([MESES[m - 1].toUpperCase()])
    aoa.push(header)
    doMes.forEach((d) => aoa.push(COLS.map((c) => {
      if (c.tipo === 'date') return dBR(d[c.k])
      if (c.tipo === 'num') return Number(d[c.k]) || 0
      return d[c.k] == null ? '' : d[c.k]
    })))
    const tv = doMes.reduce((s, d) => s + (Number(d.valor_nfe) || 0), 0)
    const tp = doMes.reduce((s, d) => s + (Number(d.peso) || 0), 0)
    const linhaTot = new Array(COLS.length).fill('')
    linhaTot[7] = 'TOTAL'; linhaTot[8] = tv; linhaTot[9] = tp
    aoa.push(linhaTot)
    aoa.push([])
  }
  // Resumo anual
  const totalValor = dados.reduce((s, d) => s + (Number(d.valor_nfe) || 0), 0)
  const totalPeso = dados.reduce((s, d) => s + (Number(d.peso) || 0), 0)
  aoa.push([])
  aoa.push(['RELATÓRIO ANUAL'])
  aoa.push(['Valor Comercializado', totalValor])
  aoa.push(['Kilos Produzidos', totalPeso])
  aoa.push(['Total de Notas', dados.length])
  aoa.push([])
  aoa.push(['VENDAS POR MÊS'])
  aoa.push(['Mês', 'Notas', 'Valor', 'Peso'])
  for (let m = 1; m <= 12; m++) {
    const doMes = dados.filter((d) => d.mes === m)
    if (!doMes.length) continue
    aoa.push([MESES[m - 1], doMes.length, doMes.reduce((s, d) => s + (Number(d.valor_nfe) || 0), 0), doMes.reduce((s, d) => s + (Number(d.peso) || 0), 0)])
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = COLS.map((c) => ({ wch: c.k === 'produto' || c.k === 'vendedor' ? 20 : 14 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, String(anoAtual))
  XLSX.writeFile(wb, `Faturamento_NFe_${anoAtual}.xlsx`)
}

function exportarPDF() { window.print() }

function montarInterface() {
  const cont = document.getElementById('conteudo-contabil')
  cont.innerHTML = `
    <div class="card mb-4 no-print"><div class="card-body">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h5 class="secao-titulo-card mb-0">Lançar nota fiscal</h5>
        <div class="d-flex align-items-center gap-2">
          <label class="small fw-semibold mb-0">Ano:</label>
          <select id="sel-ano" class="form-select form-select-sm" style="width:auto"></select>
        </div>
      </div>
      <div class="row g-2">
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Data</label><input type="date" id="f-data" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Mês (se sem data)</label>
          <select id="f-mes" class="form-select form-select-sm"><option value="">—</option>${MESES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}</select></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">NF</label><input type="text" id="f-nf" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Fatura</label><input type="text" id="f-fatura" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Núm. DUE</label><input type="text" id="f-num_due" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Data DUE</label><input type="date" id="f-data_due" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Nº Conhec. Emb.</label><input type="text" id="f-num_conhecimento" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Data Conhec.</label><input type="date" id="f-data_conhecimento" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Tipo</label>
          <select id="f-tipo" class="form-select form-select-sm"><option value="">—</option><option>BL</option><option>CRT</option><option>DDE</option><option>SD</option></select></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Valor da NFE</label><input type="number" step="any" id="f-valor_nfe" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Peso (kg)</label><input type="number" step="any" id="f-peso" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Vendedor</label><input type="text" id="f-vendedor" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-3"><label class="form-label small mb-0">Produto</label><input type="text" id="f-produto" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">País</label><input type="text" id="f-pais" class="form-control form-control-sm"></div>
      </div>
      <div class="mt-3 d-flex gap-2">
        <button id="btn-salvar-nota" class="btn btn-ok-grande">➕ Lançar nota</button>
        <button id="cancelar-edicao" class="btn btn-outline-secondary" style="display:none">Cancelar</button>
      </div>
    </div></div>

    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
      <h4 class="fw-bold mb-0">Faturamento ${anoAtual}</h4>
      <div class="d-flex gap-2 no-print">
        <button id="btn-excel" class="btn btn-sm btn-outline-success">📗 Exportar Excel</button>
        <button id="btn-pdf" class="btn btn-sm btn-outline-danger">📄 Exportar PDF</button>
      </div>
    </div>

    <div id="resumo-contabil"></div>
    <div id="tabela-contabil"></div>
  `

  document.getElementById('sel-ano').addEventListener('change', (e) => { anoAtual = parseInt(e.target.value); document.querySelector('#conteudo-contabil h4').textContent = 'Faturamento ' + anoAtual; carregarDados() })
  document.getElementById('btn-salvar-nota').addEventListener('click', salvarNota)
  document.getElementById('cancelar-edicao').addEventListener('click', limparForm)
  document.getElementById('btn-excel').addEventListener('click', exportarExcel)
  document.getElementById('btn-pdf').addEventListener('click', exportarPDF)
}

async function iniciar() {
  const perfil = exigirPapel(['admin'])
  if (!perfil) return
  if ((perfil.email || '').toLowerCase() !== EMAIL_CONTABIL) {
    window.location.href = '/HTML/admin.html'
    return
  }
  montarCabecalho(perfil.papel)
  montarInterface()
  await carregarAnos()
  carregarDados()
}

iniciar()