<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Creative Code Portfolio</title>
    <style>
        /* --- Global Styles --- */
        :root {
            --primary-color: #3b82f6;
            --secondary-color: #10b981;
            --text-dark: #1f2937;
            --text-light: #f3f4f6;
            --bg-dark: #0a192f;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            background-color: var(--bg-dark);
            color: var(--text-light);
            scroll-behavior: smooth;
        }

        a {
            text-decoration: none;
            color: var(--primary-color);
            transition: color 0.3s;
        }

        a:hover {
            color: var(--secondary-color);
        }

        .container {
            width: 90%;
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 0;
        }

        /* --- Header/Navigation --- */
        header {
            background: rgba(10, 25, 47, 0.9); /* Semi-transparent background for sticky effect */
            padding: 15px 0;
            position: sticky;
            top: 0;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }

        header .container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 20px;
        }

        .logo {
            font-size: 1.8rem;
            font-weight: bold;
            color: var(--text-light);
        }

        nav ul {
            list-style: none;
            display: flex;
        }

        nav ul li {
            margin-left: 30px;
        }

        nav ul li a {
            color: var(--text-light);
            font-weight: 500;
            padding: 5px 0;
            position: relative;
        }

        nav ul li a::after {
            content: '';
            position: absolute;
            width: 0;
            height: 2px;
            bottom: 0;
            left: 0;
            background-color: var(--secondary-color);
            transition: width 0.3s;
        }

        nav ul li a:hover::after {
            width: 100%;
        }

        /* --- Hero Section --- */
        #hero {
            height: 80vh;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            background: linear-gradient(-45deg, #ee7752, #e037b2, #ff9a9e, #daf2d7);
            background-size: 400% 400%;
            animation: gradientAnimation 15s ease infinite;
            padding: 40px 0;
        }

        @keyframes gradientAnimation {
            0% { background-position: 0% 50%; }
            50% { background-position: 50% 50%; }
            100% { background-position: 100% 50%; }
        }

        .hero-content {
            max-width: 800px;
            padding: 20px;
        }

        .hero-content h1 {
            font-size: 3.5rem;
            margin-bottom: 15px;
            color: var(--text-dark);
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
        }

        .hero-content p {
            font-size: 1.4rem;
            margin-bottom: 30px;
            color: #555;
        }

        .cta-button {
            background-color: var(--primary-color);
            color: white;
            padding: 12px 30px;
            border-radius: 50px;
            font-size: 1.1rem;
            cursor: pointer;
            border: none;
            transition: background-color 0.3s, transform 0.3s;
        }

        .cta-button:hover {
            background-color: var(--secondary-color);
            transform: translateY(-3px);
        }

        /* --- Section Styling --- */
        section {
            padding: 80px 0;
            text-align: center;
        }

        .section-title {
            font-size: 2.5rem;
            margin-bottom: 40px;
            color: var(--text-light);
            position: relative;
        }

        .section-title::after {
            content: '';
            display: block;
            width: 60px;
            height: 3px;
            background: var(--secondary-color);
            margin: 10px auto;
        }

        /* --- Projects Grid --- */
        #projects {
            background-color: #112233;
        }

        .project-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
            margin-top: 40px;
        }

        .project-card {
            background: #1f3a5c;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            transition: transform 0.3s, box-shadow 0.3s;
            text-align: left;
            border-left: 5px solid var(--primary-color);
        }

        .project-card:hover {
            transform: translateY(-10px);
            box-shadow: 0 10px 25px rgba(59, 130, 246, 0.3);
        }

        .project-card h3 {
            color: var(--secondary-color);
            margin-bottom: 10px;
        }

        .project-card p {
            margin-bottom: 15px;
            color: #ccc;
        }

        .project-card .tags span {
            display: inline-block;
            background: #3b82f622;
            color: var(--primary-color);
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 0.9rem;
            margin-right: 8px;
            margin-top: 5px;
        }

        /* --- Contact Form --- */
        #contact {
            background-color: #0a192f;
        }

        #contact-form {
            max-width: 600px;
            margin: 30px auto;
            padding: 30px;
            background: #1f3a5c;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            text-align: left;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: bold;
            color: var(--text-light);
        }

        .form-group input,
        .form-group textarea {
            width: 100%;
            padding: 12px;
            border: 1px solid #4b5563;
            border-radius: 5px;
            background-color: #2d4762;
            color: var(--text-light);
            font-size: 1rem;
            transition: border-color 0.3s;
        }

        .form-group input:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: var(--primary-color);
            box-shadow: 0 0 5px rgba(59, 130, 246, 0.5);
        }

        textarea {
            resize: vertical;
            min-height: 150px;
        }

        .submit-button {
            width: 100%;
            background-color: var(--secondary-color);
            color: white;
            padding: 12px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 1.1rem;
            transition: background-color 0.3s;
        }

        .submit-button:hover {
            background-color: #0f8d66;
        }

        /* --- Footer --- */
        footer {
            background-color: #0a192f;
            color: #aaa;
            text-align: center;
            padding: 20px 0;
            border-top: 1px solid #1f3a5c;
        }

        /* --- Responsiveness --- */
        @media (max-width: 768px) {
            .hero-content h1 {
                font-size: 2.5rem;
            }

            .hero-content p {
                font-size: 1.2rem;
            }

            header .container {
                flex-direction: column;
                text-align: center;
            }

            .logo {
                margin-bottom: 15px;
            }

            nav ul {
                justify-content: center;
                padding: 0;
            }

            nav ul li {
                margin: 0 15px;
            }

            .project-grid {
                grid-template-columns: 1fr;
            }

            .container {
                padding: 20px 0;
            }
        }
    </style>
</head>
<body>

    <!-- Header/Navigation -->
    <header>
        <div class="container">
            <div class="logo">CODE_PORTFOLIO</div>
            <nav>
                <ul>
                    <li><a href="#hero">Home</a></li>
                    <li><a href="#projects">Projects</a></li>
                    <li><a href="#contact">Contact</a></li>
                </ul>
            </nav>
        </div>
    </header>

    <!-- Hero Section (Animated Gradient) -->
    <section id="hero">
        <div class="hero-content">
            <h1>I Build Digital Experiences with Code.</h1>
            <p>Creative Coder specializing in interactive art, generative design, and full-stack web applications.</p>
            <a href="#projects" class="cta-button">View My Work</a>
        </div>
    </section>

    <!-- Projects Section -->
    <section id="projects">
        <div class="container">
            <h2 class="section-title">Featured Projects</h2>
            <p style="margin-bottom: 40px; color: #ccc;">A showcase of my passion for computation and visual design.</p>

            <div class="project-grid">
                <!-- Project Card 1 -->
                <div class="project-card">
                    <h3>Generative Art Engine</h3>
                    <p>An interactive browser tool that uses Perlin noise to create evolving, abstract visual patterns.</p>
                    <div class="tags">
                        <span>p5.js</span>
                        <span>JavaScript</span>
                        <span>WebGL</span>
                    </div>
                    <a href="#" style="display: block; margin-top: 20px; text-align: right;">View Project &rarr;</a>
                </div>

                <!-- Project Card 2 -->
                <div class="project-card">
                    <h3>Data Visualization Dashboard</h3>
                    <p>A responsive dashboard visualizing complex climate data using D3.js for dynamic charting.</p>
                    <div class="tags">
                        <span>D3.js</span>
                        <span>React</span>
                        <span>API Integration</span>
                    </div>
                    <a href="#" style="display: block; margin-top: 20px; text-align: right;">View Project &rarr;</a>
                </div>

                <!-- Project Card 3 -->
                <div class="project-card">
                    <h3>Procedural Game Map</h3>
                    <p>A grid-based game map generator using cellular automata rules for realistic terrain formation.</p>
                    <div class="tags">
                        <span>Python</span>
                        <span>Numpy</span>
                        <span>Game Logic</span>
                    </div>
                    <a href="#" style="display: block; margin-top: 20px; text-align: right;">View Project &rarr;</a>
                </div>
            </div>
        </div>
    </section>

    <!-- Contact Section -->
    <section id="contact">
        <div class="container">
            <h2 class="section-title">Get In Touch</h2>
            <p style="margin-bottom: 40px; color: #ccc;">Ready to build something amazing? Let's connect and bring your vision to life.</p>

            <form id="contact-form" action="#" method="POST">
                <div class="form-group">
                    <label for="name">Name</label>
                    <input type="text" id="name" name="name" required>
                </div>
                <div class="form-group">
                    <label for="email">Email</label>
                    <input type="email" id="email" name="email" required>
                </div>
                <div class="form-group">
                    <label for="message">Message</label>
                    <textarea id="message" name="message" required></textarea>
                </div>
                <button type="submit" class="submit-button">Send Message</button>
            </form>
        </div>
    </section>

    <!-- Footer -->
    <footer>
        <div class="container">
            <p>&copy; 2024 Creative Code Portfolio. Built with <span style="color: #ffeb3b;">&hearts;</span> and code.</p>
        </div>
    </footer>

    <script>
        // Simple JavaScript for form handling (preventing default submission and providing feedback)
        document.getElementById('contact-form').addEventListener('submit', function(e) {
            e.preventDefault();
            alert('Thank you for your message! I will get back to you shortly.');
            this.reset();
        });
    </script>
</body>
</html>