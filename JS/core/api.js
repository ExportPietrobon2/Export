const URL_BASE = ''

function obterToken() {
  return sessionStorage.getItem('token') || localStorage.getItem('token_deposito')
}

async function requisitar(metodo, rota, corpo, formData) {
  const opcoes = {
    method: metodo,
    headers: { Authorization: `Bearer ${obterToken()}` }
  }

  if (formData) {
    opcoes.body = formData
  } else if (corpo) {
    opcoes.headers['Content-Type'] = 'application/json'
    opcoes.body = JSON.stringify(corpo)
  }

  try {
    const resposta = await fetch(URL_BASE + rota, opcoes)

    if (resposta.status === 401) {
      if (!window._sessaoExpiradaAvisada) {
        window._sessaoExpiradaAvisada = true
        alert('Sua sessão expirou. Anote o que estava fazendo, atualize a página (F5) e entre novamente.')
      }
      return { erro: 'Sessão expirada. Atualize a página.' }
    }

    if (!resposta.ok && resposta.status !== 400) {
      let mensagem = `Erro ${resposta.status}. Tente novamente.`
      try {
        const json = await resposta.clone().json()
        if (json && json.erro) mensagem = json.erro
      } catch (_) {}
      return { erro: mensagem }
    }

    return resposta.json()
  } catch (erro) {
    return { erro: 'Sem conexão com o servidor. Verifique sua internet.' }
  }
}

export const api = {
  login: (email, senha) =>
    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    }).then((r) => r.json()),

  logout: () => sessionStorage.removeItem('token'),

  pendencias: () => requisitar('GET', '/api/pendencias'),

  chat: (mensagem, historico) => requisitar('POST', '/api/chat', { mensagem, historico }),

  pedidos: {
    listar: (incluirConcluidas = false) =>
      requisitar('GET', `/api/pedidos?incluirConcluidas=${incluirConcluidas}`),
    completo: (incluirConcluidas = false) =>
      requisitar('GET', `/api/pedidos/completo?incluirConcluidas=${incluirConcluidas}`),
    criar: (dados) => requisitar('POST', '/api/pedidos', dados),
    concluir: (id, concluida) => requisitar('PATCH', `/api/pedidos/${id}/concluir`, { concluida }),
    editarEmbarque: (id, dataEmbarque) =>
      requisitar('PATCH', `/api/pedidos/${id}/embarque`, { data_embarque: dataEmbarque }),
    comentarioEmbarque: (id, comentario) =>
      requisitar('PATCH', `/api/pedidos/${id}/comentario-embarque`, { comentario }),
    excluir: (id) => requisitar('DELETE', `/api/pedidos/${id}`)
  },

  produtos: {
    listar: (piId) => requisitar('GET', `/api/pedidos/${piId}/produtos`),
    criar: (dados) => requisitar('POST', '/api/produtos', dados),
    editarQuantidade: (id, quantidade) =>
      requisitar('PATCH', `/api/produtos/${id}/quantidade`, { quantidade }),
    insumos: (produtoId) => requisitar('GET', `/api/produtos/${produtoId}/insumos`),
    salvarInsumos: (produtoId, dados) =>
      requisitar('PATCH', `/api/produtos/${produtoId}/insumos`, dados)
  },

  recebimentos: {
    pendentes: () => requisitar('GET', '/api/recebimentos/pendentes'),
    registrar: (id, quantidadeRecebida, fotoProduto, fotoNota) => {
      const formData = new FormData()
      formData.append('quantidade_recebida', quantidadeRecebida)
      if (fotoProduto) formData.append('foto_produto', fotoProduto)
      if (fotoNota) formData.append('foto_nota', fotoNota)
      return requisitar('PATCH', `/api/recebimentos/${id}`, null, formData)
    }
  },

  usuarios: {
    listar: () => requisitar('GET', '/api/usuarios'),
    criar: (dados) => requisitar('POST', '/api/usuarios', dados),
    excluir: (id) => requisitar('DELETE', `/api/usuarios/${id}`)
  },

  alertas: {
    declaracaoPendente: () => requisitar('GET', '/api/alertas/declaracao')
  },

  estoque: {
    saldo: () => requisitar('GET', '/api/estoque/saldo'),
    historico: () => requisitar('GET', '/api/estoque/historico'),
    vinculos: () => requisitar('GET', '/api/estoque/vinculos'),
    vincular: (dados) => requisitar('POST', '/api/estoque/vincular', dados),
    editarVinculo: (id, dados) => requisitar('PATCH', `/api/estoque/vinculos/${id}`, dados),
    excluirVinculo: (id) => requisitar('DELETE', `/api/estoque/vinculos/${id}`),
    excluirEntrada: (id) => requisitar('DELETE', `/api/estoque/entradas/${id}`),
    editarProdutoEntrada: (id, produto) =>
      requisitar('PATCH', `/api/estoque/entradas/${id}/produto`, { produto }),
    editarLocalizacaoEntrada: (id, localizacao) =>
      requisitar('PATCH', `/api/estoque/entradas/${id}/localizacao`, { localizacao }),
    registrarEntrada: (produto, embalagemKg, rotuloKg, palletCaixas, fotoProduto, fotoNota, localizacao) => {
      const formData = new FormData()
      formData.append('produto', produto)
      formData.append('localizacao', localizacao || '')
      formData.append('embalagem_kg', embalagemKg)
      formData.append('rotulo_kg', rotuloKg)
      formData.append('pallet_caixas', palletCaixas)
      if (fotoProduto) formData.append('foto_produto', fotoProduto)
      if (fotoNota) formData.append('foto_nota', fotoNota)
      return requisitar('POST', '/api/estoque/entrada', null, formData)
    }
  },

  compras: {
    listar: () => requisitar('GET', '/api/compras'),
    sugestoes: () => requisitar('GET', '/api/compras/sugestoes'),
    criar: (dados) => requisitar('POST', '/api/compras', dados),
    editar: (id, dados) => requisitar('PATCH', `/api/compras/${id}`, dados),
    receber: (id) => requisitar('PATCH', `/api/compras/${id}/receber`),
    observacao: (id, observacoes) =>
      requisitar('PATCH', `/api/compras/${id}/observacao`, { observacoes }),
    excluir: (id) => requisitar('DELETE', `/api/compras/${id}`)
  },

  demandas: {
    listar: () => requisitar('GET', '/api/demandas'),
    criar: (dados) => requisitar('POST', '/api/demandas', dados),
    responder: (id, status) => requisitar('PATCH', `/api/demandas/${id}/status`, { status }),
    excluir: (id) => requisitar('DELETE', `/api/demandas/${id}`)
  },

  contabil: {
    anos: () => requisitar('GET', '/api/contabil/anos'),
    listar: (ano) => requisitar('GET', `/api/contabil?ano=${ano}`),
    criar: (dados) => requisitar('POST', '/api/contabil', dados),
    editar: (id, dados) => requisitar('PATCH', `/api/contabil/${id}`, dados),
    excluir: (id) => requisitar('DELETE', `/api/contabil/${id}`)
  },

  ec: {
    meses: () => requisitar('GET', '/api/ec/meses'),
    criarMes: (ano, mes) => requisitar('POST', '/api/ec/meses', { ano, mes }),
    excluirMes: (id) => requisitar('DELETE', `/api/ec/meses/${id}`),
    entidades: (tipo) => requisitar('GET', `/api/ec/entidades?tipo=${tipo}`),
    criarEntidade: (dados) => requisitar('POST', '/api/ec/entidades', dados),
    toggleEntidade: (id, tipo) => requisitar('PATCH', `/api/ec/entidades/${id}`, { tipo }),
    saldos: (modulo, mesId) =>
      requisitar('GET', `/api/ec/saldos?modulo=${modulo}&mesId=${mesId}`),
    lancamentos: (modulo, mesId, entidadeId) =>
      requisitar('GET', `/api/ec/lancamentos?modulo=${modulo}&mesId=${mesId}&entidadeId=${entidadeId}`),
    criarLancamento: (dados) => requisitar('POST', '/api/ec/lancamentos', dados),
    excluirLancamento: (modulo, id) =>
      requisitar('DELETE', `/api/ec/lancamentos/${modulo}/${id}`)
  },

  fin: {
    resumo: () => requisitar('GET', '/api/fin/resumo'),
    ptax: (data) => requisitar('GET', `/api/fin/ptax?data=${data}`),
    enviarResumoSemanal: () => requisitar('POST', '/api/fin/resumo-semanal/enviar'),
    fornecedores: () => requisitar('GET', '/api/fin/fornecedores'),
    criarFornecedor: (dados) => requisitar('POST', '/api/fin/fornecedores', dados),
    editarFornecedor: (id, dados) => requisitar('PATCH', `/api/fin/fornecedores/${id}`, dados),
    excluirFornecedor: (id) => requisitar('DELETE', `/api/fin/fornecedores/${id}`),
    criarImportacao: (dados) => requisitar('POST', '/api/fin/importacoes', dados),
    editarImportacao: (id, dados) => requisitar('PATCH', `/api/fin/importacoes/${id}`, dados),
    excluirImportacao: (id) => requisitar('DELETE', `/api/fin/importacoes/${id}`),
    pagamentos: (importacaoId) =>
      requisitar('GET', `/api/fin/pagamentos?importacaoId=${importacaoId}`),
    criarPagamento: (dados) => requisitar('POST', '/api/fin/pagamentos', dados),
    editarPagamento: (id, dados) => requisitar('PATCH', `/api/fin/pagamentos/${id}`, dados),
    excluirPagamento: (id) => requisitar('DELETE', `/api/fin/pagamentos/${id}`),
    contratos: (importacaoId) =>
      requisitar('GET', `/api/fin/contratos${importacaoId ? '?importacaoId=' + importacaoId : ''}`),
    criarContrato: (dados) => requisitar('POST', '/api/fin/contratos', dados),
    editarContrato: (id, dados) => requisitar('PATCH', `/api/fin/contratos/${id}`, dados),
    excluirContrato: (id) => requisitar('DELETE', `/api/fin/contratos/${id}`),
    custos: () => requisitar('GET', '/api/fin/custos'),
    custo: (impId) => requisitar('GET', `/api/fin/custos/${impId}`),
    salvarCusto: (impId, dados) => requisitar('PUT', `/api/fin/custos/${impId}`, dados),
    excluirCusto: (impId) => requisitar('DELETE', `/api/fin/custos/${impId}`)
  },

  ordemProducao: {
    listar: () => requisitar('GET', '/api/ordemproducao'),
    obter: (id) => requisitar('GET', `/api/ordemproducao/${id}`),
    criar: (dados) => requisitar('POST', '/api/ordemproducao', dados),
    editar: (id, dados) => requisitar('PUT', `/api/ordemproducao/${id}`, dados),
    excluir: (id) => requisitar('DELETE', `/api/ordemproducao/${id}`)
  },

  checklist: {
    listar: () => requisitar('GET', '/api/checklist'),
    obter: (id) => requisitar('GET', `/api/checklist/${id}`),
    criar: (dados) => requisitar('POST', '/api/checklist', dados),
    editar: (id, dados) => requisitar('PUT', `/api/checklist/${id}`, dados),
    excluir: (id) => requisitar('DELETE', `/api/checklist/${id}`)
  }
}
