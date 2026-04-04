<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Creative Coding Portfolio</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary-color: #ff6b6b;
            --secondary-color: #1e3c72;
            --dark-bg: #121212;
            --light-text: #f4f4f4;
            --card-bg: #222222;
            --gradient-start: #3366ff;
            --gradient-end: #ff6b6b;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Poppins', sans-serif;
            background-color: var(--dark-bg);
            color: var(--light-text);
            scroll-behavior: smooth;
        }

        a {
            text-decoration: none;
            color: var(--light-text);
        }

        /* --- Utility Classes --- */
        .container {
            width: 90%;
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 0;
        }

        .btn {
            display: inline-block;
            padding: 12px 30px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
            text-transform: uppercase;
        }

        .btn-primary {
            background-color: var(--primary-color);
            color: var(--dark-bg);
            border: 2px solid var(--primary-color);
        }

        .btn-primary:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 15px rgba(255, 107, 107, 0.4);
            background-color: transparent;
            color: var(--primary-color);
        }

        /* --- Navigation --- */
        header {
            background: rgba(18, 18, 18, 0.9);
            position: sticky;
            top: 0;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
            padding: 15px 0;
        }

        header .container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0;
        }

        .logo {
            font-size: 1.8rem;
            font-weight: 700;
            color: var(--primary-color);
        }

        nav a {
            margin-left: 25px;
            font-weight: 400;
            transition: color 0.3s;
        }

        nav a:hover {
            color: var(--primary-color);
        }

        /* --- Hero Section --- */
        #hero {
            height: 80vh;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            /* Animated Gradient Background Setup */
            background: linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 100%);
            background-size: 400% 400%;
            animation: gradientShift 15s ease infinite;
            padding: 0; /* Override container padding */
        }

        #hero h1 {
            font-size: 4rem;
            margin-bottom: 15px;
            animation: fadeInDown 1s ease-out;
        }

        #hero p {
            font-size: 1.5rem;
            color: rgba(255, 255, 255, 0.9);
            margin-bottom: 30px;
            animation: fadeInUp 1s ease-out 0.2s forwards;
            opacity: 0;
        }

        /* --- Portfolio Section --- */
        #portfolio {
            background-color: #1c1c1c;
            padding: 80px 0;
            text-align: center;
        }

        #portfolio h2 {
            font-size: 2.5rem;
            margin-bottom: 50px;
            color: var(--primary-color);
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
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            text-align: left;
        }

        .project-card:hover {
            transform: translateY(-10px);
            box-shadow: 0 15px 30px rgba(255, 107, 107, 0.3);
        }

        .project-card img {
            width: 100%;
            height: 200px;
            object-fit: cover;
            display: block;
            filter: grayscale(20%);
            transition: filter 0.3s;
        }

        .project-card:hover img {
            filter: grayscale(0%);
        }

        .project-info {
            padding: 20px;
        }

        .project-info h3 {
            color: var(--primary-color);
            margin-bottom: 10px;
        }

        .project-info p {
            margin-bottom: 15px;
            color: #aaa;
        }

        .project-card .btn {
            background-color: var(--secondary-color);
            color: white;
            padding: 8px 15px;
            font-size: 0.9rem;
        }
        
        .project-card .btn:hover {
            background-color: var(--primary-color);
            color: var(--dark-bg);
        }

        /* --- Contact Section --- */
        #contact {
            background-color: #1c1c1c;
            padding: 80px 0;
            text-align: center;
        }

        #contact h2 {
            font-size: 2.5rem;
            margin-bottom: 40px;
            color: var(--primary-color);
        }

        .contact-form {
            max-width: 600px;
            margin: 0 auto;
            padding: 30px;
            background: #222;
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
            text-align: left;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
        }

        .form-group input,
        .form-group textarea {
            width: 100%;
            padding: 12px;
            border: 1px solid #444;
            border-radius: 5px;
            background-color: #333;
            color: var(--light-text);
            font-family: inherit;
            transition: border-color 0.3s;
        }

        .form-group input:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: var(--primary-color);
            box-shadow: 0 0 5px rgba(255, 107, 107, 0.5);
        }

        textarea {
            resize: vertical;
            min-height: 150px;
        }

        /* --- Footer --- */
        footer {
            background-color: #0a0a0a;
            text-align: center;
            padding: 25px 0;
            border-top: 1px solid #222;
            font-size: 0.9rem;
            color: #888;
        }

        /* --- Animations (Keyframes) --- */
        @keyframes gradientShift {
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

        /* --- Responsiveness --- */
        @media (max-width: 900px) {
            #hero h1 {
                font-size: 3rem;
            }
            #hero p {
                font-size: 1.2rem;
            }
        }

        @media (max-width: 600px) {
            header .container {
                flex-direction: column;
                gap: 15px;
                padding-bottom: 10px;
            }
            
            nav {
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
            }

            nav a {
                margin: 5px 10px;
                font-size: 0.9rem;
            }

            .project-grid {
                grid-template-columns: 1fr;
            }
            
            .btn {
                padding: 10px 20px;
                display: block;
                width: fit-content;
                margin: 10px auto;
            }
        }
    </style>
</head>
<body>

    <!-- Header & Navigation -->
    <header>
        <div class="container">
            <div class="logo">CodeCraft.dev</div>
            <nav>
                <a href="#hero">Home</a>
                <a href="#portfolio">Portfolio</a>
                <a href="#contact">Contact</a>
            </nav>
        </div>
    </header>

    <!-- Hero Section -->
    <section id="hero">
        <div class="container" style="max-width: 800px;">
            <h1>Hi, I'm Alex. Creative Coder.</h1>
            <p>Building interactive digital experiences using code, design, and pure creativity.</p>
            <a href="#portfolio" class="btn btn-primary">View Projects</a>
        </div>
    </section>

    <!-- Portfolio Section -->
    <section id="portfolio">
        <div class="container">
            <h2>Featured Works</h2>
            <div class="project-grid">
                
                <!-- Project Card 1 -->
                <div class="project-card">
                    <img src="https://via.placeholder.com/600x400/3366ff/FFFFFF?text=Generative+Art" alt="Generative Art">
                    <div class="project-info">
                        <h3>Generative Art Engine</h3>
                        <p>A system using p5.js to create evolving, complex visual patterns.</p>
                        <p>Technologies: JavaScript, p5.js, Canvas</p>
                        <a href="#" class="btn">View Project</a>
                    </div>
                </div>

                <!-- Project Card 2 -->
                <div class="project-card">
                    <img src="https://via.placeholder.com/600x400/ff6b6b/FFFFFF?text=Web+Audio+Visualizer" alt="Audio Visualizer">
                    <div class="project-info">
                        <h3>Audio Visualizer</h3>
                        <p>Real-time visualization of audio frequencies into dynamic graphics.</p>
                        <p>Technologies: Web Audio API, React, Three.js</p>
                        <a href="#" class="btn">View Project</a>
                    </div>
                </div>

                <!-- Project Card 3 -->
                <div class="project-card">
                    <img src="https://via.placeholder.com/600x400/1e3c72/FFFFFF?text=Interactive+Mapping" alt="Interactive Map">
                    <div class="project-info">
                        <h3>Interactive Data Map</h3>
                        <p>An exploration of geospatial data using custom SVG paths and interactions.</p>
                        <p>Technologies: D3.js, SVG, HTML</p>
                        <a href="#" class="btn">View Project</a>
                    </div>
                </div>
            </div>
        </div>