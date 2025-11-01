/**
 * Test script for LLM configuration
 * Run with: node src/scripts/test-llm-config.js
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { getLLMConfig, checkLLMHealth, callLLM } = require('../lib/llm-config');

async function testLLMConfiguration() {
  console.log('='.repeat(60));
  console.log('LLM Configuration Test');
  console.log('='.repeat(60));

  // Test 1: Get configuration
  console.log('\n1. Testing configuration...');
  const config = getLLMConfig();
  console.log('   ✓ Configuration loaded:');
  console.log('   - Type:', config.type);
  console.log('   - Endpoint:', config.endpoint);
  console.log('   - Model:', config.model);

  // Test 2: Health check
  console.log('\n2. Testing health check...');
  try {
    const health = await checkLLMHealth();
    if (health.available) {
      console.log('   ✓ LLM service is available');
      console.log('   - Endpoint:', health.endpoint);
      console.log('   - Type:', health.type);
      if (health.models && health.models.length > 0) {
        console.log('   - Available models:', health.models.length);
      }
    } else {
      console.log('   ✗ LLM service is NOT available');
      console.log('   - Error:', health.error);
      console.log('   - Endpoint:', health.endpoint);
      process.exit(1);
    }
  } catch (error) {
    console.log('   ✗ Health check failed:', error.message);
    process.exit(1);
  }

  // Test 3: Simple generation
  console.log('\n3. Testing generation...');
  try {
    const prompt = 'Say "Hello, I am working!" in one sentence.';
    console.log('   - Sending prompt:', prompt);

    const startTime = Date.now();
    const response = await callLLM(prompt, { temperature: 0.7 });
    const duration = Date.now() - startTime;

    console.log('   ✓ Generation successful');
    console.log('   - Duration:', duration, 'ms');
    console.log('   - Model:', response.model);
    console.log('   - Response:', response.response.substring(0, 100) + '...');
  } catch (error) {
    console.log('   ✗ Generation failed:', error.message);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('All tests passed! ✓');
  console.log('='.repeat(60));
}

// Run tests
testLLMConfiguration().catch(error => {
  console.error('\nTest suite failed:', error);
  process.exit(1);
});

