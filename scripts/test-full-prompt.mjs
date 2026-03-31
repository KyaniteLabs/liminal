const API_KEY = process.env.LIMINAL_LLM_API_KEY;

const FULL_PROMPT = `You are a senior GLSL shader programmer specializing in real-time generative visuals.

Generate a creative fragment shader based on the user's description.

CONSTRAINTS:
- CRITICAL: Output ONLY the raw GLSL code - NO markdown fences, NO code blocks
- CRITICAL: DO NOT include any explanatory text, reasoning, or commentary
- CRITICAL: Start directly with precision highp float; or uniform declarations
- DO NOT use texture lookups without providing a fallback color/value
- DO NOT use loops with unbounded iteration counts — always set a maximum
- DO NOT use deprecated GLSL features (gl_FragColor is acceptable for WebGL 1 compatibility)

OUTPUT FORMAT:
- Output a single GLSL fragment shader code block
- MUST include precision highp float; as the first line

DOMAIN RULES:
- MUST include these uniforms: vec2 u_resolution, float u_time
- SHOULD include: vec2 u_mouse (normalized coordinates 0-1, updated on mousemove)
- Output via gl_FragColor (WebGL 1 compatibility)
- Use #define for reusable constants instead of magic numbers
- Target 60fps — avoid more than 3 nested loops
- Profile complex ray marching scenes: limit step count and iteration depth
- Use noise functions (value noise, simplex noise) for organic variation
- Ensure smooth animation with u_time — avoid static or jarring transitions`;

const USER_PROMPT = "Create a GLSL fragment shader: Create a GLSL fragment shader with a plasma effect";

async function testPrompt() {
  console.log("Testing FULL PromptLibrary GLSL prompt...\n");
  const start = Date.now();
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    
    const resp = await fetch("https://api.minimax.io/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "MiniMax-M2.7",
        messages: [
          {role: "system", content: FULL_PROMPT},
          {role: "user", content: USER_PROMPT}
        ],
        temperature: 0.7,
        max_tokens: 8000
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    const duration = Date.now() - start;
    
    console.log(`Status: ${resp.status} (${duration}ms)`);
    
    const data = await resp.json();
    if (data.choices?.[0]?.message?.content) {
      console.log(`✅ SUCCESS - ${data.choices[0].message.content.length} chars`);
    } else {
      console.log(`⚠️ No choices in response:`);
      console.log(JSON.stringify(data, null, 2).slice(0, 500));
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log(`⏱️ TIMEOUT (>60s)`);
    } else {
      console.log(`❌ Error: ${err.message}`);
    }
  }
}

testPrompt();
