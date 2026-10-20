const { banco } = require('../config/banco')
const { enviarEmail, enviarPush, podeEnviarHoje } = require('../servicos/notificacoes')

async function verificarAlertasEmbarque() {
  try {
    const [pis] = await banco.query(
      `SELECT id, numero_pi, cliente, destino, data_embarque
 FROM pedidos
 WHERE concluida = 0 AND data_embarque IS NOT NULL
 AND data_embarque <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
 ORDER BY data_embarque ASC`
    )

    const alertas = []
    for (const pi of pis) {
      const [[tot]] = await banco.query('SELECT COUNT(*) as total FROM produtos_pi WHERE pi_id = ?', [pi.id])
      const [[pend]] = await banco.query(
        `SELECT COUNT(*) as pendentes
 FROM produtos_pi pp
 JOIN insumos_produto ip ON ip.produto_id = pp.id
 WHERE pp.pi_id = ? AND ip.confirmado = 0`,
        [pi.id]
      )
      const pronta = tot.total > 0 && pend.pendentes === 0
      if (!pronta) alertas.push(pi)
    }

    if (!alertas.length) return
    if (!(await podeEnviarHoje('alertas_embarque'))) return

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const linhas = alertas
      .map((pi) => {
        const alvo = new Date(String(pi.data_embarque).slice(0, 10) + 'T00:00:00')
        const dias = Math.round((alvo - hoje) / 86400000)
        const quando = dias < 0 ? `VENCIDO há ${Math.abs(dias)} dia(s)` : dias === 0 ? 'HOJE' : `em ${dias} dia(s)`
        const dataFmt = alvo.toLocaleDateString('pt-BR')
        return `<tr><td style="padding:8px 10px;border-bottom:1px solid #f0d0d0;font-weight:700">PI ${pi.numero_pi}</td><td style="padding:8px 10px;border-bottom:1px solid #f0d0d0">${pi.cliente || '—'}</td><td style="padding:8px 10px;border-bottom:1px solid #f0d0d0;color:#ED3237;font-weight:700">${dataFmt} (${quando})</td></tr>`
      })
      .join('')

    enviarPush(
      `⚠️ ${alertas.length} PI(s) em risco de embarque`,
      alertas.map((p) => `PI ${p.numero_pi}`).join(', '),
      '/HTML/estoque/embarques.html',
      'alertas_embarque'
    ).catch(() => {})
    enviarEmail(
      `ALERTA: ${alertas.length} PI(s) perto do embarque e SEM estar pronta`,
      `<h2 style="color:#ED3237;margin:0 0 16px">PIs em Risco de Embarque</h2><p style="margin:0 0 12px;color:#8a6a6a">As PIs abaixo têm embarque em até 7 dias (ou já vencido) e ainda possuem itens pendentes no almoxarifado:</p><table style="width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:left;padding:8px 10px;border-bottom:2px solid #ED3237">PI</th><th style="text-align:left;padding:8px 10px;border-bottom:2px solid #ED3237">Cliente</th><th style="text-align:left;padding:8px 10px;border-bottom:2px solid #ED3237">Embarque</th></tr></thead><tbody>${linhas}</tbody></table>`,
      ['admin', 'gerente_producao']
    )
    console.log(`Alerta de embarque enviado: ${alertas.length} PI(s)`)
  } catch (e) {
    console.error('Erro no alerta de embarque:', e.message)
  }
}

setTimeout(verificarAlertasEmbarque, 60 * 1000)

setInterval(verificarAlertasEmbarque, 24 * 60 * 60 * 1000)

const SQL_DECLARACAO_PENDENTE = `
 SELECT pp.id as produto_id, pp.produto, pp.criado_em,
 p.id as pi_id, p.numero_pi, p.cliente
 FROM produtos_pi pp
 JOIN pedidos p ON p.id = pp.pi_id
 WHERE p.concluida = 0 AND pp.declarado_em IS NULL
 AND pp.criado_em <= DATE_SUB(NOW(), INTERVAL 48 HOUR)
 AND NOT EXISTS (SELECT 1 FROM insumos_produto ip WHERE ip.produto_id = pp.id AND ip.sobra > 0)
 ORDER BY pp.criado_em ASC`

async function verificarAlertasDeclaracao() {
  try {
    const [rows] = await banco.query(SQL_DECLARACAO_PENDENTE)
    if (!rows.length) return
    if (!(await podeEnviarHoje('declaracao_pendente'))) return

    const linhas = rows
      .map((r) => {
        const horas = Math.floor((Date.now() - new Date(r.criado_em).getTime()) / 3600000)
        return `<tr><td style="padding:8px 10px;border-bottom:1px solid #f0d0d0;font-weight:700">PI ${r.numero_pi}</td><td style="padding:8px 10px;border-bottom:1px solid #f0d0d0">${r.cliente || '—'}</td><td style="padding:8px 10px;border-bottom:1px solid #f0d0d0">${r.produto}</td><td style="padding:8px 10px;border-bottom:1px solid #f0d0d0;color:#E65100;font-weight:700">há ${horas}h sem declarar</td></tr>`
      })
      .join('')

    const maxHoras = Math.max(...rows.map((r) => Math.floor((Date.now() - new Date(r.criado_em).getTime()) / 3600000)))
    const urgente = maxHoras >= 96

    enviarPush(
      `${urgente ? '🚨 URGENTE' : '⚠️ Atenção'} — Estoque não declarado`,
      `${rows.length} produto(s) sem declaração no almoxarifado.`,
      '/HTML/estoque/almoxarifado.html',
      'declaracao_pendente'
    ).catch(() => {})
    enviarEmail(
      `${urgente ? 'URGENTE — ' : ''}${rows.length} produto(s) sem estoque declarado (Almoxarifado)`,
      `<h2 style="color:#E65100;margin:0 0 16px">${urgente ? 'URGENTE — ' : ''}Estoque não declarado pelo Almoxarifado</h2><p style="margin:0 0 12px;color:#8a6a6a">Os produtos abaixo foram cadastrados há mais de 48h e ainda não tiveram o informe de estoque salvo no almoxarifado:</p><table style="width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:left;padding:8px 10px;border-bottom:2px solid #E65100">PI</th><th style="text-align:left;padding:8px 10px;border-bottom:2px solid #E65100">Cliente</th><th style="text-align:left;padding:8px 10px;border-bottom:2px solid #E65100">Produto</th><th style="text-align:left;padding:8px 10px;border-bottom:2px solid #E65100">Situação</th></tr></thead><tbody>${linhas}</tbody></table>`,
      ['admin', 'almoxarifado']
    )
    console.log(`Alerta de declaração enviado: ${rows.length} produto(s)`)
  } catch (e) {
    console.error('Erro no alerta de declaração:', e.message)
  }
}

setTimeout(verificarAlertasDeclaracao, 90 * 1000)

setInterval(verificarAlertasDeclaracao, 24 * 60 * 60 * 1000)

async function verificarComprasAtrasadas() {
  try {
    const [rows] = await banco.query(`
 SELECT c.*, p.numero_pi FROM compras c
 LEFT JOIN pedidos p ON p.id = c.pi_id
 WHERE c.status <> 'recebido' AND c.data_prevista IS NOT NULL AND c.data_prevista < CURDATE()
 ORDER BY c.data_prevista ASC`)
    if (!rows.length) return
    if (!(await podeEnviarHoje('compras_atrasadas'))) return

    const linhas = rows
      .map((c) => {
        const prev = new Date(String(c.data_prevista).slice(0, 10) + 'T00:00:00')
        const dias = Math.floor((Date.now() - prev.getTime()) / 86400000)
        return `<tr><td style="padding:8px 10px;border-bottom:1px solid #f0d0d0;font-weight:700">${c.descricao}</td><td style="padding:8px 10px;border-bottom:1px solid #f0d0d0">${c.fornecedor || '—'}</td><td style="padding:8px 10px;border-bottom:1px solid #f0d0d0">${c.numero_pi ? 'PI ' + c.numero_pi : 'Estoque geral'}</td><td style="padding:8px 10px;border-bottom:1px solid #f0d0d0;color:#ED3237;font-weight:700">atrasada ${dias} dia(s)</td></tr>`
      })
      .join('')

    enviarPush(
      `⏰ ${rows.length} compra(s) atrasada(s)`,
      rows
        .map((c) => c.descricao)
        .slice(0, 3)
        .join(', '),
      '/HTML/estoque/compras.html',
      'compras_atrasadas'
    ).catch(() => {})
    enviarEmail(
      `⏰ ALERTA: ${rows.length} compra(s) atrasada(s) na entrega`,
      `<h2 style="color:#ED3237;margin:0 0 16px">⏰ Compras com Entrega Atrasada</h2><p style="margin:0 0 12px;color:#8a6a6a">As compras abaixo passaram da data prevista de chegada e ainda não foram marcadas como recebidas:</p><table style="width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:left;padding:8px 10px;border-bottom:2px solid #ED3237">Item</th><th style="text-align:left;padding:8px 10px;border-bottom:2px solid #ED3237">Fornecedor</th><th style="text-align:left;padding:8px 10px;border-bottom:2px solid #ED3237">Destino</th><th style="text-align:left;padding:8px 10px;border-bottom:2px solid #ED3237">Situação</th></tr></thead><tbody>${linhas}</tbody></table>`,
      ['admin', 'compras']
    )
    console.log(`Alerta de compras atrasadas enviado: ${rows.length}`)
  } catch (e) {
    console.error('Erro no alerta de compras atrasadas:', e.message)
  }
}

setTimeout(verificarComprasAtrasadas, 120 * 1000)

setInterval(verificarComprasAtrasadas, 24 * 60 * 60 * 1000)

const SQL_EMBARQUES_PENDENTES = `
 SELECT p.id, p.numero_pi, p.cliente
 FROM pedidos p
 WHERE p.concluida = 0 AND p.data_embarque IS NULL
 AND EXISTS (SELECT 1 FROM produtos_pi pp WHERE pp.pi_id = p.id)
 AND NOT EXISTS (
 SELECT 1 FROM produtos_pi pp JOIN insumos_produto ip ON ip.produto_id = pp.id
 WHERE pp.pi_id = p.id AND ip.tipo <> 'etiqueta' AND ip.confirmado = 0
 )
 ORDER BY p.numero_pi ASC`

async function verificarEmbarquesPendentes() {
  try {
    const [rows] = await banco.query(SQL_EMBARQUES_PENDENTES)
    if (!rows.length) return
    if (!(await podeEnviarHoje('embarques_pendentes'))) return
    const linhas = rows
      .map(
        (p) =>
          `<tr><td style="padding:8px 10px;border-bottom:1px solid #f0d0d0;font-weight:700">PI ${p.numero_pi}</td><td style="padding:8px 10px;border-bottom:1px solid #f0d0d0">${p.cliente || '—'}</td></tr>`
      )
      .join('')
    enviarPush(
      `🚢 ${rows.length} PI(s) prontas sem data de embarque`,
      rows.map((p) => `PI ${p.numero_pi}`).join(', '),
      '/HTML/estoque/embarques.html',
      'embarques_pendentes'
    ).catch(() => {})
    enviarEmail(
      `${rows.length} PI(s) pronta(s) aguardando data de embarque`,
      `<h2 style="color:#1565C0;margin:0 0 16px">PIs prontas sem data de embarque</h2><p style="margin:0 0 12px;color:#8a6a6a">As PIs abaixo já estão liberadas para produção, mas ainda não têm data de embarque definida. Gerente: por favor, declare o embarque.</p><table style="width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:left;padding:8px 10px;border-bottom:2px solid #1565C0">PI</th><th style="text-align:left;padding:8px 10px;border-bottom:2px solid #1565C0">Cliente</th></tr></thead><tbody>${linhas}</tbody></table>`,
      ['admin', 'gerente_producao']
    )
    console.log(`Aviso de embarques pendentes enviado: ${rows.length} PI(s)`)
  } catch (e) {
    console.error('Erro no aviso de embarques pendentes:', e.message)
  }
}

setTimeout(verificarEmbarquesPendentes, 150 * 1000)

setInterval(verificarEmbarquesPendentes, 24 * 60 * 60 * 1000)

module.exports = { SQL_DECLARACAO_PENDENTE, SQL_EMBARQUES_PENDENTES }
