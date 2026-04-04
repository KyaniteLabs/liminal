<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Creative Code Portfolio | [Your Name]</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        /* GLOBAL STYLES & RESET */
        :root {
            --primary-color: #ff6b6b;
            --secondary-color: #4d96ff;
            --background-dark: #1a1a2e;
            --text-light: #e4e4f1;
            --card-bg: #2c2c54;
            --gradient-start: #ff6b6b;
            --gradient-end: #4d96ff;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Poppins', sans-serif;
            background-color: #1a1a2e;
            color: var(--text-light);
            scroll-behavior: smooth;
        }

        a {
            text-decoration: none;
            color: var(--text-light);
            transition: color 0.3s;
        }

        a:hover {
            color: var(--primary-color);
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
        }

        /* HEADER & NAVIGATION */
        header {
            background-color: rgba(26, 26, 46, 0.95);
            position: sticky;
            top: 0;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }

        nav {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 0;
        }

        .logo {
            font-size: 1.8em;
            font-weight: 700;
            color: var(--primary-color);
        }

        .nav-links a {
            margin-left: 25px;
            font-weight: 500;
            padding: 5px 0;
        }

        /* HERO SECTION */
        #hero {
            height: 80vh;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            overflow: hidden;
            /* Animated Background */
            background: linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 100%);
            background-size: 400% 400%;
            animation: gradientAnimation 15s ease infinite;
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
            font-size: 4em;
            margin-bottom: 10px;
            color: #fff;
            text-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        }

        .hero-content p {
            font-size: 1.5em;
            margin-bottom: 30px;
            font-weight: 300;
            color: #fff;
        }

        .btn {
            display: inline-block;
            padding: 12px 30px;
            margin: 10px;
            border-radius: 50px;
            font-weight: 600;
            transition: transform 0.3s, background-color 0.3s;
            border: none;
            cursor: pointer;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .btn-primary {
            background-color: var(--primary-color);
            color: white;
        }

        .btn-primary:hover {
            transform: translateY(-3px);
            background-color: #ff8a8a;
        }

        .btn-secondary {
            background-color: transparent;
            color: white;
            border: 2px solid white;
        }

        .btn-secondary:hover {
            background-color: white;
            color: var(--background-dark);
        }

        /* GENERAL SECTION STYLING */
        section {
            padding: 80px 0;
            text-align: center;
        }

        .section-title {
            font-size: 2.5em;
            margin-bottom: 50px;
            font-weight: 700;
            color: var(--primary-color);
        }

        /* PROJECT CARDS SECTION */
        #projects {
            background-color: var(--background-dark);
            padding-bottom: 100px;
        }

        .project-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
            margin-top: 40px;
        }

        .card {
            background-color: var(--card-bg);
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            transition: transform 0.3s, box-shadow 0.3s;
            text-align: left;
        }

        .card:hover {
            transform: translateY(-10px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        }

        .card-img {
            width: 100%;
            height: 200px;
            background: linear-gradient(45deg, #333, #222);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5em;
            color: var(--primary-color);
            font-weight: 600;
        }

        .card-content {
            padding: 20px;
        }

        .card-content h3 {
            font-size: 1.5em;
            margin-bottom: 10px;
        }

        .card-content p {
            color: #ccc;
            margin-bottom: 15px;
        }

        .card-links a {
            margin-right: 15px;
            font-weight: 600;
            color: var(--secondary-color);
        }

        /* CONTACT FORM SECTION */
        #contact {
            background-color: var(--background-dark);
        }

        .contact-form {
            max-width: 600px;
            margin: 0 auto;
            padding: 40px;
            background-color: var(--card-bg);
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            text-align: left;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: var(--text-light);
        }

        .form-group input,
        .form-group textarea {
            width: 100%;
            padding: 12px;
            border: 1px solid #444;
            border-radius: 8px;
            background-color: #1a1a2e;
            color: var(--text-light);
            transition: border-color 0.3s;
        }

        .form-group input:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: var(--primary-color);
            box-shadow: 0 0 5px rgba(255, 107, 107, 0.4);
        }

        textarea {
            resize: vertical;
            min-height: 150px;
        }

        .btn-submit {
            width: 100%;
            padding: 12px;
            background-color: var(--secondary-color);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1.1em;
            font-weight: 600;
            transition: background-color 0.3s;
        }

        .btn-submit:hover {
            background-color: #3a7dff;
        }

        /* FOOTER */
        footer {
            background-color: #101020;
            padding: 30px 0;
            text-align: center;
            font-size: 0.9em;
            border-top: 1px solid #222;
        }

        footer a {
            margin: 0 10px;
        }

        /* MEDIA QUERIES (RESPONSIVENESS) */
        @media (max-width: 768px) {
            .hero-content h1 {
                font-size: 3em;
            }

            .hero-content p {
                font-size: 1.2em;
            }

            .btn {
                display: block;
                width: 80%;
                margin: 15px auto;
            }

            .nav-links {
                display: none; /* Simple hamburger menu implementation would go here */
            }

            nav {
                justify-content: center;
                padding: 10px 0;
            }

            .section-title {
                font-size: 2em;
            }
        }

        @media (max-width: 480px) {
            .hero-content h1 {
                font-size: 2.5em;
            }
            .hero-content p {
                font-size: 1em;
            }
            .project-grid {
                gap: 20px;
            }
        }
    </style>
</head>
<body>

    <!-- HEADER & NAVIGATION -->
    <header>
        <div class="container">
            <nav>
                <div class="logo">/CODE.PORT</div>
                <div class="nav-links">
                    <a href="#hero">Home</a>
                    <a href="#projects">Projects</a>
                    <a href="#contact">Contact</a>
                </div>
            </nav>
        </div>
    </header>

    <!-- HERO SECTION -->
    <section id="hero">
        <div class="hero-content">
            <h1>Hi, I'm Alex.</h1>
            <p>A creative coder crafting interactive digital experiences with JavaScript, p5.js, and CSS.</p>
            <a href="#projects" class="btn btn-primary">View Projects</a>
            <a href="#contact" class="btn btn-secondary">Get In Touch</a>
        </div>
    </section>

    <!-- PROJECTS SECTION -->
    <section id="projects">
        <div class="container">
            <h2 class="section-title">Featured Work</h2>
            <div class="project-grid">

                <!-- Project Card 1 -->
                <div class="card">
                    <div class="card-img">GLITCH VISUALIZER</div>
                    <div class="card-content">
                        <h3>Generative Art Engine</h3>
                        <p>A p5.js implementation using Perlin noise and complex color mapping to create abstract, evolving visuals.</p>
                        <div class="card-links">
                            <a href="#" target="_blank">View Live</a>
                            <a href="#" target="_blank">Code</a>
                        </div>
                    </div>
                </div>

                <!-- Project Card 2 -->
                <div class="card">
                    <div class="card-img">INTERACTIVE MAP</div>
                    <div class="card-content">
                        <h3>Data Visualization Map</h3>
                        <p>Utilizing Leaflet and custom logic to visualize real-time streaming data with smooth transitions.</p>
                        <div class="card-links">
                            <a href="#" target="_blank">View Live</a>
                            <a href="#" target="_blank">Code</a>
                        </div>
                    </div>
                </div>

                <!-- Project Card 3 -->
                <div class="card">
                    <div class="card-img">PHYSICS SIM</div>
                    <div class="card-content">
                        <h3>Particle System Simulation</h3>
                        <p>A complex JavaScript simulation demonstrating behaviors like attraction, repulsion, and decay.</p>
                        <div class="card-links">
                            <a href="#" target="_blank">View Live</a>
                            <a href="#" target="_blank">Code</a>
                        </div>
                    </div>
                </div>

                <!-- Project Card 4 (Optional) -->
                <div class="card">
                    <div class="card-img">WEBGL SCULPTURE</div>
                    <div class="card-content">
                        <h3>WebGL 3D Portfolio Piece</h3>
                        <p>A low-poly, interactive 3D sculpture built with Three.js, optimized for browser performance.</p>
                        <div class="card-links">
                            <a href="#" target="_blank">View Live</a>
                            <a href="#" target="_blank">Code</a>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </section>

    <!-- CONTACT SECTION -->
    <section id="contact">
        <div class="container">
            <h2 class="section-title">Let's Create Magic Together</h2>
            
            <div class="contact-form">
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
                        <label for="message">Project Details / Message</label>
                        <textarea id="message" name="message" required placeholder="Tell me about your vision..."></textarea>
                    </div>
                    <button type="submit" class="btn btn-submit">Send Message</button>
                </form>
            </div>
        </div>
    </section>

    <!-- FOOTER -->
    <footer>
        <div class="container">
            <p>&copy; 2024 Alex. Creative Coding Portfolio.</p>
            <p>
                <a href="mailto:alex@example.com">alex@example.com</a> | 
                <a href="https://github.com/yourprofile">GitHub</a> | 
                <a href="https://linkedin.com/in/yourprofile">LinkedIn</a>
            </p>
        </div>
    </footer>

    <