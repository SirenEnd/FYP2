require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 5000;

// In your server.js or a separate scheduler file
const cron = require('node-cron')
const { autoGeneratePayroll } = require('./controllers/payroll.controller')

// Run every day at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('Checking for payroll cycles to generate...')
  const req = { body: {} }
  const res = {
    json: (data) => console.log('Auto-generate result:', data),
    status: () => ({ json: () => {} })
  }
  await autoGeneratePayroll(req, res)
})
app.listen(PORT, () => {
  console.log(`✅ RestroHR server running on http://localhost:${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV}`);
}); 
