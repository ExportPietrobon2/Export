import { api } from '/JS/compartilhado/api.js'
import { iniciarPagina, esc, pill, avisar, normalizar } from '/JS/financeiro/comum.js'
import { seletorPais, seletorComNovo, ativarSeletoresComNovo, normalizarValor } from '/JS/compartilhado/listas.js'

const CAMPOS_DV = ['nf', 'fatura', 'num_due', 'num_conhecimento', 'tipo', 'vendedor', 'produto', 'pais']
const ehDV = (d) =>
  CAMPOS_DV.some(
    (c) =>
      String(d[c] ?? '')
        .trim()
        .toUpperCase() === 'DV'
  )
const valorConta = (d) => (ehDV(d) ? 0 : Number(d.valor_nfe) || 0)
const pesoConta = (d) => (ehDV(d) ? 0 : Number(d.peso) || 0)
let listaVendedores = []
let listaProdutos = []

function atualizarListas() {
  listaVendedores = [...new Set(dados.map((d) => normalizarValor(d.vendedor)).filter((v) => v && v !== 'DV'))].sort()
  listaProdutos = [...new Set(dados.map((d) => normalizarValor(d.produto)).filter((v) => v && v !== 'DV'))].sort()
}
const MESES = [
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
  { k: 'peso', t: 'Peso (kg)', tipo: 'num' },
  { k: 'vendedor', t: 'Vendedor' },
  { k: 'produto', t: 'Produto' },
  { k: 'pais', t: 'País' }
]

let anoAtual = new Date().getFullYear()
let dados = []
let clientes = []
let busca = ''
let soSemCliente = false
let formAberto = false
const abertos = new Set()
const mesesAbertos = new Set([new Date().getMonth() + 1])

function dISO(v) {
  return v ? String(v).slice(0, 10) : ''
}
function dBR(v) {
  const s = dISO(v)
  return s ? s.split('-').reverse().join('/') : ''
}
function money(n) {
  return (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

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
  if (!Array.isArray(rows)) {
    cont.innerHTML = '<p class="text-danger">Erro ao carregar.</p>'
    return
  }
  dados = rows
  atualizarListas()
  preencherSlotsForm()
  renderTabela()
  renderResumo()
}

function preencherSlotsForm() {
  const slots = [
    ['vendedor', listaVendedores],
    ['produto', listaProdutos]
  ]
  for (const [k, lista] of slots) {
    const slot = document.getElementById('slot-f-' + k)
    if (!slot) continue
    const atual = document.getElementById('f-' + k)?.value || ''
    slot.innerHTML = seletorComNovo('f-' + k, lista, atual === '__novo__' ? '' : atual, k)
    ativarSeletoresComNovo(slot)
  }
}

window.toggleMes = function (m) {
  if (mesesAbertos.has(m)) mesesAbertos.delete(m)
  else mesesAbertos.add(m)
  renderTabela()
}

window.expandirTodos = function () {
  for (let m = 1; m <= 12; m++) mesesAbertos.add(m)
  renderTabela()
}

window.recolherTodos = function () {
  mesesAbertos.clear()
  renderTabela()
}

window.toggleForm = function () {
  formAberto = !formAberto
  const form = document.getElementById('form-lancamento')
  const btn = document.getElementById('btn-toggle-form')
  if (formAberto) {
    form.style.display = 'block'
    btn.textContent = '▲ Recolher'
  } else {
    form.style.display = 'none'
    btn.textContent = '➕ Nova nota'
  }
}

function opcoesClientes(selecionado) {
  return clientes
    .filter((c) => c.ativo || String(c.id) === String(selecionado))
    .map(
      (c) =>
        `<option value="${c.id}" data-pais="${esc(c.pais || '')}" ${String(c.id) === String(selecionado) ? 'selected' : ''}>${esc(c.nome)}${c.pais ? ' · ' + esc(c.pais) : ''}</option>`
    )
    .join('')
}

function seloFechamento(d) {
  if (!d.cliente_id) return pill('Sem cliente', 'alerta', 'Vincule um cliente para a nota entrar no Fechamento')
  if (d.entra_fechamento)
    return pill('No Fechamento', 'auto', 'Gera o débito do cliente automaticamente no Fechamento contábil')
  return pill('Fora do Fechamento', 'neutro', 'Débito lançado à mão no Fechamento')
}

function notasVisiveis() {
  const b = normalizar(busca)
  return dados.filter(
    (d) =>
      (!soSemCliente || !d.cliente_id) &&
      (!b || normalizar(`${d.fatura} ${d.nf} ${d.cliente_nome} ${d.pais} ${d.produto} ${d.vendedor}`).includes(b))
  )
}

function sinaisNota(d) {
  const faltando = camposFaltando(d)
  let html = ehDV(d) ? '<span class="sinal-dv" title="Nota marcada como DV: não entra nos totais">DV</span>' : ''
  if (!d.cliente_id) html += '<i class="sinal sinal-alerta" title="Sem cliente: não entra no Fechamento"></i>'
  else if (d.entra_fechamento) html += '<i class="sinal sinal-auto" title="Gera o débito no Fechamento"></i>'
  else html += '<i class="sinal sinal-neutro" title="Fora do Fechamento"></i>'
  if (faltando.length)
    html += `<span class="sinal-campos" title="Falta: ${esc(faltando.join(', '))}">${faltando.length}</span>`
  return html
}

function camposFaltando(d) {
  const faltando = []
  if (!d.num_due) faltando.push('DUE')
  if (!d.data_due) faltando.push('Data DUE')
  if (!d.num_conhecimento) faltando.push('Conhec.')
  if (!d.data_conhecimento) faltando.push('Data Conhec.')
  if (!d.tipo) faltando.push('Tipo')
  if (!d.vendedor) faltando.push('Vendedor')
  if (!d.peso) faltando.push('Peso')
  return faltando
}

function alertasCampos(d) {
  const faltando = []
  if (!d.num_due) faltando.push('DUE')
  if (!d.data_due) faltando.push('Data DUE')
  if (!d.num_conhecimento) faltando.push('Conhec.')
  if (!d.data_conhecimento) faltando.push('Data Conhec.')
  if (!d.tipo) faltando.push('Tipo')
  if (!d.vendedor) faltando.push('Vendedor')
  if (!d.peso) faltando.push('Peso')
  if (!faltando.length) return '<span class="badge bg-success">✔ Completo</span>'
  return `<span class="nota-pendente" title="${faltando.join(', ')} não preenchido">${faltando.length} campo${faltando.length > 1 ? 's' : ''}</span>`
}

function gerarFormEdicaoInline(d) {
  const campo = (col) => {
    const val = col.tipo === 'date' ? dISO(d[col.k]) : d[col.k] == null ? '' : d[col.k]
    if (col.k === 'pais') return seletorPais(`ei-pais-${d.id}`, val)
    if (col.k === 'vendedor') return seletorComNovo(`ei-vendedor-${d.id}`, listaVendedores, val, 'vendedor')
    if (col.k === 'produto') return seletorComNovo(`ei-produto-${d.id}`, listaProdutos, val, 'produto')
    if (col.k === 'tipo') {
      return `<select id="ei-tipo-${d.id}" class="form-select form-select-sm">
        <option value="">—</option>
        ${['BL', 'CRT', 'DDE', 'SD'].map((o) => `<option ${val === o ? 'selected' : ''}>${o}</option>`).join('')}
      </select>`
    }
    const type = col.tipo === 'date' ? 'date' : col.tipo === 'num' ? 'number' : 'text'
    const step = col.tipo === 'num' ? ' step="any"' : ''
    return `<input type="${type}"${step} id="ei-${col.k}-${d.id}" class="form-control form-control-sm" value="${val}">`
  }
  return `
    <div class="form-edicao-inline" id="form-inline-${d.id}">
      <div class="row g-2">
        <div class="col-12 col-md-6">
          <label class="form-label small fw-semibold mb-1">Cliente</label>
          <select id="ei-cliente_id-${d.id}" class="form-select form-select-sm"><option value="">Sem cliente</option>${opcoesClientes(d.cliente_id)}</select>
        </div>
        <div class="col-12 col-md-6 d-flex align-items-end">
          <div class="form-check"><input class="form-check-input" type="checkbox" id="ei-entra_fechamento-${d.id}" ${d.entra_fechamento ? 'checked' : ''}>
          <label class="form-check-label small" for="ei-entra_fechamento-${d.id}">Gerar o débito do cliente no Fechamento</label></div>
        </div>
        ${COLS.map(
          (col) => `
          <div class="col-6 col-md-3">
            <label class="form-label small fw-semibold mb-1">${col.t}</label>
            ${campo(col)}
          </div>`
        ).join('')}
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
  const visiveis = notasVisiveis()
  if (!visiveis.length) {
    cont.innerHTML = `<div class="fin-cartao"><div class="fin-vazio">${dados.length ? 'Nenhuma nota neste filtro.' : 'Nenhuma nota lançada neste ano.'}</div></div>`
    return
  }

  const totalAno = visiveis.reduce((s, d) => s + valorConta(d), 0)
  let html = `<div class="nota-legenda"><span><i class="sinal sinal-auto"></i>No Fechamento</span><span><i class="sinal sinal-alerta"></i>Sem cliente</span><span><i class="sinal sinal-neutro"></i>Fora do Fechamento</span><span><b class="sinal-campos">n</b>Campos a preencher</span><span><b class="sinal-dv">DV</b>Não entra nos totais</span><span class="ms-auto">Clique na nota para ver tudo e editar</span></div><div class="meses-lista">`
  for (let m = 1; m <= 12; m++) {
    const doMes = visiveis.filter((d) => d.mes === m)
    if (!doMes.length) continue
    const aberto = mesesAbertos.has(m) || !!busca || soSemCliente
    const totValor = doMes.reduce((s, d) => s + valorConta(d), 0)
    const totPeso = doMes.reduce((s, d) => s + pesoConta(d), 0)
    const participacao = totalAno ? (totValor / totalAno) * 100 : 0
    const temIncompleto = doMes.some(
      (d) =>
        !d.num_due || !d.data_due || !d.num_conhecimento || !d.data_conhecimento || !d.tipo || !d.vendedor || !d.peso
    )

    html += `
      <div class="mes-section${aberto ? ' mes-aberto' : ''}">
        <button class="mes-header" onclick="toggleMes(${m})">
          <div class="mes-header-esq">
            <span class="mes-chevron">${aberto ? '▼' : '▶'}</span>
            <span class="mes-nome">${MESES[m - 1]}</span>
            <span class="mes-qtd">${doMes.length} nota${doMes.length > 1 ? 's' : ''}</span>
            ${temIncompleto ? '<span class="mes-incompleto">Campos pendentes</span>' : ''}
          </div>
          <div class="mes-header-dir">
            <span class="mes-participacao" title="${money(participacao)}% do ano"><span style="width:${participacao}%"></span></span>
            <span class="mes-valor-total">R$ ${money(totValor)}</span>
            <span class="mes-peso-total">${money(totPeso)} kg</span>
          </div>
        </button>
        ${
          aberto
            ? `
          <div class="mes-body">
            ${doMes
              .map((d) => {
                const estaAberto = abertos.has(d.id)
                return `
                <div class="nota-card${estaAberto ? ' nota-aberta' : ''}" id="card-nota-${d.id}">
                  <div class="nota-linha" onclick="toggleInline(${d.id})" title="${esc(d.produto || '')}">
                    <span class="nota-fatura">${esc(d.fatura || '—')}</span>
                    <span class="nota-nf">NF ${esc(d.nf || '—')}</span>
                    <span class="nota-data">${d.data ? dBR(d.data).slice(0, 5) : ''}</span>
                    <span class="nota-cliente">${d.cliente_nome ? esc(d.cliente_nome) : esc(d.pais || '—')}</span>
                    <span class="nota-sinais">${sinaisNota(d)}</span>
                    <span class="nota-valor${ehDV(d) ? ' nota-dv' : ''}">R$ ${money(d.valor_nfe)}</span>
                    <span class="nota-seta">${estaAberto ? '▴' : '▾'}</span>
                  </div>
                  ${estaAberto ? gerarFormEdicaoInline(d) : ''}
                </div>`
              })
              .join('')}
          </div>`
            : ''
        }
      </div>`
  }
  html += '</div>'
  cont.innerHTML = html
  ativarSeletoresComNovo(cont)
}

window.toggleInline = function (id) {
  if (abertos.has(id)) abertos.delete(id)
  else abertos.add(id)
  renderTabela()
  setTimeout(() => {
    const card = document.getElementById(`card-nota-${id}`)
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, 50)
}

window.fecharInline = function (id) {
  abertos.delete(id)
  renderTabela()
}

window.salvarEdicaoInline = async function (id) {
  const d = dados.find((x) => x.id === id)
  if (!d) return
  const g = (k) => {
    const el = document.getElementById(`ei-${k}-${id}`)
    return el ? el.value || null : null
  }
  const dataVal = g('data')
  const mes = dataVal ? new Date(dataVal + 'T00:00:00').getMonth() + 1 : d.mes
  const registro = {
    ano: anoAtual,
    mes,
    data: g('data'),
    nf: g('nf'),
    fatura: g('fatura'),
    num_due: g('num_due'),
    data_due: g('data_due'),
    num_conhecimento: g('num_conhecimento'),
    data_conhecimento: g('data_conhecimento'),
    tipo: g('tipo'),
    valor_nfe: g('valor_nfe'),
    peso: g('peso'),
    vendedor: g('vendedor'),
    produto: g('produto'),
    pais: g('pais'),
    cliente_id: g('cliente_id'),
    entra_fechamento: document.getElementById(`ei-entra_fechamento-${id}`).checked
  }
  const btn = document.querySelector(`#form-inline-${id} .btn-ok-grande`)
  if (btn) {
    btn.disabled = true
    btn.textContent = 'Salvando...'
  }
  const r = await api.contabil.editar(id, registro)
  if (r?.erro) {
    alert(r.erro || 'Erro ao salvar.')
    if (btn) {
      btn.disabled = false
      btn.textContent = '💾 Salvar'
    }
    return
  }
  if (r?.aviso) avisar(r.aviso, 'warning')
  else avisar('Nota atualizada.')
  abertos.delete(id)
  await carregarAnos()
  carregarDados()
}

window.excluirNota = async function (id) {
  if (!confirm('Excluir esta nota?')) return
  const r = await api.contabil.excluir(id)
  if (r?.erro) {
    alert('Erro ao excluir.')
    return
  }
  abertos.delete(id)
  carregarDados()
}

function renderResumo() {
  const totalValor = dados.reduce((s, d) => s + valorConta(d), 0)
  const totalPeso = dados.reduce((s, d) => s + pesoConta(d), 0)
  const totalNotas = dados.filter((d) => !ehDV(d)).length
  const qtdDV = dados.filter(ehDV).length
  const noFechamento = dados.filter((d) => d.cliente_id && d.entra_fechamento && !ehDV(d)).length
  const semCliente = dados.filter((d) => !d.cliente_id).length
  const porMes = MESES.map((nome, i) => {
    const doMes = dados.filter((d) => d.mes === i + 1)
    return {
      nome,
      valor: doMes.reduce((s, d) => s + valorConta(d), 0),
      peso: doMes.reduce((s, d) => s + pesoConta(d), 0),
      qtd: doMes.length
    }
  })
  const maior = Math.max(...porMes.map((m) => m.valor), 1)
  const hoje = new Date()
  const mesCorrente = anoAtual === hoje.getFullYear() ? hoje.getMonth() : -1
  const melhor = porMes.reduce((a, m) => (m.valor > a.valor ? m : a), porMes[0])
  const integracao = totalNotas ? Math.round((noFechamento / totalNotas) * 100) : 0

  document.getElementById('resumo-contabil').innerHTML = `
    <section class="fat-hero">
      <div class="fat-hero-grade"></div>
      <div class="fat-hero-conteudo">
        <div class="fat-hero-principal">
          <span class="fat-rotulo"><span class="fat-ponto"></span>Faturamento de exportação · ${anoAtual}</span>
          <div class="fat-total">R$ ${money(totalValor)}</div>
          ${qtdDV ? `<div class="fat-dv">${qtdDV} nota(s) DV fora do total</div>` : ''}
          <div class="fat-metricas">
            <div><span>Peso</span><strong>${money(totalPeso)} kg</strong></div>
            <div><span>Notas</span><strong>${totalNotas}</strong></div>
            <div><span>Média por nota</span><strong>R$ ${money(totalNotas ? totalValor / totalNotas : 0)}</strong></div>
            <div><span>Melhor mês</span><strong>${melhor.valor ? melhor.nome : '—'}</strong></div>
          </div>
          <div class="fat-integracao">
            <div class="fat-integracao-topo"><span>Integração com o Fechamento</span><strong>${integracao}%</strong></div>
            <div class="fat-integracao-barra"><span style="width:${integracao}%"></span></div>
            <div class="fat-integracao-sub">${noFechamento} de ${totalNotas} nota(s) geram o débito sozinhas${semCliente ? ` · <button class="fat-link" id="fat-ver-sem-cliente">${semCliente} sem cliente</button>` : ''}</div>
          </div>
        </div>
        <div class="fat-grafico" role="img" aria-label="Faturamento por mês">
          ${porMes
            .map(
              (
                m,
                i
              ) => `<div class="fat-col ${i === mesCorrente ? 'atual' : ''} ${m.valor ? '' : 'vazia'}" title="${m.nome}: R$ ${money(m.valor)} · ${m.qtd} nota(s) · ${money(m.peso)} kg">
              <span class="fat-col-valor">${m.valor ? abreviar(m.valor) : ''}</span>
              <div class="fat-col-trilho"><div class="fat-col-barra" style="height:${m.valor ? Math.max(4, (m.valor / maior) * 100) : 0}%"></div></div>
              <span class="fat-col-mes">${m.nome.slice(0, 3)}</span>
            </div>`
            )
            .join('')}
        </div>
      </div>
    </section>`
  const btnSemCliente = document.getElementById('fat-ver-sem-cliente')
  if (btnSemCliente)
    btnSemCliente.addEventListener('click', () => {
      soSemCliente = true
      document.getElementById('btn-sem-cliente')?.classList.add('ativo')
      renderTabela()
      document.getElementById('tabela-contabil').scrollIntoView({ behavior: 'smooth' })
    })
}

function abreviar(v) {
  if (v >= 1e6) return (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'M'
  if (v >= 1e3) return Math.round(v / 1e3).toLocaleString('pt-BR') + 'k'
  return Math.round(v).toLocaleString('pt-BR')
}

async function salvarNota() {
  const dataVal = document.getElementById('f-data').value
  const mes = dataVal
    ? new Date(dataVal + 'T00:00:00').getMonth() + 1
    : parseInt(document.getElementById('f-mes').value)
  if (!mes) {
    alert('Informe a Data (ou o mês) da nota.')
    return
  }
  const registro = { ano: anoAtual, mes }
  COLS.forEach((c) => {
    registro[c.k] = document.getElementById('f-' + c.k)?.value || null
  })
  registro.cliente_id = document.getElementById('f-cliente_id').value || null
  registro.entra_fechamento = document.getElementById('f-entra_fechamento').checked
  if (!registro.cliente_id && !confirm('Lançar a nota sem cliente? Ela não vai gerar o débito no Fechamento.')) return
  const btn = document.getElementById('btn-salvar-nota')
  btn.disabled = true
  const r = await api.contabil.criar(registro)
  btn.disabled = false
  if (r?.erro) {
    alert(r.erro || 'Erro ao salvar.')
    return
  }
  if (mes) mesesAbertos.add(mes)
  avisar(r?.aviso || 'Nota lançada.', r?.aviso ? 'warning' : 'success')
  COLS.forEach((c) => {
    const el = document.getElementById('f-' + c.k)
    if (el) el.value = ''
  })
  document.getElementById('f-cliente_id').value = ''
  await carregarAnos()
  carregarDados()
}

const COR_AZUL = 'FF000080'
const COR_VERDE = 'FF99CC00'
const COR_TOTAL = 'FFD9E1F2'
const BORDA = {
  top: { style: 'thin', color: { argb: 'FF808080' } },
  left: { style: 'thin', color: { argb: 'FF808080' } },
  bottom: { style: 'thin', color: { argb: 'FF808080' } },
  right: { style: 'thin', color: { argb: 'FF808080' } }
}
function preencher(cell, argb) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

async function exportarExcel() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(String(anoAtual), { views: [{ showGridLines: false }] })
  const nc = COLS.length
  const LARGURAS = {
    data: 14,
    nf: 13,
    fatura: 14,
    num_due: 20,
    data_due: 14,
    num_conhecimento: 20,
    data_conhecimento: 15,
    tipo: 8,
    valor_nfe: 16,
    peso: 13,
    vendedor: 20,
    produto: 25,
    pais: 18
  }
  COLS.forEach((c, i) => {
    ws.getColumn(i + 1).width = LARGURAS[c.k] || 15
  })
  const totalValor = dados.reduce((s, d) => s + valorConta(d), 0)
  const totalPeso = dados.reduce((s, d) => s + pesoConta(d), 0)
  ws.mergeCells(1, 1, 1, nc)
  const c1 = ws.getCell(1, 1)
  c1.value = 'FATURAMENTO NFe — ' + anoAtual
  c1.font = { bold: true, size: 16, color: { argb: COR_AZUL } }
  c1.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 30
  ws.mergeCells(2, 1, 2, nc)
  const c2 = ws.getCell(2, 1)
  c2.value = 'Total: R$ ' + money(totalValor) + '  •  Kilos: ' + money(totalPeso) + ' kg  •  Notas: ' + dados.length
  c2.font = { size: 10, italic: true, color: { argb: 'FF555555' } }
  c2.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(2).height = 18
  ws.getRow(3).height = 8
  let r = 4
  for (let m = 1; m <= 12; m++) {
    const doMes = dados.filter((d) => d.mes === m)
    if (!doMes.length) continue
    const tv = doMes.reduce((s, d) => s + valorConta(d), 0)
    const tp = doMes.reduce((s, d) => s + pesoConta(d), 0)
    ws.mergeCells(r, 1, r, nc)
    const cm = ws.getCell(r, 1)
    cm.value =
      MESES[m - 1].toUpperCase() +
      '   —   ' +
      doMes.length +
      ' nota' +
      (doMes.length > 1 ? 's' : '') +
      '   •   R$ ' +
      money(tv) +
      '   •   ' +
      money(tp) +
      ' kg'
    cm.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
    preencher(cm, COR_AZUL)
    cm.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    ws.getRow(r).height = 22
    r++
    COLS.forEach((c, i) => {
      const cell = ws.getCell(r, i + 1)
      cell.value = c.t
      cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
      preencher(cell, '2C3E50')
      cell.border = BORDA
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    })
    ws.getRow(r).height = 18
    r++
    doMes.forEach((d, idx) => {
      ws.getRow(r).height = 16
      COLS.forEach((c, i) => {
        const cell = ws.getCell(r, i + 1)
        let v = d[c.k]
        if (c.tipo === 'date') {
          cell.value = dBR(v)
        } else if (c.tipo === 'num') {
          cell.value = Number(v) || 0
          cell.numFmt = '#,##0.00'
        } else {
          cell.value = v == null ? '' : v
        }
        cell.font = { size: 10, color: { argb: 'FF111111' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF5F5F5' } }
        cell.border = BORDA
        cell.alignment = { horizontal: c.tipo === 'num' ? 'right' : 'left', vertical: 'middle' }
      })
      r++
    })
    ws.getRow(r).height = 16
    for (let i = 1; i <= nc; i++) {
      const cell = ws.getCell(r, i)
      preencher(cell, COR_TOTAL)
      cell.border = BORDA
      cell.font = { bold: true, size: 10 }
    }
    ws.mergeCells(r, 1, r, 8)
    const lt = ws.getCell(r, 1)
    lt.value = 'TOTAL ' + MESES[m - 1]
    lt.alignment = { horizontal: 'right', vertical: 'middle' }
    const cv = ws.getCell(r, 9)
    cv.value = tv
    cv.numFmt = '#,##0.00'
    cv.alignment = { horizontal: 'right', vertical: 'middle' }
    const cp = ws.getCell(r, 10)
    cp.value = tp
    cp.numFmt = '#,##0.00'
    cp.alignment = { horizontal: 'right', vertical: 'middle' }
    r++
    ws.getRow(r).height = 10
    r++
  }
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'Faturamento_NFe_' + anoAtual + '.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}

function exportarPDF() {
  const totalValor = dados.reduce((s, d) => s + valorConta(d), 0)
  const totalPeso = dados.reduce((s, d) => s + pesoConta(d), 0)
  let secoes = ''
  for (let m = 1; m <= 12; m++) {
    const doMes = dados.filter((d) => d.mes === m)
    if (!doMes.length) continue
    const tv = doMes.reduce((s, d) => s + valorConta(d), 0)
    const tp = doMes.reduce((s, d) => s + pesoConta(d), 0)
    const linhas = doMes
      .map(
        (d) =>
          '<tr><td>' +
          dBR(d.data) +
          '</td><td>' +
          (d.nf || '') +
          '</td><td><strong>' +
          (d.fatura || '') +
          '</strong></td><td>' +
          (d.num_due || '') +
          '</td><td>' +
          dBR(d.data_due) +
          '</td><td>' +
          (d.num_conhecimento || '') +
          '</td><td>' +
          dBR(d.data_conhecimento) +
          '</td><td>' +
          (d.tipo || '') +
          '</td><td class="num">R$ ' +
          money(d.valor_nfe) +
          '</td><td class="num">' +
          money(d.peso) +
          '</td><td>' +
          (d.vendedor || '') +
          '</td><td>' +
          (d.produto || '') +
          '</td><td>' +
          (d.pais || '') +
          '</td></tr>'
      )
      .join('')
    secoes +=
      '<div class="mes-bloco"><div class="mes-header"><span>' +
      MESES[m - 1].toUpperCase() +
      '</span><span>' +
      doMes.length +
      ' nota' +
      (doMes.length > 1 ? 's' : '') +
      ' &middot; R$ ' +
      money(tv) +
      ' &middot; ' +
      money(tp) +
      ' kg</span></div><table><thead><tr><th>Data</th><th>NF</th><th>Fatura</th><th>Núm. DUE</th><th>Data DUE</th><th>Nº Conhec.</th><th>Data Conhec.</th><th>Tipo</th><th class="num">Valor NFE</th><th class="num">Peso (kg)</th><th>Vendedor</th><th>Produto</th><th>País</th></tr></thead><tbody>' +
      linhas +
      '</tbody><tfoot><tr><td colspan="8" style="text-align:right;font-weight:700">TOTAL ' +
      MESES[m - 1] +
      '</td><td class="num" style="font-weight:700">R$ ' +
      money(tv) +
      '</td><td class="num" style="font-weight:700">' +
      money(tp) +
      ' kg</td><td colspan="3"></td></tr></tfoot></table></div>'
  }
  const linhasMes = MESES.map((nome, i) => {
    const doMes = dados.filter((d) => d.mes === i + 1)
    if (!doMes.length) return ''
    const v = doMes.reduce((s, d) => s + valorConta(d), 0)
    const p = doMes.reduce((s, d) => s + pesoConta(d), 0)
    return (
      '<tr><td>' +
      nome +
      '</td><td class="num">' +
      doMes.length +
      '</td><td class="num">R$ ' +
      money(v) +
      '</td><td class="num">' +
      money(p) +
      ' kg</td></tr>'
    )
  }).join('')
  const css =
    '* { margin:0; padding:0; box-sizing:border-box; } body { font-family:Arial,sans-serif; font-size:8.5pt; color:#111; } .cabecalho { background:#C0392B; color:#fff; padding:12px 20px; display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; } .cabecalho h1 { font-size:14pt; font-weight:700; } .mes-bloco { margin:0 20px 20px; page-break-inside:avoid; } .mes-header { background:#1A1A2E; color:#fff; padding:6px 10px; font-size:9pt; font-weight:700; display:flex; justify-content:space-between; border-radius:4px 4px 0 0; } table { width:100%; border-collapse:collapse; font-size:7.5pt; } thead tr { background:#2C3E50; color:#fff; } thead th { padding:4px 5px; text-align:left; font-weight:600; border:1px solid #455; white-space:nowrap; } tbody tr:nth-child(even) { background:#F8F9FA; } tbody td { padding:3px 5px; border:1px solid #DDD; vertical-align:top; } tfoot tr { background:#D9E1F2; } tfoot td { padding:4px 5px; border:1px solid #BCC; font-size:8pt; } .num { text-align:right; white-space:nowrap; } .rodape-resumo { margin:0 20px; page-break-before:always; } @media print { body{font-size:7.5pt;} .cabecalho,.mes-header,thead,tfoot,tbody tr:nth-child(even){-webkit-print-color-adjust:exact;print-color-adjust:exact;} } @page { size:A4 landscape; margin:10mm; }'
  const hoje = new Date().toLocaleDateString('pt-BR')
  const html =
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Faturamento NFe ' +
    anoAtual +
    '</title><style>' +
    css +
    '</style></head><body><div class="cabecalho"><div><h1>Faturamento NFe &mdash; ' +
    anoAtual +
    '</h1><p>PIETROBON &amp; CIA. LTDA. &nbsp;&middot;&nbsp; Gerado em ' +
    hoje +
    '</p></div><div style="text-align:right"><div style="font-size:13pt;font-weight:700">R$ ' +
    money(totalValor) +
    '</div><div style="opacity:.85;font-size:9pt">' +
    money(totalPeso) +
    ' kg &nbsp;&middot;&nbsp; ' +
    dados.length +
    ' notas</div></div></div>' +
    secoes +
    '<div class="rodape-resumo"><h2 style="font-size:11pt;color:#C0392B;margin-bottom:8px;border-bottom:2px solid #C0392B;padding-bottom:4px">Vendas por Mês &mdash; ' +
    anoAtual +
    '</h2><table><thead><tr><th>Mês</th><th class="num">Notas</th><th class="num">Valor</th><th class="num">Peso</th></tr></thead><tbody>' +
    linhasMes +
    '</tbody><tfoot><tr><td><strong>TOTAL</strong></td><td class="num"><strong>' +
    dados.length +
    '</strong></td><td class="num"><strong>R$ ' +
    money(totalValor) +
    '</strong></td><td class="num"><strong>' +
    money(totalPeso) +
    ' kg</strong></td></tr></tfoot></table></div><script>window.onload=function(){window.print()}</script></body></html>'
  const janela = window.open('', '_blank')
  janela.document.write(html)
  janela.document.close()
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
        <input id="busca-nota" class="form-control form-control-sm" style="width:220px" placeholder="Buscar fatura, NF, cliente…">
        <button id="btn-sem-cliente" class="fin-chip">Sem cliente</button>
        <button class="btn btn-sm btn-outline-secondary" onclick="expandirTodos()">Expandir todos</button>
        <button class="btn btn-sm btn-outline-secondary" onclick="recolherTodos()">Recolher todos</button>
        <button id="btn-excel" class="btn btn-sm btn-outline-success">Excel</button>
        <button id="btn-pdf"   class="btn btn-sm btn-outline-danger">PDF</button>
      </div>
    </div>

    <div id="form-lancamento">
      <h5 class="secao-titulo-card mb-3">Lançar nota fiscal</h5>
      <div class="row g-2">
        <div class="col-12 col-md-5"><label class="form-label small mb-0">Cliente</label>
          <div class="d-flex gap-2"><select id="f-cliente_id" class="form-select form-select-sm"><option value="">Selecione o cliente…</option></select>
          <a class="btn-icone" href="/HTML/financeiro/cadastros.html#clientes" title="Cadastrar cliente">+</a></div></div>
        <div class="col-12 col-md-7 d-flex align-items-end"><div class="form-check"><input class="form-check-input" type="checkbox" id="f-entra_fechamento" checked>
          <label class="form-check-label small" for="f-entra_fechamento">Gerar o débito do cliente no Fechamento contábil (sem relançar)</label></div></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Data</label><input type="date" id="f-data" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Mês (se sem data)</label><select id="f-mes" class="form-select form-select-sm"><option value="">—</option>${MESES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}</select></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">NF</label><input type="text" id="f-nf" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Fatura</label><input type="text" id="f-fatura" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Núm. DUE</label><input type="text" id="f-num_due" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Data DUE</label><input type="date" id="f-data_due" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Nº Conhec. Emb.</label><input type="text" id="f-num_conhecimento" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Data Conhec.</label><input type="date" id="f-data_conhecimento" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Tipo</label><select id="f-tipo" class="form-select form-select-sm"><option value="">—</option><option>BL</option><option>CRT</option><option>DDE</option><option>SD</option></select></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Valor da NFE</label><input type="number" step="any" id="f-valor_nfe" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Peso (kg)</label><input type="number" step="any" id="f-peso" class="form-control form-control-sm"></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">Vendedor</label><span id="slot-f-vendedor"></span></div>
        <div class="col-6 col-md-3"><label class="form-label small mb-0">Produto</label><span id="slot-f-produto"></span></div>
        <div class="col-6 col-md-2"><label class="form-label small mb-0">País</label>${seletorPais('f-pais', '')}</div>
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
    if (!ano || ano < 2000 || ano > 2100) {
      alert('Ano inválido.')
      return
    }
    const sel = document.getElementById('sel-ano')
    if (![...sel.options].some((o) => parseInt(o.value) === ano)) {
      const o = document.createElement('option')
      o.value = ano
      o.textContent = ano
      sel.appendChild(o)
      const opts = [...sel.options].sort((a, b) => parseInt(b.value) - parseInt(a.value))
      sel.innerHTML = ''
      opts.forEach((op) => sel.appendChild(op))
    }
    sel.value = ano
    anoAtual = ano
    mesesAbertos.clear()
    mesesAbertos.add(new Date().getMonth() + 1)
    carregarDados()
  })
  document.getElementById('btn-salvar-nota').addEventListener('click', salvarNota)
  document.getElementById('busca-nota').addEventListener('input', (e) => {
    busca = e.target.value
    renderTabela()
  })
  document.getElementById('btn-sem-cliente').addEventListener('click', (e) => {
    soSemCliente = !soSemCliente
    e.target.classList.toggle('ativo', soSemCliente)
    renderTabela()
  })
  document.getElementById('f-cliente_id').addEventListener('change', (e) => {
    const pais = e.target.selectedOptions[0]?.dataset.pais
    const sel = document.getElementById('f-pais')
    if (pais && !sel.value) {
      const v = normalizarValor(pais)
      if (![...sel.options].some((o) => o.value === v)) sel.add(new Option(v, v), 1)
      sel.value = v
    }
  })
  document.getElementById('btn-excel').addEventListener('click', exportarExcel)
  document.getElementById('btn-pdf').addEventListener('click', exportarPDF)
}

async function carregarClientes() {
  const lista = await api.cadastros.clientes()
  clientes = Array.isArray(lista) ? lista : []
  const sel = document.getElementById('f-cliente_id')
  if (sel) sel.innerHTML = '<option value="">Selecione o cliente…</option>' + opcoesClientes()
}

async function iniciar() {
  if (!iniciarPagina()) return
  montarInterface()
  await Promise.all([carregarAnos(), carregarClientes()])
  carregarDados()
}

iniciar()
