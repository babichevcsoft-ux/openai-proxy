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
  console.log('📨 Received request:', req.method, req.url);
  console.log('📦 Body:', JSON.stringify(req.body));
  
  try {
    const targetUrl = req.url.replace('/proxy/', 'https://openrouter.ai/api/');
    console.log('🎯 Target URL:', targetUrl);
    
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        'Authorization': 'Bearer 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',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://openai-proxy-gglw.onrender.com',
        'X-Title': 'Corporate AI Proxy'
      },
      data: req.body,
      timeout: 30000
    });

    console.log('✅ OpenRouter response status:', response.status);
    res.status(response.status).json(response.data);
    
  } catch (error) {
    console.error('❌ Proxy error:', error.message);
    console.error('🔍 Error details:', error.response?.data);
    
    res.status(500).json({ 
      error: 'Proxy error', 
      message: error.message,
      details: error.response?.data || 'No response details'
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
