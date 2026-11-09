const { enviarEmailPara, podeEnviarHoje } = require('./notificacoes')
const { importacoesComputadas } = require('./financeiro')
const { USUARIOS_PERMITIDOS } = require('../middlewares/autenticacao')

const EMAILS_RESUMO_IMPORTACAO = ['joaoantonio@pietrobon.com.br', 'export2@pietrobon.com.br'].filter((e) =>
  USUARIOS_PERMITIDOS.includes(e)
)

const ROTULO_STATUS = {
  EM_ABERTO: ['Em aberto', '#2563eb'],
  PARCIAL: ['Parcial', '#b7791f'],
  QUITADA: ['Quitada', '#1a7f37'],
  PAGO_A_MAIOR: ['Pago a maior', '#7c3aed']
}

function formatarReais(n) {
  return 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatarNumero(n) {
  return (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatarData(iso) {
  return iso ? iso.split('-').reverse().join('/') : '-'
}

function escaparHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function seloSituacao(i) {
  if (i.prazo === 'VENCIDA')
    return `<span style="color:#c0392b;font-weight:bold">Vencida há ${Math.abs(i.dias_para_vencer)} dia(s)</span>`
  if (i.prazo === 'VENCE_EM_BREVE')
    return `<span style="color:#b7791f;font-weight:bold">Vence em ${i.dias_para_vencer} dia(s)</span>`
  const [rotulo, cor] = ROTULO_STATUS[i.status] || [i.status, '#555']
  return `<span style="color:${cor};font-weight:bold">${rotulo}</span>`
}

async function montarCorpoResumoImportacao() {
  const imps = (await importacoesComputadas()).filter((i) => i.status === 'EM_ABERTO' || i.status === 'PARCIAL')
  imps.sort((a, b) => (a.data_vencimento || '9999').localeCompare(b.data_vencimento || '9999'))
  const totais = {}
  imps.forEach((i) => {
    const m = i.moeda || 'USD'
    totais[m] = (totais[m] || 0) + Math.max(i.saldo_moeda, 0)
  })
  const vencidas = imps.filter((i) => i.prazo === 'VENCIDA').length
  const linhas = imps
    .map(
      (i) => `<tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:5px 8px">${escaparHtml(i.invoice || '-')}</td>
        <td style="padding:5px 8px">${escaparHtml(i.fornecedor_nome || '-')}</td>
        <td style="padding:5px 8px">${formatarData(i.data_vencimento)}</td>
        <td style="padding:5px 8px;text-align:right">${escaparHtml(i.moeda)} ${formatarNumero(i.valor_moeda)}</td>
        <td style="padding:5px 8px;text-align:right">${escaparHtml(i.moeda)} ${formatarNumero(i.pago_moeda)}</td>
        <td style="padding:5px 8px;text-align:right;font-weight:bold">${escaparHtml(i.moeda)} ${formatarNumero(i.saldo_moeda)}</td>
        <td style="padding:5px 8px;text-align:right">${formatarReais(i.saldo)}</td>
        <td style="padding:5px 8px">${seloSituacao(i)}</td>
      </tr>`
    )
    .join('')
  const resumoTotais = Object.entries(totais)
    .map(([m, v]) => `${escaparHtml(m)} ${formatarNumero(v)}`)
    .join(' · ')
  return `
  <h2 style="color:#1f2d50;margin:0 0 4px">Resumo Semanal de Importação</h2>
  <p style="color:#555;margin:0 0 6px">${new Date().toLocaleDateString('pt-BR')} · ${imps.length} importação(ões) em aberto${vencidas ? ` · <strong style="color:#c0392b">${vencidas} vencida(s)</strong>` : ''}</p>
  <p style="margin:0 0 16px"><strong>Saldo a pagar:</strong> ${resumoTotais || '—'}</p>
  ${
    imps.length
      ? `<table style="width:100%;border-collapse:collapse;font-size:.8rem">
    <thead><tr style="background:#1f2d50;color:#fff">
      <th style="padding:6px 8px;text-align:left">Invoice</th><th style="padding:6px 8px;text-align:left">Fornecedor</th><th style="padding:6px 8px;text-align:left">Vencimento</th>
      <th style="padding:6px 8px;text-align:right">Valor</th><th style="padding:6px 8px;text-align:right">Pago</th><th style="padding:6px 8px;text-align:right">Saldo</th>
      <th style="padding:6px 8px;text-align:right">Saldo R$ (taxa da invoice)</th><th style="padding:6px 8px;text-align:left">Situação</th>
    </tr></thead>
    <tbody>${linhas}</tbody>
  </table>`
      : '<p>Nenhuma importação em aberto.</p>'
  }`
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

module.exports = { enviarResumoSemanalImportacao }
