/**
 * LLM Configuration
 * Dynamically selects between local and cloud-hosted model endpoints
 * based on the environment (development vs production)
 */

/**
 * Get the appropriate LLM endpoint configuration based on environment
 * @returns {Object} Configuration object with endpoint URL, model name, and type
 */
export function getLLMConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  const llmEndpoint = process.env.LLM_ENDPOINT;
  const llmModel = process.env.LLM_MODEL;
  const llmType = process.env.LLM_TYPE || (isProduction ? 'cloud' : 'local');

  // Default configurations
  const configs = {
    local: {
      endpoint: llmEndpoint || 'http://localhost:11434',
      model: llmModel || 'llama3:8b',
      type: 'ollama',
      apiPath: '/api/generate',
      healthCheckPath: '/api/tags',
    },
    cloud: {
      endpoint: llmEndpoint || 'http://54.87.162.171:11434',
      model: llmModel || 'llama3:8b',
      type: 'ollama',
      apiPath: '/api/generate',
      healthCheckPath: '/api/tags',
    },
  };

  const config = configs[llmType] || configs.local;

  console.log(`[LLM Config] Using ${llmType} model: ${config.model} at ${config.endpoint}`);

  return config;
}

/**
 * Make a request to the LLM endpoint
 * @param {string} prompt - The prompt to send to the model
 * @param {Object} options - Additional options for the request
 * @returns {Promise<Object>} The response from the model
 */
export async function callLLM(prompt, options = {}) {
  const config = getLLMConfig();
  const {
    model = config.model,
    stream = false,
    temperature = 0.7,
    maxTokens,
  } = options;

  const endpoint = `${config.endpoint}${config.apiPath}`;

  try {
    const requestBody = {
      model,
      prompt,
      stream,
      options: {
        temperature,
        ...(maxTokens && { num_predict: maxTokens }),
      },
    };

    console.log(`[LLM] Sending request to ${endpoint}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      response: data.response,
      model: model,
      endpoint: config.endpoint,
      type: config.type,
    };
  } catch (error) {
    console.error('[LLM] Request failed:', error);
    throw error;
  }
}

/**
 * Check if the LLM service is available
 * @returns {Promise<Object>} Health check result
 */
export async function checkLLMHealth() {
  const config = getLLMConfig();
  const healthEndpoint = `${config.endpoint}${config.healthCheckPath}`;

  try {
    const response = await fetch(healthEndpoint, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      return {
        available: false,
        error: `Health check failed: ${response.status}`,
        endpoint: config.endpoint,
      };
    }

    const data = await response.json();

    return {
      available: true,
      endpoint: config.endpoint,
      type: config.type,
      models: data.models || [],
    };
  } catch (error) {
    return {
      available: false,
      error: error.message,
      endpoint: config.endpoint,
    };
  }
}

/**
 * Get available models from the LLM service
 * @returns {Promise<Array>} List of available models
 */
export async function getAvailableModels() {
  const config = getLLMConfig();
  const tagsEndpoint = `${config.endpoint}${config.healthCheckPath}`;

  try {
    const response = await fetch(tagsEndpoint, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error('[LLM] Failed to fetch available models:', error);
    return [];
  }
}

