// Bisect which part of the system prompt causes the hang
const API_KEY = process.env.LIMINAL_LLM_API_KEY;

const SHORT_PROMPT = `You are a senior GLSL shader programmer.

Generate a fragment shader based on: plasma effect

Output ONLY raw GLSL code.`;

const LONG_PROMPT = `You are a senior GLSL shader programmer specializing in real-time generative visuals.

Generate a creative fragment shader based on the user's description.

CONSTRAINTS:
- CRITICAL: Output ONLY the raw GLSL code - NO markdown fences, NO code blocks
- CRITICAL: DO NOT include any explanatory text, reasoning, or commentary
- CRITICAL: Start directly with precision highp float; or uniform declarations

OUTPUT FORMAT:
- Output a single GLSL fragment shader code block
- MUST include precision highp float; as the first line`;

async function testPrompt(name, systemPrompt) {
  console.log(`\n=== Testing: ${name} ===`);
  const start = Date.now();
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    
    const resp = await fetch("https://api.minimax.io/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "MiniMax-M2.7",
        messages: [
          {role: "system", content: systemPrompt},
          {role: "user", content: "Generate a plasma shader"}
        ],
        temperature: 0.7,
        max_tokens: 8000
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    const duration = Date.now() - start;
    
    if (!resp.ok) {
      console.log(`❌ HTTP ${resp.status} (${duration}ms)`);
      return;
    }
    
    const data = await resp.json();
    if (data.choices?.[0]?.message?.content) {
      console.log(`✅ Success (${duration}ms) - ${data.choices[0].message.content.length} chars`);
    } else {
      console.log(`❌ No content (${duration}ms)`);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log(`⏱️ TIMEOUT after 15s`);
    } else {
      console.log(`❌ Error: ${err.message}`);
    }
  }
}

await testPrompt("SHORT_PROMPT", SHORT_PROMPT);
await testPrompt("LONG_PROMPT", LONG_PROMPT);

console.log("\n=== Done ===");
