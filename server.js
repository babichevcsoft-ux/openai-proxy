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

// Кэш для токена
let gigachatTokenCache = {
  token: null,
  expiry: null
};

// Детальная диагностика аутентификации
async function getGigaChatToken() {
  try {
    console.log('🔐 Getting GigaChat token...');
    console.log('📝 GIGACHAT_KEY from env:', process.env.GIGACHAT_KEY ? 'Present' : 'Missing');
    
    // Проверяем разные форматы ключа
    let authHeader;
    
    if (process.env.GIGACHAT_KEY.startsWith('Basic ')) {
      // Если ключ уже в формате Basic
      authHeader = process.env.GIGACHAT_KEY;
      console.log('🔑 Using pre-formatted Basic auth');
    } else if (process.env.GIGACHAT_KEY.includes(':')) {
      // Если ключ в формате client_id:client_secret
      const base64Credentials = Buffer.from(process.env.GIGACHAT_KEY).toString('base64');
      authHeader = `Basic ${base64Credentials}`;
      console.log('🔑 Encoded credentials to Base64');
    } else {
      // Если это просто Authorization Key (уже base64)
      authHeader = `Basic ${process.env.GIGACHAT_KEY}`;
      console.log('🔑 Using as direct Base64 key');
    }
    
    console.log('🔐 Auth header preview:', authHeader.substring(0, 20) + '...');
    
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
        timeout: 15000
      }
    );
    
    console.log('✅ GigaChat token received successfully');
    console.log('⏰ Token expires in:', response.data.expires_in, 'seconds');
    
    return response.data.access_token;
  } catch (error) {
    console.error('❌ GigaChat token error details:');
    console.error('Status:', error.response?.status);
    console.error('Headers sent:', error.config?.headers?.Authorization ? 'Yes' : 'No');
    console.error('Error data:', error.response?.data);
    
    throw new Error(`GigaChat auth failed: ${error.response?.data?.error_description || error.response?.data || error.message}`);
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
    expiry: now + 25 * 60 * 1000 // 25 minutes
  };
  
  return token;
}

// Основной endpoint для чата
app.post('/v1/chat/completions', async (req, res) => {
  console.log('📨 Received chat request');
  console.log('📝 Request model:', req.body?.model);
  
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
    console.error('❌ GigaChat API error:');
    console.error('Status:', error.response?.status);
    console.error('Error data:', error.response?.data);
    
    res.status(error.response?.status || 500).json({ 
      error: 'GigaChat API error',
      message: error.message,
      details: error.response?.data || 'No response details'
    });
  }
});

// Получение списка моделей
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

    console.log('✅ Models response status:', response.status);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('❌ GigaChat models error:', error.response?.data);
    res.status(500).json({ 
      error: 'GigaChat models API error',
      details: error.response?.data 
    });
  }
});

// Диагностический endpoint для тестирования аутентификации
app.get('/debug/auth', async (req, res) => {
  try {
    console.log('🔧 Debug auth endpoint called');
    
    const token = await getGigaChatToken();
    
    res.json({
      status: 'SUCCESS',
      message: 'GigaChat authentication working',
      token_preview: token ? `${token.substring(0, 20)}...` : 'No token',
      token_length: token ? token.length : 0
    });
  } catch (error) {
    res.status(500).json({
      status: 'FAILED',
      message: error.message,
      gigachat_key_format: process.env.GIGACHAT_KEY ? 'Present' : 'Missing',
      key_preview: process.env.GIGACHAT_KEY ? `${process.env.GIGACHAT_KEY.substring(0, 30)}...` : 'No key'
    });
  }
});

// Health check
app.get('/health', async (req, res) => {
  const health = {
    status: 'OK',
    service: 'GigaChat Corporate Proxy',
    timestamp: new Date().toISOString(),
    environment: {
      gigachat_key: process.env.GIGACHAT_KEY ? '✅ Present' : '❌ Missing',
      key_length: process.env.GIGACHAT_KEY ? process.env.GIGACHAT_KEY.length : 0
    }
  };
  
  // Проверяем аутентификацию
  if (process.env.GIGACHAT_KEY) {
    try {
      const token = await getGigaChatToken();
      health.authentication = '✅ Working';
      health.token_info = {
        preview: `${token.substring(0, 15)}...`,
        length: token.length
      };
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
      health: 'GET /health',
      debug: 'GET /debug/auth'
    },
    troubleshooting: {
      check_key_format: 'Ensure GIGACHAT_KEY is in correct format',
      expected_formats: [
        'Authorization Key (Base64) directly from GigaChat console',
        'ClientID:ClientSecret (will be encoded to Base64)'
      ]
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 GigaChat Corporate Proxy running on port ${PORT}`);
  console.log(`🔗 Debug endpoint: /debug/auth`);
});
