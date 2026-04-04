<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Creative Coder Portfolio</title>
    <style>
        :root {
            --primary: #6366f1;
            --secondary: #a855f7;
            --accent: #ec4899;
            --dark: #0f172a;
            --light: #f8fafc;
            --text-gray: #94a3b8;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        body {
            background-color: var(--dark);
            color: var(--light);
            line-height: 1.6;
            overflow-x: hidden;
        }

        /* Navigation */
        nav {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1.5rem 5%;
            position: absolute;
            width: 100%;
            z-index: 10;
        }

        .logo {
            font-size: 1.5rem;
            font-weight: 700;
            background: linear-gradient(to right, var(--primary), var(--accent));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .nav-links a {
            color: var(--light);
            text-decoration: none;
            margin-left: 2rem;
            font-weight: 500;
            transition: color 0.3s;
        }

        .nav-links a:hover {
            color: var(--accent);
        }

        /* Hero Section */
        .hero {
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            padding: 0 1rem;
            position: relative;
        }

        .hero-bg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(-45deg, #0f172a, #312e81, #4c1d95, #831843);
            background-size: 400% 400%;
            animation: gradientBG 15s ease infinite;
            z-index: -1;
            opacity: 0.8;
        }

        @keyframes gradientBG {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }

        .hero h1 {
            font-size: 4rem;
            margin-bottom: 1rem;
            line-height: 1.1;
        }

        .hero p {
            font-size: 1.25rem;
            color: var(--text-gray);
            max-width: 600px;
            margin-bottom: 2rem;
        }

        .btn {
            padding: 0.8rem 2rem;
            background: linear-gradient(90deg, var(--primary), var(--secondary));
            border: none;
            border-radius: 50px;
            color: white;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(99, 102, 241, 0.3);
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
            background: rgba(30, 41, 59, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 1rem;
            overflow: hidden;
            transition: transform 0.3s;
        }

        .card:hover {
            transform: translateY(-5px);
        }

        .card-image {
            height: 200px;
            width: 100%;
            background: linear-gradient(135deg, var(--primary), var(--accent));
            position: relative;
        }
        
        /* Abstract patterns for cards */
        .card:nth-child(1) .card-image { background: radial-gradient(circle at 30% 30%, #6366f1, transparent 60%), #1e293b; }
        .card:nth-child(2) .card-image { background: repeating-linear-gradient(45deg, #a855f7, #a855f7 10px, #1e293b 10px, #1e293b 20px); }
        .card:nth-child(3) .card-image { background: conic-gradient(from 45deg, #ec4899, #6366f1, #ec4899); }

        .card-content {
            padding: 1.5rem;
        }

        .card h3 {
            margin-bottom: 0.5rem;
            font-size: 1.25rem;
        }

        .card p {
            color: var(--text-gray);
            font-size: 0.9rem;
            margin-bottom: 1rem;
        }

        .tags {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
        }

        .tag {
            font-size: 0.75rem;
            padding: 0.2rem 0.6rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            color: var(--text-gray);
        }

        /* Contact Section */
        .contact {
            padding: 5rem 5%;
            background: #0b1120;
        }

        .form-container {
            max-width: 600px;
            margin: 0 auto;
            background: rgba(30, 41, 59, 0.3);
            padding: 2rem;
            border-radius: 1rem;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .form-group {
            margin-bottom: 1.5rem;
        }

        label {
            display: block;
            margin-bottom: 0.5rem;
            color: var(--text-gray);
            font-size: 0.9rem;
        }

        input, textarea {
            width: 100%;
            padding: 0.8rem;
            background: rgba(15, 23, 42, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 0.5rem;
            color: white;
            font-size: 1rem;
        }

        input:focus, textarea:focus {
            outline: none;
            border-color: var(--primary);
        }

        /* Footer */
        footer {
            padding: 2rem;
            text-align: center;
            color: var(--text-gray);
            font-size: 0.9rem;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
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
        <div class="logo">DevPortfolio.</div>
        <div class="nav-links">
            <a href="#projects">Work</a>
            <a href="#contact">Contact</a>
        </div>
    </nav>

    <section class="hero">
        <div class="hero-bg"></div>
        <h1>Building Digital<br><span style="color: var(--accent)">Experiences</span></h1>
        <p>I am a creative developer specializing in interactive web experiences, generative art, and performant code.</p>
        <a href="#projects" class="btn">View My Work</a>
    </section>

    <section id="projects" class="projects">
        <h2 class="section-title">Selected Projects</h2>
        <div class="grid">
            <!-- Card 1 -->
            <div class="card">
                <div class="card-image"></div>
                <div class="card-content">
                    <h3>Generative Particles</h3>
                    <p>A WebGL experiment exploring mouse interaction with thousands of particles using Three.js.</p>
                    <div class="tags">
                        <span class="tag">WebGL</span>
                        <span class="tag">Three.js</span>
                        <span class="tag">GLSL</span>
                    </div>
                </div>
            </div>

            <!-- Card 2 -->
            <div class="card">
                <div class="card-image"></div>
                <div class="card-content">
                    <h3>Data Visualization Dashboard</h3>
                    <p>Real-time financial data visualization built with D3.js and React, featuring smooth transitions.</p>
                    <div class="tags">
                        <span class="tag">React</span>
                        <span class="tag">D3.js</span>
                        <span class="tag">API</span>
                    </div>
                </div>
            </div>

            <!-- Card 3 -->
            <div class="card">
                <div class="card-image"></div>
                <div class="card-content">
                    <h3>Audio Visualizer</h3>
                    <p>An interactive audio visualizer that responds to microphone input using the Web Audio API.</p>
                    <div class="tags">
                        <span class="tag">JavaScript</span>
                        <span class="tag">Canvas</span>
                        <span class="tag">Audio API</span>
                    </div>
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
                    <textarea id="message" rows="5" required placeholder="Tell me about your project..."></textarea>
                </div>
                <button type="submit" class="btn" style="width: 100%">Send Message</button>
            </form>
        </div>
    </section>

    <footer>
        <p>&copy; 2023 Creative Coder. All rights reserved.</p>
    </footer>

    <script>
        // Simple Form Handler
        document.getElementById('contactForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = this.querySelector('button');
            const originalText = btn.innerText;
            
            btn.innerText = 'Message Sent!';
            btn.style.background = '#10b981'; // Green color
            
            setTimeout(() => {
                btn.innerText = originalText;
                btn.style.background = '';
                this.reset();
            }, 3000);
        });

        // Smooth Scroll for Anchor Links
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