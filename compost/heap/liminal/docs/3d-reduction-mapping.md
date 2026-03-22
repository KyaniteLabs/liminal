# 3D Logic: Cone 10 Reduction Mapping

## The Concept
In high-fire reduction (Cone 10), the atmosphere is oxygen-starved. This physical "deprivation" creates the visual character (copper reds, celadons, carbon trapping).

## Mapping Strategy for Voice-to-Sculpture
I am instructing the scavenger logic to translate "Oxygen Deprivation" into "Vertex Depletion" or "Noise Injection."

### 1. The Carbon Trapping Effect (Shino)
- **Physics:** Carbon is trapped under the glaze.
- **3D Logic:** Random noise clusters that "break" the surface mesh, creating localized roughness where the "carbon" (noise) is highest.

### 2. The Celadon Pool (Translucency)
- **Physics:** Iron in the glaze turns green/blue where it pools.
- **3D Logic:** Ambient Occlusion mapping. Deep crevices in the 3D model get a higher "specular" and "transparency" value, simulating thick, glassy pools.

### 3. The Copper Red Blush (Reduction Sio2)
- **Physics:** Copper turns red only in a reduced state.
- **3D Logic:** Surface-normal mapping. Areas facing "away" from the primary light source (the "reduced" side) get a shift toward high-chroma red/oxblood textures.

## The Prompt Seed for Token Mill
"Sculpt a form that can withstand the weight of a thick, crawling Shino glaze. Deep pools for Celadon at the base. Sharp edges for iron breaks. It must survive 2350°F (Cone 10) without collapsing."
