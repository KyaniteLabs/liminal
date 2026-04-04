<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Creative Coding Portfolio</title>
<style>
  :root {
    --primary: #6c5ce7;
    --secondary: #a29bfe;
    --dark: #2d3436;
    --light: #dfe6e9;
    --bg: #f5f6fa;
    --card-bg: #ffffff;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background-color: var(--bg);
    color: var(--dark);
    line-height: 1.6;
  }

  /* Hero Section */
  .hero {
    position: relative;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    overflow: hidden;
    color: #fff;
  }

  .hero::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(270deg, #ff9a9e, #fecfef, #a1c4fd, #c2e9fb, #ff9a9e);
    background-size: 400% 400%;
    animation: gradientShift 15s ease infinite;
    z-index: -1;
  }

  @keyframes gradientShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  .hero-content h1 {
    font-size: clamp(2.5rem, 5vw, 4rem);
    margin-bottom: 1rem;
    text-shadow: 2px 2px 8px rgba(0,0,0,0.3);
  }

  .hero-content p {
    font-size: clamp(1rem, 2.5vw, 1.5rem);
    margin-bottom: 2rem;
    opacity: 0.9;
  }

  .btn {
    display: inline-block;
    padding: 0.75rem 2rem;
    background: var(--primary);
    color: #fff;
    border-radius: 50px;
    text-decoration: none;
    font-weight: bold;
    transition: background 0.3s;
  }

  .btn:hover { background: var(--secondary); }

  /* Section common */
  section { padding: 5rem 1.5rem; }

  .container {
    max-width: 1100px;
    margin: 0 auto;
  }

  .section-title {
    text-align: center;
    font-size: 2.5rem;
    margin-bottom: 3rem;
    color: var(--primary);
  }

  /* Projects Grid */
  .projects-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 2rem;
  }

  .project-card {
    background: var(--card-bg);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    transition: transform 0.3s, box-shadow 0.3s;
  }

  .project-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 25px rgba(0,0,0,0.15);
  }

  .project-image {
    height: 200px;
    background: linear-gradient(135deg, var(--primary), var(--secondary));
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 3rem;
  }

  .project-info { padding: 1.5rem; }

  .project-info h3 { margin-bottom: 0.5rem; color: var(--dark); }

  .project-info p { font-size: 0.95rem; color: #636e72; margin-bottom: 1rem; }

  .project-link {
    color: var(--primary);
    text-decoration: none;
    font-weight: bold;
  }

  .project-link:hover { text-decoration: underline; }

  /* Contact Form */
  .contact-form {
    background: var(--card-bg);
    max-width: 600px;
    margin: 0 auto;
    padding: 2.5rem;
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  }

  .form-group { margin-bottom: 1.5rem; }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid #dfe6e9;
    border-radius: 8px;
    font-size: 1rem;
    transition: border-color 0.3s;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--primary);
  }

  .form-group textarea { resize: vertical; min-height: 150px; }

  .submit-btn {
    width: 100%;
    padding: 0.85rem;
    background: var(--primary);
    color: #fff;
    border: none;
    border-radius: 50px;
    font-size: 1.1rem;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.3s;
  }

  .submit-btn:hover { background: var(--secondary); }

  /* Footer */
  footer {
    text-align: center;
    padding: 2rem;
    background: var(--dark);
    color: #fff;
    font-size: 0.9rem;
  }

  /* Responsive tweaks */
  @media (max-width: 768px) {
    .hero-content h1 { font-size: 2.2rem; }
    .hero-content p { font-size: 1rem; }
    .section-title { font-size: 2rem; }
    .contact-form { padding: 1.5rem; }
  }
</style>
</head>
<body>

<!-- Hero -->
<section class="hero">
  <div class="hero-content">
    <h1>Creative Coding Portfolio</h1>
    <p>Exploring the intersection of art, code, and interaction</p>
    <a href="#projects" class="btn">View Projects</a>
  </div>
</section>

<!-- Projects -->
<section id="projects">
  <div class="container">
    <h2 class="section-title">Featured Projects</h2>
    <div class="projects-grid">
      <article class="project-card">
        <div class="project-image">&#x1F300;</div>
        <div class="project-info">
          <h3>Generative Landscapes</h3>
          <p>WebGL-based procedural terrain generator using noise algorithms.</p>
          <a href="#" class="project-link">Explore &rarr;</a>
        </div>
      </article>
      <article class="project-card">
        <div class="project-image">&#x1F4BB;</div>
        <div class="project-info">
          <h3>Interactive Data Viz</h3>
          <p>D3.js dashboard visualizing global climate data with animated transitions.</p>
          <a href="#" class="project-link">Explore &rarr;</a>
        </div>
      </article>
      <article class="project-card">
        <div class="project-image">&#x1F3A8;</div>
        <div class="project-info">
          <h3>Audio-Reactive Art</h3>
          <p>Real-time canvas sketches that respond to microphone input using the Web Audio API.</p>
          <a href="#" class="project-link">Explore &rarr;</a>
        </div>
      </article>
      <article class="project-card">
        <div class="project-image">&#x1F310;</div>
        <div class="project-info">
          <h3>AR Street Art</h3>
          <p>Augmented reality installation overlaying animated graffiti onto urban environments.</p>
          <a href="#" class="project-link">Explore &rarr;</a>
        </div>
      </article>
    </div>
  </div>
</section>

<!-- Contact -->
<section id="contact">
  <div class="container">
    <h2 class="section-title">Get in Touch</h2>
    <form class="contact-form" onsubmit="handleSubmit(event)">
      <div class="form-group">
        <label for="name">Name</label>
        <input type="text" id="name" name="name" placeholder="Your name" required>
      </div>
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" placeholder="your@email.com" required>
      </div>
      <div class="form-group">
        <label for="message">Message</label>
        <textarea id="message" name="message" placeholder="Write your message here..." required></textarea>
      </div>
      <button type="submit" class="submit-btn">Send Message</button>
    </form>
  </div>
</section>

<!-- Footer -->
<footer>
  <p>&copy; 2026 Creative Coding Portfolio. Built with passion and code.</p>
</footer>

<script>
  function handleSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('name').value;
    alert(`Thanks ${name}! Your message has been sent.`);
    e.target.reset();
  }
</script>
</body>
</html>