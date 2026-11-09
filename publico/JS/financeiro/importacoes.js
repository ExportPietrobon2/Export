import { api } from '/JS/compartilhado/api.js'
import {
  $,
  iniciarPagina,
  brl,
  num,
  valorMoeda,
  dISO,
  dBR,
  hojeISO,
  esc,
  normalizar,
  pill,
  pillStatusImportacao,
  pillPrazo,
  barraProgresso,
  numeroDoCampo,
  avisar,
  painelLateral,
  buscarPtax
} from '/JS/financeiro/comum.js'

const numf = num

let resumo = { importacoes: [], contagem: {} }
let fornecedores = []
let contratos = []
let aba = 'importacoes'
let filtro = { texto: '', situacao: 'abertas', fornecedor: '', ano: '' }
let custoImpSel = ''
let custoIdSel = null
let custosDaImp = []
let custoCab = {}
let custoDespesas = []
let custoSt = []

const painel = () => painelLateral('painel-importacao', 'Importação')

async function carregar() {
  const [r, f, c] = await Promise.all([api.fin.resumo(), api.cadastros.fornecedores(), api.fin.contratos()])
  if (!r || r.erro) {
    $('area-fin').innerHTML = `<p class="text-danger">${esc(r?.erro || 'Erro ao carregar.')}</p>`
    return
  }
  resumo = r
  fornecedores = Array.isArray(f) ? f : []
  contratos = Array.isArray(c) ? c : []
  render()
}

function render() {
  document.querySelectorAll('#abas-fin button').forEach((b) => b.classList.toggle('ativo', b.dataset.aba === aba))
  if (aba === 'importacoes') renderImportacoes()
  else if (aba === 'contratos') renderContratos()
  else if (aba === 'custos') renderCustos()
}

const SITUACOES = [
  ['abertas', 'A pagar', (i) => i.status === 'EM_ABERTO' || i.status === 'PARCIAL'],
  ['vencidas', 'Vencidas', (i) => i.prazo === 'VENCIDA'],
  ['breve', 'Vencem em 7 dias', (i) => i.prazo === 'VENCE_EM_BREVE'],
  ['parciais', 'Pagas em parte', (i) => i.status === 'PARCIAL'],
  ['quitadas', 'Quitadas', (i) => i.status === 'QUITADA' || i.status === 'PAGO_A_MAIOR'],
  ['todas', 'Todas', () => true]
]

function importacoesFiltradas() {
  const regra = (SITUACOES.find((s) => s[0] === filtro.situacao) || SITUACOES[0])[2]
  const busca = normalizar(filtro.texto)
  return resumo.importacoes.filter(
    (i) =>
      regra(i) &&
      (!filtro.fornecedor || String(i.fornecedor_id) === filtro.fornecedor) &&
      (!filtro.ano || String(i.data_invoice || '').startsWith(filtro.ano)) &&
      (!busca || normalizar(`${i.invoice} ${i.fornecedor_nome} ${i.mercadoria} ${i.banco}`).includes(busca))
  )
}

function totaisPorMoeda(lista, campo) {
  const t = {}
  lista.forEach((i) => {
    const m = i.moeda || 'USD'
    t[m] = (t[m] || 0) + (Number(i[campo]) || 0)
  })
  return (
    Object.entries(t)
      .map(([m, v]) => valorMoeda(v, m))
      .join(' · ') || '—'
  )
}

function renderImportacoes() {
  const anos = [...new Set(resumo.importacoes.map((i) => String(i.data_invoice || '').slice(0, 4)).filter(Boolean))]
    .sort()
    .reverse()
  const usados = [...new Set(resumo.importacoes.map((i) => String(i.fornecedor_id)))]
  const optForn = fornecedores
    .filter((f) => usados.includes(String(f.id)))
    .map(
      (f) => `<option value="${f.id}" ${String(f.id) === filtro.fornecedor ? 'selected' : ''}>${esc(f.nome)}</option>`
    )
    .join('')
  const lista = importacoesFiltradas()
  const abertas = resumo.importacoes.filter((i) => i.status === 'EM_ABERTO' || i.status === 'PARCIAL')

  $('area-fin').innerHTML = `
    <div class="fin-kpis">
      <div class="kpi kpi-azul"><span class="kpi-rotulo">Saldo a pagar</span><span class="kpi-valor">${totaisPorMoeda(abertas, 'saldo_moeda')}</span><span class="kpi-sub">${abertas.length} importação(ões) em aberto</span></div>
      <div class="kpi kpi-vermelho"><span class="kpi-rotulo">Vencidas</span><span class="kpi-valor">${resumo.contagem.VENCIDA || 0}</span><span class="kpi-sub">${totaisPorMoeda(
        abertas.filter((i) => i.prazo === 'VENCIDA'),
        'saldo_moeda'
      )}</span></div>
      <div class="kpi kpi-laranja"><span class="kpi-rotulo">Vencem em 7 dias</span><span class="kpi-valor">${resumo.contagem.VENCE_EM_BREVE || 0}</span><span class="kpi-sub">${totaisPorMoeda(
        abertas.filter((i) => i.prazo === 'VENCE_EM_BREVE'),
        'saldo_moeda'
      )}</span></div>
      <div class="kpi kpi-verde"><span class="kpi-rotulo">Quitadas</span><span class="kpi-valor">${(resumo.contagem.QUITADA || 0) + (resumo.contagem.PAGO_A_MAIOR || 0)}</span><span class="kpi-sub">de ${resumo.importacoes.length} lançadas</span></div>
    </div>

    <div class="fin-barra">
      <input class="form-control form-control-sm busca" id="f-busca" placeholder="Buscar invoice, fornecedor ou mercadoria" value="${esc(filtro.texto)}">
      <select class="form-select form-select-sm" id="f-fornecedor"><option value="">Todos os fornecedores</option>${optForn}</select>
      <select class="form-select form-select-sm" id="f-ano"><option value="">Todos os anos</option>${anos.map((a) => `<option ${a === filtro.ano ? 'selected' : ''}>${a}</option>`).join('')}</select>
      <button class="btn btn-pietrobon btn-sm ms-auto" id="btn-nova-imp">+ Nova importação</button>
    </div>
    <div class="fin-chips mb-3">${SITUACOES.map(
      ([k, t, regra]) =>
        `<button class="fin-chip ${filtro.situacao === k ? 'ativo' : ''}" data-situacao="${k}">${t}<span class="qtd">${resumo.importacoes.filter(regra).length}</span></button>`
    ).join('')}</div>

    <div class="fin-cartao">
      <div class="table-responsive">
        <table class="fin-tabela">
          <thead><tr>
            <th>Invoice</th><th class="oculta-celular">Data</th><th class="num">Valor</th><th>Pago</th><th class="num">Saldo</th><th>Situação</th><th></th>
          </tr></thead>
          <tbody>${
            lista.length
              ? lista
                  .map(
                    (i) => `<tr class="clicavel" data-imp="${i.id}">
              <td><div class="texto-forte">${esc(i.invoice)}</div><div class="texto-sub">${esc(i.fornecedor_nome || 'Sem fornecedor')}${i.mercadoria ? ' · ' + esc(i.mercadoria) : ''}</div></td>
              <td class="oculta-celular">${dBR(i.data_invoice)}</td>
              <td class="num">${valorMoeda(i.valor_moeda, i.moeda)}<div class="texto-sub">${brl(i.valor_reais)}</div></td>
              <td style="min-width:120px">${barraProgresso(i)}<div class="texto-sub mt-1">${valorMoeda(i.pago_moeda, i.moeda)} · ${num(i.percentual_pago, 0)}%</div></td>
              <td class="num"><span class="texto-forte ${i.saldo_moeda > 0.01 ? 'valor-negativo' : ''}">${valorMoeda(Math.max(i.saldo_moeda, 0), i.moeda)}</span></td>
              <td><div class="d-flex flex-column gap-1 align-items-start">${pillStatusImportacao(i)}${pillPrazo(i)}</div></td>
              <td class="acoes">${i.status === 'EM_ABERTO' || i.status === 'PARCIAL' ? `<button class="btn-icone" data-pagar="${i.id}">Pagar</button>` : ''}</td>
            </tr>`
                  )
                  .join('')
              : `<tr><td colspan="7"><div class="fin-vazio">Nenhuma importação neste filtro.</div></td></tr>`
          }</tbody>
          ${
            lista.length
              ? `<tfoot><tr><td colspan="2">${lista.length} importação(ões)</td><td class="num">${totaisPorMoeda(lista, 'valor_moeda')}</td><td>${totaisPorMoeda(lista, 'pago_moeda')}</td><td class="num">${totaisPorMoeda(
                  lista.map((i) => ({ ...i, saldo_moeda: Math.max(i.saldo_moeda, 0) })),
                  'saldo_moeda'
                )}</td><td colspan="2"></td></tr></tfoot>`
              : ''
          }
        </table>
      </div>
    </div>`

  $('f-busca').addEventListener('input', (e) => {
    filtro.texto = e.target.value
    const pos = e.target.selectionStart
    renderImportacoes()
    $('f-busca').focus()
    $('f-busca').setSelectionRange(pos, pos)
  })
  $('f-fornecedor').addEventListener('change', (e) => {
    filtro.fornecedor = e.target.value
    renderImportacoes()
  })
  $('f-ano').addEventListener('change', (e) => {
    filtro.ano = e.target.value
    renderImportacoes()
  })
  document.querySelectorAll('[data-situacao]').forEach((b) =>
    b.addEventListener('click', () => {
      filtro.situacao = b.dataset.situacao
      renderImportacoes()
    })
  )
  $('btn-nova-imp').addEventListener('click', () => abrirFormImportacao(null))
  document.querySelectorAll('tr[data-imp]').forEach((tr) =>
    tr.addEventListener('click', (e) => {
      const pagar = e.target.closest('[data-pagar]')
      abrirDetalhe(Number(tr.dataset.imp), !!pagar)
    })
  )
}

function opcoesFornecedores(selecionado) {
  return fornecedores
    .filter((f) => f.ativo || String(f.id) === String(selecionado))
    .map(
      (f) =>
        `<option value="${f.id}" data-moeda="${esc(f.moeda || 'USD')}" ${String(f.id) === String(selecionado) ? 'selected' : ''}>${esc(f.nome)}</option>`
    )
    .join('')
}

function abrirFormImportacao(id) {
  const ed = id ? resumo.importacoes.find((x) => x.id === id) : null
  const p = painel()
  p.titulo(ed ? `Editar ${ed.invoice}` : 'Nova importação')
  p.corpo.innerHTML = `
    <div class="row g-2">
      <div class="col-12"><label class="form-label">Fornecedor</label>
        <div class="d-flex gap-2"><select id="i-fornecedor_id" class="form-select form-select-sm"><option value="">Selecione…</option>${opcoesFornecedores(ed?.fornecedor_id)}</select>
        <a class="btn-icone" href="/HTML/financeiro/cadastros.html#fornecedores" title="Cadastrar fornecedor">+</a></div></div>
      <div class="col-6"><label class="form-label">Nº da invoice</label><input id="i-invoice" class="form-control form-control-sm" value="${esc(ed?.invoice || '')}"></div>
      <div class="col-6"><label class="form-label">Data da invoice</label><input type="date" id="i-data_invoice" class="form-control form-control-sm" value="${dISO(ed?.data_invoice)}"></div>
      <div class="col-12"><label class="form-label">Mercadoria</label><input id="i-mercadoria" class="form-control form-control-sm" value="${esc(ed?.mercadoria || '')}"></div>
      <div class="col-4"><label class="form-label">Moeda</label><select id="i-moeda" class="form-select form-select-sm">${['USD', 'EUR', 'CNY', 'BRL'].map((m) => `<option ${(ed?.moeda || 'USD') === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="col-8"><label class="form-label">Valor da invoice</label><input inputmode="decimal" id="i-valor_moeda" class="form-control form-control-sm" value="${ed ? ed.valor_moeda : ''}"></div>
      <div class="col-6"><label class="form-label">Taxa de câmbio (PTAX)</label><input inputmode="decimal" id="i-taxa_cambio" class="form-control form-control-sm" value="${ed ? ed.taxa_cambio : ''}"><div id="i-taxa-nota" class="texto-sub mt-1"></div></div>
      <div class="col-6"><label class="form-label">Valor em R$</label><div class="form-control form-control-sm bg-light fw-semibold" id="i-valor-reais">—</div></div>
      <div class="col-6"><label class="form-label">Vencimento do pagamento</label><input type="date" id="i-data_vencimento" class="form-control form-control-sm" value="${dISO(ed?.data_vencimento)}">
        <div class="d-flex gap-1 mt-1 flex-wrap">${[0, 30, 60, 90].map((d) => `<button type="button" class="fin-chip py-0" data-prazo="${d}">${d ? d + ' dias' : 'à vista'}</button>`).join('')}</div></div>
      <div class="col-6"><label class="form-label">Chegada da mercadoria</label><input type="date" id="i-data_chegada" class="form-control form-control-sm" value="${dISO(ed?.data_chegada)}"><div class="texto-sub mt-1">Data da NF de entrada. Pagamentos antes dela são adiantamento.</div></div>
      <div class="col-6"><label class="form-label">Banco</label><input id="i-banco" class="form-control form-control-sm" value="${esc(ed?.banco || '')}"></div>
      <div class="col-12"><label class="form-label">Observações</label><input id="i-obs" class="form-control form-control-sm" value="${esc(ed?.obs || '')}"></div>
    </div>
    <div class="d-flex gap-2 mt-4">
      <button class="btn btn-ok-grande" id="i-salvar">${ed ? 'Salvar alterações' : 'Lançar importação'}</button>
      ${ed ? '<button class="btn btn-outline-danger ms-auto" id="i-excluir">Excluir</button>' : ''}
    </div>`

  const atualizarReais = () => {
    const v = numeroDoCampo($('i-valor_moeda').value) * numeroDoCampo($('i-taxa_cambio').value)
    $('i-valor-reais').textContent = v ? brl(v) : '—'
  }
  atualizarReais()
  $('i-valor_moeda').addEventListener('input', atualizarReais)
  $('i-taxa_cambio').addEventListener('input', atualizarReais)
  $('i-fornecedor_id').addEventListener('change', (e) => {
    const m = e.target.selectedOptions[0]?.dataset.moeda
    if (m && !ed) $('i-moeda').value = m
  })
  $('i-data_invoice').addEventListener('change', async () => {
    const data = $('i-data_invoice').value
    if (!data || $('i-moeda').value !== 'USD') return
    $('i-taxa-nota').textContent = 'Buscando PTAX…'
    const r = await buscarPtax(data)
    if (r) {
      $('i-taxa_cambio').value = r.taxa
      $('i-taxa-nota').textContent = `PTAX ${num(r.taxa, 4)} de ${dBR(r.dataCotacao)}`
      atualizarReais()
    } else $('i-taxa-nota').textContent = 'PTAX indisponível. Informe a taxa.'
  })
  p.corpo.querySelectorAll('[data-prazo]').forEach((b) =>
    b.addEventListener('click', () => {
      const base = $('i-data_invoice').value || hojeISO()
      const d = new Date(base + 'T00:00:00')
      d.setDate(d.getDate() + Number(b.dataset.prazo))
      $('i-data_vencimento').value = d.toISOString().slice(0, 10)
    })
  )
  $('i-salvar').addEventListener('click', async () => {
    const dados = {}
    ;[
      'fornecedor_id',
      'invoice',
      'data_invoice',
      'data_vencimento',
      'data_chegada',
      'mercadoria',
      'moeda',
      'banco',
      'obs'
    ].forEach((k) => (dados[k] = $('i-' + k).value))
    dados.valor_moeda = numeroDoCampo($('i-valor_moeda').value)
    dados.taxa_cambio = numeroDoCampo($('i-taxa_cambio').value)
    if (!dados.fornecedor_id) return avisar('Selecione o fornecedor.', 'warning')
    const r = ed ? await api.fin.editarImportacao(ed.id, dados) : await api.fin.criarImportacao(dados)
    if (r?.erro) return avisar(r.erro, 'error')
    p.fechar()
    avisar(ed ? 'Importação atualizada.' : 'Importação lançada.')
    await carregar()
  })
  if (ed)
    $('i-excluir').addEventListener('click', async () => {
      if (!confirm(`Excluir a importação ${ed.invoice} com todos os pagamentos, contratos e custos dela?`)) return
      const r = await api.fin.excluirImportacao(ed.id)
      if (r?.erro) return avisar(r.erro, 'error')
      p.fechar()
      avisar('Importação excluída.')
      carregar()
    })
  p.abrir()
}

async function abrirDetalhe(id, focarPagamento) {
  const i = resumo.importacoes.find((x) => x.id === id)
  if (!i) return
  const p = painel()
  p.titulo(`Invoice ${i.invoice}`)
  p.corpo.innerHTML = '<p class="text-muted">Carregando…</p>'
  p.abrir()
  const [pags, cts] = await Promise.all([api.fin.pagamentos(id), api.fin.contratos(id)])
  const pagamentos = Array.isArray(pags) ? pags : []
  const contratosImp = Array.isArray(cts) ? cts : []
  const saldo = Math.max(i.saldo_moeda, 0)

  p.corpo.innerHTML = `
    <div class="d-flex flex-wrap gap-2 mb-2">${pillStatusImportacao(i)}${pillPrazo(i)}</div>
    <div class="texto-sub mb-3">${esc(i.fornecedor_nome || 'Sem fornecedor')}${i.mercadoria ? ' · ' + esc(i.mercadoria) : ''} · invoice de ${dBR(i.data_invoice)}</div>
    <div class="fin-cartao"><div class="fin-cartao-corpo">
      <div class="fin-resumo-linha"><span>Valor da invoice</span><strong>${valorMoeda(i.valor_moeda, i.moeda)} · ${brl(i.valor_reais)}</strong></div>
      <div class="fin-resumo-linha"><span>Taxa da invoice</span><strong>${num(i.taxa_cambio, 4)}</strong></div>
      <div class="fin-resumo-linha"><span>Pago</span><strong>${valorMoeda(i.pago_moeda, i.moeda)} · ${brl(i.pago)}</strong></div>
      <div class="fin-resumo-linha"><span>Saldo</span><strong class="${saldo > 0.01 ? 'valor-negativo' : 'valor-positivo'}">${valorMoeda(saldo, i.moeda)}${saldo > 0.01 ? ` · ≈ ${brl(i.saldo)}` : ''}</strong></div>
      <div class="fin-resumo-linha"><span>Variação cambial</span><strong class="${i.variacao_cambial > 0 ? 'valor-negativo' : 'valor-positivo'}">${brl(i.variacao_cambial)}</strong></div>
      <div class="fin-resumo-linha"><span>Vencimento</span><strong>${dBR(i.data_vencimento)}</strong></div>
      <div class="fin-resumo-linha"><span>Chegada da mercadoria</span><strong>${dBR(i.data_chegada)}</strong></div>
      <div class="mt-2">${barraProgresso(i)}</div>
    </div></div>
    <div class="d-flex gap-2 mb-3"><button class="btn-icone" id="d-editar">Editar importação</button><button class="btn-icone" id="d-custos">Custos de nacionalização</button></div>

    <h6 class="fw-bold mb-2">Registrar pagamento</h6>
    <div class="row g-2 mb-1" id="form-pag">
      <div class="col-6"><label class="form-label">Data</label><input type="date" id="p-data" class="form-control form-control-sm" value="${hojeISO()}"></div>
      <div class="col-6"><label class="form-label">Contrato de câmbio</label><select id="p-contrato" class="form-select form-select-sm"><option value="">Nenhum</option>${contratosImp
        .filter((c) => !c.liquidado)
        .map(
          (c) => `<option value="${c.id}" data-taxa="${c.taxa}">Nº ${esc(c.num_contrato)} · ${num(c.taxa, 4)}</option>`
        )
        .join('')}</select></div>
      <div class="col-6"><label class="form-label">Valor pago (${esc(i.moeda)})</label><input inputmode="decimal" id="p-moeda" class="form-control form-control-sm"></div>
      <div class="col-6"><label class="form-label">Taxa</label><input inputmode="decimal" id="p-taxa" class="form-control form-control-sm" value="${i.taxa_cambio || ''}"><div class="texto-sub mt-1" id="p-taxa-nota"></div></div>
      <div class="col-6"><label class="form-label">Valor em R$</label><input inputmode="decimal" id="p-reais" class="form-control form-control-sm"></div>
      <div class="col-6"><label class="form-label">Forma</label><input id="p-forma" class="form-control form-control-sm" value="Câmbio"></div>
      <div class="col-12"><label class="form-label">Observação</label><input id="p-obs" class="form-control form-control-sm"></div>
    </div>
    <div class="d-flex flex-wrap gap-2 align-items-center mb-4">
      <button class="btn btn-ok-grande btn-sm" id="p-salvar">Registrar pagamento</button>
      ${saldo > 0.01 ? `<button class="btn-icone" id="p-quitar">Preencher saldo (${valorMoeda(saldo, i.moeda)})</button>` : ''}
    </div>

    <h6 class="fw-bold mb-2">Pagamentos (${pagamentos.length})</h6>
    ${
      pagamentos.length
        ? `<table class="fin-tabela mb-3"><thead><tr><th>Data</th><th class="num">${esc(i.moeda)}</th><th class="num">R$</th><th></th></tr></thead><tbody>${pagamentos
            .map((pg) => {
              const auto = pg.origem === 'contrato'
              const adiant = pg.entra_fechamento && (!i.data_chegada || dISO(pg.data_pgto) < i.data_chegada)
              return `<tr>
              <td>${dBR(pg.data_pgto)}<div class="texto-sub">${esc(pg.forma || '')}${pg.num_contrato ? ' · contrato ' + esc(pg.num_contrato) : ''}</div>
                <div class="d-flex gap-1 mt-1 flex-wrap">${auto ? pill('Gerado pelo contrato', 'auto') : ''}${adiant ? pill('Adiantamento', 'neutro', 'Entra em Adiantamentos a Fornecedores no Fechamento') : ''}</div></td>
              <td class="num">${num(pg.valor_moeda)}</td><td class="num">${brl(pg.valor_reais)}</td>
              <td class="acoes">${auto ? '' : `<button class="btn-icone perigo" data-excluir-pag="${pg.id}">Excluir</button>`}</td></tr>`
            })
            .join('')}</tbody></table>`
        : '<div class="fin-vazio">Nenhum pagamento registrado.</div>'
    }
    ${
      contratosImp.length
        ? `<h6 class="fw-bold mb-2">Contratos de câmbio</h6><ul class="fin-lista-alertas">${contratosImp
            .map(
              (
                c
              ) => `<li><div><div class="texto-forte">Nº ${esc(c.num_contrato)}</div><div class="texto-sub">${esc(c.banco || '')} · ${dBR(c.data_fechamento)} · taxa ${num(c.taxa, 4)}</div></div>
              <div class="text-end">${valorMoeda(c.valor_moeda, c.moeda)}<div>${c.liquidado ? pill('Liquidado', 'quitada') : pill('A liquidar', 'alerta')}</div></div></li>`
            )
            .join('')}</ul>`
        : ''
    }`

  const taxaAtual = () => numeroDoCampo($('p-taxa').value)
  const recalcularReais = () => {
    const v = numeroDoCampo($('p-moeda').value) * taxaAtual()
    if (v) $('p-reais').value = v.toFixed(2)
  }
  $('p-moeda').addEventListener('input', recalcularReais)
  $('p-taxa').addEventListener('input', recalcularReais)
  $('p-contrato').addEventListener('change', (e) => {
    const t = e.target.selectedOptions[0]?.dataset.taxa
    if (t) {
      $('p-taxa').value = t
      $('p-taxa-nota').textContent = 'Taxa do contrato'
      recalcularReais()
    }
  })
  $('p-data').addEventListener('change', async () => {
    if ($('p-contrato').value || i.moeda !== 'USD') return
    $('p-taxa-nota').textContent = 'Buscando PTAX…'
    const r = await buscarPtax($('p-data').value)
    if (r) {
      $('p-taxa').value = r.taxa
      $('p-taxa-nota').textContent = `PTAX de ${dBR(r.dataCotacao)}`
      recalcularReais()
    } else $('p-taxa-nota').textContent = ''
  })
  if ($('p-quitar'))
    $('p-quitar').addEventListener('click', () => {
      $('p-moeda').value = saldo.toFixed(2)
      recalcularReais()
    })
  $('p-salvar').addEventListener('click', async () => {
    const dados = {
      importacao_id: id,
      data_pgto: $('p-data').value,
      valor_moeda: numeroDoCampo($('p-moeda').value),
      valor_reais: numeroDoCampo($('p-reais').value),
      forma: $('p-forma').value,
      obs: $('p-obs').value,
      contrato_id: $('p-contrato').value || null
    }
    if (!(dados.valor_moeda > 0)) return avisar('Informe o valor pago.', 'warning')
    const r = await api.fin.criarPagamento(dados)
    if (r?.erro) return avisar(r.erro, 'error')
    avisar('Pagamento registrado.')
    await carregar()
    abrirDetalhe(id)
  })
  p.corpo.querySelectorAll('[data-excluir-pag]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('Excluir este pagamento?')) return
      const r = await api.fin.excluirPagamento(b.dataset.excluirPag)
      if (r?.erro) return avisar(r.erro, 'error')
      await carregar()
      abrirDetalhe(id)
    })
  )
  $('d-editar').addEventListener('click', () => abrirFormImportacao(id))
  $('d-custos').addEventListener('click', () => {
    p.fechar()
    aba = 'custos'
    carregarCusto(String(id))
    render()
  })
  if (focarPagamento) setTimeout(() => $('p-moeda').focus(), 300)
}

function renderContratos() {
  const abertos = contratos.filter((c) => !c.liquidado)
  $('area-fin').innerHTML = `
    <div class="fin-aviso">Ao marcar um contrato como <strong>liquidado</strong> e vinculá-lo a uma importação, o pagamento é lançado sozinho na importação (com a taxa e o valor do contrato). Desmarcar remove o pagamento.</div>
    <div class="fin-barra">
      <span class="texto-sub">${abertos.length} a liquidar · ${contratos.length - abertos.length} liquidado(s)</span>
      <button class="btn btn-pietrobon btn-sm ms-auto" id="btn-novo-ct">+ Novo contrato</button>
    </div>
    <div class="fin-cartao"><div class="table-responsive"><table class="fin-tabela">
      <thead><tr><th>Contrato</th><th class="oculta-celular">Fechamento</th><th class="num">Valor</th><th class="num">Taxa</th><th class="num">R$</th><th>Importação</th><th>Situação</th></tr></thead>
      <tbody>${
        contratos.length
          ? contratos
              .map(
                (c) => `<tr class="clicavel" data-ct="${c.id}">
          <td><div class="texto-forte">Nº ${esc(c.num_contrato)}</div><div class="texto-sub">${esc(c.banco || '')}</div></td>
          <td class="oculta-celular">${dBR(c.data_fechamento)}</td>
          <td class="num">${valorMoeda(c.valor_moeda, c.moeda)}</td><td class="num">${num(c.taxa, 4)}</td><td class="num">${brl(c.valor_reais)}</td>
          <td>${c.invoice ? `<div>${esc(c.invoice)}</div><div class="texto-sub">${esc(c.fornecedor_nome || '')}</div>` : '<span class="texto-sub">Sem vínculo</span>'}</td>
          <td>${c.liquidado ? pill(c.data_liquidacao ? `Liquidado ${dBR(c.data_liquidacao)}` : 'Liquidado', 'quitada') : pill('A liquidar', 'alerta')}${c.liquidado && c.importacao_id && !Number(c.qtd_pagamentos) ? '<div class="mt-1">' + pill('Sem pagamento vinculado', 'neutro', 'Nenhum pagamento da importação está ligado a este contrato') + '</div>' : ''}</td>
        </tr>`
              )
              .join('')
          : '<tr><td colspan="7"><div class="fin-vazio">Nenhum contrato cadastrado.</div></td></tr>'
      }</tbody></table></div></div>`
  $('btn-novo-ct').addEventListener('click', () => abrirFormContrato(null))
  document
    .querySelectorAll('tr[data-ct]')
    .forEach((tr) => tr.addEventListener('click', () => abrirFormContrato(Number(tr.dataset.ct))))
}

function abrirFormContrato(id) {
  const ed = id ? contratos.find((c) => c.id === id) : null
  const p = painelLateral('painel-contrato', ed ? `Contrato Nº ${ed.num_contrato}` : 'Novo contrato de câmbio')
  const optImp = resumo.importacoes
    .filter((i) => i.status === 'EM_ABERTO' || i.status === 'PARCIAL' || String(i.id) === String(ed?.importacao_id))
    .map(
      (i) =>
        `<option value="${i.id}" data-saldo="${Math.max(i.saldo_moeda, 0)}" data-moeda="${esc(i.moeda)}" ${String(i.id) === String(ed?.importacao_id) ? 'selected' : ''}>${esc(i.invoice)} · ${esc(i.fornecedor_nome || '')} · saldo ${valorMoeda(Math.max(i.saldo_moeda, 0), i.moeda)}</option>`
    )
    .join('')
  p.corpo.innerHTML = `
    <div class="row g-2">
      <div class="col-6"><label class="form-label">Nº do contrato</label><input id="ct-num_contrato" class="form-control form-control-sm" value="${esc(ed?.num_contrato || '')}"></div>
      <div class="col-6"><label class="form-label">Banco</label><input id="ct-banco" class="form-control form-control-sm" value="${esc(ed?.banco || '')}"></div>
      <div class="col-12"><label class="form-label">Importação</label><select id="ct-importacao_id" class="form-select form-select-sm"><option value="">Sem vínculo</option>${optImp}</select></div>
      <div class="col-6"><label class="form-label">Data de fechamento</label><input type="date" id="ct-data_fechamento" class="form-control form-control-sm" value="${dISO(ed?.data_fechamento)}"></div>
      <div class="col-6"><label class="form-label">Moeda</label><select id="ct-moeda" class="form-select form-select-sm">${['USD', 'EUR', 'CNY'].map((m) => `<option ${(ed?.moeda || 'USD') === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="col-6"><label class="form-label">Valor (moeda)</label><input inputmode="decimal" id="ct-valor_moeda" class="form-control form-control-sm" value="${ed ? ed.valor_moeda : ''}"></div>
      <div class="col-6"><label class="form-label">Taxa</label><input inputmode="decimal" id="ct-taxa" class="form-control form-control-sm" value="${ed ? ed.taxa : ''}"><div class="texto-sub mt-1" id="ct-taxa-nota"></div></div>
      <div class="col-12"><label class="form-label">Valor em R$</label><div class="form-control form-control-sm bg-light fw-semibold" id="ct-reais">—</div></div>
      <div class="col-6 d-flex align-items-end"><div class="form-check"><input class="form-check-input" type="checkbox" id="ct-liquidado" ${ed?.liquidado ? 'checked' : ''}><label class="form-check-label" for="ct-liquidado">Liquidado</label></div></div>
      <div class="col-6"><label class="form-label">Data de liquidação</label><input type="date" id="ct-data_liquidacao" class="form-control form-control-sm" value="${dISO(ed?.data_liquidacao)}"></div>
      <div class="col-12"><label class="form-label">Observações</label><input id="ct-obs" class="form-control form-control-sm" value="${esc(ed?.obs || '')}"></div>
    </div>
    <div class="d-flex gap-2 mt-4"><button class="btn btn-ok-grande" id="ct-salvar">${ed ? 'Salvar alterações' : 'Adicionar contrato'}</button>
      ${ed ? '<button class="btn btn-outline-danger ms-auto" id="ct-excluir">Excluir</button>' : ''}</div>`
  const atualizar = () => {
    const v = numeroDoCampo($('ct-valor_moeda').value) * numeroDoCampo($('ct-taxa').value)
    $('ct-reais').textContent = v ? brl(v) : '—'
  }
  atualizar()
  $('ct-valor_moeda').addEventListener('input', atualizar)
  $('ct-taxa').addEventListener('input', atualizar)
  $('ct-importacao_id').addEventListener('change', (e) => {
    const o = e.target.selectedOptions[0]
    if (o && o.dataset.saldo && !$('ct-valor_moeda').value) {
      $('ct-valor_moeda').value = Number(o.dataset.saldo).toFixed(2)
      $('ct-moeda').value = o.dataset.moeda || 'USD'
      atualizar()
    }
  })
  $('ct-data_fechamento').addEventListener('change', async () => {
    if ($('ct-taxa').value) return
    const r = await buscarPtax($('ct-data_fechamento').value)
    if (r) {
      $('ct-taxa').value = r.taxa
      $('ct-taxa-nota').textContent = `PTAX de ${dBR(r.dataCotacao)} (confira a taxa do banco)`
      atualizar()
    }
  })
  $('ct-liquidado').addEventListener('change', (e) => {
    if (e.target.checked && !$('ct-data_liquidacao').value)
      $('ct-data_liquidacao').value = $('ct-data_fechamento').value || hojeISO()
  })
  $('ct-salvar').addEventListener('click', async () => {
    const dados = {}
    ;['num_contrato', 'banco', 'importacao_id', 'data_fechamento', 'moeda', 'data_liquidacao', 'obs'].forEach(
      (k) => (dados[k] = $('ct-' + k).value)
    )
    dados.valor_moeda = numeroDoCampo($('ct-valor_moeda').value)
    dados.taxa = numeroDoCampo($('ct-taxa').value)
    dados.liquidado = $('ct-liquidado').checked
    const r = ed ? await api.fin.editarContrato(ed.id, dados) : await api.fin.criarContrato(dados)
    if (r?.erro) return avisar(r.erro, 'error')
    p.fechar()
    avisar(
      r.pagamento === 'automatico'
        ? 'Contrato salvo e pagamento lançado na importação.'
        : r.pagamento === 'manual'
          ? 'Contrato salvo. A importação já tinha um pagamento ligado a este contrato.'
          : 'Contrato salvo.'
    )
    await carregar()
  })
  if (ed)
    $('ct-excluir').addEventListener('click', async () => {
      if (!confirm('Excluir este contrato? O pagamento gerado por ele também será removido.')) return
      await api.fin.excluirContrato(ed.id)
      p.fechar()
      carregar()
    })
  p.abrir()
}

function stRecolher(it) {
  const bc = ((parseFloat(it.base_icms) || 0) + (parseFloat(it.ipi_destacado) || 0)) * (parseFloat(it.mva) || 0)
  return bc * (parseFloat(it.aliquota) || 0) - (parseFloat(it.icms_proprio) || 0)
}
function mpProduto() {
  const tot = parseFloat(custoCab.mp_total) || 0
  const pct =
    custoCab.percentual === '' || custoCab.percentual === undefined ? 100 : parseFloat(custoCab.percentual) || 0
  return tot > 0 ? Math.round(((tot * pct) / 100) * 100) / 100 : parseFloat(custoCab.materia_prima) || 0
}
function somaPctOutros() {
  return custosDaImp.filter((c) => c.id !== custoIdSel).reduce((s, c) => s + (parseFloat(c.percentual) || 0), 0)
}
function calcCusto() {
  custoCab.materia_prima = mpProduto()
  const despTotal = custoDespesas.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0)
  const stCusto = custoSt.reduce((s, i) => s + stRecolher(i), 0)
  const g = (k) => parseFloat(custoCab[k]) || 0
  const total =
    g('materia_prima') + g('imposto_importacao') + stCusto + g('ipi') + g('pis') + g('cofins') + g('icms') + despTotal
  const credito = g('icms') + g('ipi') + g('pis') + g('cofins')
  const custoCredito = total - credito
  const kg = g('quantidade_kg')
  return {
    mp: g('materia_prima'),
    despTotal,
    stCusto,
    total,
    credito,
    custoCredito,
    custoKg: kg > 0 ? custoCredito / kg : 0
  }
}

function cabDe(d) {
  const mpTot = d.mp_total != null && Number(d.mp_total) > 0 ? d.mp_total : (d.materia_prima ?? '')
  return {
    nfe: d.nfe || '',
    produto: d.produto || '',
    mp_total: mpTot,
    percentual: d.percentual ?? 100,
    materia_prima: d.materia_prima ?? '',
    imposto_importacao: d.imposto_importacao ?? '',
    ipi: d.ipi ?? '',
    pis: d.pis ?? '',
    cofins: d.cofins ?? '',
    icms: d.icms ?? '',
    quantidade_kg: d.quantidade_kg ?? '',
    unidade: d.unidade || 'KG',
    obs: d.obs || ''
  }
}
function impSelecionada() {
  return resumo.importacoes.find((x) => String(x.id) === String(custoImpSel))
}

function abrirProduto(c) {
  custoIdSel = c.id
  custoCab = cabDe(c)
  custoDespesas = (c.despesas || []).map((x) => ({ nome: x.nome || '', valor: x.valor ?? '' }))
  custoSt = (c.st || []).map((x) => ({
    produto: x.produto || '',
    ncm: x.ncm || '',
    base_icms: x.base_icms ?? '',
    icms_proprio: x.icms_proprio ?? '',
    aliquota: x.aliquota ?? '',
    ipi_destacado: x.ipi_destacado ?? '',
    mva: x.mva ?? ''
  }))
}
function novoProduto() {
  const imp = impSelecionada()
  const restante = Math.max(0, Math.round((100 - somaPctOutros()) * 10000) / 10000)
  custoIdSel = null
  custoCab = {
    nfe: custosDaImp[0]?.nfe || '',
    produto: '',
    mp_total: custosDaImp[0]?.mp_total || imp?.valor_reais || '',
    percentual: custosDaImp.length ? restante : 100,
    materia_prima: '',
    imposto_importacao: '',
    ipi: '',
    pis: '',
    cofins: '',
    icms: '',
    quantidade_kg: '',
    unidade: 'KG',
    obs: ''
  }
  custoDespesas = []
  custoSt = []
}

async function carregarCusto(impId, custoId) {
  custoImpSel = impId
  custoIdSel = null
  custosDaImp = []
  if (!impId) {
    custoCab = {}
    custoDespesas = []
    custoSt = []
    renderCustos()
    return
  }
  const lista = await api.fin.custosImp(impId)
  custosDaImp = Array.isArray(lista) ? lista : []
  const alvo = custosDaImp.find((c) => String(c.id) === String(custoId)) || custosDaImp[0]
  if (alvo) abrirProduto(alvo)
  else novoProduto()
  renderCustos()
}

function renderCustos() {
  const optImp = resumo.importacoes
    .map(
      (i) =>
        `<option value="${i.id}" ${String(i.id) === String(custoImpSel) ? 'selected' : ''}>${esc(i.invoice)} — ${esc(i.fornecedor_nome || '')}</option>`
    )
    .join('')
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
  const num = (k, label, prefill) =>
    `<div class="col-6 col-md-3"><label class="form-label small mb-0">${label}</label><input type="number" step="any" class="form-control form-control-sm" value="${custoCab[k] ?? ''}" oninput="custoCabInput('${k}',this.value)" ${prefill || ''}></div>`
  const despRows = custoDespesas
    .map(
      (d, i) => `<tr>
    <td><input class="form-control form-control-sm" value="${esc(d.nome)}" oninput="custoDespInput(${i},'nome',this.value)" placeholder="Ex: Frete marítimo"></td>
    <td style="width:160px"><input type="number" step="any" class="form-control form-control-sm text-end" value="${d.valor ?? ''}" oninput="custoDespInput(${i},'valor',this.value)"></td>
    <td style="width:40px"><button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="custoDelDesp(${i})">×</button></td></tr>`
    )
    .join('')
  const stRows = custoSt
    .map(
      (s, i) => `<tr>
    <td><input class="form-control form-control-sm" value="${esc(s.produto)}" oninput="custoStInput(${i},'produto',this.value)" placeholder="Produto"></td>
    <td style="width:110px"><input class="form-control form-control-sm" value="${esc(s.ncm)}" oninput="custoStInput(${i},'ncm',this.value)" placeholder="NCM"></td>
    <td style="width:120px"><input type="number" step="any" class="form-control form-control-sm text-end" value="${s.base_icms ?? ''}" oninput="custoStInput(${i},'base_icms',this.value)"></td>
    <td style="width:120px"><input type="number" step="any" class="form-control form-control-sm text-end" value="${s.icms_proprio ?? ''}" oninput="custoStInput(${i},'icms_proprio',this.value)"></td>
    <td style="width:90px"><input type="number" step="any" class="form-control form-control-sm text-end" value="${s.aliquota ?? ''}" oninput="custoStInput(${i},'aliquota',this.value)" placeholder="0.17"></td>
    <td style="width:110px"><input type="number" step="any" class="form-control form-control-sm text-end" value="${s.ipi_destacado ?? ''}" oninput="custoStInput(${i},'ipi_destacado',this.value)"></td>
    <td style="width:90px"><input type="number" step="any" class="form-control form-control-sm text-end" value="${s.mva ?? ''}" oninput="custoStInput(${i},'mva',this.value)" placeholder="1.66"></td>
    <td style="width:120px;text-align:right;font-weight:600" id="st-res-${i}">-</td>
    <td style="width:40px"><button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="custoDelSt(${i})">×</button></td></tr>`
    )
    .join('')
  const imp = impSelecionada()
  const abas = custosDaImp
    .map(
      (c) =>
        `<button class="btn btn-sm ${c.id === custoIdSel ? 'btn-primary' : 'btn-outline-primary'} me-1 mb-1" onclick="custoAbrirProduto(${c.id})">${esc(c.produto || 'Produto #' + c.id)} <span class="opacity-75">(${numf(c.percentual, 2)}%)</span></button>`
    )
    .join('')
  const novoAtivo = custoIdSel === null
  $('area-fin').innerHTML = `
    <div class="card mb-3"><div class="card-body">
      <div class="small text-muted mb-1">Produtos desta importação</div>
      <div class="d-flex flex-wrap align-items-center mb-2">${abas}
        <button class="btn btn-sm ${novoAtivo ? 'btn-success' : 'btn-outline-success'} mb-1" onclick="custoNovoProduto()">${novoAtivo ? '● Novo produto (não salvo)' : '+ Novo produto'}</button></div>
      <div class="small mb-3" id="c-soma-pct"></div>
      <div class="row g-2 align-items-end mb-2">
        <div class="col-12 col-md-6"><label class="form-label small mb-0">Importação</label>
          <select class="form-select form-select-sm" onchange="custoSelImp(this.value)"><option value="">— selecione —</option>${optImp}</select></div>
        <div class="col-12 col-md-6"><label class="form-label small mb-0">Produto</label><input class="form-control form-control-sm" value="${esc(custoCab.produto || '')}" oninput="custoCabInput('produto',this.value)" placeholder="Nome do produto importado"></div>
        <div class="col-6 col-md-4"><label class="form-label small mb-0">NF-e</label><input class="form-control form-control-sm" value="${esc(custoCab.nfe || '')}" oninput="custoCabInput('nfe',this.value)"></div>
        <div class="col-6 col-md-4"><label class="form-label small mb-0">Quantidade</label><input type="number" step="any" class="form-control form-control-sm" value="${custoCab.quantidade_kg ?? ''}" oninput="custoCabInput('quantidade_kg',this.value)"></div>
        <div class="col-6 col-md-4"><label class="form-label small mb-0">Unidade</label><select class="form-select form-select-sm" onchange="custoCabInput('unidade',this.value)"><option value="KG" ${(custoCab.unidade || 'KG') === 'KG' ? 'selected' : ''}>KG</option><option value="UN" ${custoCab.unidade === 'UN' ? 'selected' : ''}>UN</option></select></div>
      </div>
      <h6 class="secao-titulo-card mt-2 mb-2">Mercadoria</h6>
      <div class="row g-2 align-items-end">
        ${num('mp_total', 'Mercadoria total da invoice (R$)')}
        ${num('percentual', '% deste produto na invoice')}
        <div class="col-6 col-md-3"><label class="form-label small mb-0">Mercadoria deste produto (R$)</label><div class="form-control form-control-sm bg-light fw-semibold" id="c-mp-produto">${brl(mpProduto())}</div></div>
        <div class="col-12 col-md-3 small text-muted">${imp ? `Invoice: <a href="#" onclick="custoUsarMp(${Number(imp.valor_reais) || 0});return false">${brl(imp.valor_reais)}</a><br>Pago: <a href="#" onclick="custoUsarMp(${Number(imp.pago) || 0});return false">${brl(imp.pago)}</a>` : ''}</div>
      </div>
      <div class="small text-muted mt-1 mb-3">% = valor do produto na NF ÷ total dos produtos da NF. Ex.: 105.978,14 ÷ 165.450,25 = 64,0544%.</div>
      <h6 class="secao-titulo-card mt-2 mb-2">Impostos deste produto (R$)</h6>
      <div class="row g-2">
        ${num('imposto_importacao', 'Imposto Importação')}${num('ipi', 'IPI')}${num('pis', 'PIS')}
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
  if (!Array.isArray(lista) || !lista.length) {
    el.innerHTML = '<p class="text-muted fst-italic mb-0">Nenhum custo salvo ainda.</p>'
    return
  }
  el.innerHTML = `<div class="table-responsive"><table class="table table-sm table-hover mb-0" style="font-size:.85rem">
    <thead><tr><th>Invoice</th><th>Produto</th><th class="text-end">%</th><th>Fornecedor</th><th class="text-end">Custo/un.</th><th class="text-end">Total pago</th><th></th></tr></thead>
    <tbody>${lista
      .map(
        (c) => `<tr class="${c.id === custoIdSel ? 'table-primary' : ''}">
      <td class="fw-semibold">${esc(c.invoice || '-')}</td><td>${esc(c.produto || '-')}</td><td class="text-end">${numf(c.percentual ?? 100, 2)}%</td><td>${esc(c.fornecedor_nome || '-')}</td>
      <td class="text-end">${brl(c.calc ? c.calc.custoKg : 0)} <span class="text-muted">/${esc(c.unidade || 'KG')}</span></td>
      <td class="text-end">${brl(c.calc ? c.calc.total : 0)}</td>
      <td class="text-end" style="white-space:nowrap"><button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="custoSelImp('${c.importacao_id}', ${c.id})">Abrir</button>
        <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="excluirCustoSalvo('${c.importacao_id}', ${c.id})">🗑</button></td></tr>`
      )
      .join('')}</tbody></table></div>`
}

window.excluirCustoSalvo = async (impId, custoId) => {
  if (!confirm('Excluir o custo deste produto?')) return
  await api.fin.excluirCusto(impId, custoId)
  if (String(custoImpSel) === String(impId)) await carregarCusto(impId)
  else renderCustos()
}

function atualizarResumoCusto() {
  custoSt.forEach((s, i) => {
    const el = $('st-res-' + i)
    if (el) el.textContent = brl(stRecolher(s))
  })
  const c = calcCusto()
  const mpEl = $('c-mp-produto')
  if (mpEl) mpEl.textContent = brl(c.mp)
  const somaEl = $('c-soma-pct')
  if (somaEl) {
    const somaPct = somaPctOutros() + (parseFloat(custoCab.percentual) || 0)
    const ok = Math.abs(somaPct - 100) < 0.01
    somaEl.className = 'small mb-3 ' + (ok ? 'text-success' : 'text-danger fw-semibold')
    somaEl.textContent =
      `Soma dos % dos produtos desta importação: ${numf(somaPct, 2)}%` + (ok ? ' ✓' : ' — deve fechar 100%')
  }
  const el = $('c-resumo')
  if (!el) return
  const linha = (l, v, cls) =>
    `<div class="d-flex justify-content-between py-1 ${cls || ''}"><span>${l}</span><strong>${v}</strong></div>`
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

window.custoSelImp = (v, custoId) => carregarCusto(v, custoId)
window.custoAbrirProduto = (id) => {
  const c = custosDaImp.find((x) => x.id === id)
  if (c) {
    abrirProduto(c)
    renderCustos()
  }
}
window.custoNovoProduto = () => {
  novoProduto()
  renderCustos()
}
window.custoUsarMp = (v) => {
  custoCab.mp_total = v
  renderCustos()
}
window.custoCabInput = (k, v) => {
  custoCab[k] = v
  atualizarResumoCusto()
}
window.custoDespInput = (i, k, v) => {
  custoDespesas[i][k] = v
  atualizarResumoCusto()
}
window.custoStInput = (i, k, v) => {
  custoSt[i][k] = v
  atualizarResumoCusto()
}
window.custoAddDesp = () => {
  custoDespesas.push({ nome: '', valor: '' })
  renderCustos()
}
window.custoDelDesp = (i) => {
  custoDespesas.splice(i, 1)
  renderCustos()
}
window.custoAddSt = () => {
  custoSt.push({ produto: '', ncm: '', base_icms: '', icms_proprio: '', aliquota: '0.17', ipi_destacado: '', mva: '' })
  renderCustos()
}
window.custoDelSt = (i) => {
  custoSt.splice(i, 1)
  renderCustos()
}
window.salvarCusto = async () => {
  if (!custoImpSel) {
    alert('Selecione uma importação.')
    return
  }
  if (!(custoCab.produto || '').trim()) {
    alert('Informe o nome do produto.')
    return
  }
  calcCusto()
  const dados = { ...custoCab, despesas: custoDespesas, st: custoSt }
  const r = custoIdSel
    ? await api.fin.salvarCusto(custoImpSel, custoIdSel, dados)
    : await api.fin.criarCusto(custoImpSel, dados)
  if (r?.erro) {
    alert(r.erro)
    return
  }
  await carregarCusto(custoImpSel, r?.id || custoIdSel)
  const somaPct = custosDaImp.reduce((s, c) => s + (parseFloat(c.percentual) || 0), 0)
  alert(
    'Custos salvos.' +
      (Math.abs(somaPct - 100) >= 0.01
        ? `\n\nAtenção: a soma dos % desta importação está em ${numf(somaPct, 2)}%. Cadastre os outros produtos até fechar 100%.`
        : '')
  )
}

function carregarScriptFin(src) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some((s) => s.src === src)) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Falha ao carregar ' + src))
    document.head.appendChild(s)
  })
}
async function garantirLibsPdf() {
  if (!window.html2canvas)
    await carregarScriptFin('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')
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
    const pageW = 210,
      pageH = 297
    const imgW = pageW,
      imgH = (canvas.height * imgW) / canvas.width
    let heightLeft = imgH,
      position = 0
    const img = canvas.toDataURL('image/jpeg', 0.92)
    pdf.addImage(img, 'JPEG', 0, position, imgW, imgH)
    heightLeft -= pageH
    while (heightLeft > 0) {
      position -= pageH
      pdf.addPage()
      pdf.addImage(img, 'JPEG', 0, position, imgW, imgH)
      heightLeft -= pageH
    }
    pdf.save(nomeArquivo)
  } catch (e) {
    alert('Erro ao gerar PDF: ' + e.message)
  } finally {
    document.body.removeChild(cont)
  }
}

window.exportarCustoPDF = async () => {
  if (!custoImpSel) {
    alert('Selecione uma importação.')
    return
  }
  const imp = resumo.importacoes.find((x) => String(x.id) === String(custoImpSel))
  const c = calcCusto()
  const un = custoCab.unidade || 'KG'
  const CAB = '#404040',
    ZEBRA = '#f2f2f2',
    TOTAL = '#c9c9c9',
    BORDA = '1px solid #000'
  const pct = (v) =>
    c.total > 0
      ? ((v / c.total) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
      : '-'
  const th = `background:${CAB};color:#fff;font-weight:bold;border:${BORDA};padding:5px 6px;font-size:10px;text-align:center`
  const tdL = (bg) => `background:${bg};color:#000;border:${BORDA};padding:4px 6px;font-size:10px;text-align:left`
  const tdR = (bg) => `background:${bg};color:#000;border:${BORDA};padding:4px 6px;font-size:10px;text-align:right`
  const g = (k) => parseFloat(custoCab[k]) || 0
  const zeb = (i) => (i % 2 ? ZEBRA : '#fff')
  const impLinhas = [
    [`Matéria-prima (${numf(custoCab.percentual ?? 100, 4)}% de ${brl(custoCab.mp_total)})`, c.mp],
    ['Imposto Importação', g('imposto_importacao')],
    ['ST Custo', c.stCusto],
    ['IPI', g('ipi')],
    ['PIS', g('pis')],
    ['COFINS', g('cofins')],
    ['ICMS', g('icms')],
    ['Despesas', c.despTotal]
  ]
  const impRows = impLinhas
    .map(
      ([l, v], i) =>
        `<tr><td style="${tdL(zeb(i))}">${esc(l)}</td><td style="${tdR(zeb(i))}">${brl(v)}</td><td style="${tdR(zeb(i))}">${pct(v)}</td></tr>`
    )
    .join('')
  const despLista = custoDespesas.filter((d) => d.nome || '' || parseFloat(d.valor) || 0)
  const despRows = despLista.length
    ? despLista
        .map(
          (d, i) =>
            `<tr><td style="${tdL(zeb(i))}">${esc(d.nome || '-')}</td><td style="${tdR(zeb(i))}">${brl(d.valor)}</td></tr>`
        )
        .join('')
    : `<tr><td style="${tdL('#fff')}" colspan="2">—</td></tr>`
  const stLista = custoSt.filter((s) => s.produto || '' || parseFloat(s.base_icms) || 0)
  const stRows = stLista
    .map(
      (s, i) => `<tr>
    <td style="${tdL(zeb(i))}">${esc(s.produto || '-')}</td><td style="${tdL(zeb(i))}">${esc(s.ncm || '-')}</td>
    <td style="${tdR(zeb(i))}">${brl(s.base_icms)}</td><td style="${tdR(zeb(i))}">${brl(s.icms_proprio)}</td>
    <td style="${tdR(zeb(i))}">${numf(s.aliquota, 4)}</td><td style="${tdR(zeb(i))}">${brl(s.ipi_destacado)}</td><td style="${tdR(zeb(i))}">${numf(s.mva, 4)}</td>
    <td style="${tdR(zeb(i))};font-weight:bold">${brl(stRecolher(s))}</td></tr>`
    )
    .join('')
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

    ${
      stRows
        ? `<table style="width:100%;border-collapse:collapse;margin-bottom:14px">
      <thead><tr><th style="${th};text-align:left">ICMS-ST — Produto</th><th style="${th}">NCM</th><th style="${th}">Base ICMS</th><th style="${th}">ICMS Próprio</th><th style="${th}">Alíquota</th><th style="${th}">IPI Dest.</th><th style="${th}">MVA</th><th style="${th}">ST a recolher</th></tr></thead>
      <tbody>${stRows}<tr><td style="${tdL(TOTAL)};font-weight:bold" colspan="7">ST Custo (total)</td><td style="${tdR(TOTAL)};font-weight:bold">${brl(c.stCusto)}</td></tr></tbody>
    </table>`
        : ''
    }

    <table style="width:55%;border-collapse:collapse;margin-left:auto">
      <tr><td style="${tdL('#fff')}">TOTAL PAGO</td><td style="${tdR('#fff')}">${brl(c.total)}</td></tr>
      <tr><td style="${tdL('#fff')}">(−) Créditos ICMS/IPI/PIS/COFINS</td><td style="${tdR('#fff')}">${brl(c.credito)}</td></tr>
      <tr><td style="${tdL(ZEBRA)};font-weight:bold">CUSTO COM CRÉDITO</td><td style="${tdR(ZEBRA)};font-weight:bold">${brl(c.custoCredito)}</td></tr>
      <tr><td style="${tdL(TOTAL)};font-weight:bold;font-size:12px">CUSTO POR ${esc(un)}</td><td style="${tdR(TOTAL)};font-weight:bold;font-size:12px">${brl(c.custoKg)}</td></tr>
    </table>
    <div style="font-size:9px;color:#555;margin-top:14px;text-align:center">Emitido em ${new Date().toLocaleDateString('pt-BR')} · Pietrobon &amp; Cia Ltda</div>
  </div>`
  gerarPdfDeHtml(
    html,
    `Custo_${((imp?.invoice || 'importacao') + (custoCab.produto ? '_' + custoCab.produto : '')).replace(/\W+/g, '_')}.pdf`
  )
}

function montarInterface() {
  $('conteudo-fin').innerHTML = `
    <div class="fin-abas" id="abas-fin">
      <button data-aba="importacoes">Importações</button>
      <button data-aba="contratos">Contratos de câmbio</button>
      <button data-aba="custos">Custos de nacionalização</button>
    </div>
    <div id="area-fin"><p class="text-muted">Carregando...</p></div>`
  document.querySelectorAll('#abas-fin button').forEach((b) =>
    b.addEventListener('click', () => {
      aba = b.dataset.aba
      history.replaceState(null, '', aba === 'importacoes' ? location.pathname : '#' + aba)
      render()
    })
  )
}

async function iniciar() {
  if (!iniciarPagina()) return
  const hash = location.hash.replace('#', '')
  if (hash === 'contratos' || hash === 'custos') aba = hash
  if (hash === 'vencidas') filtro.situacao = 'vencidas'
  montarInterface()
  carregar()
}

iniciar()
