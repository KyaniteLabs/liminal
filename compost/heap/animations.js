// Scroll-triggered animations
function initAnimations() {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Fade-in animations with IntersectionObserver
    const fadeElements = document.querySelectorAll('.fade-in');

    if (prefersReducedMotion) {
        // Immediately show all elements without animation
        fadeElements.forEach(el => el.classList.add('visible'));
    } else {
        const fadeObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    fadeObserver.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1
        });

        fadeElements.forEach(el => fadeObserver.observe(el));
    }

    // Typewriter effect for elements with .typewriter class
    const typewriterElements = document.querySelectorAll('.typewriter');

    if (!prefersReducedMotion) {
        const typewriterObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    startTypewriter(entry.target);
                    typewriterObserver.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.5
        });

        typewriterElements.forEach(el => {
            // Mark for JS animation — CSS class sets width: 0
            el.classList.add('typewriting');
            typewriterObserver.observe(el);
        });
    }
}

// Typewriter animation function
function startTypewriter(element) {
    const text = element.textContent;
    // Measure full width before collapsing
    const targetWidth = element.scrollWidth;
    element.textContent = '';
    // Set explicit width so overflow clips correctly
    element.style.width = '0px';
    element.style.minWidth = '0px';

    let currentIndex = 0;
    const speed = 40; // milliseconds per character

    function type() {
        if (currentIndex < text.length) {
            element.textContent += text.charAt(currentIndex);
            currentIndex++;
            // Grow width proportionally to characters typed
            element.style.width = ((currentIndex / text.length) * targetWidth) + 'px';
            setTimeout(type, speed);
        } else {
            // Animation complete — release width constraint
            element.style.width = 'auto';
            element.style.minWidth = '';
            element.classList.remove('typewriting');
        }
    }

    type();
}
