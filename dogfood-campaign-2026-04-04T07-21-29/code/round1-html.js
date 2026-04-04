<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Creative Coding Portfolio</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #0f0f13;
    --card-bg: #1a1a24;
    --accent: #00e5ff;
    --accent2: #ff00e5;
    --text: #e0e0e0;
    --text-muted: #a0a0b0;
    --gradient: linear-gradient(135deg, #00e5ff, #ff00e5, #00e5ff);
  }

  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html {
    scroll-behavior: smooth;
  }

  body {
    font-family: 'Inter', sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    overflow-x: hidden;
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  ul {
    list-style: none;
  }

  /* Navigation */
  .nav {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    padding: 1rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(15, 15, 19, 0.8);
    backdrop-filter: blur(10px);
    z-index: 1000;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  .nav__logo {
    font-family: 'Space Mono', monospace;
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: -0.5px;
  }

  .nav__links {
    display: flex;
    gap: 2rem;
  }

  .nav__link {
    font-size: 0.95rem;
    color: var(--text-muted);
    transition: color 0.3s;
  }

  .nav__link:hover {
    color: var(--accent);
  }

  .nav__hamburger {
    display: none;
    flex-direction: column;
    gap: 5px;
    cursor: pointer;
  }

  .nav__hamburger span {
    width: 24px;
    height: 2px;
    background: var(--text);
    transition: all 0.3s;
  }

  /* Mobile Menu */
  .mobile-menu {
    position: fixed;
    top: 0;
    right: -100%;
    width: 100%;
    height: 100vh;
    background: rgba(15, 15, 19, 0.98);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2rem;
    transition: right 0.4s ease;
    z-index: 999;
  }

  .mobile-menu.active {
    right: 0;
  }

  .mobile-menu .nav__link {
    font-size: 1.5rem;
    font-family: 'Space Mono', monospace;
  }

  /* Hero Section */
  .hero {
    position: relative;
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    overflow: hidden;
  }

  .hero__bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--gradient);
    background-size: 400% 400%;
    animation: gradientShift 8s ease infinite;
    z-index: -2;
    filter: blur(60px);
    opacity: 0.6;
  }

  .hero__overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(15, 15, 19, 0.7);
    z-index: -1;
  }

  .hero__content {
    max-width: 800px;
    padding: 0 2rem;
    z-index: 1;
  }

  .hero__title {
    font-family: 'Space Mono', monospace;
    font-size: clamp(2.5rem, 6vw, 5rem);
    font-weight: 700;
    line-height: 1.1;
    margin-bottom: 1rem;
    background: var(--gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero__subtitle {
    font-size: clamp(1rem, 2vw, 1.25rem);
    color: var(--text-muted);
    margin-bottom: 2.5rem;
  }

  .btn {
    display: inline-block;
    padding: 0.8rem 2rem;
    font-family: 'Space Mono', monospace;
    font-size: 0.95rem;
    color: var(--bg);
    background: var(--accent);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .btn:hover {
    transform: translateY(-3px);
    box-shadow: 0 0 20px rgba(0, 229, 255, 0.5);
  }

  .btn:active {
    transform: translateY(0);
  }

  /* Section Styles */
  section {
    padding: 5rem 2rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .section-title {
    font-family: 'Space Mono', monospace;
    font-size: 2rem;
    margin-bottom: 3rem;
    text-align: center;
    position: relative;
    display: inline-block;
    left: 50%;
    transform: translateX(-50%);
  }

  .section-title::after {
    content: '';
    display: block;
    width: 60px;
    height: 3px;
    background: var(--gradient);
    margin: 0.5rem auto 0;
    border-radius: 2px;
  }

  /* Projects Grid */
  .projects__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
  }

  .project-card {
    background: var(--card-bg);
    border-radius: 12px;
    overflow: hidden;
    transition: transform 0.3s, box-shadow 0.3s;
    border: 1px solid rgba(255,255,255,0.05);
  }

  .project-card:hover {
    transform: translateY(-8px);
    box-shadow: 0 20px 40px rgba(0,0,0,0.4);
    border-color: rgba(0,229,255,0.3);
  }

  .project-card__image {
    width: 100%;
    height: 200px;
    object-fit: cover;
    display: block;
  }

  .project-card__body {
    padding: 1.5rem;
  }

  .project-card__title {
    font-family: 'Space Mono', monospace;
    font-size: 1.2rem;
    margin-bottom: 0.5rem;
    color: var(--accent);
  }

  .project-card__desc {
    font-size: 0.9rem;
    color: var(--text-muted);
    margin-bottom: 1rem;
  }

  .project-card__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .tag {
    font-size: 0.75rem;
    padding: 0.2rem 0.6rem;
    background: rgba(0, 229, 255, 0.1);
    color: var(--accent);
    border-radius: 20px;
    border: 1px solid rgba(0, 229, 255, 0.2);
  }

  .project-card__link {
    display: inline-block;
    font-family: 'Space Mono', monospace;
    font-size: 0.85rem;
    color: var(--accent);
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s;
  }

  .project-card__link:hover {
    border-color: var(--accent);
  }

  /* Contact Form */
  .contact__form {
    max-width: 600px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
  }

  .form-group {
    position: relative;
  }

  .form-group label {
    position: absolute;
    top: 50%;
    left: 1rem;
    transform: translateY(-50%);
    font-size: 0.9rem;
    color: var(--text-muted);
    pointer-events: none;
    transition: all 0.2s;
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 1rem 1rem 0.5rem;
    background: var(--card-bg);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    color: var(--text);
    font-family: 'Inter', sans-serif;
    font-size: 1rem;
    outline: none;
    transition: border-color 0.2s;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    border-color: var(--accent);
  }

  .form-group input:focus + label,
  .form-group input:not(:placeholder-shown) + label,
  .form-group textarea:focus + label,
  .form-group textarea:not(:placeholder-shown) + label {
    top: 0.5rem;
    font-size: 0.7rem;
    color: var(--accent);
  }

  .form-group textarea {
    min-height: 150px;
    resize: vertical;
  }

  .btn--submit {
    background: var(--accent);
    color: var(--bg);
    padding: 1rem;
    font-size: 1rem;
    font-weight: 600;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    font-family: 'Space Mono', monospace;
  }

  .btn--submit:hover {
    transform: translateY(-3px);
    box-shadow: 0 0 25px rgba(0, 229, 255, 0.5);
  }

  .btn--submit:active {
    transform: translateY(0);
  }

  /* Footer */
  footer {
    text-align: center;
    padding: 2rem;
    font-size: 0.85rem;
    color: var(--text-muted);
    border-top: 1px solid rgba(255,255,255,0.05);
  }

  /* Animations */
  @keyframes gradientShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  /* Responsive */
  @media (max-width: 768px) {
    .nav__links {
      display: none;
    }

    .nav__hamburger {
      display: flex;
    }

    .hero__title {
      font-size: 2.5rem;
    }

    section {
      padding: 3rem 1.5rem;
    }

    .projects__grid {
      grid-template-columns: 1fr;
    }
  }
</style>
</head>
<body>

<!-- Navigation -->
<nav class="nav">
  <a href="#" class="nav__logo">CC_Portfolio</a>
  <ul class="nav__links">
    <li><a href="#hero" class="nav__link">Home</a></li>
    <li><a href="#projects" class="nav__link">Projects</a></li>
    <li><a href="#contact" class="nav__link">Contact</a></li>
  </ul>
  <div class="nav__hamburger" id="hamburger" aria-label="Toggle menu" role="button" tabindex="0">
    <span></span>
    <span></span>
    <span></span>
  </div>
</nav>

<!-- Mobile Menu -->
<div class="mobile-menu" id="mobileMenu">
  <a href="#hero" class="nav__link">Home</a>
  <a href="#projects" class="nav__link">Projects</a>
  <a href="#contact" class="nav__link">Contact</a>
</div>

<!-- Hero Section -->
<section id="hero" class="hero">
  <div class="hero__bg"></div>
  <div class="hero__overlay"></div>
  <div class="hero__content">
    <h1 class="hero__title">Creative Coding Portfolio</h1>
    <p class="hero__subtitle">Crafting digital experiences at the intersection of art and technology.</p>
    <a href="#projects" class="btn">View Projects</a>
  </div>
</section>

<!-- Projects Section -->
<section id="projects">
  <h2 class="section-title">Selected Works</h2>
  <div class="projects__grid">
    <!-- Card 1 -->
    <article class="project-card">
      <img src="https://picsum.photos/id/1/800/600" alt="Project One" class="project-card__image">
      <div class="project-card__body">
        <h3 class="project-card__title">Interactive Sound Visualizer</h3>
        <p class="project-card__desc">Real‑time audio visualization using Web Audio API and Three.js. Reactive shaders create immersive environments driven by music.</p>
        <div class="project-card__tags">
          <span class="tag">Web