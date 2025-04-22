const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const runDataLayerFlow = require('./routes/run-datalayer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use('/files', express.static(path.join(__dirname, 'public')));
app.post('/run-datalayer', runDataLayerFlow);

app.get('/', (req, res) => res.send('✅ DataLayer API is running. POST to /run-datalayer.'));

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
