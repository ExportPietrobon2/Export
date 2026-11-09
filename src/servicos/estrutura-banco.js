const { banco } = require('../config/banco')

async function colunaExiste(tabela, coluna) {
  const [rows] = await banco.query(`SHOW COLUMNS FROM \`${tabela}\` LIKE ?`, [coluna])
  return rows.length > 0
}

async function tabelaExiste(tabela) {
  const [rows] = await banco.query('SHOW TABLES LIKE ?', [tabela])
  return rows.length > 0
}

async function garantirColuna(tabela, coluna, definicao) {
  if (!(await colunaExiste(tabela, coluna))) {
    await banco.query(`ALTER TABLE \`${tabela}\` ADD COLUMN \`${coluna}\` ${definicao}`)
    console.log(`${tabela}.${coluna} adicionada.`)
  }
}

async function jaExecutado(chave) {
  await banco.query('CREATE TABLE IF NOT EXISTS notif_log (chave VARCHAR(60) PRIMARY KEY, ultima_data DATE)')
  const [[r]] = await banco.query('SELECT chave FROM notif_log WHERE chave = ?', [chave])
  return !!r
}

async function marcarExecutado(chave) {
  await banco.query(
    'INSERT INTO notif_log (chave, ultima_data) VALUES (?, CURDATE()) ON DUPLICATE KEY UPDATE ultima_data = CURDATE()',
    [chave]
  )
}

async function removerChavesEstrangeiras(tabela, coluna) {
  const [fks] = await banco.query(
    `SELECT CONSTRAINT_NAME AS nome FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [tabela, coluna]
  )
  for (const fk of fks) {
    await banco.query(`ALTER TABLE \`${tabela}\` DROP FOREIGN KEY \`${fk.nome}\``)
    console.log(`${tabela}: chave estrangeira ${fk.nome} removida.`)
  }
}

async function unificarFornecedores() {
  if (await jaExecutado('migr_fornecedores_unicos')) return
  if (!(await tabelaExiste('ec_fornecedores')) || !(await tabelaExiste('ec_lanc_adiant_fornecedores'))) {
    await marcarExecutado('migr_fornecedores_unicos')
    return
  }
  await removerChavesEstrangeiras('ec_lanc_adiant_fornecedores', 'fornecedor_id')
  const [antigos] = await banco.query('SELECT * FROM ec_fornecedores')
  const [atuais] = await banco.query('SELECT id, nome FROM fin_fornecedores')
  const porNome = {}
  atuais.forEach((f) => {
    porNome[
      String(f.nome || '')
        .trim()
        .toLowerCase()
    ] = f.id
  })
  const mapa = {}
  for (const f of antigos) {
    const chave = String(f.nome || '')
      .trim()
      .toLowerCase()
    if (!porNome[chave]) {
      const [r] = await banco.query('INSERT INTO fin_fornecedores (nome, moeda, ativo) VALUES (?, ?, ?)', [
        String(f.nome || '').trim(),
        'USD',
        f.ativo === 0 ? 0 : 1
      ])
      porNome[chave] = r.insertId
    }
    mapa[f.id] = porNome[chave]
  }
  await garantirColuna('ec_lanc_adiant_fornecedores', 'fornecedor_unificado_id', 'INT NULL')
  for (const [antigo, novo] of Object.entries(mapa)) {
    await banco.query('UPDATE ec_lanc_adiant_fornecedores SET fornecedor_unificado_id = ? WHERE fornecedor_id = ?', [
      novo,
      antigo
    ])
  }
  await banco.query(
    'UPDATE ec_lanc_adiant_fornecedores SET fornecedor_id = fornecedor_unificado_id WHERE fornecedor_unificado_id IS NOT NULL'
  )
  await banco.query('ALTER TABLE ec_lanc_adiant_fornecedores DROP COLUMN fornecedor_unificado_id')
  await marcarExecutado('migr_fornecedores_unicos')
  console.log('Fornecedores unificados:', Object.keys(mapa).length)
}

async function prepararFinanceiro() {
  await garantirColuna('fin_fornecedores', 'ativo', 'TINYINT DEFAULT 1')
  await garantirColuna('fin_importacoes', 'data_vencimento', 'DATE NULL')
  await garantirColuna('fin_importacoes', 'data_chegada', 'DATE NULL')
  await garantirColuna('fin_pagamentos', 'contrato_id', 'INT NULL')
  await garantirColuna('fin_pagamentos', 'origem', 'VARCHAR(20) NULL')
  await garantirColuna('fin_pagamentos', 'entra_fechamento', 'TINYINT DEFAULT 0')
  await garantirColuna('nfe_lancamentos', 'cliente_id', 'INT NULL')
  await garantirColuna('nfe_lancamentos', 'entra_fechamento', 'TINYINT DEFAULT 0')
  await garantirColuna('ec_clientes', 'ativo', 'TINYINT DEFAULT 1')

  if (!(await jaExecutado('backfill_pag_usd'))) {
    await banco.query(`
      UPDATE fin_pagamentos p JOIN fin_importacoes i ON i.id = p.importacao_id
      SET p.valor_moeda = ROUND(p.valor_reais / i.taxa_cambio, 2)
      WHERE (p.valor_moeda IS NULL OR p.valor_moeda = 0) AND i.taxa_cambio > 0 AND p.valor_reais > 0`)
    await marcarExecutado('backfill_pag_usd')
  }

  await banco.query(`CREATE TABLE IF NOT EXISTS fin_custos (
    id INT AUTO_INCREMENT PRIMARY KEY, importacao_id INT NULL, nfe VARCHAR(60), produto VARCHAR(200),
    mp_total DECIMAL(14,2) NULL, percentual DECIMAL(9,4) DEFAULT 100,
    materia_prima DECIMAL(14,2) DEFAULT 0, imposto_importacao DECIMAL(14,2) DEFAULT 0,
    ipi DECIMAL(14,2) DEFAULT 0, pis DECIMAL(14,2) DEFAULT 0, cofins DECIMAL(14,2) DEFAULT 0, icms DECIMAL(14,2) DEFAULT 0,
    quantidade_kg DECIMAL(14,3) DEFAULT 0, unidade VARCHAR(4) DEFAULT 'KG', obs VARCHAR(500),
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_custos_imp (importacao_id))`)
  await banco.query(`CREATE TABLE IF NOT EXISTS fin_custo_despesas (
    id INT AUTO_INCREMENT PRIMARY KEY, custo_id INT NOT NULL, nome VARCHAR(160), valor DECIMAL(14,2) DEFAULT 0, INDEX(custo_id))`)
  await banco.query(`CREATE TABLE IF NOT EXISTS fin_custo_st (
    id INT AUTO_INCREMENT PRIMARY KEY, custo_id INT NOT NULL, produto VARCHAR(200), ncm VARCHAR(20),
    base_icms DECIMAL(14,2) DEFAULT 0, icms_proprio DECIMAL(14,2) DEFAULT 0, aliquota DECIMAL(6,4) DEFAULT 0,
    ipi_destacado DECIMAL(14,2) DEFAULT 0, mva DECIMAL(8,4) DEFAULT 0, INDEX(custo_id))`)
  await garantirColuna('fin_custos', 'mp_total', 'DECIMAL(14,2) NULL')
  await garantirColuna('fin_custos', 'percentual', 'DECIMAL(9,4) DEFAULT 100')
  await garantirColuna('fin_custos', 'unidade', "VARCHAR(4) DEFAULT 'KG'")
  await garantirColuna('fin_custos', 'produto', 'VARCHAR(200)')
  const [unicos] = await banco.query(
    "SHOW INDEX FROM fin_custos WHERE Column_name = 'importacao_id' AND Non_unique = 0"
  )
  for (const nome of new Set(unicos.map((i) => i.Key_name))) {
    await banco.query(`ALTER TABLE fin_custos DROP INDEX \`${nome}\``)
  }

  await unificarFornecedores()
}

async function prepararBanco() {
  try {
    await prepararFinanceiro()
    console.log('Estrutura do banco conferida.')
  } catch (e) {
    console.error('Erro ao preparar o banco:', e.message)
  }
}

module.exports = { prepararBanco }
