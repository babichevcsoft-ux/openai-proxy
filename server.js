const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Конфигурация провайдеров
const PROVIDERS = {
  OPENROUTER: {
    baseUrl: 'https://openrouter.ai/api',
    authHeader: 'Bearer ' + process.env.OPENROUTER_KEY,
    headers: {
      'HTTP-Referer': 'https://openai-proxy-gglw.onrender.com',
      'X-Title': 'Corporate AI Proxy'
    }
  },
  DEEPSEEK: {
    baseUrl: 'https://api.deepseek.com',
    authHeader: 'Bearer ' + process.env.DEEPSEEK_KEY
  },
  GIGACHAT: {
    baseUrl: 'https://gigachat.devices.sberbank.ru/api/v1',
    authHeader: 'Bearer ' + process.env.GIGACHAT_KEY
  }
};

// Умная маршрутизация по модели
function detectProvider(model) {
  if (!model) return 'OPENROUTER'; // по умолчанию
  
  const modelLower = model.toLowerCase();
  
  if (modelLower.includes('deepseek')) return 'DEEPSEEK';
  if (modelLower.includes('gigachat') || modelLower.includes('gpt-4')) return 'GIGACHAT';
  if (modelLower.includes('gpt') || modelLower.includes('claude') || modelLower.includes('llama')) return 'OPENROUTER';
  
  return 'OPENROUTER'; // fallback
}

// Получение токена для GigaChat (OAuth 2.0)
async function getGigaChatToken() {
  try {
    const response = await axios.post(
      'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
      'scope=GIGACHAT_API_PERS',
      {
        headers: {
          'Authorization': 'Basic ' + process.env.GIGACHAT_KEY,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false // для корпоративного прокси может потребоваться
        })
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error('❌ GigaChat token error:', error.response?.data);
    throw error;
  }
}

// Умный прокси - поддерживает все API
app.all('/proxy/*', async (req, res) => {
  console.log('📨 Received request:', req.method, req.url);
  
  try {
    const path = req.url.replace('/proxy/', '');
    const providerType = detectProvider(req.body?.model);
    const provider = PROVIDERS[providerType];
    
    console.log(`🎯 Routing to ${providerType} API for model: ${req.body?.model}`);
    
    let targetUrl, headers = {
      'Content-Type': 'application/json'
    };

    // Специальная логика для GigaChat
    if (providerType === 'GIGACHAT') {
      const gigachatToken = await getGigaChatToken();
      targetUrl = `${provider.baseUrl}/${path}`;
      headers.Authorization = `Bearer ${gigachatToken}`;
    } else {
      // OpenRouter и DeepSeek
      targetUrl = `${provider.baseUrl}/${path}`;
      headers.Authorization = provider.authHeader;
      
      // Дополнительные заголовки для OpenRouter
      if (providerType === 'OPENROUTER' && provider.headers) {
        Object.assign(headers, provider.headers);
      }
    }
    
    console.log('🔗 Target URL:', targetUrl);
    
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: headers,
      data: req.body,
      timeout: 30000
    });

    console.log(`✅ ${providerType} response status:`, response.status);
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

// Прямой endpoint для GigaChat
app.post('/gigachat/chat', async (req, res) => {
  try {
    console.log('🎯 Direct GigaChat chat request');
    
    const token = await getGigaChatToken();
    
    const response = await axios({
      method: 'POST',
      url: 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: req.body,
      timeout: 30000
    });

    console.log('✅ GigaChat response status:', response.status);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('❌ GigaChat error:', error.response?.data);
    res.status(500).json({ 
      error: 'GigaChat API error',
      details: error.response?.data 
    });
  }
});

// Получение списка моделей GigaChat
app.get('/gigachat/models', async (req, res) => {
  try {
    console.log('🎯 Getting GigaChat models list');
    
    const token = await getGigaChatToken();
    
    const response = await axios({
      method: 'GET',
      url: 'https://gigachat.devices.sberbank.ru/api/v1/models',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('❌ GigaChat models error:', error.response?.data);
    res.status(500).json({ 
      error: 'GigaChat models API error',
      details: error.response?.data 
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
        'Authorization': PROVIDERS.DEEPSEEK.authHeader,
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
        'Authorization': PROVIDERS.DEEPSEEK.authHeader,
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

// Health check с информацией о всех провайдерах
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Universal AI Proxy is running',
    usage: {
      smart_proxy: 'Use /proxy/* for automatic routing',
      openrouter: 'Auto-detected for: gpt-*, claude-*, llama-*',
      deepseek: 'Auto-detected for: deepseek-*',
      gigachat: 'Auto-detected for: gigachat-*, gpt-4*',
      direct_endpoints: {
        gigachat: '/gigachat/chat, /gigachat/models',
        deepseek: '/deepseek/chat, /deepseek/models'
      }
    },
    environment: {
      openrouter_key: process.env.OPENROUTER_KEY ? '✅ Set' : '❌ Missing',
      deepseek_key: process.env.DEEPSEEK_KEY ? '✅ Set' : '❌ Missing',
      gigachat_key: process.env.GIGACHAT_KEY ? '✅ Set' : '❌ Missing'
    },
    supported_providers: [
      'OpenRouter (330+ models)',
      'DeepSeek (deepseek-chat, deepseek-coder)',
      'GigaChat (GigaChat-Pro, GigaChat-Max)'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Universal AI Proxy running on port ${PORT}`);
  console.log(`🔗 Supports: OpenRouter + DeepSeek + GigaChat APIs`);
  console.log(`🌍 Smart routing based on model detection`);
});
