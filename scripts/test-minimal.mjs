// Find minimal working prompt
const API_KEY = process.env.LIMINAL_LLM_API_KEY;

const prompts = [
  { name: "Ultra minimal", system: "Generate GLSL shader", user: "Plasma effect" },
  { name: "Short no constraints", system: "You are a GLSL programmer. Generate shaders.", user: "Plasma effect" },
  { name: "No CRITICAL keyword", system: "You are a GLSL programmer. Output raw GLSL code only.", user: "Plasma effect" },
  { name: "With constraints", system: "You are a GLSL programmer. CONSTRAINTS: Output raw GLSL code only. No markdown.", user: "Plasma effect" },
];

async function testPrompt(name, systemPrompt, userPrompt) {
  process.stdout.write(`${name.padEnd(25)}... `);
  const start = Date.now();
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
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
          {role: "user", content: userPrompt}
        ],
        temperature: 0.7,
        max_tokens: 8000
      }),
      signal: controller.signal
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
      console.log(`⚠️ No content (${duration}ms)`);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log(`⏱️ TIMEOUT`);
    } else {
      console.log(`❌ ${err.message}`);
    }
  }
}

console.log("Testing various prompts...\n");
for (const p of prompts) {
  await testPrompt(p.name, p.system, p.user);
}
console.log("\nDone!");
