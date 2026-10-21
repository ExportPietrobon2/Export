const mysql = require('mysql2/promise')

const banco = mysql.createPool({
  host: process.env.MYSQLHOST,
  port: process.env.MYSQLPORT,
  database: process.env.MYSQLDATABASE,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  waitForConnections: true,
  connectionLimit: 10
})

async function emTransacao(operacao) {
  const conexao = await banco.getConnection()
  try {
    await conexao.beginTransaction()
    const resultado = await operacao(conexao)
    await conexao.commit()
    return resultado
  } catch (erro) {
    await conexao.rollback().catch(() => {})
    throw erro
  } finally {
    conexao.release()
  }
}

module.exports = { banco, emTransacao }
