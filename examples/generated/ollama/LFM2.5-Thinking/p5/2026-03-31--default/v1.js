const width=800, height=600;
function setup() {
  createCanvas(width, height);
  windowResized();
} function draw() {
  background(0);
  fill(1);
  for(let p=0;p<1000;p++) particles.push({x:noise(noise(width*random(width),random(height)),y:noise(width*random(width),random(height))});
  particles.forEach(p=>{
    p.y += gravity();
    p.x += noise(p.x * 0.5 + noise(p.y));
    fill(0);
    stroke(0);
    rect(p.x, p.y, 10, 10);
  });
}