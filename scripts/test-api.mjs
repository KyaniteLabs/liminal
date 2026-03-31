// Test MiniMax API directly with GLSL prompt
const API_KEY = process.env.LIMINAL_LLM_API_KEY;

const prompt = `You are a senior GLSL shader programmer.

Generate a fragment shader based on: plasma effect

Output ONLY raw GLSL code - NO markdown, NO explanation.
Start with precision highp float;`;

console.log("Calling MiniMax API directly...");
const start = Date.now();

try {
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
  
  const duration = Date.now() - start;
  console.log(`Status: ${resp.status} (${duration}ms)`);
  
  const data = await resp.json();
  
  if (data.choices?.[0]?.message?.content) {
    console.log("✅ Got response!");
    console.log("Content length:", data.choices[0].message.content.length);
  } else {
    console.log("❌ No content in response");
    console.log(JSON.stringify(data, null, 2).slice(0, 1000));
  }
} catch (err) {
  console.error("Error:", err.message);
}
