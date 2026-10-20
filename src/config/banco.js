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

module.exports = { banco }
