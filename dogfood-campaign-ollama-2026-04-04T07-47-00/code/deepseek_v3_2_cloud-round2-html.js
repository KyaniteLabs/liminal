<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Creative Code Portfolio</title>
    <style>
        /* --- Global Reset & Variables --- */
        :root {
            --primary-color: #3498db;
            --secondary-color: #e74c3c;
            --text-dark: #2c3e50;
            --text-light: #ecf0f1;
            --bg-dark: #1a1a2e;
            --card-bg: #2c3e50;
            --gradient-start: #3498db;
            --gradient-end: #9b59b6;
            --gradient-mid: #e74c3c;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: var(--bg-dark);
            color: var(--text-light);
            line-height: 1.6;
            overflow-x: hidden;
        }

        a {
            text-decoration: none;
            color: var(--primary-color);
        }

        .container {
            width: 90%;
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 0;
        }

        /* --- Header/Navigation --- */
        header {
            background: rgba(0, 0, 0, 0.3);
            padding: 15px 0;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }

        header .container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 5%;
        }

        .logo {
            font-size: 1.8rem;
            font-weight: bold;
            color: var(--primary-color);
        }

        nav a {
            margin-left: 25px;
            font-weight: 500;
            transition: color 0.3s;
            padding: 5px 0;
        }

        nav a:hover {
            color: var(--gradient-end);
            border-bottom: 2px solid var(--gradient-end);
        }

        /* --- Hero Section --- */
        #hero {
            /* Fake background for animation container */
            background: linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 50%, var(--gradient-mid) 100%);
            background-size: 400% 400%;
            animation: gradientBackground 15s ease infinite;
            text-align: center;
            padding: 100px 0;
            position: relative;
            overflow: hidden;
        }

        @keyframes gradientBackground {
            0% { background-position: 0% 50%; }
            50% { background-position: 50% 50%; }
            100% { background-position: 100% 50%; }
        }

        #hero h1 {
            font-size: 3.5rem;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        }

        #hero p {
            font-size: 1.5rem;
            margin-bottom: 40px;
            opacity: 0.9;
        }

        .cta-button {
            background-color: var(--secondary-color);
            color: var(--text-light);
            padding: 12px 30px;
            border: none;
            border-radius: 5px;
            font-size: 1.1rem;
            cursor: pointer;
            transition: background-color 0.3s, transform 0.3s;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        }

        .cta-button:hover {
            background-color: #c0392b;
            transform: translateY(-3px);
        }

        /* --- General Section Styling --- */
        section {
            padding: 60px 0;
        }

        .section-title {
            text-align: center;
            font-size: 2.5rem;
            margin-bottom: 50px;
            color: var(--primary-color);
            position: relative;
        }

        .section-title::after {
            content: '';
            display: block;
            width: 60px;
            height: 3px;
            background: var(--gradient-mid);
            margin: 10px auto;
        }

        /* --- Project Grid --- */
        #projects {
            background-color: #1f2a40; /* Slightly different background for contrast */
        }

        .project-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
        }

        .project-card {
            background-color: var(--card-bg);
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
            transition: transform 0.3s, box-shadow 0.3s;
            padding-bottom: 20px;
            display: flex;
            flex-direction: column;
        }

        .project-card:hover {
            transform: translateY(-10px);
            box-shadow: 0 15px 30px rgba(0, 0, 0, 0.4);
        }

        .project-card img {
            width: 100%;
            height: 200px;
            object-fit: cover;
            background-color: #34495e; /* Placeholder color */
        }

        .card-content {
            padding: 20px;
        }

        .card-content h3 {
            color: var(--primary-color);
            margin-bottom: 10px;
        }

        .card-content p {
            margin-bottom: 15px;
            color: #bdc3c7;
        }

        .tech-stack span {
            display: inline-block;
            background: rgba(52, 152, 219, 0.2);
            color: var(--primary-color);
            padding: 5px 10px;
            border-radius: 3px;
            font-size: 0.85rem;
            margin-right: 5px;
            margin-bottom: 5px;
        }

        /* --- Contact Form --- */
        #contact {
            text-align: center;
        }

        .contact-form {
            max-width: 600px;
            margin: 0 auto;
            background: var(--card-bg);
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        }

        .form-group {
            margin-bottom: 20px;
            text-align: left;
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
            border: 1px solid #34495e;
            border-radius: 5px;
            background-color: #2c3e50;
            color: var(--text-light);
            font-size: 1rem;
            transition: border-color 0.3s;
        }

        .form-group input:focus,
        .form-group textarea:focus {
            border-color: var(--primary-color);
            outline: none;
            box-shadow: 0 0 5px rgba(52, 152, 219, 0.5);
        }

        textarea {
            resize: vertical;
            min-height: 150px;
        }

        .submit-button {
            width: 100%;
            background-color: var(--primary-color);
            color: white;
            padding: 12px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 1.1rem;
            transition: background-color 0.3s;
        }

        .submit-button:hover {
            background-color: #2980b9;
        }

        /* --- Footer --- */
        footer {
            background-color: #111;
            color: #7f8c8d;
            text-align: center;
            padding: 20px 0;
            font-size: 0.9rem;
        }

        /* --- Responsiveness --- */
        @media (max-width: 768px) {
            #hero h1 {
                font-size: 2.5rem;
            }
            #hero p {
                font-size: 1.2rem;
            }
            header .container {
                flex-direction: column;
                text-align: center;
            }
            nav {
                margin-top: 15px;
            }
            nav a {
                margin: 0 10px;
                display: inline-block;
            }
            .project-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>

    <!-- Header/Navigation -->
    <header>
        <div class="container">
            <div class="logo">CodeCraft.dev</div>
            <nav>
                <a href="#hero">Home</a>
                <a href="#projects">Projects</a>
                <a href="#contact">Contact</a>
            </nav>
        </div>
    </header>

    <!-- Hero Section (Animated Gradient) -->
    <section id="hero">
        <div class="container">
            <h1>Hi, I'm Alex.</h1>
            <p>A Creative Coder transforming ideas into interactive digital experiences.</p>
            <a href="#projects" class="cta-button">View My Work</a>
        </div>
    </section>

    <!-- Projects Section -->
    <section id="projects">
        <div class="container">
            <h2 class="section-title">Featured Projects</h2>
            <div class="project-grid">
                
                <!-- Project Card 1 -->
                <div class="project-card">
                    <img src="placeholder-1.jpg" alt="Generative Art">
                    <div class="card-content">
                        <h3>Generative Art Engine</h3>
                        <p>An interactive piece using p5.js to create complex, evolving visual patterns based on user input.</p>
                        <div class="tech-stack">
                            <span>p5.js</span>
                            <span>JavaScript</span>
                            <span>Canvas</span>
                        </div>
                        <p style="margin-top: 15px;"><a href="#" style="color: var(--primary-color);">View Live</a></p>
                    </div>
                </div>

                <!-- Project Card 2 -->
                <div class="project-card">
                    <img src="placeholder-2.jpg" alt="Web Data Visualization">
                    <div class="card-content">
                        <h3>Global Data Visualizer</h3>
                        <p>A responsive dashboard visualizing real-time climate data using D3.js for dynamic mapping.</p>
                        <div class="tech-stack">
                            <span>D3.js</span>
                            <span>React</span>
                            <span>Mapbox</span>
                        </div>
                        <p style="margin-top: 15px;"><a href="#" style="color: var(--primary-color);">View Live</a></p>
                    </div>
                </div>

                <!-- Project Card 3 -->
                <div class="project-card">
                    <img src="placeholder-3.jpg" alt="Interactive Game">
                    <div class="card-content">
                        <h3>Procedural Dungeon Crawler</h3>
                        <p>A simple text-based adventure game with procedural content generation and state management.</p>
                        <div class="tech-stack">
                            <span>Python</span>
                            <span>Flask</span>
                            <span>HTML/CSS</span>
                        </div>
                        <p style="margin-top: 15px;"><a href="#" style="color: var(--primary-color);">View Live</a></p>
                    </div>
                </div>

            </div>
        </div>
    </section>

    <!-- Contact Section -->
    <section id="contact">
        <div class="container">
            <h2 class="section-title">Let's Connect</h2>
            <div class="contact-form">
                <form id="contactForm">
                    <div class="form-group">
                        <label for="name">Name:</label>
                        <input type="text" id="name" name="name" required>
                    </div>
                    <div class="form-group">
                        <label for="email">Email:</label>
                        <input type="email" id="email" name="email" required>
                    </div>
                    <div class="form-group">
                        <label for="message">Message:</label>
                        <textarea id="message" name="message" required></textarea>
                    </div>
                    <button type="submit" class="submit-button">Send Message</button>
                </form>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer>
        <div class="container">
            <p>&copy; 2023 CodeCraft Portfolio. Powered by creativity and code.</p>
        </div>
    </footer>

    <script>
        // Simple form handling simulation
        document.getElementById('contactForm').addEventListener('submit', function(e) {
            e.preventDefault();
            alert('Thank you for your message! I will get back to you shortly.');
            this.reset();
        });
    </script>

</body>
</html>