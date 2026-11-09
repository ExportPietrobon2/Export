const URL_BASE = ''

function obterToken() {
  return sessionStorage.getItem('token')
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

  usuarios: {
    listar: () => requisitar('GET', '/api/usuarios'),
    criar: (dados) => requisitar('POST', '/api/usuarios', dados),
    excluir: (id) => requisitar('DELETE', `/api/usuarios/${id}`)
  },

  cadastros: {
    clientes: () => requisitar('GET', '/api/cadastros/clientes'),
    criarCliente: (dados) => requisitar('POST', '/api/cadastros/clientes', dados),
    editarCliente: (id, dados) => requisitar('PATCH', `/api/cadastros/clientes/${id}`, dados),
    fornecedores: () => requisitar('GET', '/api/cadastros/fornecedores'),
    criarFornecedor: (dados) => requisitar('POST', '/api/cadastros/fornecedores', dados),
    editarFornecedor: (id, dados) => requisitar('PATCH', `/api/cadastros/fornecedores/${id}`, dados),
    excluirFornecedor: (id) => requisitar('DELETE', `/api/cadastros/fornecedores/${id}`)
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
    saldos: (modulo, mesId) => requisitar('GET', `/api/ec/saldos?modulo=${modulo}&mesId=${mesId}`),
    lancamentos: (modulo, mesId, entidadeId) =>
      requisitar('GET', `/api/ec/lancamentos?modulo=${modulo}&mesId=${mesId}&entidadeId=${entidadeId}`),
    criarLancamento: (dados) => requisitar('POST', '/api/ec/lancamentos', dados),
    excluirLancamento: (modulo, id) => requisitar('DELETE', `/api/ec/lancamentos/${modulo}/${id}`)
  },

  fin: {
    painel: () => requisitar('GET', '/api/fin/painel'),
    resumo: () => requisitar('GET', '/api/fin/resumo'),
    ptax: (data) => requisitar('GET', `/api/fin/ptax?data=${data}`),
    enviarResumoSemanal: () => requisitar('POST', '/api/fin/resumo-semanal/enviar'),
    criarImportacao: (dados) => requisitar('POST', '/api/fin/importacoes', dados),
    editarImportacao: (id, dados) => requisitar('PATCH', `/api/fin/importacoes/${id}`, dados),
    excluirImportacao: (id) => requisitar('DELETE', `/api/fin/importacoes/${id}`),
    pagamentos: (importacaoId) => requisitar('GET', `/api/fin/pagamentos?importacaoId=${importacaoId}`),
    criarPagamento: (dados) => requisitar('POST', '/api/fin/pagamentos', dados),
    editarPagamento: (id, dados) => requisitar('PATCH', `/api/fin/pagamentos/${id}`, dados),
    excluirPagamento: (id) => requisitar('DELETE', `/api/fin/pagamentos/${id}`),
    contratos: (importacaoId) =>
      requisitar('GET', `/api/fin/contratos${importacaoId ? '?importacaoId=' + importacaoId : ''}`),
    criarContrato: (dados) => requisitar('POST', '/api/fin/contratos', dados),
    editarContrato: (id, dados) => requisitar('PATCH', `/api/fin/contratos/${id}`, dados),
    excluirContrato: (id) => requisitar('DELETE', `/api/fin/contratos/${id}`),
    custos: () => requisitar('GET', '/api/fin/custos'),
    custosImp: (impId) => requisitar('GET', `/api/fin/custos/${impId}`),
    criarCusto: (impId, dados) => requisitar('POST', `/api/fin/custos/${impId}`, dados),
    salvarCusto: (impId, custoId, dados) => requisitar('PUT', `/api/fin/custos/${impId}/${custoId}`, dados),
    excluirCusto: (impId, custoId) => requisitar('DELETE', `/api/fin/custos/${impId}/${custoId}`)
  },

  checklist: {
    listar: () => requisitar('GET', '/api/checklist'),
    obter: (id) => requisitar('GET', `/api/checklist/${id}`),
    criar: (dados) => requisitar('POST', '/api/checklist', dados),
    editar: (id, dados) => requisitar('PUT', `/api/checklist/${id}`, dados),
    excluir: (id) => requisitar('DELETE', `/api/checklist/${id}`)
  }
}
