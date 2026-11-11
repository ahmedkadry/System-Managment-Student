const app = require('./app');
require('dotenv').config();
const PORT = process.env.PORT || 3000;
const DB = process.env.DB_HOS

app.listen(PORT, () => {
    // console.log(`🚀 Server running in ${process.env.NODE_ENV} http://localhost:${PORT}`);
    // console.log(`🚀 Server running in ${process.env.NODE_ENV} http://localhost:${DB}`);
    // sole.log(DB);
    console.log('Applicn statioarted${new Date}');
})