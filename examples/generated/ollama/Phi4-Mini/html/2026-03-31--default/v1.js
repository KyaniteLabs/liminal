<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Creative Coding Portfolio</title>
    <style>
        :root {
            --primary-color: #5b9bdc;
            --secondary-color: #f7fafb;
            --transition-speed: 300ms;
        }
        body { margin: 0; font-family: Arial, sans-serif; background-color: var(--secondary-color); color: black; display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; flex-direction: column; }
        .hero {
            width: 80vw;
            max-width: 900px;
            aspect-ratio: 16 / 9;
            overflow: hidden;
            animation: gradientBackground var(--transition-speed) infinite alternate ease-in-out;
        }
        @keyframes gradientBackground {
            background-color: from(var(--secondary-color)) to(hsl(210, 20%, 60%));
        }
        .project-card { display: flex; flex-direction: column; align-items: center; margin-bottom: 1rem; transition: transform var(--transition-speed);
            &:hover { transform: scale(1.05); }
        .contact-form input, .contact-form button { padding: 0.5rem; border-radius: 4px; margin-top: 0.25rem; }
    </style>
</head>
<body>
    <header class="hero" style="background-image: linear-gradient(135deg, var(--primary-color) ,var(--secondary-color));">
        <!-- Hero Section with Animated Gradient Background -->
    </header>

    <main>
        <section class="project-cards">
            <div class="project-card">Project 1</div>
            <div class="project-card">Project 2</div>
            <div class="project-card">Project 3</div>
        </section>
        
        <form class="contact-form">
            <input type="text" placeholder="Name" required />
            <input type="email" placeholder="Email" required />
            <textarea placeholder="Message" required></textarea>
            <button type="submit">Send Message</button>
        </form>
    </main>

    <script>
        document.querySelectorAll('.project-card').forEach(card => {
            card.addEventListener('mouseenter', () => console.log(`Hovered over ${card.textContent}`));
            card.addEventListener('mouseleave', () => console.log(`${card.textContent} mouse left`))
        })

    </script>
</body>
</html>