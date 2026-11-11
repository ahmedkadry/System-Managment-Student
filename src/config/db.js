const mysql = require('mysql2/promise');
require('dotenv').config();
//const { attachDatabasePool } = require('@vercel/functions');

const pool = mysql.createPool({
    /*host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,*/
    host: "sql7.freesqldatabase.com",
    user: "sql7840180",
    password: "qJkGBAimLd",
    database: "sql7840180",
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});


// Test connection
pool.getConnection()
    .then(connection => {
        console.log('✅ Connected to MySQL Database securely.');
        connection.release();
    })
    .catch(err => {
        console.error('❌ Database connection failed:', err.message);
    });


// Attach the pool to the Vercel function lifecycle
//attachDatabasePool(pool);

module.exports = pool;