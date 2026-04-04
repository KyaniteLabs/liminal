This is a classic physics simulation problem. We will use a `Ball` class to manage individual ball properties and implement custom collision and boundary handling within the main loop.

We will use the standard elastic collision response for ball-to-ball interaction, and calculate the distance to the center of the screen to enforce the circular boundary.

```javascript
/**
 * p5.js Sketch: Multiple Bouncing Balls in a Circular Container
 * Implements ball-to-ball elastic collision detection.
 */

// Array to hold all the ball objects
let balls = [];

// --- BALL CLASS ---
class Ball {
    constructor(x, y, r, vx, vy) {
        this.x = x;
        this.y = y;
        this.r = r;
        this.vx = vx;
        this.vy = vy;
    }

    // Update position and handle collisions
    update(containerRadius) {
        // 1. Update Position
        this.x += this.vx;
        this.y += this.vy;

        // 2. Handle Outer Circular Boundary Collision
        this.checkContainerBoundary(containerRadius);

        // 3. Update position after potential separation due to collision response
        // (This is usually handled in the main loop, but keep structure clean)
    }

    // Check and correct collision with the outer circle
    checkContainerBoundary(containerRadius) {
        const cx = width / 2;
        const cy = height / 2;

        // Calculate the vector from the center of the container to the ball
        let dx = this.x - cx;
        let dy = this.y - cy;
        
        // Distance squared from the center
        let distSq = dx * dx + dy * dy;
        
        // Maximum allowed distance for the center of the ball
        let maxDist = containerRadius - this.r;
        let maxDistSq = maxDist * maxDist;

        if (distSq > maxDistSq) {
            // Calculate how far outside the boundary the ball is
            let dist = Math.sqrt(distSq);
            let overshoot = dist - maxDist;
            
            // Push the ball back slightly to resolve overlap
            let correctionFactor = (this.r / maxDist) * overshoot * 0.5;

            // Calculate the normalization vector components (unit vector pointing from center to ball)
            let nx = dx / dist;
            let ny = dy / dist;
            
            // Move the ball center back by the overlap distance scaled by the normal vector
            this.x -= nx * overshoot;
            this.y -= ny * overshoot;

            // Simple reflection approximation: Reverse the velocity component along the normal vector
            // This is a crude approximation but effective for visualization.
            let dotProduct = this.vx * nx + this.vy * ny;
            let impulse = -2 * dotProduct;

            this.vx += impulse * nx;
            this.vy += impulse * ny;
        }
    }

    // Check and resolve collision with another ball (Ball B)
    resolveCollision(otherBall, containerRadius) {
        // 1. Calculate distance vector components
        let dx = this.x - otherBall.x;
        let dy = this.y - otherBall.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        let minDistance = this.r + otherBall.r;

        // Check for overlap
        if (distance < minDistance) {
            // --- 1. Separation (Prevent sticking/sinking) ---
            let overlap = minDistance - distance;
            let separationFactor = overlap * 0.5; // Move both balls half the overlap distance

            // Calculate the unit normal vector (direction from otherBall to this ball