<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Creative Coding Portfolio</title>
    <style>
        :root {
            --primary-color: #3498db;
            --secondary-color: #2ecc71;
            --background-color: #f1f1f1;
            --text-color: #333;
            --transition-duration: 0.3s;
        }
        body {
            margin: 0;
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: var(--text-color);
        }
        header, nav, main, section, article, footer {
            padding: 20px;
        }
        .hero-section {
            display: flex;
            justify-content: center;
            align-items: center;
            height: calc(100vh - 80px);
        }
        .hero-section img {
            width: 100%;
            transition: transform var(--transition-duration) ease-in-out;
        }
        .hero-section:hover img {
            transform: scale(1.05);
        }
        nav {
            display: flex;
            justify-content: space-around;
            background: var(--primary-color);
            padding: 10px 0;
        }
        main {
            display: grid;
            gap: 20px;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            margin-top: 40px;
        }
        .project-card {
            background: var(--background-color);
            border-radius: 8px;
            overflow: hidden;
            transition: transform var(--transition-duration) ease-in-out;
        }
        .project-card:hover {
            transform: translateY(-5%);
        }
        article {
            margin-top: 20px;
        }
        footer {
            background: var(--primary-color);
            color: white;
            text-align: center;
            padding: 10px 0;
        }
    </style>
</head>
<body>
    <header>
        <nav>
            <a href="#" class="logo">Creative Coding Portfolio</a>
        </nav>
    </header>
    <main>
        <section class="hero-section">
            <img src="https://via.placeholder.com/1920x1080?text=Gradient+Background" alt="">
        </section>
    </main>
    <article>
        <div class="project-card">
            <h2>Project Title 1</h2>
            <p>A brief description of the project.</p>
            <button>Contact Me</button>
        </div>
        <div class="project-card">
            <h2>Project Title 2</h2>
            <p>A brief description of the project.</p>
            <button>Contact Me</button>
        </div>
    </article>
    <footer>
        <p>&copy; 2023 Creative Coding Portfolio. All rights reserved.</p>
    </footer>
    <script>
        // Add your JavaScript code here
    </script>
</body>
</html>