const API_KEY = process.env.LIMINAL_LLM_API_KEY;

const basePrompt = `You are a senior GLSL shader programmer.

Generate a fragment shader based on: plasma effect

Output ONLY raw GLSL code - NO markdown, NO explanation.
Start with precision highp float;`;

async function testVariant(name, body) {
  process.stdout.write(`${name.padEnd(20)}... `);
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
      body: JSON.stringify(body)
    });
    
    clearTimeout(timeout);
    const duration = Date.now() - start;
    
    if (!resp.ok) {
      console.log(`HTTP ${resp.status} (${duration}ms)`);
      return;
    }
    const data = await resp.json();
    if (data.choices?.[0]?.message?.content) {
      console.log(`✅ ${data.choices[0].message.content.length} chars (${duration}ms)`);
    } else {
      console.log(`⚠️ No content (${duration}ms) - ${JSON.stringify(data).slice(0,100)}`);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log(`⏱️ TIMEOUT (>15s)`);
    } else {
      console.log(`❌ ${err.message}`);
    }
  }
}

console.log("Testing MiniMax GLSL with different params...\n");

// Base messages
const messages = [
  {role: "system", content: basePrompt},
  {role: "user", content: "Generate the shader"}
];

await testVariant("No extra params", {model: "MiniMax-M2.7", messages});
await testVariant("With temperature", {model: "MiniMax-M2.7", messages, temperature: 0.7});
await testVariant("With max_tokens", {model: "MiniMax-M2.7", messages, max_tokens: 8000});
await testVariant("With both", {model: "MiniMax-M2.7", messages, temperature: 0.7, max_tokens: 8000});

console.log("\nDone!");
