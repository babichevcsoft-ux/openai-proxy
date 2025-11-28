const express = require('express');
const cors = require('cors');
const axios = require('axios');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Конфигурация GigaChat
const GIGACHAT_CONFIG = {
  baseUrl: 'https://gigachat.devices.sberbank.ru/api/v1',
  authUrl: 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
  scope: 'GIGACHAT_API_PERS'
};

// Кэш для токена GigaChat
let gigachatTokenCache = {
  token: null,
  expiry: null
};

// Получение токена для GigaChat
async function getGigaChatToken() {
  try {
    console.log('🔐 Getting GigaChat token...');
    
    // Используем Authorization Key из переменной окружения
    const authHeader = `Basic ${process.env.GIGACHAT_KEY}`;
    
    const response = await axios.post(
      GIGACHAT_CONFIG.authUrl,
      `scope=${GIGACHAT_CONFIG.scope}`,
      {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        }),
        timeout: 10000
      }
    );
    
    console.log('✅ GigaChat token received');
    return response.data.access_token;
  } catch (error) {
    console.error('❌ GigaChat token error:', error.response?.data || error.message);
    throw new Error(`GigaChat auth failed: ${error.response?.data?.error_description || error.message}`);
  }
}

// Получение токена с кэшированием
async function getCachedGigaChatToken() {
  const now = Date.now();
  if (gigachatTokenCache.token && gigachatTokenCache.expiry > now) {
    console.log('🔑 Using cached GigaChat token');
    return gigachatTokenCache.token;
  }
  
  const token = await getGigaChatToken();
  gigachatTokenCache = {
    token: token,
    expiry: now + 25 * 60 * 1000 // 25 minutes cache
  };
  
  return token;
}

// Основной endpoint для чата
app.post('/v1/chat/completions', async (req, res) => {
  console.log('📨 Received chat request');
  
  try {
    const token = await getCachedGigaChatToken();
    
    const response = await axios({
      method: 'POST',
      url: `${GIGACHAT_CONFIG.baseUrl}/chat/completions`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      data: req.body,
      timeout: 30000,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    });

    console.log('✅ GigaChat response status:', response.status);
    res.status(response.status).json(response.data);
    
  } catch (error) {
    console.error('❌ GigaChat API error:', error.response?.data || error.message);
    
    res.status(error.response?.status || 500).json({ 
      error: 'GigaChat API error',
      message: error.message,
      details: error.response?.data || 'No response details'
    });
  }
});

// Получение списка моделей GigaChat
app.get('/v1/models', async (req, res) => {
  console.log('📋 Getting GigaChat models list');
  
  try {
    const token = await getCachedGigaChatToken();
    
    const response = await axios({
      method: 'GET',
      url: `${GIGACHAT_CONFIG.baseUrl}/models`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      timeout: 30000,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
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

// Health check с диагностикой
app.get('/health', async (req, res) => {
  const health = {
    status: 'OK',
    service: 'GigaChat Corporate Proxy',
    timestamp: new Date().toISOString(),
    environment: {
      gigachat_key: process.env.GIGACHAT_KEY ? '✅ Configured' : '❌ Missing'
    },
    features: [
      'OAuth 2.0 Token Caching',
      'Auto-token refresh',
      'Corporate proxy compatible',
      'SSL bypass for internal networks'
    ]
  };
  
  // Проверяем аутентификацию
  if (process.env.GIGACHAT_KEY) {
    try {
      const token = await getGigaChatToken();
      health.authentication = '✅ Working';
      health.token_preview = token ? `${token.substring(0, 15)}...` : 'No token';
    } catch (error) {
      health.authentication = `❌ Failed: ${error.message}`;
    }
  }
  
  res.json(health);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'GigaChat Corporate Proxy is running',
    endpoints: {
      chat: 'POST /v1/chat/completions',
      models: 'GET /v1/models',
      health: 'GET /health'
    },
    usage: {
      example: {
        method: 'POST',
        url: '/v1/chat/completions',
        body: {
          model: "GigaChat-Pro",
          messages: [
            {"role": "user", "content": "Привет! Как дела?"}
          ],
          temperature: 0.7,
          max_tokens: 1000
        }
      }
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 GigaChat Corporate Proxy running on port ${PORT}`);
  console.log(`🔗 Endpoints: /v1/chat/completions, /v1/models, /health`);
  console.log(`🔐 OAuth 2.0 with token caching enabled`);
});
