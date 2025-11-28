const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Умный прокси - определяет целевой API по контексту
app.all('/proxy/*', async (req, res) => {
  console.log('📨 Received request:', req.method, req.url);
  
  try {
    const path = req.url.replace('/proxy/', '');
    
    // Определяем целевой API на основе пути или тела запроса
    let targetUrl, headers;
    
    if (req.body && req.body.model && req.body.model.includes('deepseek')) {
      // DeepSeek API
      targetUrl = `https://api.deepseek.com/${path}`;
      headers = {
        'Authorization': 'Bearer ' + process.env.DEEPSEEK_KEY,
        'Content-Type': 'application/json'
      };
      console.log('🎯 Using DeepSeek API');
    } else {
      // OpenRouter API (по умолчанию)
      targetUrl = `https://openrouter.ai/api/${path}`;
      headers = {
        'Authorization': 'Bearer ' + process.env.OPENROUTER_KEY,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://openai-proxy-gglw.onrender.com',
        'X-Title': 'Corporate AI Proxy'
      };
      console.log('🎯 Using OpenRouter API');
    }
    
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: headers,
      data: req.body,
      timeout: 30000
    });

    console.log('✅ API response status:', response.status);
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
    message: 'Universal AI Proxy is running',
    usage: 'Use /proxy/* for both OpenRouter and DeepSeek APIs'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Universal AI Proxy running on port ${PORT}`);
});
