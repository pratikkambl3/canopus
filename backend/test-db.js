const { Pool } = require('pg');
const p = new Pool({
  host: 'postgres',
  port: 5432,
  database: 'canopus_db',
  user: 'canopus',
  password: 'canopus_dev_password'
});
p.query('SELECT 1')
  .then(r => { console.log('DB CONNECTION OK'); process.exit(0); })
  .catch(e => { console.error('DB CONNECTION FAILED:', e.message); process.exit(1); });
