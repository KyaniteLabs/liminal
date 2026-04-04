let fireworks = [];
let particles = [];

class Particle {
    constructor(x, y, hue) {
        this.position = createVector(x, y);
        this.velocity = p5.Vector.random2D().mult(random(2, 8));
        this.acceleration = createVector(0, 0.1); // Gravity
        this.lifespan = 255;
        this.hue = hue;
    }

    applyForce(force) {
        this.acceleration.add(force);
    }

    update() {
        this.velocity.add(this.acceleration);
        this.position.add(this.velocity);
        this.acceleration.mult(0); // Reset acceleration
        this.lifespan -= 4;
    }

    show() {
        colorMode(HSB, 360, 100, 100, 255);
        stroke(this.hue, 100, 100, this.lifespan);
        strokeWeight(3);
        point(this.position.x, this.position.y);
    }

    isDone() {
        return this.lifespan < 0;
    }
}

class Firework {
    constructor(startX, startY, targetX, targetY) {
        this.start = createVector(startX, startY);
        this.target = createVector(targetX, targetY);
        this.position = createVector(startX, startY);
        this.velocity = p5.Vector.sub(this.target, this.start).div(60); // Initial speed calculation
        this.hue = random(360);
        this.exploded = false;
    }

    update() {
        if (!this.exploded) {
            this.position.add(this.velocity);
            // Check if we are close enough to the target
            let distance = p5.Vector.dist(this.position, this.target);
            if (distance < 10) {
                this.exploded = true;
                return true; // Signal to explode
            }
        } else {
            // If exploded, we handle particle generation elsewhere, but we keep the object alive for a frame or two.
        }
        return false; // Signal not to explode yet
    }

    show() {
        if (!this.exploded) {
            stroke(this.hue, 100, 100);
            strokeWeight(4);
            point(this.position.x, this.position.y);
        }
    }
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    colorMode(HSB, 360, 100, 100, 255);
}

function draw() {
    // Semi-transparent background creates the fading trail effect
    background(0, 0, 0, 20);

    // 1. Update and draw Fireworks (the rocket trails)
    for (let i = fireworks.length - 1; i >= 0; i--) {
        let firework = fireworks[i];
        firework.show();
        let exploded = firework.update();

        if (exploded && !firework.exploded) {
            // Explode: Create many particles at the target location
            for (let j = 0; j < 100; j++) {
                particles.push(new Particle(firework.target.x, firework.target.y, firework.hue));
            }
            firework.exploded = true; // Mark as exploded so we don't re-explode it
        }

        // Remove firework if it has exploded and its particles are handled (optional: keep for a moment)
        if (firework.exploded && random(1) < 0.02) {
             fireworks.splice(i, 1);
        }
    }

    // 2. Update and draw Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.update();
        p.show();

        if (p.isDone()) {
            particles.splice(i, 1);
        }
    }

    // 3. Launch new fireworks randomly
    if (random(1) < 0.07) {
        let startX = random(width);
        let startY = height; // Launched from the bottom
        let targetX = random(width * 0.2, width * 0.8);
        let targetY = random(height * 0.1, height * 0.4); // Target in the upper part of the sky
        fireworks.push(new Firework(startX, startY, targetX, targetY));
    }
}