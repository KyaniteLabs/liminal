<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DevPortfolio | Creative Coding</title>
    <style>
        :root {
            --bg-dark: #0f172a;
            --text-light: #f8fafc;
            --text-dim: #94a3b8;
            --accent-1: #ec4899;
            --accent-2: #8b5cf6;
            --accent-3: #06b6d4;
            --glass: rgba(30, 41, 59, 0.7);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        }

        body {
            background-color: var(--bg-dark);
            color: var(--text-light);
            overflow-x: hidden;
            line-height: 1.6;
        }

        /* Navigation */
        nav {
            position: fixed;
            top: 0;
            width: 100%;
            padding: 1.5rem 5%;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(15, 23, 42, 0.8);
            backdrop-filter: blur(10px);
            z-index: 1000;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .logo {
            font-size: 1.5rem;
            font-weight: 700;
            background: linear-gradient(to right, var(--accent-1), var(--accent-3));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .nav-links a {
            color: var(--text-light);
            text-decoration: none;
            margin-left: 2rem;
            font-size: 0.9rem;
            transition: color 0.3s;
        }

        .nav-links a:hover {
            color: var(--accent-3);
        }

        /* Hero Section with Animated Gradient */
        .hero {
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            position: relative;
            overflow: hidden;
        }

        .hero-bg {
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: linear-gradient(45deg, var(--bg-dark), var(--accent-2), var(--accent-1), var(--accent-3), var(--bg-dark));
            background-size: 400% 400%;
            animation: gradientMove 15s ease infinite;
            z-index: -1;
            opacity: 0.6;
        }

        @keyframes gradientMove {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }

        .hero-content {
            z-index: 1;
            padding: 0 1rem;
            max-width: 800px;
        }

        .hero h1 {
            font-size: 4rem;
            margin-bottom: 1rem;
            line-height: 1.1;
        }

        .hero p {
            font-size: 1.25rem;
            color: var(--text-dim);
            margin-bottom: 2rem;
        }

        .cta-btn {
            display: inline-block;
            padding: 1rem 2.5rem;
            background: var(--text-light);
            color: var(--bg-dark);
            text-decoration: none;
            font-weight: 600;
            border-radius: 50px;
            transition: transform 0.3s, box-shadow 0.3s;
        }

        .cta-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 20px rgba(255,255,255,0.2);
        }

        /* Projects Section */
        .projects {
            padding: 5rem 5%;
        }

        .section-title {
            font-size: 2.5rem;
            margin-bottom: 3rem;
            text-align: center;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
        }

        .card {
            background: var(--glass);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 1rem;
            padding: 2rem;
            transition: transform 0.3s, border-color 0.3s;
            cursor: pointer;
        }

        .card:hover {
            transform: translateY(-5px);
            border-color: var(--accent-3);
        }

        .card h3 {
            margin-bottom: 0.5rem;
            font-size: 1.5rem;
        }

        .card p {
            color: var(--text-dim);
            font-size: 0.95rem;
            margin-bottom: 1.5rem;
        }

        .tags {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
        }

        .tag {
            font-size: 0.75rem;
            padding: 0.25rem 0.75rem;
            background: rgba(255,255,255,0.1);
            border-radius: 20px;
            color: var(--accent-3);
        }

        /* Contact Section */
        .contact {
            padding: 5rem 5%;
            background: rgba(0,0,0,0.2);
        }

        .form-container {
            max-width: 600px;
            margin: 0 auto;
            background: var(--glass);
            padding: 3rem;
            border-radius: 1rem;
            border: 1px solid rgba(255,255,255,0.1);
        }

        .form-group {
            margin-bottom: 1.5rem;
        }

        label {
            display: block;
            margin-bottom: 0.5rem;
            font-size: 0.9rem;
            color: var(--text-dim);
        }

        input, textarea {
            width: 100%;
            padding: 1rem;
            background: rgba(15, 23, 42, 0.5);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 0.5rem;
            color: var(--text-light);
            font-size: 1rem;
            transition: border-color 0.3s;
        }

        input:focus, textarea:focus {
            outline: none;
            border-color: var(--accent-2);
        }

        button[type="submit"] {
            width: 100%;
            padding: 1rem;
            background: linear-gradient(to right, var(--accent-2), var(--accent-1));
            border: none;
            border-radius: 0.5rem;
            color: white;
            font-weight: 600;
            cursor: pointer;
            transition: opacity 0.3s;
        }

        button[type="submit"]:hover {
            opacity: 0.9;
        }

        footer {
            padding: 2rem;
            text-align: center;
            color: var(--text-dim);
            font-size: 0.9rem;
            border-top: 1px solid rgba(255,255,255,0.05);
        }

        /* Responsive */
        @media (max-width: 768px) {
            .hero h1 { font-size: 2.5rem; }
            .nav-links { display: none; } /* Simplified for demo */
            .form-container { padding: 1.5rem; }
        }
    </style>
</head>
<body>

    <nav>
        <div class="logo">DEV.PORTFOLIO</div>
        <div class="nav-links">
            <a href="#hero">Home</a>
            <a href="#projects">Work</a>
            <a href="#contact">Contact</a>
        </div>
    </nav>

    <section id="hero" class="hero">
        <div class="hero-bg"></div>
        <div class="hero-content">
            <h1>Code as Canvas</h1>
            <p>Building immersive digital experiences through creative coding, WebGL, and interactive design.</p>
            <a href="#projects" class="cta-btn">View Projects</a>
        </div>
    </section>

    <section id="projects" class="projects">
        <h2 class="section-title">Selected Works</h2>
        <div class="grid">
            <!-- Project 1 -->
            <div class="card">
                <h3>Generative Particles</h3>
                <p>An interactive particle system simulating fluid dynamics using WebGL and custom shaders.</p>
                <div class="tags">
                    <span class="tag">Three.js</span>
                    <span class="tag">GLSL</span>
                    <span class="tag">JavaScript</span>
                </div>
            </div>
            <!-- Project 2 -->
            <div class="card">
                <h3>Data Visualization</h3>
                <p>Real-time visualization of global network traffic data rendered in 3D space.</p>
                <div class="tags">
                    <span class="tag">D3.js</span>
                    <span class="tag">React</span>
                    <span class="tag">WebSockets</span>
                </div>
            </div>
            <!-- Project 3 -->
            <div class="card">
                <h3>Audio Reactive</h3>
                <p>A visualizer that responds to microphone input, creating geometric patterns synchronized to music.</p>
                <div class="tags">
                    <span class="tag">Web Audio API</span>
                    <span class="tag">Canvas</span>
                    <span class="tag">HTML5</span>
                </div>
            </div>
        </div>
    </section>

    <section id="contact" class="contact">
        <h2 class="section-title">Get In Touch</h2>
        <div class="form-container">
            <form id="contactForm">
                <div class="form-group">
                    <label for="name">Name</label>
                    <input type="text" id="name" required placeholder="John Doe">
                </div>
                <div class="form-group">
                    <label for="email">Email</label>
                    <input type="email" id="email" required placeholder="john@example.com">
                </div>
                <div class="form-group">
                    <label for="message">Message</label>
                    <textarea id="message" rows="5" required placeholder="Let's build something amazing..."></textarea>
                </div>
                <button type="submit">Send Message</button>
            </form>
        </div>
    </section>

    <footer>
        <p>&copy; 2023 Creative Coder. All rights reserved.</p>
    </footer>

    <script>
        // Smooth scrolling for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                document.querySelector(this.getAttribute('href')).scrollIntoView({
                    behavior: 'smooth'
                });
            });
        });

        // Simple form handling simulation
        document.getElementById('contactForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = this.querySelector('button');
            const originalText = btn.innerText;
            btn.innerText = 'Message Sent!';
            btn.style.background = '#10b981';
            setTimeout(() => {
                btn.innerText = originalText;
                btn.style.background = '';
                this.reset();
            }, 3000);
        });
    </script>
</body>
</html>