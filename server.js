const express = require('express');
const cors = require('cors');
const axios = require('axios');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Функция для получения токена GigaChat
async function getGigaChatToken() {
  try {
    console.log('🔐 Getting GigaChat token...');
    
    // Генерируем RqUID как в примере от Сбера
    const rqUID = generateRqUID();
    
    const response = await axios.post(
      'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
      'scope=GIGACHAT_API_PERS',
      {
        headers: {
          'Authorization': `Basic ${process.env.GIGACHAT_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'RqUID': rqUID
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        }),
        timeout: 10000
      }
    );
    
    console.log('✅ Token received successfully!');
    return response.data.access_token;
  } catch (error) {
    console.error('❌ Authentication failed:');
    console.error('Status:', error.response?.status);
    console.error('Error data:', error.response?.data);
    console.error('Request headers:', error.config?.headers);
    throw error;
  }
}

// Генерация RqUID как в примере Сбера
function generateRqUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Тестовый endpoint для проверки аутентификации
app.get('/test-auth', async (req, res) => {
  try {
    console.log('🧪 Testing GigaChat authentication...');
    
    if (!process.env.GIGACHAT_KEY) {
      return res.status(400).json({ 
        error: 'GIGACHAT_KEY not set',
        instruction: 'Add GIGACHAT_KEY to environment variables with your Authorization Key from Sber'
      });
    }
    
    console.log('🔑 Using Authorization Key from environment');
    
    const token = await getGigaChatToken();
    
    res.json({
      success: true,
      message: 'GigaChat authentication successful!',
      token_preview: token.substring(0, 20) + '...',
      token_length: token.length,
      expires_in: '30 minutes'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'GigaChat authentication failed',
      details: error.response?.data || error.message,
      instruction: 'Check that GIGACHAT_KEY contains the exact Authorization Key from Sber AI Platform'
    });
  }
});

// Основной чат endpoint
app.post('/v1/chat/completions', async (req, res) => {
  try {
    console.log('💬 Chat request received');
    console.log('Model:', req.body?.model);
    
    const token = await getGigaChatToken();
    
    const response = await axios.post(
      'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
      req.body,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        }),
        timeout: 30000
      }
    );
    
    console.log('✅ Chat response received');
    res.json(response.data);
  } catch (error) {
    console.error('❌ Chat error:');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data);
    
    res.status(error.response?.status || 500).json({
      error: 'GigaChat API error',
      details: error.response?.data || error.message
    });
  }
});

// Получение списка моделей
app.get('/v1/models', async (req, res) => {
  try {
    console.log('📋 Getting models list...');
    
    const token = await getGigaChatToken();
    
    const response = await axios.get(
      'https://gigachat.devices.sberbank.ru/api/v1/models',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        }),
        timeout: 15000
      }
    );
    
    console.log('✅ Models list received');
    res.json(response.data);
  } catch (error) {
    console.error('❌ Models error:', error.response?.data);
    res.status(500).json({
      error: 'Failed to get models',
      details: error.response?.data
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'GigaChat Corporate Proxy',
    timestamp: new Date().toISOString(),
    environment: {
      gigachat_key: process.env.GIGACHAT_KEY ? '✅ Set' : '❌ Missing',
      key_preview: process.env.GIGACHAT_KEY ? 
        `${process.env.GIGACHAT_KEY.substring(0, 15)}...` : 'No key'
    },
    endpoints: {
      test_auth: 'GET /test-auth',
      chat: 'POST /v1/chat/completions',
      models: 'GET /v1/models'
    }
  });
});

app.get('/', (req, res) => {
  res.json({
    service: 'GigaChat Corporate Proxy',
    status: 'Running',
    documentation: {
      authentication: 'Uses Authorization Key from Sber AI Platform',
      key_format: 'Should be the exact Authorization Key provided by Sber',
      example_request: {
        method: 'POST',
        url: '/v1/chat/completions',
        body: {
          model: "GigaChat-Pro",
          messages: [
            {"role": "user", "content": "Привет!"}
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
  console.log(`🔐 Using Sber Authorization Key authentication`);
});
