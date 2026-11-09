import { api } from '/JS/compartilhado/api.js'
import { iniciarPagina, pill, avisar, hojeISO } from '/JS/financeiro/comum.js'
const MESES = [
  '',
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
]

const MODULOS = {
  exterior: {
    titulo: 'Clientes Exterior',
    tipoEnt: 'clientes',
    rotA: 'Débito (fatura)',
    rotD: 'Baixa (recebimento)',
    tipoA: 'debito',
    tipoD: 'baixa',
    temFatura: true,
    colA: 'Débito do mês',
    colD: 'Baixa do mês',
    aviso:
      'As notas lançadas em Faturamento (NF-e) com cliente geram o débito aqui sozinhas. Lance à mão só as baixas (recebimentos) e ajustes.'
  },
  adiant_clientes: {
    titulo: 'Adiantamentos de Clientes',
    tipoEnt: 'clientes',
    rotA: 'Crédito (adiantamento)',
    rotD: 'Débito (uso)',
    tipoA: 'credito',
    tipoD: 'debito',
    temFatura: false,
    colA: 'Crédito do mês',
    colD: 'Débito do mês',
    aviso: 'Lance os adiantamentos recebidos de clientes e o uso deles nas faturas.'
  },
  adiant_fornecedores: {
    titulo: 'Adiantamentos a Fornecedores',
    tipoEnt: 'fornecedores',
    rotA: 'Débito (adiantado)',
    rotD: 'Pagamento (abatimento)',
    tipoA: 'debito',
    tipoD: 'pagamento',
    temFatura: false,
    colA: 'Débito do mês',
    colD: 'Baixa do mês',
    aviso:
      'Pagamentos de importação feitos antes da chegada da mercadoria entram aqui sozinhos como adiantamento. Quando a data de chegada é informada na importação, o adiantamento é baixado automaticamente.'
  }
}

let meses = []
let mesId = null
let modulo = 'exterior'
let saldoCache = null
let mostrarZerados = false

const $ = (id) => document.getElementById(id)
function money(n) {
  return 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function dISO(v) {
  return v ? String(v).slice(0, 10) : ''
}
function dBR(v) {
  const s = dISO(v)
  return s ? s.split('-').reverse().join('/') : '-'
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function carregarMeses() {
  meses = await api.ec.meses()
  if (!Array.isArray(meses)) meses = []
  if (!mesId && meses.length) mesId = meses[0].id
  renderTopo()
  if (mesId) carregarSaldos()
}

function renderTopo() {
  const opts = meses
    .map((m) => `<option value="${m.id}" ${m.id === mesId ? 'selected' : ''}>${esc(m.nome)}</option>`)
    .join('')
  $('sel-mes').innerHTML = opts || '<option value="">Nenhum período</option>'
}

async function carregarSaldos() {
  const area = $('area-saldos')
  area.innerHTML = '<p class="text-muted">Carregando...</p>'
  const r = await api.ec.saldos(modulo, mesId)
  if (!r || r.erro) {
    area.innerHTML = `<p class="text-danger">${esc(r?.erro || 'Erro ao carregar.')}</p>`
    return
  }
  saldoCache = r
  const cfg = MODULOS[modulo]
  const linhas = r.linhas.filter(
    (l) => mostrarZerados || Math.abs(l.anterior) > 0.009 || l.aumenta > 0.009 || l.diminui > 0.009
  )
  const t = r.linhas.reduce(
    (a, l) => ({ ant: a.ant + l.anterior, au: a.au + l.aumenta, di: a.di + l.diminui, at: a.at + l.atual }),
    { ant: 0, au: 0, di: 0, at: 0 }
  )
  const ocultos = r.linhas.length - linhas.length

  area.innerHTML = `
    <div class="fin-aviso no-print">${cfg.aviso}</div>
    <div class="fin-kpis">
      <div class="kpi kpi-cinza"><span class="kpi-rotulo">Saldo anterior</span><span class="kpi-valor">${money(t.ant)}</span></div>
      <div class="kpi kpi-azul"><span class="kpi-rotulo">${cfg.colA}</span><span class="kpi-valor">${money(t.au)}</span></div>
      <div class="kpi kpi-verde"><span class="kpi-rotulo">${cfg.colD}</span><span class="kpi-valor">${money(t.di)}</span></div>
      <div class="kpi kpi-laranja"><span class="kpi-rotulo">Saldo atual</span><span class="kpi-valor">${money(t.at)}</span></div>
    </div>
    <div class="fin-cartao">
      <div class="fin-cartao-cab"><h2>${cfg.titulo} · ${esc(r.mes.nome)}</h2>
        <div class="d-flex gap-2 no-print align-items-center">
          ${ocultos || mostrarZerados ? `<button class="fin-chip ${mostrarZerados ? 'ativo' : ''}" id="btn-zerados">${mostrarZerados ? 'Ocultar zerados' : `Mostrar zerados (${ocultos})`}</button>` : ''}
          <button class="btn-icone" id="btn-ec-excel">Excel</button>
          <button class="btn-icone" id="btn-ec-pdf">PDF</button>
        </div></div>
      <div class="table-responsive"><table class="fin-tabela">
      <thead><tr>
        <th>${cfg.tipoEnt === 'clientes' ? 'Cliente' : 'Fornecedor'}</th>
        <th class="num">Saldo anterior</th>
        <th class="num">${cfg.colA}</th>
        <th class="num">${cfg.colD}</th>
        <th class="num">Saldo atual</th>
      </tr></thead>
      <tbody>
        ${
          linhas.length
            ? linhas
                .map(
                  (l) => `<tr class="clicavel" data-ent="${l.id}" data-nome="${esc(l.nome)}">
          <td><div class="texto-forte">${esc(l.nome)}</div><div class="d-flex gap-1 flex-wrap">${l.pais ? `<span class="texto-sub">${esc(l.pais)}</span>` : ''}${l.automaticos ? pill(`${l.automaticos} automático${l.automaticos > 1 ? 's' : ''}`, 'auto') : ''}${l.ativo ? '' : pill('Inativo', 'neutro')}</div></td>
          <td class="num">${money(l.anterior)}</td>
          <td class="num">${money(l.aumenta)}</td>
          <td class="num">${money(l.diminui)}</td>
          <td class="num texto-forte ${l.atual > 0.009 ? 'valor-negativo' : l.atual < -0.009 ? 'valor-positivo' : ''}">${money(l.atual)}</td>
        </tr>`
                )
                .join('')
            : '<tr><td colspan="5"><div class="fin-vazio">Nenhum saldo neste período. Clique em "Mostrar zerados" para lançar para um cadastro sem movimento.</div></td></tr>'
        }
      </tbody>
      <tfoot><tr><td>TOTAL</td><td class="num">${money(t.ant)}</td><td class="num">${money(t.au)}</td><td class="num">${money(t.di)}</td><td class="num">${money(t.at)}</td></tr></tfoot>
    </table></div></div>`
  if ($('btn-zerados'))
    $('btn-zerados').addEventListener('click', () => {
      mostrarZerados = !mostrarZerados
      carregarSaldos()
    })
  area
    .querySelectorAll('tr[data-ent]')
    .forEach((tr) => tr.addEventListener('click', () => abrirLancamentos(Number(tr.dataset.ent), tr.dataset.nome)))
  $('btn-ec-excel').addEventListener('click', exportarExcel)
  $('btn-ec-pdf').addEventListener('click', exportarPDF)
}

function exportarPDF() {
  if (!saldoCache) return
  const cfg = MODULOS[modulo]
  const CAB = '#404040',
    ZEBRA = '#f2f2f2',
    TOTAL = '#c9c9c9',
    BORDA = '1px solid #000'
  const th = `background:${CAB};color:#fff;font-weight:bold;border:${BORDA};padding:5px 6px;font-size:10px;text-align:center`
  const tdL = (bg) => `background:${bg};color:#000;border:${BORDA};padding:4px 6px;font-size:10px;text-align:left`
  const tdR = (bg) => `background:${bg};color:#000;border:${BORDA};padding:4px 6px;font-size:10px;text-align:right`
  const linhas = saldoCache.linhas
  const t = linhas.reduce(
    (a, l) => ({ ant: a.ant + l.anterior, au: a.au + l.aumenta, di: a.di + l.diminui, at: a.at + l.atual }),
    { ant: 0, au: 0, di: 0, at: 0 }
  )

  let html = `<h2 style="text-align:center;margin:0 0 12px">${cfg.titulo.toUpperCase()} — ${esc(saldoCache.mes.nome)}</h2>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="${th}">Entidade</th>
        <th style="${th}">Saldo anterior</th>
        <th style="${th}">${cfg.colA}</th>
        <th style="${th}">${cfg.colD}</th>
        <th style="${th}">Saldo atual</th>
      </tr></thead>
      <tbody>
        ${linhas
          .map((l, idx) => {
            const bg = idx % 2 ? ZEBRA : '#fff'
            return `<tr>
            <td style="${tdL(bg)}">${esc(l.nome)}</td>
            <td style="${tdR(bg)}">${money(l.anterior)}</td>
            <td style="${tdR(bg)}">${money(l.aumenta)}</td>
            <td style="${tdR(bg)}">${money(l.diminui)}</td>
            <td style="${tdR(bg)}">${money(l.atual)}</td>
          </tr>`
          })
          .join('')}
        <tr>
          <td style="${tdL(TOTAL)};font-weight:bold">TOTAL</td>
          <td style="${tdR(TOTAL)};font-weight:bold">${money(t.ant)}</td>
          <td style="${tdR(TOTAL)};font-weight:bold">${money(t.au)}</td>
          <td style="${tdR(TOTAL)};font-weight:bold">${money(t.di)}</td>
          <td style="${tdR(TOTAL)};font-weight:bold">${money(t.at)}</td>
        </tr>
      </tbody>
    </table>`

  let area = document.getElementById('area-impressao')
  if (!area) {
    area = document.createElement('div')
    area.id = 'area-impressao'
    area.style.display = 'none'
    document.body.appendChild(area)
  }
  area.innerHTML = html
  document.body.classList.add('imprimindo')
  const limpar = () => {
    document.body.classList.remove('imprimindo')
    window.removeEventListener('afterprint', limpar)
  }
  window.addEventListener('afterprint', limpar)
  window.print()
}

function dataPadraoDoMes() {
  const m = meses.find((x) => x.id === mesId)
  if (!m) return hojeISO()
  const hoje = hojeISO()
  const prefixo = `${m.ano}-${String(m.mes).padStart(2, '0')}`
  if (hoje.startsWith(prefixo)) return hoje
  const ultimo = new Date(m.ano, m.mes, 0).getDate()
  return `${prefixo}-${String(ultimo).padStart(2, '0')}`
}

async function abrirLancamentos(entidadeId, nome) {
  window._ecEntidadeAtual = entidadeId
  const cfg = MODULOS[modulo]
  const r = await api.ec.lancamentos(modulo, mesId, entidadeId)
  const lancs = (r && r.lancamentos) || []
  const box = $('modal-ec-body')
  box.innerHTML = `
    <h5 class="mb-1">${esc(nome)}</h5>
    <div class="text-muted small mb-3">${cfg.titulo} · ${esc(meses.find((m) => m.id === mesId)?.nome || '')}</div>
    <div class="row g-2 align-items-end mb-3">
      <div class="col-6 col-md-3"><label class="form-label small mb-0">Tipo</label>
        <select id="l-tipo" class="form-select form-select-sm">
          <option value="${cfg.tipoD}">${cfg.rotD}</option>
          <option value="${cfg.tipoA}">${cfg.rotA}</option>
        </select></div>
      <div class="col-6 col-md-2"><label class="form-label small mb-0">Data</label><input type="date" id="l-data" class="form-control form-control-sm"></div>
      <div class="col-6 col-md-2"><label class="form-label small mb-0">Valor (R$)</label><input type="text" inputmode="decimal" id="l-valor" class="form-control form-control-sm" placeholder="0,00"></div>
      ${cfg.temFatura ? '<div class="col-6 col-md-2"><label class="form-label small mb-0">Nº Fatura</label><input type="text" id="l-fatura" class="form-control form-control-sm"></div>' : ''}
      <div class="col-12 col-md-${cfg.temFatura ? '3' : '5'}"><label class="form-label small mb-0">Observação</label><input type="text" id="l-obs" class="form-control form-control-sm"></div>
    </div>
    <button class="btn btn-ok-grande" id="l-salvar">Salvar lançamento</button>
    <div class="texto-sub mt-2">O lançamento vai para o mês da data informada.</div>
    <hr>
    <div id="l-lista"></div>`
  $('l-data').value = dataPadraoDoMes()
  renderListaLanc(lancs)
  $('l-salvar').addEventListener('click', () => salvarLanc(entidadeId))
  window._modalEc.show()
}

function renderListaLanc(lancs) {
  const cfg = MODULOS[modulo]
  const el = $('l-lista')
  if (!lancs.length) {
    el.innerHTML = '<p class="text-muted fst-italic mb-0">Nenhum lançamento neste mês.</p>'
    return
  }
  const rot = { [cfg.tipoA]: cfg.rotA, [cfg.tipoD]: cfg.rotD }
  el.innerHTML = `<table class="fin-tabela">
    <thead><tr><th>Data</th><th>Tipo</th><th class="num">Valor</th>${cfg.temFatura ? '<th>Fatura</th>' : ''}<th>Origem / obs.</th><th></th></tr></thead>
    <tbody>${lancs
      .map(
        (l) => `<tr>
      <td>${dBR(l.data_lanc)}</td>
      <td>${esc(rot[l.tipo] || l.tipo)}</td>
      <td class="num">${money(l.valor)}</td>
      ${cfg.temFatura ? `<td>${esc(l.fatura || '-')}</td>` : ''}
      <td>${l.automatico ? pill('Automático', 'auto') + ' ' : ''}<span class="texto-sub">${esc(l.observacao || '')}</span></td>
      <td class="acoes">${l.automatico ? '' : `<button class="btn-icone perigo" onclick="excluirLanc(${l.id})">Excluir</button>`}</td>
    </tr>`
      )
      .join('')}</tbody></table>`
}

async function salvarLanc(entidadeId) {
  const cfg = MODULOS[modulo]
  const dados = {
    modulo,
    entidadeId,
    tipo: $('l-tipo').value,
    data_lanc: $('l-data').value,
    valor: $('l-valor').value,
    observacao: $('l-obs').value
  }
  if (cfg.temFatura) dados.fatura = $('l-fatura').value
  const btn = $('l-salvar')
  btn.disabled = true
  const r = await api.ec.criarLancamento(dados)
  btn.disabled = false
  if (r?.erro) {
    avisar(r.erro || 'Erro ao salvar.', 'error')
    return
  }
  avisar('Lançamento salvo.')
  const lr = await api.ec.lancamentos(modulo, mesId, entidadeId)
  renderListaLanc((lr && lr.lancamentos) || [])
  $('l-valor').value = ''
  $('l-obs').value = ''
  if (cfg.temFatura) $('l-fatura').value = ''
  carregarSaldos()
}

window.excluirLanc = async function (id) {
  if (!confirm('Excluir este lançamento?')) return
  const r = await api.ec.excluirLancamento(modulo, id)
  if (r?.erro) return avisar(r.erro, 'error')
  const entidadeId = window._ecEntidadeAtual
  if (entidadeId) {
    const lr = await api.ec.lancamentos(modulo, mesId, entidadeId)
    renderListaLanc((lr && lr.lancamentos) || [])
  }
  carregarSaldos()
}

async function exportarExcel() {
  if (!saldoCache) return
  const cfg = MODULOS[modulo]

  const CAB = 'FF404040'
  const LINHA_A = 'FFFFFFFF'
  const LINHA_B = 'FFF2F2F2'
  const TOTAL = 'FFC9C9C9'
  const PRETO = 'FF000000'
  const BORDA = { style: 'thin', color: { argb: PRETO } }
  const b = { top: BORDA, left: BORDA, bottom: BORDA, right: BORDA }
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Contab', { views: [{ showGridLines: false }] })
  ws.mergeCells(1, 1, 1, 5)
  const t = ws.getCell(1, 1)
  t.value = `${cfg.titulo.toUpperCase()} — ${saldoCache.mes.nome}`
  t.font = { bold: true, size: 14, color: { argb: PRETO } }
  t.alignment = { horizontal: 'center' }
  const head = ['Entidade', 'Saldo anterior', cfg.colA, cfg.colD, 'Saldo atual']
  head.forEach((h, i) => {
    const c = ws.getCell(3, i + 1)
    c.value = h
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CAB } }
    c.border = b
    c.alignment = { horizontal: 'center' }
  })
  let r = 4
  const tot = { ant: 0, au: 0, di: 0, at: 0 }
  saldoCache.linhas.forEach((l, idx) => {
    const cor = idx % 2 === 0 ? LINHA_A : LINHA_B
    const vals = [l.nome, l.anterior, l.aumenta, l.diminui, l.atual]
    vals.forEach((v, i) => {
      const c = ws.getCell(r, i + 1)
      c.value = v
      if (i > 0) c.numFmt = '#,##0.00'
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cor } }
      c.border = b
      c.font = { color: { argb: PRETO } }
      if (i > 0) c.alignment = { horizontal: 'right' }
    })
    tot.ant += l.anterior
    tot.au += l.aumenta
    tot.di += l.diminui
    tot.at += l.atual
    r++
  })
  const totv = ['TOTAL', tot.ant, tot.au, tot.di, tot.at]
  totv.forEach((v, i) => {
    const c = ws.getCell(r, i + 1)
    c.value = v
    if (i > 0) {
      c.numFmt = '#,##0.00'
      c.alignment = { horizontal: 'right' }
    }
    c.font = { bold: true, color: { argb: PRETO } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL } }
    c.border = b
  })
  ws.columns = [{ width: 42 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }]
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Contabilidade_${saldoCache.mes.nome.replace(/\s+/g, '_')}_${modulo}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

function montarInterface() {
  const cont = $('conteudo-ec')
  cont.innerHTML = `
    <div class="fin-barra no-print">
      <label class="small fw-semibold mb-0 text-muted">Período</label>
      <select id="sel-mes" class="form-select form-select-sm" style="width:180px"></select>
      <a class="btn-icone ms-auto" href="/HTML/financeiro/cadastros.html">Clientes e fornecedores</a>
    </div>

    <div class="fin-abas no-print" id="tabs-ec">
      <button class="ativo" data-mod="exterior">Clientes exterior</button>
      <button data-mod="adiant_clientes">Adiantamentos de clientes</button>
      <button data-mod="adiant_fornecedores">Adiantamentos a fornecedores</button>
    </div>

    <div id="area-saldos"></div>

    <div class="modal fade" id="modal-ec" tabindex="-1"><div class="modal-dialog modal-lg modal-dialog-scrollable">
      <div class="modal-content"><div class="modal-header"><h6 class="modal-title fw-bold">Lançamentos do mês</h6>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body" id="modal-ec-body"></div>
      </div></div></div>`

  window._modalEc = new bootstrap.Modal($('modal-ec'))
  $('modal-ec').addEventListener('hidden.bs.modal', () => carregarSaldos())

  $('sel-mes').addEventListener('change', (e) => {
    mesId = parseInt(e.target.value)
    carregarSaldos()
  })

  document.querySelectorAll('#tabs-ec button').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#tabs-ec button').forEach((x) => x.classList.remove('ativo'))
      b.classList.add('ativo')
      modulo = b.dataset.mod
      mostrarZerados = false
      if (mesId) carregarSaldos()
    })
  })
}

async function iniciar() {
  if (!iniciarPagina()) return
  montarInterface()
  carregarMeses()
}

iniciar()
