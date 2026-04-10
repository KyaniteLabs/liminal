#!/usr/bin/env node
/**
 * Debug MiniMax API Key
 */

import { LLMClient } from '../dist/llm/LLMClient.js';

console.log('🔍 Debugging MiniMax API Key\n');

// Check environment
const apiKey = process.env.MINIMAX_API_KEY;
console.log('MINIMAX_API_KEY present:', !!apiKey);
console.log('MINIMAX_API_KEY length:', apiKey?.length || 0);
console.log('MINIMAX_API_KEY prefix:', apiKey?.slice(0, 10) + '...');

// Create client
const llm = new LLMClient({
  role: 'generator',
  baseUrl: 'https://api.minimax.chat/v1',
  model: 'MiniMax-M2.7',
  apiKey: apiKey,
  temperature: 0.7,
  maxTokens: 100,
});

console.log('\nClient config:');
console.log('  baseUrl:', (llm as any).config?.baseUrl);
console.log('  model:', (llm as any).config?.model);
console.log('  apiKey present:', !!(llm as any).config?.apiKey);

// Try a simple request
async function test() {
  console.log('\n🧪 Testing API call...');
  try {
    const response = await llm.generate('Say hello', 'User says hi');
    console.log('\n✅ SUCCESS!');
    console.log('Response:', response.content?.slice(0, 100));
  } catch (error) {
    console.log('\n❌ FAILED');
    console.log('Error:', error instanceof Error ? error.message : error);
  }
}

test();
