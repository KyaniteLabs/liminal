<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Creative Coding Portfolio - Interactive Web Experiments and Generative Art">
    <meta name="theme-color" content="#0a0a0f">
    <title>Creative Code | Portfolio</title>
    <style>
        :root {
            --bg-primary: #0a0a0f;
            --bg-secondary: #161b22;
            --bg-card: #1c2128;
            --accent-cyan: #00f2ff;
            --accent-purple: #bc13fe;
            --accent-pink: #ff006e;
            --text-primary: #ffffff;
            --text-secondary: #b0b8c4;
            --border: rgba(255, 255, 255, 0.1);
            --shadow: rgba(0, 0, 0, 0.4);
            --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        html {
            scroll-behavior: smooth;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            overflow-x: hidden;
        }

        /* Animated Background */
        .gradient-bg {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            background: linear-gradient(-45deg, #0a0a0f, #1a1a2e, #16213e, #0f3460);
            background-size: 400% 400%;
            animation: gradientShift 15s ease infinite;
        }

        @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }

        /* Navigation */
        header {
            position: fixed;
            top: 0;
            width: 100%;
            background: rgba(10, 10, 15, 0.8);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid var(--border);
            z-index: 1000;
            padding: 1rem 0;
        }

        nav {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .logo {
            font-size: 1.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            letter-spacing: -1px;
        }

        .nav-links {
            display: flex;
            gap: 2rem;
            list-style: none;
        }

        .nav-links a {
            color: var(--text-secondary);
            text-decoration: none;
            font-weight: 500;
            transition: var(--transition);
            position: relative;
        }

        .nav-links a::after {
            content: '';
            position: absolute;
            bottom: -5px;
            left: 0;
            width: 0;
            height: 2px;
            background: linear-gradient(90deg, var(--accent-cyan), var(--accent-purple));
            transition: var(--transition);
        }

        .nav-links a:hover {
            color: var(--text-primary);
        }

        .nav-links a:hover::after {
            width: 100%;
        }

        .mobile-menu-btn {
            display: none;
            background: none;
            border: none;
            color: var(--text-primary);
            font-size: 1.5rem;
            cursor: pointer;
        }

        /* Hero Section */
        #hero {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            padding: 6rem 2rem 2rem;
            overflow: hidden;
        }

        .hero-content {
            text-align: center;
            max-width: 800px;
            z-index: 1;
        }

        .hero-badge {
            display: inline-block;
            padding: 0.5rem 1rem;
            background: rgba(0, 242, 255, 0.1);
            border: 1px solid var(--accent-cyan);
            border-radius: 50px;
            color: var(--accent-cyan);
            font-size: 0.875rem;
            margin-bottom: 1.5rem;
            animation: fadeInUp 0.8s ease;
        }

        h1 {
            font-size: clamp(2.5rem, 8vw, 4.5rem);
            font-weight: 800;
            line-height: 1.1;
            margin-bottom: 1.5rem;
            background: linear-gradient(135deg, var(--text-primary) 0%, var(--accent-cyan) 50%, var(--accent-purple) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: fadeInUp 0.8s ease 0.2s both;
        }

        .hero-subtitle {
            font-size: clamp(1.125rem, 3vw, 1.5rem);
            color: var(--text-secondary);
            margin-bottom: 2.5rem;
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
            animation: fadeInUp 0.8s ease 0.4s both;
        }

        .cta-group {
            display: flex;
            gap: 1rem;
            justify-content: center;
            flex-wrap: wrap;
            animation: fadeInUp 0.8s ease 0.6s both;
        }

        .btn {
            padding: 1rem 2rem;
            border-radius: 8px;
            font-weight: 600;
            text-decoration: none;
            transition: var(--transition);
            cursor: pointer;
            border: none;
            font-size: 1rem;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
        }

        .btn-primary {
            background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
            color: var(--bg-primary);
            box-shadow: 0 4px 15px rgba(0, 242, 255, 0.3);
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 242, 255, 0.4);
        }

        .btn-secondary {
            background: transparent;
            color: var(--text-primary);
            border: 1px solid var(--border);
        }

        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.05);
            border-color: var(--accent-cyan);
        }

        /* Floating shapes animation */
        .shape {
            position: absolute;
            filter: blur(50px);
            opacity: 0.4;
            animation: float 20s infinite ease-in-out;
        }

        .shape-1 {
            width: 300px;
            height: 300px;
            background: var(--accent-purple);
            border-radius: 50%;
            top: 20%;
            left: 10%;
            animation-delay: 0s;
        }

        .shape-2 {
            width: 200px;
            height: 200px;
            background: var(--accent-cyan);
            border-radius: 50%;
            bottom: 20%;
            right: 10%;
            animation-delay: -5s;
        }

        .shape-3 {
            width: 150px;
            height: 150px;
            background: var(--accent-pink);
            border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
            top: 50%;
            right: 30%;
            animation-delay: -10s;
        }

        @keyframes float {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(30px, -50px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        /* Sections */
        section {
            padding: 6rem 2rem;
            max-width: 1200px;
            margin: 0 auto;
        }

        .section-header {
            text-align: center;
            margin-bottom: 4rem;
        }

        h2 {
            font-size: clamp(2rem, 5vw, 3rem);
            margin-bottom: 1rem;
            background: linear-gradient(135deg, var(--text-primary), var(--accent-cyan));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .section-subtitle {
            color: var(--text-secondary);
            font-size: 1.125rem;
            max-width: 600px;
            margin: 0 auto;
        }

        /* Projects Grid */
        .projects-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
        }

        .project-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            overflow: hidden;
            transition: var(--transition);
            position: relative;
            opacity: 0;
            transform: translateY(20px);
        }

        .project-card.visible {
            opacity: 1;
            transform: translateY(0);
            transition: opacity 0.6s ease, transform 0.6s ease;
        }

        .project-card:hover {
            transform: translateY(-10px);
            border-color: var(--accent-cyan);
            box-shadow: 0 20px 40px var(--shadow);
        }

        .project-image {
            width: 100%;
            height: 200px;
            background: linear-gradient(135deg, var(--bg-secondary), #2a303c);
            position: relative;
            overflow: hidden;
        }

        .project-image::before {
            content: '<CODE />';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: var(--accent-cyan);
            font-family: 'Courier New', monospace;
            font-size: 1.2rem;
            opacity: 0.5;
        }

        .project-content {
            padding: 1.5rem;
        }

        .project-tags {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 1rem;
            flex-wrap: wrap;
        }

        .tag {
            padding: 0.25rem 0.75rem;
            background: rgba(0, 242, 255, 0.1);
            border: 1px solid rgba(0, 242, 255, 0.2);
            border-radius: 50px;
            font-size: 0.75rem;
            color: var(--accent-cyan);
            font-weight: 600;
        }

        h3 {
            font-size: 1.25rem;
            margin-bottom: 0.5rem;
            color: var(--text-primary);
        }

        .project-description {
            color: var(--text-secondary);
            font-size: 0.95rem;
            line-height: 1.6;
        }

        .project-links {
            display: flex;
            gap: 1rem;
            margin-top: 1.5rem;
        }

        .project-link {
            color: var(--text-secondary);
            text-decoration: none;
            font-size: 0.875rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 0.25rem;
            transition: var(--transition);
        }

        .project-link:hover {
            color: var(--accent-cyan);
        }

        /* Contact Section */
        #contact {
            background: var(--bg-secondary);
            border-radius: 24px;
            margin: 4rem auto;
            border: 1px solid var(--border);
        }

        .contact-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4rem;
            align-items: start;
        }

        .contact-info h3 {
            font-size: 2rem;
            margin-bottom: 1rem;
            background: linear-gradient(135deg, var(--text-primary), var(--accent-purple));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .contact-info p {
            color: var(--text-secondary);
            margin-bottom: 2rem;
        }

        .contact-details {
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }

        .contact-item {
            display: flex;
            align-items: center;
            gap: 1rem;
            color: var(--text-secondary);
        }

        .contact-icon {
            width: 40px;
            height: 40