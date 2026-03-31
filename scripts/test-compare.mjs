const API_KEY = process.env.LIMINAL_LLM_API_KEY;

// Test A: Working version (from test-api.mjs)
async function testA() {
  const prompt = `You are a senior GLSL shader programmer.

Generate a fragment shader based on: plasma effect

Output ONLY raw GLSL code - NO markdown, NO explanation.
Start with precision highp float;`;

  const resp = await fetch("https://api.minimax.io/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: "MiniMax-M2.7",
      messages: [
        {role: "system", content: prompt},
        {role: "user", content: "Generate the shader"}
      ]
    })
  });
  return resp;
}

// Test B: Same but with temp/max_tokens
async function testB() {
  const prompt = `You are a senior GLSL shader programmer.

Generate a fragment shader based on: plasma effect

Output ONLY raw GLSL code - NO markdown, NO explanation.
Start with precision highp float;`;

  const resp = await fetch("https://api.minimax.io/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: "MiniMax-M2.7",
      messages: [
        {role: "system", content: prompt},
        {role: "user", content: "Generate the shader"}
      ],
      temperature: 0.7,
      max_tokens: 8000
    })
  });
  return resp;
}

async function runTest(name, fn) {
  process.stdout.write(`${name.padEnd(15)}... `);
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    
    const resp = await fn();
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
      console.log(`⚠️ No content (${duration}ms)`);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log(`⏱️ TIMEOUT (>15s)`);
    } else {
      console.log(`❌ ${err.message}`);
    }
  }
}

console.log("Comparing API calls...\n");
await runTest("Without params", testA);
await runTest("With params", testB);
console.log("\nDone!");
