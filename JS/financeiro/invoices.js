import { exigirPapel } from '/JS/core/auth.js'
import { montarCabecalho } from '/JS/core/cabecalho.js'

const EMAILS_PERMITIDOS = ['export2@pietrobon.com.br', 'export@pietrobon.com.br', 'joaoantonio@pietrobon.com.br']
const $ = (id) => document.getElementById(id)
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function obterToken() {
  return sessionStorage.getItem('token') || localStorage.getItem('token_deposito')
}

async function req(metodo, rota, corpo) {
  const r = await fetch(rota, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${obterToken()}` },
    body: corpo ? JSON.stringify(corpo) : undefined
  })
  return r.json()
}

const MOEDAS = {
  'USD': { simbolo: 'US$', nome: 'Dollar USA', idioma: 'en' },
  'EUR': { simbolo: '€',   nome: 'Euro',       idioma: 'en' },
  'BRL': { simbolo: 'R$',  nome: 'Reais',      idioma: 'es' }
}

const IDIOMAS = {
  en: {
    invoice: 'COMMERCIAL INVOICE',
    packing: 'PACKING LIST',
    date: 'DATE',
    buyer: 'BUYER',
    consignee: 'CONSIGNEE',
    notify: 'NOTIFY',
    payment: 'PAYMENTS TERMS',
    bl: 'BILL OF LADING', vessel: 'VESSEL', sailing: 'SAILING DATE',
    shipping: 'SHIPPING CNY.', loading: 'PORT OF LOADING',
    discharge: 'PORT OF DISCHARGE', delivery: 'PLACE OF DELIVERY',
    currency: 'CURRENCY', marks: 'MARKS',
    qty: 'QUANTITY', item: 'ITEM', desc: 'PRODUCT DESCRIPTION',
    ncm: 'SH / NCM', unit: 'UNIT', total: 'TOTAL',
    totalCartons: 'TOTAL CARTONS', totalPacks: 'TOTAL PACKS',
    netWeight: 'NET WEIGHT', grossWeight: 'GROSS WEIGHT',
    cubic: 'CUBIC MEASUREMENT',
    freight: 'OCEAN FREIGHT', charges: 'EXPORT CHARGES',
    wooden: 'WOODEN PACKAGE: NOT APPLICABLE (NOT USED)',
    netW: 'NET WEIGHT', grossW: 'GROSS WEIGHT', m3: 'M/3'
  },
  es: {
    invoice: 'FACTURA COMERCIAL',
    packing: 'LISTA DE EMPAQUE',
    date: 'FECHA',
    buyer: 'COMPRADOR',
    consignee: 'CONSIGNEE',
    notify: 'NOTIFY',
    payment: 'TERMO DE PAGO',
    bl: 'BILL OF LADING', vessel: 'BARCO', sailing: 'FECHA SALIDA',
    shipping: 'NAVIERA', loading: 'LOCAL DE EMBARQUE',
    discharge: 'LOCAL DE DESCARGA', delivery: 'LUGAR DE ENTREGA',
    currency: 'MONEDA', marks: 'MARCA',
    qty: 'CANTIDAD', item: 'ITEM', desc: 'MERCADERIA',
    ncm: 'S H / N C M', unit: 'UNITARIO', total: 'TOTAL',
    totalCartons: 'CANTIDAD TOTAL', totalPacks: 'TOTAL BULTOS',
    netWeight: 'PESO NETO', grossWeight: 'PESO BRUTO',
    cubic: 'CUBICOS',
    freight: 'FLETE MARITIMO', charges: 'GASTOS DE EXPORTACION',
    wooden: 'EMBALAJE DE MADERA: NO APLICA (NO UTILIZADO)',
    netW: 'PESO NETO', grossW: 'PESO BRUTO', m3: 'M/3'
  }
}

let modalInvoice, modalPreview
let invoiceAtual = null
let itensTemp = []

function numf(n, casas = 2) {
  return (Number(n) || 0).toFixed(casas)
}

function formatarData(dataStr, idioma) {
  if (!dataStr) return ''
  const d = new Date(dataStr + 'T00:00:00')
  if (idioma === 'es') {
    const meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']
    return `${d.getDate().toString().padStart(2,'0')} DE ${meses[d.getMonth()]} DE ${d.getFullYear()}`
  }
  const meses = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER']
  const sufixos = ['th','st','nd','rd']
  const d2 = d.getDate()
  const suf = d2 >= 11 && d2 <= 13 ? 'th' : (sufixos[d2 % 10] || 'th')
  return `${meses[d.getMonth()]} ${d2}${suf}, ${d.getFullYear()}`
}

function calcularTotais(itens) {
  let totalQtd = 0, totalValor = 0, totalNeto = 0, totalBruto = 0, totalM3 = 0
  for (const it of itens) {
    totalQtd   += Number(it.quantidade) || 0
    totalValor += (Number(it.quantidade) || 0) * (Number(it.preco_unit) || 0)
    totalNeto  += Number(it.peso_neto) || 0
    totalBruto += Number(it.peso_bruto) || 0
    totalM3    += Number(it.m3) || 0
  }
  return { totalQtd, totalValor, totalNeto, totalBruto, totalM3 }
}

function gerarHtmlInvoice(inv, itens) {
  const m = MOEDAS[inv.moeda] || MOEDAS.USD
  const t = IDIOMAS[m.idioma]
  const data = formatarData(inv.data, m.idioma)
  const { totalQtd, totalValor, totalNeto, totalBruto, totalM3 } = calcularTotais(itens)
  const totalFrete = Number(inv.frete) || 0
  const totalCharges = Number(inv.charges) || 0
  const totalGeral = totalValor + totalFrete + totalCharges
  const unidadeItem = inv.unidade_item || 'Cartons'
  const containerInfo = inv.container ? `<tr><td colspan="9" style="padding:2px 6px;font-size:.8rem"><strong>In ${esc(inv.container)}</strong></td></tr>` : ''

  const linhasItens = itens.map(it => `
    <tr>
      <td style="padding:3px 6px;text-align:right">${esc(it.quantidade)}</td>
      <td style="padding:3px 6px">${esc(unidadeItem)}</td>
      <td style="padding:3px 6px">${esc(it.descricao)}</td>
      <td style="padding:3px 6px;text-align:center;white-space:nowrap">${esc(it.ncm)}</td>
      <td style="padding:3px 6px;text-align:right">${numf(it.preco_unit, 2)}</td>
      <td style="padding:3px 6px;text-align:right">${numf((Number(it.quantidade)||0)*(Number(it.preco_unit)||0), 2)}</td>
    </tr>`).join('')

  const bancoDados = inv.banco ? `<tr><td colspan="6" style="padding:4px 6px;font-size:.82rem">${esc(inv.banco)}</td></tr>` : ''

  return `
    <div style="font-family:'Arial',sans-serif;font-size:.82rem;max-width:900px;margin:0 auto;padding:16px">
      <table style="width:100%;border-collapse:collapse;margin-bottom:6px">
        <tr>
          <td style="font-size:1rem;font-weight:700">PIETROBON & CIA. LTDA.<br>
            <span style="font-weight:400;font-size:.8rem">RUA OSVALDO CRUZ, 126<br>TAPEJARA - RS - BRAZIL<br>CEP.: 99.950-000 - CNPJ: 97.580.260/0001-15</span>
          </td>
          <td style="text-align:right;vertical-align:top">
            <div style="font-size:1.1rem;font-weight:700">${t.invoice}</div>
            <div>${t.date}: ${data}</div>
            <div style="font-weight:700">NUMBER: ${esc(inv.numero)}</div>
          </td>
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse;border-top:2px solid #000;margin-bottom:4px">
        <tr><td style="padding:3px 0;font-weight:700;width:110px">BUYER:</td><td style="padding:3px 0;white-space:pre-line">${esc(inv.buyer)}</td></tr>
        <tr><td style="padding:3px 0;font-weight:700">${t.consignee}:</td><td style="padding:3px 0;white-space:pre-line">${esc(inv.consignee)}</td></tr>
        <tr><td style="padding:3px 0;font-weight:700">${t.notify}:</td><td style="padding:3px 0;white-space:pre-line">${esc(inv.notify || inv.consignee)}</td></tr>
        <tr><td style="padding:3px 0;font-weight:700">${t.payment}:</td><td style="padding:3px 0">${esc(inv.pagamento)}</td></tr>
        ${bancoDados}
      </table>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #000;border-bottom:1px solid #000;margin-bottom:4px">
        <tr>
          <td style="padding:3px 6px"><strong>${t.bl}:</strong></td>
          <td style="padding:3px 6px"><strong>${t.vessel}:</strong></td>
          <td style="padding:3px 6px"><strong>${t.sailing}:</strong></td>
        </tr>
        <tr>
          <td style="padding:3px 6px"><strong>${t.shipping}:</strong></td>
          <td style="padding:3px 6px"><strong>${t.loading}:</strong> ${esc(inv.porto_embarque)}</td>
          <td style="padding:3px 6px"><strong>${t.discharge}:</strong> ${esc(inv.porto_descarga)}</td>
        </tr>
        <tr>
          <td style="padding:3px 6px"><strong>${t.currency}:</strong> ${m.simbolo} - ${m.nome}</td>
          <td colspan="2" style="padding:3px 6px"><strong>${t.delivery}:</strong> ${esc(inv.local_entrega)}</td>
        </tr>
        <tr><td colspan="3" style="padding:3px 6px"><strong>${t.marks}:</strong> MADE IN BRAZIL - PIETROBON</td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse;border:1px solid #ccc">
        <thead>
          <tr style="background:#f0f0f0">
            <th style="padding:4px 6px;text-align:right;width:80px">${t.qty}</th>
            <th style="padding:4px 6px;width:70px">${t.item}</th>
            <th style="padding:4px 6px">${t.desc}</th>
            <th style="padding:4px 6px;text-align:center;width:90px">${t.ncm}</th>
            <th style="padding:4px 6px;text-align:right;width:80px">${t.unit} ${m.simbolo}</th>
            <th style="padding:4px 6px;text-align:right;width:90px">${t.total} ${m.simbolo}</th>
          </tr>
        </thead>
        <tbody>
          ${containerInfo}
          ${linhasItens}
        </tbody>
        <tfoot>
          <tr style="border-top:1px solid #ccc">
            <td style="padding:4px 6px;text-align:right;font-weight:700">${totalQtd}</td>
            <td style="padding:4px 6px;font-weight:700">${unidadeItem}</td>
            <td style="padding:4px 6px;font-weight:700">${t.totalCartons}:</td>
            <td colspan="2" style="padding:4px 6px;text-align:right;font-weight:700">${t.total} ${m.simbolo}</td>
            <td style="padding:4px 6px;text-align:right;font-weight:700">${numf(totalValor,2)}</td>
          </tr>
          <tr>
            <td colspan="4" style="padding:4px 6px;font-weight:700">${t.totalPacks}: ${totalQtd} ${unidadeItem}</td>
            <td style="padding:4px 6px;text-align:right;font-weight:700">${t.freight} ${m.simbolo}</td>
            <td style="padding:4px 6px;text-align:right">${numf(totalFrete,2)}</td>
          </tr>
          <tr>
            <td colspan="4" style="padding:4px 6px;font-weight:700">${t.netWeight}: ${numf(totalNeto,2)} KGS</td>
            <td style="padding:4px 6px;text-align:right;font-weight:700">${t.charges} ${m.simbolo}</td>
            <td style="padding:4px 6px;text-align:right">${numf(totalCharges,2)}</td>
          </tr>
          <tr>
            <td colspan="4" style="padding:4px 6px;font-weight:700">${t.grossWeight}: ${numf(totalBruto,2)} KGS</td>
            <td colspan="2" style="padding:4px 6px"></td>
          </tr>
          <tr style="border-top:1px solid #ccc">
            <td colspan="4" style="padding:4px 6px;font-weight:700">${t.cubic}: ${numf(totalM3,4)} M/3</td>
            <td style="padding:4px 6px;text-align:right;font-weight:700">TOTAL ${esc(inv.incoterm)} ${esc(inv.local_entrega)}</td>
            <td style="padding:4px 6px;text-align:right;font-weight:700">${m.simbolo} ${numf(totalGeral,2)}</td>
          </tr>
          ${inv.endereco_entrega ? `<tr><td colspan="6" style="padding:4px 6px;font-size:.8rem">${esc(inv.endereco_entrega)}</td></tr>` : ''}
        </tfoot>
      </table>
      <div style="margin-top:24px;text-align:right;font-weight:700">PIETROBON & CIA. LTDA.</div>
    </div>`
}

function gerarHtmlPacking(inv, itens) {
  const m = MOEDAS[inv.moeda] || MOEDAS.USD
  const t = IDIOMAS[m.idioma]
  const data = formatarData(inv.data, m.idioma)
  const { totalQtd, totalNeto, totalBruto, totalM3 } = calcularTotais(itens)
  const unidadeItem = inv.unidade_item || 'Cartons'
  const containerInfo = inv.container ? `<tr><td colspan="7" style="padding:2px 6px;font-size:.8rem"><strong>In ${esc(inv.container)}</strong></td></tr>` : ''

  const linhasItens = itens.map(it => `
    <tr>
      <td style="padding:3px 6px;text-align:right">${esc(it.quantidade)}</td>
      <td style="padding:3px 6px">${esc(unidadeItem)}</td>
      <td style="padding:3px 6px">${esc(it.descricao)}</td>
      <td style="padding:3px 6px;text-align:right">${numf(it.peso_neto,2)}</td>
      <td style="padding:3px 6px;text-align:right">${numf(it.peso_bruto,2)}</td>
      <td style="padding:3px 6px;text-align:right">${numf(it.m3,4)}</td>
    </tr>`).join('')

  const bancoDados = inv.buyer ? `<tr><td style="padding:3px 0;font-weight:700;width:110px">BUYER:</td><td style="padding:3px 0;white-space:pre-line">${esc(inv.buyer)}</td></tr>` : ''

  return `
    <div style="font-family:'Arial',sans-serif;font-size:.82rem;max-width:900px;margin:0 auto;padding:16px">
      <table style="width:100%;border-collapse:collapse;margin-bottom:6px">
        <tr>
          <td style="font-size:1rem;font-weight:700">PIETROBON & CIA. LTDA.<br>
            <span style="font-weight:400;font-size:.8rem">RUA OSVALDO CRUZ, 126<br>TAPEJARA - RS - BRAZIL<br>CEP.: 99.950-000 - CNPJ: 97.580.260/0001-15</span>
          </td>
          <td style="text-align:right;vertical-align:top">
            <div style="font-size:1.1rem;font-weight:700">${t.packing}</div>
            <div>${t.date}: ${data}</div>
            <div style="font-weight:700">NUMBER: ${esc(inv.numero)}</div>
          </td>
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse;border-top:2px solid #000;margin-bottom:4px">
        ${bancoDados}
        <tr><td style="padding:3px 0;font-weight:700;width:110px">${t.consignee}:</td><td style="padding:3px 0;white-space:pre-line">${esc(inv.consignee)}</td></tr>
        <tr><td style="padding:3px 0;font-weight:700">${t.notify}:</td><td style="padding:3px 0;white-space:pre-line">${esc(inv.notify || inv.consignee)}</td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #000;border-bottom:1px solid #000;margin-bottom:4px">
        <tr>
          <td style="padding:3px 6px"><strong>${t.bl}:</strong></td>
          <td style="padding:3px 6px"><strong>${t.vessel}:</strong></td>
          <td style="padding:3px 6px"><strong>${t.sailing}:</strong></td>
        </tr>
        <tr>
          <td style="padding:3px 6px"><strong>${t.shipping}:</strong></td>
          <td style="padding:3px 6px"><strong>${t.loading}:</strong> ${esc(inv.porto_embarque)}</td>
          <td style="padding:3px 6px"><strong>${t.discharge}:</strong> ${esc(inv.porto_descarga)}</td>
        </tr>
        <tr>
          <td style="padding:3px 6px"><strong>${t.currency}:</strong> ${m.simbolo} - ${m.nome}</td>
          <td colspan="2" style="padding:3px 6px"><strong>${t.delivery}:</strong> ${esc(inv.local_entrega)}</td>
        </tr>
        <tr><td colspan="3" style="padding:3px 6px"><strong>${t.marks}:</strong> MADE IN BRAZIL - PIETROBON</td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse;border:1px solid #ccc">
        <thead>
          <tr style="background:#f0f0f0">
            <th style="padding:4px 6px;text-align:right;width:80px">${t.qty}</th>
            <th style="padding:4px 6px;width:70px">${t.item}</th>
            <th style="padding:4px 6px">${t.desc}</th>
            <th style="padding:4px 6px;text-align:right;width:80px">${t.netW} KGS</th>
            <th style="padding:4px 6px;text-align:right;width:80px">${t.grossW} KGS</th>
            <th style="padding:4px 6px;text-align:right;width:60px">${t.m3}</th>
          </tr>
        </thead>
        <tbody>
          ${containerInfo}
          ${linhasItens}
        </tbody>
        <tfoot style="border-top:1px solid #ccc">
          <tr style="font-weight:700;background:#f0f0f0">
            <td style="padding:4px 6px;text-align:right">${totalQtd}</td>
            <td style="padding:4px 6px">${totalQtd}</td>
            <td style="padding:4px 6px"></td>
            <td style="padding:4px 6px;text-align:right">${numf(totalNeto,2)}</td>
            <td style="padding:4px 6px;text-align:right">${numf(totalBruto,2)}</td>
            <td style="padding:4px 6px;text-align:right">${numf(totalM3,4)}</td>
          </tr>
          <tr>
            <td colspan="3" style="padding:4px 6px;font-size:.75rem">TOTAL KGS / KGS / M/3</td>
            <td style="padding:4px 6px;text-align:right;font-weight:700">KGS</td>
            <td style="padding:4px 6px;text-align:right;font-weight:700">KGS</td>
            <td style="padding:4px 6px;text-align:right;font-weight:700">M/3</td>
          </tr>
        </tfoot>
      </table>
      <div style="margin-top:12px;font-weight:700">${t.wooden}</div>
      <div style="margin-top:24px;text-align:right;font-weight:700">PIETROBON & CIA. LTDA.</div>
    </div>`
}

function gerarFormItem(idx, it) {
  it = it || {}
  return `
    <tr id="item-row-${idx}" style="border-bottom:1px solid #eee">
      <td style="padding:4px 2px"><input type="text" class="form-control form-control-sm" placeholder="Descrição do produto" name="descricao" value="${esc(it.descricao||'')}" style="min-width:200px"></td>
      <td style="padding:4px 2px"><input type="text" class="form-control form-control-sm" placeholder="NCM" name="ncm" value="${esc(it.ncm||'')}"></td>
      <td style="padding:4px 2px"><input type="number" class="form-control form-control-sm item-qtd" placeholder="0" name="quantidade" value="${it.quantidade||''}" min="0"></td>
      <td style="padding:4px 2px"><input type="number" class="form-control form-control-sm item-preco" placeholder="0.00" name="preco_unit" value="${it.preco_unit||''}" step="0.01" min="0"></td>
      <td style="padding:4px 2px"><input type="number" class="form-control form-control-sm" placeholder="0.00" name="peso_neto" value="${it.peso_neto||''}" step="0.01" min="0"></td>
      <td style="padding:4px 2px"><input type="number" class="form-control form-control-sm" placeholder="0.00" name="peso_bruto" value="${it.peso_bruto||''}" step="0.01" min="0"></td>
      <td style="padding:4px 2px"><input type="number" class="form-control form-control-sm" placeholder="0.0000" name="m3" value="${it.m3||''}" step="0.0001" min="0"></td>
      <td style="padding:4px 2px;text-align:center"><span class="badge bg-secondary px-2 py-1" style="cursor:pointer" onclick="removerItem(${idx})">✕</span></td>
    </tr>`
}

let idxItem = 0
window.removerItem = (idx) => {
  const row = $(`item-row-${idx}`)
  if (row) row.remove()
}

function lerItens() {
  const itens = []
  document.querySelectorAll('#tabela-itens tbody tr').forEach(row => {
    const d = (n) => row.querySelector(`[name="${n}"]`)?.value || ''
    const descricao = d('descricao').trim()
    if (!descricao) return
    itens.push({
      descricao,
      ncm: d('ncm'),
      quantidade: parseFloat(d('quantidade')) || 0,
      preco_unit: parseFloat(d('preco_unit')) || 0,
      peso_neto: parseFloat(d('peso_neto')) || 0,
      peso_bruto: parseFloat(d('peso_bruto')) || 0,
      m3: parseFloat(d('m3')) || 0
    })
  })
  return itens
}

function gerarFormInvoice(inv) {
  inv = inv || {}
  idxItem = 0
  const itensHtml = (inv.itens || []).map(it => { const h = gerarFormItem(idxItem++, it); return h }).join('')

  return `
    <form id="form-invoice" class="px-1">
      <div class="row g-3 mb-3">
        <div class="col-6 col-md-3">
          <label class="form-label fw-semibold small">Número *</label>
          <input type="text" id="inv-numero" class="form-control" placeholder="289/2026" value="${esc(inv.numero||'')}" required>
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label fw-semibold small">Data *</label>
          <input type="date" id="inv-data" class="form-control" value="${esc(inv.data||'')}" required>
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label fw-semibold small">Moeda *</label>
          <select id="inv-moeda" class="form-select">
            <option value="USD" ${inv.moeda==='USD'?'selected':''}>US$ — Dólar</option>
            <option value="EUR" ${inv.moeda==='EUR'?'selected':''}>€ — Euro</option>
            <option value="BRL" ${inv.moeda==='BRL'?'selected':''}>R$ — Reais</option>
          </select>
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label fw-semibold small">Tipo de produto</label>
          <select id="inv-tipo" class="form-select">
            <option value="alimentos" ${(!inv.tipo||inv.tipo==='alimentos')?'selected':''}>🔴 Alimentos</option>
            <option value="tubos" ${inv.tipo==='tubos'?'selected':''}>🔵 Tubos e Mangueiras</option>
          </select>
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label fw-semibold small">Unidade dos itens</label>
          <input type="text" id="inv-unidade-item" class="form-control" placeholder="Cartons / Und" value="${esc(inv.unidade_item||'Cartons')}">
        </div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-12">
          <label class="form-label fw-semibold small">Buyer (nome, EIN/doc, endereço) *</label>
          <textarea id="inv-buyer" class="form-control" rows="3" placeholder="PIETROBON LLC&#10;EIN: 32-0806574&#10;201 S. BISCAYNE BLVD., SUITE 1200&#10;MIAMI, FLORIDA 33131">${esc(inv.buyer||'')}</textarea>
        </div>
        <div class="col-12 col-md-6">
          <label class="form-label fw-semibold small">Consignee</label>
          <textarea id="inv-consignee" class="form-control" rows="3" placeholder="Mesmo do buyer ou diferente">${esc(inv.consignee||'')}</textarea>
        </div>
        <div class="col-12 col-md-6">
          <label class="form-label fw-semibold small">Notify</label>
          <textarea id="inv-notify" class="form-control" rows="3" placeholder="Deixe em branco para usar o mesmo do Consignee">${esc(inv.notify||'')}</textarea>
        </div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-12 col-md-6">
          <label class="form-label fw-semibold small">Condições de pagamento</label>
          <input type="text" id="inv-pagamento" class="form-control" placeholder="100% T/T IN ADVANCE" value="${esc(inv.pagamento||'100% T/T IN ADVANCE')}">
        </div>
        <div class="col-12 col-md-6">
          <label class="form-label fw-semibold small">Incoterm</label>
          <input type="text" id="inv-incoterm" class="form-control" placeholder="FCA / DAP / FOB" value="${esc(inv.incoterm||'')}">
        </div>
        <div class="col-12">
          <label class="form-label fw-semibold small">Instruções bancárias</label>
          <textarea id="inv-banco" class="form-control" rows="2" placeholder="BANCO DO BRASIL S.A. SWIFT: BRASBRRJCTA ...">${esc(inv.banco||'')}</textarea>
        </div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-12 col-md-4">
          <label class="form-label fw-semibold small">Porto de embarque</label>
          <input type="text" id="inv-porto-embarque" class="form-control" placeholder="TAPEJARA - RS - BRASIL" value="${esc(inv.porto_embarque||'')}">
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label fw-semibold small">Porto de descarga</label>
          <input type="text" id="inv-porto-descarga" class="form-control" placeholder="MIAMI PORT USA" value="${esc(inv.porto_descarga||'')}">
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label fw-semibold small">Local de entrega</label>
          <input type="text" id="inv-local-entrega" class="form-control" placeholder="MIAMI, FL" value="${esc(inv.local_entrega||'')}">
        </div>
        <div class="col-12 col-md-6">
          <label class="form-label fw-semibold small">Container (opcional)</label>
          <input type="text" id="inv-container" class="form-control" placeholder="01 Container 40' HC." value="${esc(inv.container||'')}">
        </div>
        <div class="col-12 col-md-6">
          <label class="form-label fw-semibold small">Endereço no rodapé (opcional)</label>
          <input type="text" id="inv-endereco-entrega" class="form-control" placeholder="10201 NW 112th Ave - Suite 1 - Miami, FL 33178" value="${esc(inv.endereco_entrega||'')}">
        </div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-6 col-md-3">
          <label class="form-label fw-semibold small">Frete (opcional)</label>
          <input type="number" id="inv-frete" class="form-control" placeholder="0.00" value="${inv.frete||''}" step="0.01" min="0">
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label fw-semibold small">Export Charges (opcional)</label>
          <input type="number" id="inv-charges" class="form-control" placeholder="0.00" value="${inv.charges||''}" step="0.01" min="0">
        </div>
      </div>

      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="fw-bold mb-0">Itens da Invoice</h6>
        <button type="button" class="btn btn-sm btn-outline-danger" onclick="adicionarItem()">+ Adicionar item</button>
      </div>
      <div class="table-responsive mb-3">
        <table class="table table-sm mb-0" id="tabela-itens" style="font-size:.82rem;min-width:800px">
          <thead style="background:#f8f9fa">
            <tr>
              <th>Descrição</th>
              <th style="width:90px">NCM</th>
              <th style="width:70px">Qtd</th>
              <th style="width:80px">Preço Unit.</th>
              <th style="width:80px">Peso Neto</th>
              <th style="width:80px">Peso Bruto</th>
              <th style="width:70px">M³</th>
              <th style="width:40px"></th>
            </tr>
          </thead>
          <tbody>${itensHtml}</tbody>
        </table>
      </div>

      <div class="d-flex gap-2 flex-wrap">
        <button type="submit" class="btn btn-pietrobon">💾 Salvar</button>
        <button type="button" class="btn btn-outline-secondary" onclick="previsualizar('invoice')">👁 Invoice</button>
        <button type="button" class="btn btn-outline-secondary" onclick="previsualizar('packing')">📦 Packing List</button>
        <button type="button" class="btn btn-outline-secondary" onclick="previsualizar('ambos')">📄 Invoice + Packing</button>
      </div>
    </form>`
}

window.adicionarItem = () => {
  const tbody = document.querySelector('#tabela-itens tbody')
  if (!tbody) return
  const tr = document.createElement('tr')
  tr.id = `item-row-${idxItem}`
  tr.style.borderBottom = '1px solid #eee'
  tr.innerHTML = gerarFormItem(idxItem++).replace(/^<tr[^>]*>/, '').replace(/<\/tr>$/, '')
  tbody.appendChild(tr)
}

function lerFormInvoice() {
  const g = (id) => $(id)?.value?.trim() || ''
  return {
    tipo: g('inv-tipo') || 'alimentos',
    numero: g('inv-numero'),
    data: g('inv-data'),
    moeda: g('inv-moeda'),
    unidade_item: g('inv-unidade-item') || 'Cartons',
    buyer: g('inv-buyer'),
    consignee: g('inv-consignee'),
    notify: g('inv-notify'),
    pagamento: g('inv-pagamento'),
    incoterm: g('inv-incoterm'),
    banco: g('inv-banco'),
    porto_embarque: g('inv-porto-embarque'),
    porto_descarga: g('inv-porto-descarga'),
    local_entrega: g('inv-local-entrega'),
    container: g('inv-container'),
    endereco_entrega: g('inv-endereco-entrega'),
    frete: parseFloat($('inv-frete')?.value) || 0,
    charges: parseFloat($('inv-charges')?.value) || 0,
    itens: lerItens()
  }
}

window.previsualizar = (tipo) => {
  const inv = lerFormInvoice()
  const itens = inv.itens

  let html = ''
  if (tipo === 'invoice' || tipo === 'ambos') html += gerarHtmlInvoice(inv, itens)
  if (tipo === 'ambos') html += '<div style="page-break-before:always;border-top:3px solid #ccc;margin:32px 0"></div>'
  if (tipo === 'packing' || tipo === 'ambos') html += gerarHtmlPacking(inv, itens)

  const titulos = { invoice: 'Invoice Comercial', packing: 'Packing List', ambos: 'Invoice + Packing List' }
  $('modal-preview-titulo').textContent = `${titulos[tipo]} — ${inv.numero || ''}`
  $('modal-preview-corpo').innerHTML = `<div style="background:#fff;padding:16px">${html}</div>`
  modalPreview.show()
}

async function salvarInvoice(dados) {
  const metodo = dados.id ? 'PUT' : 'POST'
  const rota = dados.id ? `/api/invoices/${dados.id}` : '/api/invoices'
  return req(metodo, rota, dados)
}

async function carregarLista() {
  const lista = await req('GET', '/api/invoices')
  const container = $('conteudo-invoices')
  if (!Array.isArray(lista) || !lista.length) {
    container.innerHTML = `
      <div class="d-flex justify-content-end mb-3">
        <button class="btn btn-pietrobon" onclick="abrirNovaInvoice()">➕ Nova Invoice</button>
      </div>
      <p class="text-muted fst-italic">Nenhuma invoice cadastrada ainda.</p>`
    return
  }

  const linhas = lista.map(inv => `
    <div class="card mb-2">
      <div class="card-body d-flex justify-content-between align-items-center flex-wrap gap-2 py-2">
        <div>
          <span class="fw-bold">${esc(inv.numero)}</span>
          <span class="badge bg-secondary ms-2">${esc(inv.moeda)}</span>
          <span class="text-muted small ms-2">${esc(inv.consignee?.split('\n')[0] || '')}</span>
          <div class="text-muted small">${esc(inv.data || '')}</div>
        </div>
        <div class="d-flex gap-2 flex-wrap">
          <button class="btn btn-sm btn-outline-secondary" onclick="editarInvoice(${inv.id})">✎ Editar</button>
          <button class="btn btn-sm btn-outline-primary" onclick="verInvoice(${inv.id}, 'invoice')">Invoice</button>
          <button class="btn btn-sm btn-outline-primary" onclick="verInvoice(${inv.id}, 'packing')">Packing</button>
          <button class="btn btn-sm btn-outline-primary" onclick="verInvoice(${inv.id}, 'ambos')">Ambos</button>
          <button class="btn btn-sm btn-outline-success" onclick="baixarExcel(${inv.id})">📊 Excel</button>
          <button class="btn btn-sm btn-outline-danger" onclick="excluirInvoice(${inv.id})">🗑</button>
        </div>
      </div>
    </div>`).join('')

  container.innerHTML = `
    <div class="d-flex justify-content-end mb-3">
      <button class="btn btn-pietrobon" onclick="abrirNovaInvoice()">➕ Nova Invoice</button>
    </div>
    ${linhas}`
}


window.baixarExcel = async (id) => {
  const token = obterToken()
  const btn = document.querySelector(`[onclick="baixarExcel(${id})"]`)
  if (btn) { btn.disabled = true; btn.textContent = '⏳' }
  try {
    const resposta = await fetch(`/api/invoices/${id}/excel`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!resposta.ok) { alert('Erro ao gerar o Excel.'); return }
    const blob = await resposta.blob()
    const nome = resposta.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || `Invoice_${id}.xlsx`
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = nome
    link.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    alert('Erro ao baixar o Excel: ' + e.message)
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📊 Excel' }
  }
}

window.abrirNovaInvoice = () => {
  invoiceAtual = null
  idxItem = 0
  $('modal-invoice-titulo').textContent = 'Nova Invoice'
  $('modal-invoice-corpo').innerHTML = gerarFormInvoice(null)
  $('form-invoice').addEventListener('submit', async (e) => {
    e.preventDefault()
    const dados = lerFormInvoice()
    if (invoiceAtual) dados.id = invoiceAtual
    const r = await salvarInvoice(dados)
    if (r?.erro) { alert(r.erro); return }
    modalInvoice.hide()
    carregarLista()
  })
  modalInvoice.show()
}

window.editarInvoice = async (id) => {
  const inv = await req('GET', `/api/invoices/${id}`)
  if (inv?.erro) { alert(inv.erro); return }
  invoiceAtual = id
  idxItem = 0
  $('modal-invoice-titulo').textContent = `Editar Invoice ${inv.numero}`
  $('modal-invoice-corpo').innerHTML = gerarFormInvoice(inv)
  $('form-invoice').addEventListener('submit', async (e) => {
    e.preventDefault()
    const dados = lerFormInvoice()
    dados.id = id
    const r = await salvarInvoice(dados)
    if (r?.erro) { alert(r.erro); return }
    modalInvoice.hide()
    carregarLista()
  })
  modalInvoice.show()
}

window.verInvoice = async (id, tipo) => {
  const inv = await req('GET', `/api/invoices/${id}`)
  if (inv?.erro) { alert(inv.erro); return }
  const itens = inv.itens || []
  let html = ''
  if (tipo === 'invoice' || tipo === 'ambos') html += gerarHtmlInvoice(inv, itens)
  if (tipo === 'ambos') html += '<div style="page-break-before:always;border-top:3px solid #ccc;margin:32px 0"></div>'
  if (tipo === 'packing' || tipo === 'ambos') html += gerarHtmlPacking(inv, itens)
  const titulos = { invoice: 'Invoice Comercial', packing: 'Packing List', ambos: 'Invoice + Packing List' }
  $('modal-preview-titulo').textContent = `${titulos[tipo]} — ${inv.numero}`
  $('modal-preview-corpo').innerHTML = `<div style="background:#fff;padding:16px">${html}</div>`
  modalPreview.show()
}

window.excluirInvoice = async (id) => {
  if (!confirm('Deseja excluir esta invoice?')) return
  await req('DELETE', `/api/invoices/${id}`)
  carregarLista()
}

async function iniciar() {
  const perfil = exigirPapel(['admin'])
  if (!perfil) return
  if (!EMAILS_PERMITIDOS.includes((perfil.email || '').toLowerCase())) {
    window.location.href = '/HTML/producao/admin.html'
    return
  }
  montarCabecalho(perfil.papel)
  modalInvoice = new bootstrap.Modal($('modal-invoice'))
  modalPreview = new bootstrap.Modal($('modal-preview'))
  carregarLista()
}

iniciar()