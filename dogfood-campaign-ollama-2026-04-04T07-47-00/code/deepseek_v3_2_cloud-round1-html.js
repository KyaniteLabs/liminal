<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Creative Code Portfolio - [Your Name]</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
    <style>
        /* Global Reset and Variables */
        :root {
            --primary-color: #1a1a2e;
            --secondary-color: #0f3460;
            --accent-color: #e94560;
            --text-light: #ffffff;
            --text-dark: #1a1a2e;
            --bg-gradient-start: #1b263b;
            --bg-gradient-end: #1e3a5b;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Poppins', sans-serif;
            background-color: var(--primary-color);
            color: var(--text-light);
            line-height: 1.6;
            scroll-behavior: smooth;
        }

        a {
            text-decoration: none;
            color: var(--text-light);
        }

        .container {
            width: 90%;
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 0;
        }

        /* Utility Classes */
        .btn {
            display: inline-block;
            padding: 12px 30px;
            border-radius: 50px;
            font-weight: 600;
            transition: all 0.3s ease;
            text-align: center;
            border: none;
            cursor: pointer;
        }

        .btn-primary {
            background-color: var(--accent-color);
            color: var(--text-light);
            box-shadow: 0 4px 15px rgba(233, 69, 96, 0.4);
        }

        .btn-primary:hover {
            transform: translateY(-3px);
            box-shadow: 0 6px 20px rgba(233, 69, 96, 0.6);
            background-color: #ff6b81;
        }

        /* Header/Navigation */
        header {
            background-color: rgba(26, 26, 46, 0.95);
            position: sticky;
            top: 0;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }

        .navbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 0;
        }

        .logo {
            font-family: 'Space Mono', monospace;
            font-size: 1.8rem;
            font-weight: 700;
            color: var(--accent-color);
        }

        .nav-links a {
            margin-left: 25px;
            font-weight: 500;
            transition: color 0.2s;
        }

        .nav-links a:hover {
            color: var(--accent-color);
        }

        /* Hero Section */
        #hero {
            background: linear-gradient(135deg, var(--bg-gradient-start), var(--bg-gradient-end));
            background-size: 300% 300%; /* Required for animation */
            animation: gradient-animation 15s ease infinite;
            text-align: center;
            padding: 150px 0;
            min-height: 80vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        @keyframes gradient-animation {
            0% { background-position: 0% 50%; }
            50% { background-position: 50% 50%; }
            100% { background-position: 100% 50%; }
        }

        .hero-content {
            max-width: 800px;
        }

        .hero-content h1 {
            font-size: 3.5rem;
            margin-bottom: 10px;
            font-weight: 700;
            background: linear-gradient(90deg, var(--text-light) 50%, var(--accent-color) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .hero-content p {
            font-size: 1.3rem;
            margin-bottom: 30px;
            color: #b0c4de;
        }

        /* Sections General Styling */
        section {
            padding: 80px 0;
        }

        h2 {
            text-align: center;
            font-size: 2.5rem;
            margin-bottom: 50px;
            color: var(--text-light);
            position: relative;
        }

        h2::after {
            content: '';
            display: block;
            width: 60px;
            height: 4px;
            background: var(--accent-color);
            margin: 10px auto 0;
            border-radius: 2px;
        }

        /* Project Grid */
        #projects {
            background-color: var(--primary-color);
        }

        .project-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
        }

        .card {
            background-color: var(--secondary-color);
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            text-align: center;
            padding-bottom: 20px;
        }

        .card:hover {
            transform: translateY(-10px);
            box-shadow: 0 15px 40px rgba(233, 69, 96, 0.3);
        }

        .card-image {
            width: 100%;
            height: 200px;
            background-color: #2c3e50; /* Placeholder background */
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
            color: #bdc3c7;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .card-content {
            padding: 20px;
        }

        .card-content h3 {
            margin-bottom: 10px;
            color: var(--accent-color);
        }

        .card-content p {
            margin-bottom: 20px;
        }

        .card-links a {
            margin: 0 10px;
            color: var(--text-light);
            font-weight: 600;
        }

        /* Contact Form */
        #contact {
            background-color: var(--secondary-color);
            text-align: center;
        }

        .contact-form-container {
            max-width: 600px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.05);
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
        }

        .contact-form-container h2 {
            color: var(--text-light);
        }

        .contact-form-container h2::after {
            background: var(--accent-color);
        }

        .form-group {
            margin-bottom: 20px;
            text-align: left;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #ccc;
        }

        .form-group input,
        .form-group textarea {
            width: 100%;
            padding: 12px;
            border: 1px solid #333;
            border-radius: 5px;
            background-color: #2a2a40;
            color: var(--text-light);
            transition: border-color 0.3s;
        }

        .form-group input:focus,
        .form-group textarea:focus {
            border-color: var(--accent-color);
            outline: none;
            box-shadow: 0 0 5px rgba(233, 69, 96, 0.5);
        }

        textarea {
            resize: vertical;
            min-height: 150px;
        }

        /* Footer */
        footer {
            background-color: #100e22;
            padding: 30px 0;
            text-align: center;
            font-size: 0.9rem;
            border-top: 3px solid var(--accent-color);
        }

        /* Media Queries for Responsiveness */
        @media (max-width: 900px) {
            .hero-content h1 {
                font-size: 2.8rem;
            }
            .hero-content p {
                font-size: 1.1rem;
            }
            .nav-links {
                display: none; /* Simple mobile nav approach */
            }
            .navbar {
                padding: 10px 20px;
            }
            .project-grid {
                grid-template-columns: 1fr;
            }
        }

        @media (max-width: 600px) {
            .hero-content h1 {
                font-size: 2.5rem;
            }
            .hero-content p {
                font-size: 1rem;
            }
            .btn {
                padding: 10px 20px;
                font-size: 0.9rem;
            }
            .container {
                padding: 20px 0;
            }
            .card {
                margin-bottom: 20px;
            }
        }
    </style>
</head>
<body>

    <!-- Header and Navigation -->
    <header>
        <div class="container navbar">
            <div class="logo">CODE_PORTFOLIO</div>
            <nav class="nav-links">
                <a href="#projects">Projects</a>
                <a href="#contact">Contact</a>
                <a href="#hero">Home</a>
            </nav>
        </div>
    </header>

    <!-- Hero Section (Animated Gradient) -->
    <section id="hero">
        <div class="hero-content">
            <h1 class="animate-text">Hi, I'm Alex. I build interactive digital experiences.</h1>
            <p>A creative coder specializing in generative art, p5.js, and immersive web designs that blend technology and emotion.</p>
            <a href="#projects" class="btn btn-primary">View Projects</a>
        </div>
    </section>

    <!-- Projects Section -->
    <section id="projects">
        <div class="container">
            <h2>Featured Projects</h2>
            <div class="project-grid">
                
                <!-- Project Card 1 -->
                <div class="card">
                    <div class="card-image">Generative Art Placeholder</div>
                    <div class="card-content">
                        <h3>Nebula Visualizer</h3>
                        <p>A p5.js implementation generating complex, evolving particle fields based on Perlin noise.</p>
                        <div class="card-links">
                            <a href="#" target="_blank">Live Demo</a>
                            <a href="#" target="_blank">GitHub</a>
                        </div>
                    </div>
                </div>

                <!-- Project Card 2 -->
                <div class="card">
                    <div class="card-image">Interactive WebGL Placeholder</div>
                    <div class="card-content">
                        <h3>Dimensional Portal</h3>
                        <p>A WebGL experience simulating a non-Euclidean space interaction using mouse tracking.</p>
                        <div class="card-links">
                            <a href="#" target="_blank">Live Demo</a>
                            <a href="#" target="_blank">GitHub</a>
                        </div>
                    </div>
                </div>

                <!-- Project Card 3 -->
                <div class="card">
                    <div class="card-image">Audio Visualizer Placeholder</div>
                    <div class="card-content">
                        <h3>Soundscape Weaver</h3>
                        <p>Visualizing real-time audio input into dynamic geometric patterns using the Web Audio API.</p>
                        <div class="card-links">
                            <a href="#" target="_blank">Live Demo</a>
                            <a href="#" target="_blank">GitHub</a>
                        </div>
                    </div>
                </div>

                <!-- Project Card 4 (Example for responsiveness) -->
                <div class="card">
                    <div class="card-image">Data Sculpture Placeholder</div>
                    <div class="card-content">
                        <h3>Global Data Flow</h3>
                        <p>An interactive visualization mapping real-time global data streams onto a 3D grid.</p>
                        <div class="card-links">
                            <a href="#" target="_blank">Live Demo</a>
                            <a href="#" target="_blank">GitHub</a>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </section>

    <!-- Contact Section -->
    <section id="contact">
        <div class="container">
            <h2>Get In Touch</h2>
            <div class="contact-form-container">
                <form action="#" method="POST">
                    <div class="form-group">
                        <label for="name">Name</label>
                        <input type="text" id="name" name="name" required>
                    </div>
                    <div class="form-group">
                        <label for="email">Email</label>
                        <input type="email" id="email" name="email" required>
                    </div>
                    <div class="form-group">
                        <label for="subject">Subject</label>
                        <input type="text" id="subject" name="subject" required>
                    </div>
                    <div class="form-group">
                        <label for="message">Message</label>
                        <textarea id="message" name="message" required></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary">Send Message</button>
                </form>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer>
        <div class="container">
            <p>&copy; 2024 Alex Doe Creative Code Portfolio | Built with passion and code.</p>
            <p style="margin-top: 10px;">&copy; <a href="#" style="color: var(--