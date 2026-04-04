<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Creative Code Portfolio</title>
    <style>
        /* Global Reset and Variables */
        :root {
            --primary-color: #ff6b6b;
            --secondary-color: #48dbfb;
            --dark-bg: #1a1a2e;
            --light-text: #f4f4f9;
            --card-bg: #2c3e50;
            --radius: 10px;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #1a1a2e;
            color: var(--light-text);
            scroll-behavior: smooth;
        }

        a {
            text-decoration: none;
            color: var(--secondary-color);
            transition: color 0.3s;
        }

        a:hover {
            color: var(--primary-color);
        }

        .container {
            width: 90%;
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 0;
        }

        /* Navigation */
        header {
            background-color: rgba(26, 26, 46, 0.95);
            position: sticky;
            top: 0;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        }

        header .container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 0;
        }

        .logo {
            font-size: 1.8rem;
            font-weight: bold;
            color: var(--secondary-color);
        }

        nav ul {
            list-style: none;
            display: flex;
        }

        nav ul li {
            margin-left: 30px;
        }

        nav ul li a {
            font-size: 1rem;
            color: var(--light-text);
            padding: 5px 0;
            transition: all 0.3s;
        }

        nav ul li a:hover {
            color: var(--primary-color);
            border-bottom: 2px solid var(--primary-color);
        }

        /* Hero Section */
        #hero {
            background: linear-gradient(-45deg, #ee7e5e, #feb47b, #ff6b6b, #48dbfb);
            background-size: 400% 400%;
            animation: gradientBackground 15s ease infinite;
            text-align: center;
            padding: 150px 0;
            color: #1a1a2e;
        }

        #hero h1 {
            font-size: 4rem;
            margin-bottom: 20px;
            animation: fadeInDown 1s ease-out;
        }

        #hero p {
            font-size: 1.5rem;
            margin-bottom: 40px;
            animation: fadeInUp 1s ease-out 0.2s;
        }

        .btn {
            display: inline-block;
            padding: 12px 30px;
            background-color: var(--primary-color);
            color: var(--dark-bg);
            border-radius: 30px;
            font-weight: bold;
            letter-spacing: 1px;
            transition: transform 0.3s, background-color 0.3s;
            border: none;
            cursor: pointer;
            animation: fadeInUp 1s ease-out 0.4s;
        }

        .btn:hover {
            transform: translateY(-3px);
            background-color: #ff8a8a;
        }

        /* General Section Styling */
        section {
            padding: 80px 0;
        }

        h2 {
            text-align: center;
            font-size: 2.5rem;
            margin-bottom: 50px;
            color: var(--secondary-color);
            position: relative;
        }

        h2::after {
            content: '';
            display: block;
            width: 60px;
            height: 4px;
            background: var(--primary-color);
            margin: 10px auto;
            border-radius: 2px;
        }

        /* Project Cards */
        #projects {
            background-color: #121220;
        }

        .project-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
            padding-top: 40px;
        }

        .card {
            background-color: var(--card-bg);
            border-radius: var(--radius);
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            padding-bottom: 20px;
        }

        .card:hover {
            transform: translateY(-10px);
            box-shadow: 0 15px 30px rgba(255, 107, 107, 0.2);
        }

        .card-content {
            padding: 20px;
        }

        .card-content h3 {
            color: var(--secondary-color);
            margin-bottom: 10px;
        }

        .card-content p {
            margin-bottom: 15px;
            color: #ccc;
        }

        .card-links a {
            display: inline-block;
            margin-right: 15px;
            margin-top: 10px;
        }

        /* Contact Form */
        #contact {
            background-color: #1a1a2e;
        }

        .form-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: var(--card-bg);
            padding: 40px;
            border-radius: var(--radius);
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.5);
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: bold;
            color: var(--secondary-color);
        }

        .form-group input,
        .form-group textarea {
            width: 100%;
            padding: 12px;
            border: 1px solid #333;
            border-radius: 8px;
            background-color: #2c3e50;
            color: var(--light-text);
            transition: border-color 0.3s;
        }

        .form-group input:focus,
        .form-group textarea:focus {
            border-color: var(--primary-color);
            outline: none;
            box-shadow: 0 0 5px rgba(255, 107, 107, 0.5);
        }

        textarea {
            resize: vertical;
            min-height: 150px;
        }

        .submit-btn {
            width: 100%;
            padding: 12px;
            background-color: var(--secondary-color);
            color: var(--dark-bg);
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1rem;
            transition: background-color 0.3s;
        }

        .submit-btn:hover {
            background-color: #7dd4fb;
        }

        /* Footer */
        footer {
            background-color: #121220;
            text-align: center;
            padding: 30px 0;
            border-top: 3px solid var(--primary-color);
        }

        footer p {
            margin: 10px 0;
            color: #aaa;
        }

        /* Keyframe Animations */
        @keyframes gradientBackground {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }

        @keyframes fadeInDown {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* Media Queries for Responsiveness */
        @media (max-width: 768px) {
            /* Hero Adjustments */
            #hero h1 {
                font-size: 3rem;
            }

            #hero p {
                font-size: 1.2rem;
            }

            /* Navigation Adjustments */
            header .container {
                flex-direction: column;
                text-align: center;
            }

            nav ul {
                margin-top: 15px;
                justify-content: center;
            }

            nav ul li {
                margin: 0 15px;
            }

            /* General Adjustments */
            h2 {
                font-size: 2rem;
            }
            
            .project-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>

    <!-- Header & Navigation -->
    <header>
        <div class="container">
            <div class="logo">CoderPort</div>
            <nav>
                <ul>
                    <li><a href="#hero">Home</a></li>
                    <li><a href="#projects">Projects</a></li>
                    <li><a href="#contact">Contact</a></li>
                </ul>
            </nav>
        </div>
    </header>

    <!-- Hero Section -->
    <section id="hero">
        <div class="container">
            <h1>Coding Imagination Into Reality</h1>
            <p>A portfolio showcasing creative and interactive digital art using code.</p>
            <a href="#projects" class="btn">View My Work</a>
        </div>
    </section>

    <!-- Projects Section -->
    <section id="projects">
        <div class="container">
            <h2>Featured Projects</h2>
            <div class="project-grid">
                
                <!-- Project Card 1 -->
                <div class="card">
                    <div class="card-content">
                        <h3>Generative Art Engine</h3>
                        <p>An interactive piece utilizing p5.js to create evolving, complex visual patterns based on user input.</p>
                        <div class="card-links">
                            <a href="#" target="_blank">View Code</a>
                            <a href="#" target="_blank">Live Demo</a>
                        </div>
                    </div>
                </div>

                <!-- Project Card 2 -->
                <div class="card">
                    <div class="card-content">
                        <h3>Data Visualization Dashboard</h3>
                        <p>A real-time dashboard visualizing public data sets (e.g., climate change, stock market) with D3.js.</p>
                        <div class="card-links">
                            <a href="#" target="_blank">View Code</a>
                            <a href="#" target="_blank">Live Demo</a>
                        </div>
                    </div>
                </div>

                <!-- Project Card 3 -->
                <div class="card">
                    <div class="card-content">
                        <h3>Procedural Level Generator</h3>
                        <p>A game prototype that uses Perlin noise and cellular automata to generate endless, unique game maps.</p>
                        <div class="card-links">
                            <a href="#" target="_blank">View Code</a>
                            <a href="#" target="_blank">Live Demo</a>
                        </div>
                    </div>
                </div>
                
                <!-- Project Card 4 -->
                <div class="card">
                    <div class="card-content">
                        <h3>AI Chatbot Interface</h3>
                        <p>A front-end implementation of a conversational AI, focusing on sleek UI/UX and state management.</p>
                        <div class="card-links">
                            <a href="#" target="_blank">View Code</a>
                            <a href="#" target="_blank">Live Demo</a>
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
            <div class="form-container">
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
                        <label for="message">Message</label>
                        <textarea id="message" name="message" required></textarea>
                    </div>
                    <button type="submit" class="submit-btn">Send Message</button>
                </form>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer>
        <div class="container">
            <p>&copy; 2024 CoderPort. All rights reserved.</p>
            <p>Built with creativity and code.</p>
        </div>
    </footer>

    <script>
        // Basic JavaScript for smooth scrolling and form handling
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                document.querySelector(this.getAttribute('href')).scrollIntoView({
                    behavior: 'smooth'
                });
            });
        });

        // Simple form submission handler (preventing actual submission for static code)
        const contactForm = document.querySelector('#contact form');
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            alert('Thank you for your message! I will get back to you shortly.');
            this.reset();
        });
    </script>
</body>
</html>