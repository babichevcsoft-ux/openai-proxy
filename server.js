const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Умный прокси - поддерживает оба API
app.all('/proxy/*', async (req, res) => {
  console.log('📨 Received request:', req.method, req.url);
  
  try {
    const path = req.url.replace('/proxy/', '');
    let targetUrl, headers;
    
    // Автоматически определяем API по модели в запросе
    if (req.body && req.body.model && req.body.model.includes('deepseek')) {
      // DeepSeek API
      targetUrl = `https://api.deepseek.com/${path}`;
      headers = {
        'Authorization': 'Bearer ' + process.env.DEEPSEEK_KEY,
        'Content-Type': 'application/json'
      };
      console.log('🎯 Routing to DeepSeek API');
    } else {
      // OpenRouter API (по умолчанию)
      targetUrl = `https://openrouter.ai/api/${path}`;
      headers = {
        'Authorization': 'Bearer ' + process.env.OPENROUTER_KEY,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://openai-proxy-gglw.onrender.com',
        'X-Title': 'Corporate AI Proxy'
      };
      console.log('🎯 Routing to OpenRouter API');
    }
    
    console.log('🔗 Target URL:', targetUrl);
    
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

// Прямой endpoint для DeepSeek chat
app.post('/deepseek/chat', async (req, res) => {
  try {
    console.log('🎯 Direct DeepSeek chat request');
    
    const response = await axios({
      method: 'POST',
      url: 'https://api.deepseek.com/v1/chat/completions',
      headers: {
        'Authorization': 'Bearer ' + process.env.DEEPSEEK_KEY,
        'Content-Type': 'application/json'
      },
      data: req.body,
      timeout: 30000
    });

    console.log('✅ DeepSeek response status:', response.status);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('❌ DeepSeek error:', error.response?.data);
    res.status(500).json({ 
      error: 'DeepSeek API error',
      details: error.response?.data 
    });
  }
});

// Прямой endpoint для DeepSeek models
app.get('/deepseek/models', async (req, res) => {
  try {
    console.log('🎯 Getting DeepSeek models list');
    
    const response = await axios({
      method: 'GET',
      url: 'https://api.deepseek.com/v1/models',
      headers: {
        'Authorization': 'Bearer ' + process.env.DEEPSEEK_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('❌ DeepSeek models error:', error.response?.data);
    res.status(500).json({ 
      error: 'DeepSeek models API error',
      details: error.response?.data 
    });
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Universal AI Proxy is running',
    usage: {
      openrouter: 'Use /proxy/* for OpenRouter (auto-detect)',
      deepseek_chat: 'Use /deepseek/chat for DeepSeek chat',
      deepseek_models: 'Use /deepseek/models for DeepSeek models'
    },
    environment: {
      openrouter_key: process.env.OPENROUTER_KEY ? '✅ Set' : '❌ Missing',
      deepseek_key: process.env.DEEPSEEK_KEY ? '✅ Set' : '❌ Missing'
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Universal AI Proxy running on port ${PORT}`);
  console.log(`🔗 Supports: OpenRouter + DeepSeek APIs`);
});
