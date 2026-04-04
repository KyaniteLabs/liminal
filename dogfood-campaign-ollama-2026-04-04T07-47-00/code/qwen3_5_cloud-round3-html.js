<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Creative Coder | Portfolio</title>
    <style>
        :root {
            --bg-color: #0f172a;
            --text-color: #f8fafc;
            --accent-color: #38bdf8;
            --card-bg: #1e293b;
            --gradient-1: #4f46e5;
            --gradient-2: #ec4899;
            --gradient-3: #8b5cf6;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        }

        body {
            background-color: var(--bg-color);
            color: var(--text-color);
            line-height: 1.6;
            overflow-x: hidden;
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
        }

        .logo {
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--accent-color);
            text-decoration: none;
        }

        .nav-links {
            display: flex;
            gap: 2rem;
        }

        .nav-links a {
            color: var(--text-color);
            text-decoration: none;
            transition: color 0.3s;
        }

        .nav-links a:hover {
            color: var(--accent-color);
        }

        /* Hero Section with Animated Gradient */
        .hero {
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            padding: 0 1rem;
            background: linear-gradient(-45deg, var(--gradient-1), var(--gradient-2), var(--gradient-3), var(--gradient-1));
            background-size: 400% 400%;
            animation: gradientBG 15s ease infinite;
            position: relative;
        }

        .hero::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(15, 23, 42, 0.7);
        }

        .hero-content {
            position: relative;
            z-index: 1;
            max-width: 800px;
        }

        .hero h1 {
            font-size: 4rem;
            margin-bottom: 1rem;
            line-height: 1.1;
        }

        .hero p {
            font-size: 1.25rem;
            margin-bottom: 2rem;
            opacity: 0.9;
        }

        .cta-button {
            display: inline-block;
            padding: 1rem 2rem;
            background-color: var(--accent-color);
            color: var(--bg-color);
            text-decoration: none;
            font-weight: bold;
            border-radius: 50px;
            transition: transform 0.3s, box-shadow 0.3s;
        }

        .cta-button:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 20px rgba(56, 189, 248, 0.3);
        }

        @keyframes gradientBG {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }

        /* Projects Section */
        .section {
            padding: 5rem 5%;
        }

        .section-title {
            font-size: 2.5rem;
            margin-bottom: 3rem;
            text-align: center;
        }

        .projects-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
        }

        .card {
            background-color: var(--card-bg);
            border-radius: 12px;
            overflow: hidden;
            transition: transform 0.3s;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .card:hover {
            transform: translateY(-10px);
        }

        .card-image {
            height: 200px;
            background-color: #334155;
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgba(255,255,255,0.2);
            font-size: 3rem;
        }

        .card-content {
            padding: 1.5rem;
        }

        .card-title {
            font-size: 1.5rem;
            margin-bottom: 0.5rem;
        }

        .card-desc {
            color: #94a3b8;
            margin-bottom: 1.5rem;
            font-size: 0.95rem;
        }

        .card-link {
            color: var(--accent-color);
            text-decoration: none;
            font-weight: 600;
        }

        /* Contact Form */
        .contact-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: var(--card-bg);
            padding: 2rem;
            border-radius: 12px;
        }

        .form-group {
            margin-bottom: 1.5rem;
        }

        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            color: #cbd5e1;
        }

        .form-control {
            width: 100%;
            padding: 0.8rem;
            background-color: var(--bg-color);
            border: 1px solid #334155;
            border-radius: 6px;
            color: var(--text-color);
            font-size: 1rem;
        }

        .form-control:focus {
            outline: none;
            border-color: var(--accent-color);
        }

        button[type="submit"] {
            width: 100%;
            padding: 1rem;
            background-color: var(--accent-color);
            color: var(--bg-color);
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            font-weight: bold;
            cursor: pointer;
            transition: opacity 0.3s;
        }

        button[type="submit"]:hover {
            opacity: 0.9;
        }

        /* Footer */
        footer {
            text-align: center;
            padding: 2rem;
            background-color: #020617;
            color: #64748b;
            font-size: 0.9rem;
        }

        /* Responsive */
        @media (max-width: 768px) {
            .hero h1 { font-size: 2.5rem; }
            .nav-links { display: none; } /* Simplified for demo */
        }
    </style>
</head>
<body>

    <nav>
        <a href="#" class="logo">DEV.IO</a>
        <div class="nav-links">
            <a href="#projects">Work</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
        </div>
    </nav>

    <section class="hero">
        <div class="hero-content">
            <h1>Creative Code &<br>Digital Experiences</h1>
            <p>I build interactive web applications and generative art using modern technologies.</p>
            <a href="#projects" class="cta-button">View My Work</a>
        </div>
    </section>

    <section id="projects" class="section">
        <h2 class="section-title">Selected Projects</h2>
        <div class="projects-grid">
            <!-- Project 1 -->
            <div class="card">
                <div class="card-image">🎨</div>
                <div class="card-content">
                    <h3 class="card-title">Generative Particles</h3>
                    <p class="card-desc">A WebGL experiment exploring particle physics and mouse interaction.</p>
                    <a href="#" class="card-link">View Project &rarr;</a>
                </div>
            </div>
            <!-- Project 2 -->
            <div class="card">
                <div class="card-image">📊</div>
                <div class="card-content">
                    <h3 class="card-title">Data Visualization</h3>
                    <p class="card-desc">Interactive D3.js dashboard visualizing global climate data trends.</p>
                    <a href="#" class="card-link">View Project &rarr;</a>
                </div>
            </div>
            <!-- Project 3 -->
            <div class="card">
                <div class="card-image">🤖</div>
                <div class="card-content">
                    <h3 class="card-title">AI Chat Interface</h3>
                    <p class="card-desc">A sleek, responsive UI for conversational AI built with React.</p>
                    <a href="#" class="card-link">View Project &rarr;</a>
                </div>
            </div>
        </div>
    </section>

    <section id="contact" class="section">
        <h2 class="section-title">Get In Touch</h2>
        <div class="contact-container">
            <form action="#" method="POST">
                <div class="form-group">
                    <label for="name">Name</label>
                    <input type="text" id="name" class="form-control" placeholder="Your Name" required>
                </div>
                <div class="form-group">
                    <label for="email">Email</label>
                    <input type="email" id="email" class="form-control" placeholder="your@email.com" required>
                </div>
                <div class="form-group">
                    <label for="message">Message</label>
                    <textarea id="message" rows="5" class="form-control" placeholder="Let's build something cool..." required></textarea>
                </div>
                <button type="submit">Send Message</button>
            </form>
        </div>
    </section>

    <footer>
        <p>&copy; 2023 Dev.io Portfolio. Built with HTML, CSS & JS.</p>
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
    </script>
</body>
</html>