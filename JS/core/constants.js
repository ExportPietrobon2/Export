export const TIPOS_INSUMO = [
  { chave: 'embalagem', rotulo: 'Embalagem' },
  { chave: 'rotulo', rotulo: 'Rótulo' },
  { chave: 'caixa', rotulo: 'Caixa' },
  { chave: 'etiqueta', rotulo: 'Etiqueta' }
]

export const TIPOS_INSUMO_RECEBIMENTO = [
  { chave: 'embalagem', rotulo: 'Embalagem' },
  { chave: 'rotulo', rotulo: 'Rótulo' },
  { chave: 'caixa', rotulo: 'Caixa' }
]

export function formatarQuantidade(valor) {
  const numero = Number(valor) || 0
  return numero.toLocaleString('pt-BR') + ' cx'
}

export function calcularStatusProduto(insumos) {
  if (!insumos || insumos.length === 0) return 'NÃO PRODUZ'
  return insumos.every((insumo) => insumo.confirmado) ? 'LIBERADO' : 'NÃO PRODUZ'
}