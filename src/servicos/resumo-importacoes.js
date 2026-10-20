const { banco } = require('../config/banco')
const { enviarEmailPara, podeEnviarHoje } = require('./notificacoes')

function statusImportacao(valorReais, pago) {
  if (pago >= valorReais - 0.01) return 'PAGO'
  if (pago > 0.01) return 'PARCIAL'
  return 'DEVENDO'
}

async function importacoesComputadas() {
  const [imps] = await banco.query(`
    SELECT i.*, f.nome AS fornecedor_nome, f.pais AS fornecedor_pais
    FROM fin_importacoes i LEFT JOIN fin_fornecedores f ON f.id = i.fornecedor_id
    ORDER BY i.data_invoice DESC, i.id DESC`)
  const [pgs] = await banco.query(
    'SELECT importacao_id, COALESCE(SUM(valor_reais),0) AS pago, COALESCE(SUM(valor_moeda),0) AS pago_moeda FROM fin_pagamentos GROUP BY importacao_id'
  )
  const mapa = {}
  pgs.forEach((p) => {
    mapa[p.importacao_id] = { pago: Number(p.pago) || 0, pago_moeda: Number(p.pago_moeda) || 0 }
  })
  return imps.map((i) => {
    const vr = Number(i.valor_reais) || 0
    const pago = mapa[i.id] ? mapa[i.id].pago : 0
    const pagoMoeda = mapa[i.id] ? mapa[i.id].pago_moeda : 0
    const valorMoeda = Number(i.valor_moeda) || 0
    return { ...i, pago, saldo: vr - pago, saldo_moeda: valorMoeda - pagoMoeda, status: statusImportacao(vr, pago) }
  })
}

const EMAILS_RESUMO_IMPORTACAO = ['joaoantonio@pietrobon.com.br', 'export2@pietrobon.com.br']

function formatarReais(n) {
  return 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatarNumero(n) {
  return (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function escaparHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

async function montarCorpoResumoImportacao() {
  const imps = await importacoesComputadas()
  imps.forEach((i) => {
    i._vm = Number(i.valor_moeda) || 0
    const smRegistrado = Number(i.saldo_moeda) || 0
    const pmRegistrado = i._vm - smRegistrado
    const taxa = Number(i.taxa_cambio) || 0
    i._pm = pmRegistrado > 0.01 ? pmRegistrado : taxa > 0 ? i.pago / taxa : 0
    if (i._pm > i._vm) i._pm = i._vm
    i._sm = i._vm - i._pm
  })
  const totImp = imps.reduce((s, i) => s + (Number(i.valor_reais) || 0), 0)
  const totPago = imps.reduce((s, i) => s + i.pago, 0)
  const totImpM = imps.reduce((s, i) => s + i._vm, 0)
  const totPagoM = imps.reduce((s, i) => s + i._pm, 0)
  const grupos = {}
  imps.forEach((i) => {
    const k = i.fornecedor_nome || '—'
    if (!grupos[k]) grupos[k] = []
    grupos[k].push(i)
  })
  const corStatus = { PAGO: '#1a7f37', PARCIAL: '#b7791f', DEVENDO: '#c0392b' }
  const nomes = Object.keys(grupos).sort((a, b) => a.localeCompare(b))
  let linhas = ''
  for (const forn of nomes) {
    const lista = grupos[forn]
    const sImp = lista.reduce((s, i) => s + (Number(i.valor_reais) || 0), 0)
    const sPago = lista.reduce((s, i) => s + i.pago, 0)
    const sImpM = lista.reduce((s, i) => s + i._vm, 0)
    const sPagoM = lista.reduce((s, i) => s + i._pm, 0)
    linhas += `<tr style="background:#1f2d50;color:#fff"><td colspan="8" style="padding:6px 8px;font-weight:bold">${escaparHtml(forn)}</td></tr>`
    lista.forEach((i) => {
      const moeda = escaparHtml(i.moeda || 'USD')
      linhas += `<tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:5px 8px">${escaparHtml(i.invoice || '-')}</td>
        <td style="padding:5px 8px">${escaparHtml(i.mercadoria || '-')}</td>
        <td style="padding:5px 8px;text-align:right">${moeda} ${formatarNumero(i._vm)}</td>
        <td style="padding:5px 8px;text-align:right">${moeda} ${formatarNumero(i._pm)}</td>
        <td style="padding:5px 8px;text-align:right;color:${i._sm > 0.01 ? '#c0392b' : '#1a7f37'}">${moeda} ${formatarNumero(i._sm)}</td>
        <td style="padding:5px 8px;text-align:right">${formatarReais(i.valor_reais)}</td>
        <td style="padding:5px 8px;text-align:right">${formatarReais(i.pago)}</td>
        <td style="padding:5px 8px;text-align:right;color:${i.saldo > 0.01 ? '#c0392b' : '#1a7f37'}">${formatarReais(i.saldo)} <span style="color:${corStatus[i.status] || '#555'};font-size:.72rem">(${i.status})</span></td>
      </tr>`
    })
    linhas += `<tr style="background:#eef1f5;font-weight:bold"><td colspan="2" style="padding:5px 8px;text-align:right">Subtotal ${escaparHtml(forn)}</td>
      <td style="padding:5px 8px;text-align:right">${formatarNumero(sImpM)}</td><td style="padding:5px 8px;text-align:right">${formatarNumero(sPagoM)}</td><td style="padding:5px 8px;text-align:right">${formatarNumero(sImpM - sPagoM)}</td>
      <td style="padding:5px 8px;text-align:right">${formatarReais(sImp)}</td><td style="padding:5px 8px;text-align:right">${formatarReais(sPago)}</td><td style="padding:5px 8px;text-align:right">${formatarReais(sImp - sPago)}</td></tr>`
  }
  return `
  <h2 style="color:#1f2d50;margin:0 0 4px">Resumo Semanal de Importação</h2>
  <p style="color:#555;margin:0 0 16px">${new Date().toLocaleDateString('pt-BR')} · ${imps.length} importações</p>
  <table style="width:100%;border-collapse:collapse;font-size:.8rem">
    <thead><tr style="background:#c0392b;color:#fff">
      <th style="padding:6px 8px;text-align:left">Invoice</th><th style="padding:6px 8px;text-align:left">Mercadoria</th>
      <th style="padding:6px 8px;text-align:right">Valor USD</th><th style="padding:6px 8px;text-align:right">Pago USD</th><th style="padding:6px 8px;text-align:right">Saldo USD</th>
      <th style="padding:6px 8px;text-align:right">Valor R$</th><th style="padding:6px 8px;text-align:right">Pago R$</th><th style="padding:6px 8px;text-align:right">Saldo R$</th>
    </tr></thead>
    <tbody>${linhas}</tbody>
    <tfoot><tr style="background:#1f2d50;color:#fff;font-weight:bold">
      <td colspan="2" style="padding:7px 8px;text-align:right">TOTAL GERAL</td>
      <td style="padding:7px 8px;text-align:right">${formatarNumero(totImpM)}</td><td style="padding:7px 8px;text-align:right">${formatarNumero(totPagoM)}</td><td style="padding:7px 8px;text-align:right">${formatarNumero(totImpM - totPagoM)}</td>
      <td style="padding:7px 8px;text-align:right">${formatarReais(totImp)}</td><td style="padding:7px 8px;text-align:right">${formatarReais(totPago)}</td><td style="padding:7px 8px;text-align:right">${formatarReais(totImp - totPago)}</td>
    </tr></tfoot>
  </table>
  <p style="color:#8a6a6a;font-size:.72rem;margin:10px 0 0">Pago/Saldo em USD estimado pela taxa da invoice quando o pagamento foi lançado em R$.</p>`
}

async function enviarResumoSemanalImportacao(forcar = false) {
  try {
    if (!forcar) {
      if (new Date().getDay() !== 1) return
      if (!(await podeEnviarHoje('resumo_semanal_import'))) return
    }
    const corpo = await montarCorpoResumoImportacao()
    await enviarEmailPara('Resumo Semanal de Importação', corpo, EMAILS_RESUMO_IMPORTACAO)
  } catch (e) {
    console.error('Erro resumo semanal import:', e.message)
  }
}

setTimeout(() => enviarResumoSemanalImportacao(false), 200 * 1000)

setInterval(() => enviarResumoSemanalImportacao(false), 24 * 60 * 60 * 1000)

module.exports = { enviarResumoSemanalImportacao, importacoesComputadas }
