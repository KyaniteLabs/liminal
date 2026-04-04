<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Creative Coding Portfolio</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;600;800&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #0f0f13;
  --card-bg: #1a1a24;
  --accent: #8a2be2;
  --accent2: #ff6ec7;
  --text: #e6e6e6;
  --muted: #a0a0b0;
  --gradient-start: #ff00cc;
  --gradient-mid: #333399;
  --gradient-end: #00d2ff;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  font-family: 'Inter', sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
}
nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 5%;
  background: rgba(15,15,19,0.85);
  backdrop-filter: blur(10px);
  z-index: 100;
}
.logo { font-weight: 800; font-size: 1.4rem; letter-spacing: -0.03em; }
.logo span { color: var(--accent2); }
.nav-links { list-style: none; display: flex; gap: 2rem; }
.nav-links a { color: var(--muted); text-decoration: none; font-weight: 600; transition: color .3s; }
.nav-links a:hover { color: var(--accent2); }

/* Hero */
.hero {
  position: relative;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  overflow: hidden;
  padding: 0 1rem;
}
.hero-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(-45deg, var(--gradient-start), var(--gradient-mid), var(--gradient-end), var(--gradient-start));
  background-size: 400% 400%;
  animation: gradientShift 8s ease infinite;
  z-index: -1;
}
@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.hero h1 {
  font-size: clamp(2.5rem, 6vw, 5rem);
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1.1;
  margin-bottom: 1rem;
}
.hero p {
  font-size: clamp(1rem, 2vw, 1.25rem);
  color: var(--muted);
  max-width: 600px;
  margin-bottom: 2rem;
}
.btn {
  padding: .75rem 2rem;
  border-radius: 9999px;
  font-weight: 600;
  text-decoration: none;
  transition: transform .2s, box-shadow .2s;
}
.btn-primary {
  background: var(--accent2);
  color: #fff;
}
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(255,110,199,0.4);
}

/* Projects */
.section { padding: 5rem 5%; }
.section-title { font-size: 2rem; font-weight: 800; margin-bottom: 2rem; text-align: center; }
.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 2rem;
}
.card {
  background: var(--card-bg);
  border-radius: 12px;
  overflow: hidden;
  transition: transform .3s, box-shadow .3s;
  display: flex;
  flex-direction: column;
}
.card:hover {
  transform: translateY(-5px);
  box-shadow: 0 20px 40px rgba(0,0,0,0.5);
}
.card img {
  width: 100%;
  aspect-ratio: 16/9;
  object-fit: cover;
}
.card-content { padding: 1.25rem; flex: 1; display: flex; flex-direction: column; }
.card h3 { font-size: 1.25rem; font-weight: 700; margin-bottom: .5rem; }
.card p { color: var(--muted); font-size: .9rem; flex: 1; margin-bottom: 1rem; }
.card-tags { display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: 1rem; }
.tag {
  background: rgba(138,43,226,0.2);
  color: var(--accent2);
  padding: .2rem .6rem;
  border-radius: 999px;
  font-size: .75rem;
  font-weight: 600;
}
.card-link {
  color: var(--accent2);
  text-decoration: none;
  font-weight: 600;
  align-self: flex-start;
  border-bottom: 2px solid transparent;
  transition: border-color .2s;
}
.card-link:hover { border-color: var(--accent2); }

/* Contact */
.contact-wrap { max-width: 600px; margin: 0 auto; }
.contact-form { display: flex; flex-direction: column; gap: 1rem; }
.form-group { display: flex; flex-direction: column; gap: .4rem; }
label { font-weight: 600; font-size: .9rem; }
input, textarea {
  background: var(--card-bg);
  border: 1px solid #333;
  border-radius: 8px;
  padding: .75rem 1rem;
  color: var(--text);
  font-family: inherit;
  font-size: 1rem;
  transition: border-color .2s;
}
input:focus, textarea:focus {
  outline: none;
  border-color: var(--accent2);
}
textarea { resize: vertical; min-height: 120px; }
.btn-submit {
  background: var(--accent);
  color: #fff;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  padding: .75rem;
  border-radius: 8px;
  transition: background .2s, transform .2s;
}
.btn-submit:hover { background: var(--accent2); transform: translateY(-2px); }

/* Footer */
footer {
  text-align: center;
  padding: 2rem;
  color: var(--muted);
  font-size: .875rem;
  border-top: 1px solid #222;
  margin-top: 4rem;
}

/* Responsive */
@media (max-width: 600px) {
  .nav-links { display: none; }
  .hero h1 { font-size: 2.5rem; }
}
</style>
</head>
<body>

<nav>
  <div class="logo">code<span>art</span></div>
  <ul class="nav-links">
    <li><a href="#projects">Projects</a></li>
    <li><a href="#contact">Contact</a></li>
  </ul>
</nav>

<section class="hero">
  <div class="hero-bg"></div>
  <h1>Creative Coding<br>Portfolio</h1>
  <p>Blending algorithms, visuals, and interaction to craft unforgettable digital experiences.</p>
  <a href="#projects" class="btn btn-primary">View Projects</a>
</section>

<section id="projects" class="section">
  <h2 class="section-title">Selected Works</h2>
  <div class="projects-grid">
    <article class="card">
      <img src="https://picsum.photos/id/1015/800/450" alt="Generative Landscape">
      <div class="card-content">
        <h3>Generative Landscape</h3>
        <p>Procedural terrain rendered in WebGL, evolving over time using noise functions.</p>
        <div class="card-tags">
          <span class="tag">WebGL</span>
          <span class="tag">GLSL</span>
          <span class="tag">p5.js</span>
        </div>
        <a href="#" class="card-link">Explore →</a>
      </div>
    </article>
    <article class="card">
      <img src="https://picsum.photos/id/1016/800/450" alt="Audio Visualizer">
      <div class="card-content">
        <h3>Audio Visualizer</h3>
        <p>Real‑time audio analysis that drives geometric patterns and color shifts.</p>
        <div class="card-tags">
          <span class="tag">Web Audio API</span>
          <span class="tag">Canvas</span>
          <span class="tag">Tone.js</span>
        </div>
        <a href="#" class="card-link">Explore →</a>
      </div>
    </article>
    <article class="card">
      <img src="https://picsum.photos/id/1018/800/450" alt="Interactive Install">
      <div class="card-content">
        <h3>Interactive Install</h3>
        <p>Projection‑mapped installation responding to movement captured by depth cameras.</p>
        <div class="card-tags">
          <span class="tag">OpenCV</span>
          <span class="tag">TouchDesigner</span>
          <span class="tag">Syphon</span>
        </div>
        <a href="#" class="card-link">Explore →</a>
      </div>
    </article>
    <article class="card">
      <img src="https://picsum.photos/id/1025/800/450" alt="Data Sculpture">
      <div class="card-content">
        <h3>Data Sculpture</h3>
        <p>Live data streams visualized as evolving 3D forms using D3 and Three.js.</p>
        <div class="card-tags">
          <span class="tag">D3.js</span>
          <span class="tag">Three.js</span>
          <span class="tag">API</span>
        </div>
        <a href="#" class="card-link">Explore →</a>
      </div>
    </article>
  </div>
</section>

<section id="contact" class="section">
  <h2 class="section-title">Get in Touch</h2>
  <div class="contact-wrap">
    <form class="contact-form" onsubmit="event.preventDefault(); alert('Thank you! I will be in touch soon.');">
      <div class="form-group">
        <label for="name">Name</label>
        <input type="text" id="name" name="name" placeholder="Your name" required>
      </div>
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" placeholder="you@example.com" required>
      </div>
      <div class="form-group">
        <label for="message">Message</label>
        <textarea id="message" name="message" placeholder="Tell me about your project..." required></textarea>
      </div>
      <button type="submit" class="btn-submit">Send Message</button>
    </form>
  </div>
</section>

<footer>
  <p>© 2026 CodeArt. Built with code & curiosity.</p>
</footer>

</body>
</html>