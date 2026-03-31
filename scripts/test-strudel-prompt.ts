import { PromptLibrary } from '../src/prompts/index.js';

try {
  const result = PromptLibrary.render("music.strudel", { prompt: "techno beat", bpm: "120" });
  console.log("System:", result.system.slice(0, 200));
  console.log("...");
  console.log("User:", result.user);
} catch (err) {
  console.error("Error:", err);
}
