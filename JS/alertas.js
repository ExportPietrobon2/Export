import { calcularStatusProduto } from './constants.js'

export function prontaParaProduzir(pedido) {
  const produtos = pedido.produtos_pi || []
  if (produtos.length === 0) return false
  return produtos.every((p) => calcularStatusProduto(p.insumos_produto || []) === 'LIBERADO')
}

export function diasParaEmbarque(dataStr) {
  if (!dataStr) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const alvo = new Date(String(dataStr).slice(0, 10) + 'T00:00:00')
  return Math.round((alvo - hoje) / 86400000)
}

export function piEmAlerta(pedido) {
  if (pedido.concluida) return false
  if (!pedido.data_embarque) return false
  if (prontaParaProduzir(pedido)) return false
  const dias = diasParaEmbarque(pedido.data_embarque)
  return dias !== null && dias <= 7
}

export function textoPrazoEmbarque(dias) {
  if (dias === null) return ''
  if (dias < 0) return `EMBARQUE VENCIDO há ${Math.abs(dias)} dia(s)`
  if (dias === 0) return 'EMBARQUE É HOJE'
  if (dias === 1) return 'EMBARQUE AMANHÃ'
  return `EMBARQUE EM ${dias} DIAS`
}

export function bannerAlertaHtml(pedido) {
  const dias = diasParaEmbarque(pedido.data_embarque)
  return `<div class="banner-alerta-embarque">🚨 ALERTA MÁXIMO — ${textoPrazoEmbarque(dias)} E A PI NÃO ESTÁ PRONTA PARA PRODUZIR</div>`
}

export function resumoAlertasHtml(pedidos) {
  const emAlerta = (pedidos || []).filter(piEmAlerta)
    .sort((a, b) => diasParaEmbarque(a.data_embarque) - diasParaEmbarque(b.data_embarque))
  if (!emAlerta.length) return ''
  const chips = emAlerta.map((p) => {
    const dias = diasParaEmbarque(p.data_embarque)
    return `<span class="pi-chip">PI ${p.numero_pi} — ${textoPrazoEmbarque(dias)}</span>`
  }).join('')
  return `
    <div class="resumo-alerta-topo">
      <div style="font-size:1.1rem;margin-bottom:6px">🚨 ${emAlerta.length} PI(s) EM ALERTA MÁXIMO DE EMBARQUE</div>
      <div style="font-weight:600;opacity:.95;margin-bottom:8px">PIs próximas da data de embarque (ou vencidas) que ainda não estão prontas para produzir:</div>
      <div>${chips}</div>
    </div>`
}