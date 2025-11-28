const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Простой прокси для OpenAI
app.all('/proxy/*', async (req, res) => {
  try {
    const openaiUrl = req.url.replace('/proxy/', 'https://api.openai.com/');
    
    const response = await axios({
      method: req.method,
      url: openaiUrl,
      headers: {
        'Authorization': req.headers.authorization,
        'Content-Type': 'application/json'
      },
      data: req.body,
      timeout: 30000
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Proxy error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Proxy error', 
      details: error.response?.data || error.message 
    });
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'OpenAI Proxy is running',
    usage: 'Use /proxy/* to forward requests to OpenAI API'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on port ${PORT}`);
});
