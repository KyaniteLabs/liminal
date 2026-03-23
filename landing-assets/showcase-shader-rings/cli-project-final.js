Now I need to compute the chromatic separation by offsetting the ring distances for each color channel. The aberration value creates a subtle separation that increases with the pulse. Each color channel gets its own ring pattern based on the distorted distance calculations. 0.5);
    
    vec3 col = vec3(r, g, b);
    
    // Add some glow
    col += 0.1 / (dist + 0.1) * pulse;
    
    gl_FragColor = vec4(col, 1.0);
}