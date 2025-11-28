const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Прокси для OpenRouter
app.all('/proxy/*', async (req, res) => {
  try {
    const targetUrl = req.url.replace('/proxy/', 'https://openrouter.ai/api/');
    
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'Authorization': 'Bearer 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',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://your-proxy.render.com',
        'X-Title': 'Corporate AI Proxy'
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
    message: 'OpenRouter Proxy is running',
    usage: 'Use /proxy/* to forward requests to OpenRouter API'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 OpenRouter Proxy server running on port ${PORT}`);
});
