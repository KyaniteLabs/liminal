# EvoLab - Product Requirements

**Purpose:** Defines WHAT to build  
**Generated:** November 15, 2025  
**Status:** MVP Scope Defined

---

## Project Overview

### Vision

Create the world's most accessible, educational, and data-rich evolution simulator that democratizes understanding of evolutionary biology through interactive gameplay. EvoLab will be the open-source alternative to Spore that prioritizes scientific accuracy, data transparency, and educational value over photorealistic graphics.

**Long-term vision:** Become the primary teaching tool for evolution in classrooms worldwide, with curriculum integration, teacher resources, and student progress tracking.

### Problem Statement

**Current state:**
- Spore is proprietary, expensive, and no longer actively developed
- Educational evolution simulators are either too simplistic (lack depth) or too complex (academic papers, not games)
- Students struggle to understand evolution because abstract concepts (natural selection, genetic drift, fitness) lack tangible demonstrations
- Existing tools don't provide the rich data visualization that helps learners connect gameplay to scientific principles

**Desired state:**
- Free, open-source evolution simulator accessible to anyone with a web browser
- Engaging gameplay that naturally teaches evolutionary concepts through experience
- Rich data visualization showing population dynamics, trait inheritance, and environmental pressures in real-time
- Educators can use it in classrooms without installation or cost barriers
- Modding community can extend it with new biomes, creatures, and mechanics

### Target Users

**Primary:**
1. **Students (ages 12-18)** - Learning evolution in biology classes
   - Need: Fun way to understand natural selection, adaptation, genetic inheritance
   - Pain point: Textbooks are boring, concepts are abstract

2. **Educators (K-12, college)** - Teaching biology/evolution
   - Need: Free, easy-to-use tool that aligns with curriculum standards
   - Pain point: Limited resources, expensive software licenses

3. **Evolution enthusiasts** - Adult learners interested in biology
   - Need: Sandbox to experiment with evolutionary principles
   - Pain point: Spore is outdated, no modern alternatives

**Secondary:**
4. **Game developers** - Learning procedural generation, genetic algorithms
   - Need: Reference implementation of evolution mechanics, well-documented code
   - Pain point: Most game dev tutorials don't cover genetic algorithms

5. **Data visualization enthusiasts** - People who love charts/graphs
   - Need: Rich, real-time data from simulations
   - Pain point: Most games hide their data, don't provide export options

### Success Metrics

**User Engagement:**
- 1,000+ unique players in first 3 months
- 50+ user-created creature designs shared
- Average session length: 15+ minutes
- Repeat play rate: 30%+ return within 7 days

**Educational Impact:**
- 10+ classroom adoptions in Year 1
- Post-survey: 80%+ report "learned something new about evolution"
- 3+ educational YouTube channels create content about EvoLab
- Featured on /r/biology, /r/gamedev, Hacker News

**Technical:**
- 60 FPS at 1x speed with 200 entities
- Zero crashes in 1-hour play session
- < 3 second load time on 3G connection

**Community:**
- 250+ GitHub stars in Year 1
- 20+ code contributors
- 5+ forks with meaningful modifications

**Open Source Health:**
- Issue response time: < 48 hours
- PR merge time: < 7 days
- Active Discord/discussion forum: 100+ members

---

## Core Features (MVP)

### Feature 1: Cell Stage Gameplay

**Priority:** P0 (CRITICAL - MVP cannot ship without this)

**User Story:**
> As a player, I want to control a single-celled organism in a dynamic environment, so that I can experience the challenges of survival and evolution from the simplest life form.

**Description:**
The cell stage is the core gameplay loop where players control a microscopic cell in a procedurally generated lake. The cell must collect resources (glucose, amino acids, phosphates), manage its ATP (energy), avoid predators, and survive long enough to reproduce. Each generation, the player can modify their cell's traits, creating a unique evolutionary lineage.

**Acceptance Criteria:**
- [ ] Player can control a cell using WASD keys or mouse click-to-move
- [ ] Cell has a visible sprite that reflects its size and visual traits (color, patterns)
- [ ] ATP (energy) drains continuously based on cell's metabolism rate
- [ ] Player can collect 3 resource types: glucose, amino acids, phosphates
- [ ] Collecting resources increases compound storage and can restore ATP
- [ ] Cell dies when ATP reaches 0 or health reaches 0
- [ ] When reproduction requirements are met, player is prompted to reproduce
- [ ] Camera follows the player's cell smoothly
- [ ] Minimap shows player position and nearby resources
- [ ] HUD displays: Current ATP, max ATP, health, resource levels, generation number

**User Flow:**
1. Player starts in shallow warm water zone
2. Player moves cell using controls, exploring environment
3. Player collects glucose particles to restore ATP
4. Player avoids or fights AI-controlled cells (depending on aggression trait)
5. When ATP and compounds reach thresholds, reproduction prompt appears
6. Player opens trait editor, modifies species
7. New generation spawns with updated traits
8. Repeat until player achieves goals or cell dies

**Business Rules:**
- ATP drain rate = `baseRate * metabolismRate * (1 + size * 0.1)`
- Bigger cells drain more ATP but have more health
- Armor reduces speed: `actualSpeed = baseSpeed * (1 - armor * 0.05)`
- Vision range increases with intelligence: `range = baseRange * (1 + intelligence * 0.05)`

**Data Needed:**
- Cell position (x, y)
- Cell velocity (vx, vy)
- All 40+ trait values (see Technical Spec)
- Current ATP, health, resource levels
- Generation number, lineage ID

**Edge Cases:**
- **ATP reaches 0** → Cell dies, show death summary, offer to restart or load save
- **Reproduction triggered but population > limit** → Delay reproduction, show "overpopulation" message
- **Player exits lake boundaries** → Invisible wall prevents leaving, or implement wraparound
- **Multiple resources in same location** → Prioritize highest-value resource for auto-collection

---

### Feature 2: Comprehensive Trait System

**Priority:** P0 (CRITICAL)

**User Story:**
> As a player, I want to customize my cell with dozens of interconnected traits, so that I can create unique survival strategies and see how my choices affect gameplay.

**Description:**
The trait system is the heart of EvoLab's depth. It includes 40+ traits across 6 categories (energy, physical, senses, behavior, special abilities, environmental adaptation). Traits are not independent; they interact in realistic ways (bigger size = slower speed, high metabolism = more energy but faster drain).

**Acceptance Criteria:**
- [ ] All 40+ traits are implemented with min/max bounds
- [ ] Trait interconnections work as specified (e.g., size affects speed, health, energy)
- [ ] Trait values are stored in genome and persisted across generations
- [ ] Trait editor UI displays all traits with clear labels and current values
- [ ] Sliders/inputs allow modification within valid ranges
- [ ] Real-time preview shows how trait changes affect stats
- [ ] Trait changes cost "DNA points" (earned through survival)
- [ ] Tooltip explanations for each trait
- [ ] "Reset to defaults" button to undo changes
- [ ] "Randomize" button for experimentation

**User Flow:**
1. Player opens trait editor (after reproduction or via menu)
2. Player sees current trait values organized by category
3. Player adjusts sliders (e.g., increase speed, decrease size)
4. Real-time feedback shows new stats (ATP drain, health, etc.)
5. Player confirms changes, DNA points are spent
6. Next generation spawns with updated traits

**Business Rules:**
- Each trait has min/max bounds (defined in Technical Spec)
- DNA points earned: `survivalTime * 0.1 + resourcesCollected * 0.05`
- Trait modifications capped at ±2 points per generation (prevents radical changes)
- Some traits unlock at higher complexity levels (e.g., electric shock requires nucleus)

**Data Needed:**
- Genome object with all trait values
- DNA points available
- Trait unlock status

**Edge Cases:**
- **Player tries to exceed DNA budget** → Show error, prevent changes
- **Trait hits min/max bound** → Disable slider, show tooltip
- **Invalid trait combination** → Warn player (e.g., photosynthesis + carnivore is suboptimal)

---

### Feature 3: Genetic Algorithm & Evolution

**Priority:** P0 (CRITICAL)

**User Story:**
> As a player, I want my cell's traits to be inherited by offspring with small mutations, so that I can observe evolution happening across generations.

**Description:**
The genetic algorithm handles reproduction, inheritance, and mutation. When the player reproduces, their cell's genome is copied to offspring with small random mutations. Environmental pressures (fitness based on survival time, resources collected, threats avoided) influence which traits are more likely to be passed on.

**Acceptance Criteria:**
- [ ] Reproduction triggers when all requirements are met (ATP, compounds, maturity timer)
- [ ] Offspring inherits parent's genome with 90%+ similarity
- [ ] Mutations randomly adjust traits within ±10% of parent value
- [ ] Mutation rate is configurable (default: 5% chance per trait)
- [ ] Genetic algorithm runs in Web Worker (doesn't block main thread)
- [ ] Player can see mutation summary after reproduction
- [ ] Generation counter increments with each reproduction
- [ ] Lineage ID tracks evolutionary history
- [ ] "Pure breeding" option (no mutations, for controlled experiments)

**User Flow:**
1. Player meets reproduction requirements
2. Game pauses, shows "Reproduction available" notification
3. Player clicks "Reproduce" button
4. Genetic algorithm worker generates offspring genome
5. Mutation summary modal shows changes (e.g., "Speed +0.5, Size -0.3")
6. Player can accept or reroll mutations (1 reroll per generation)
7. Offspring spawns, old cell remains alive or dies (based on settings)

**Business Rules:**
- Mutation magnitude: `trait ± (trait * mutationRate * random(0.5, 1.5))`
- Beneficial mutations (increase fitness) have slightly higher inheritance chance
- Harmful mutations (decrease fitness) gradually filter out over generations
- Crossover (mixing two parents) is Phase 2 feature (not in MVP)

**Data Needed:**
- Parent genome
- Environment fitness snapshot
- Mutation rate setting

**Edge Cases:**
- **Mutation results in invalid trait value** → Clamp to min/max
- **Worker doesn't respond in 5 seconds** → Timeout, show error, allow retry
- **Player declines reproduction** → Continue playing with current cell

---

### Feature 4: Procedurally Generated Lake Environment

**Priority:** P0 (CRITICAL)

**User Story:**
> As a player, I want to explore a diverse lake with multiple biomes, so that I can experience different environmental challenges and adapt my cell accordingly.

**Description:**
The lake is a procedurally generated 2D environment with 5-7 distinct biomes (shallow warm, deep cold, nutrient-rich, toxic zones, etc.). Each biome has unique properties (temperature, light level, nutrient density, hazards) that affect cell survival and fitness.

**Acceptance Criteria:**
- [ ] Lake is procedurally generated using Perlin noise for organic shapes
- [ ] Lake size: 4000x3000 pixels (medium)
- [ ] 5-7 distinct biomes with visual differentiation (color gradients, particles)
- [ ] Biome properties affect cell fitness (temperature tolerance, pressure resistance, etc.)
- [ ] Smooth transitions between biomes (gradients, not hard borders)
- [ ] Resources spawn based on biome type (e.g., more glucose in nutrient-rich zones)
- [ ] Minimap shows biome zones clearly
- [ ] "Biome info" tooltip on hover (shows temp, light, nutrients)

**User Flow:**
1. Game generates new lake on start (or loads saved lake)
2. Player spawns in safe "starter biome" (shallow warm)
3. Player explores, discovers new biomes
4. Player notices performance changes (e.g., "Entering deep cold zone: speed -10%")
5. Player adapts traits to thrive in preferred biomes

**Business Rules:**
- Each biome has parameter ranges:
  - Temperature: 5°C to 80°C
  - Light level: 0% (dark) to 100% (bright)
  - Nutrient density: 0 (barren) to 10 (abundant)
  - Pressure: 0 (surface) to 10 (deep)
- Fitness penalty if cell's tolerances don't match biome
- Fitness calculation: `1 - abs(cellTolerance - biomeValue) / 10`

**Data Needed:**
- Biome map (grid of biome IDs)
- Per-biome properties (temp, light, nutrients, etc.)
- Spawn rules for resources

**Edge Cases:**
- **Biomes overlap during generation** → Blend properties smoothly
- **Player exits lake boundary** → Invisible wall or wraparound
- **Toxic zone kills cell instantly** → Show warning, allow "hardcore mode" toggle

---

### Feature 5: AI-Controlled Competing Species

**Priority:** P0 (CRITICAL for MVP feel)

**User Story:**
> As a player, I want to compete with AI-controlled species for resources, so that I experience the competitive pressure of natural selection.

**Description:**
The player is not alone in the lake. 0-5 AI-controlled species (user-selectable) evolve alongside the player, competing for resources, territory, and survival. Each AI has a distinct personality (herbivore, carnivore, omnivore) and uses decision trees to make survival choices.

**Acceptance Criteria:**
- [ ] At game start, player selects number of AI species (0-5)
- [ ] AI species have distinct traits and behaviors (herbivore: peaceful, carnivore: aggressive)
- [ ] AI cells collect resources, reproduce, and die like player
- [ ] AI population is tracked and displayed in UI
- [ ] AI species can go extinct if unfit for environment
- [ ] Player can see AI species stats in "Species Browser" panel
- [ ] AI species names are randomly generated (e.g., "Velocibacter", "Sluggococcus")

**User Flow:**
1. Player selects AI species count in main menu (default: 3)
2. Game spawns AI species in different starting locations
3. AI cells move autonomously, collect resources, avoid threats
4. Player observes AI population changes in real-time graph
5. Player competes with AI for limited resources
6. Dominant species (highest population) gets special visual effect (glow)

**Business Rules:**
- Each AI species has independent evolution (separate genomes, lineages)
- AI reproduction follows same rules as player (ATP, compounds, maturity)
- AI fitness calculated same way as player (survival time, resources)
- AI decision-making uses simple behavior trees (not machine learning)

**Data Needed:**
- AI species list (ID, name, traits, personality)
- Per-species population count
- AI decision tree states

**Edge Cases:**
- **All AI species go extinct** → Show notification, offer to spawn new AI
- **AI population explodes** → Implement population cap per species
- **Player kills AI cell** → Award bonus DNA points, trigger AI revenge behavior

---

### Feature 6: Real-Time Data Visualization Dashboard

**Priority:** P1 (HIGH - key differentiator)

**User Story:**
> As a player, I want to see detailed graphs and charts of my evolution progress, so that I can understand the scientific principles behind my gameplay experience.

**Description:**
The data visualization dashboard provides real-time insights into population dynamics, trait evolution, resource levels, and environmental fitness. Built with D3.js, these visualizations are interactive, exportable, and educational.

**Acceptance Criteria:**
- [ ] **Population Chart**: Line chart showing player + AI populations over time (generations or real-time)
- [ ] **Evolution Tree**: Tree diagram showing player's lineage with branches for mutations
- [ ] **Trait Radar**: Radar chart comparing player's 8 core traits to average AI traits
- [ ] **Resource Bars**: Horizontal bars showing ATP, glucose, amino acids, phosphates
- [ ] **Biome Heatmap**: Grid overlay on lake showing fitness levels per biome for current traits
- [ ] All charts update in real-time (no manual refresh)
- [ ] Charts are interactive (hover for details, click to focus)
- [ ] "Export as PNG" button for each chart
- [ ] Dashboard can be toggled on/off to maximize game view

**User Flow:**
1. Player opens dashboard (button in HUD)
2. Player sees 5 charts arranged in responsive grid
3. Player hovers over population chart → sees exact values per species
4. Player clicks "Export" → PNG downloads to computer
5. Player uses data for school report or social media post

**Business Rules:**
- Chart update frequency: Every 5 seconds (or every generation)
- Data retention: Last 100 generations or 30 minutes of play
- Population chart: Max 6 lines (player + 5 AI species)

**Data Needed:**
- Time-series data: Population counts per species per timestep
- Lineage tree: Parent-child relationships with mutation details
- Current trait values for radar chart
- Real-time resource levels
- Biome-fitness matrix

**Edge Cases:**
- **Too much data** → Implement sliding window (show last N generations)
- **Chart obscures gameplay** → Allow minimize/maximize, transparency slider
- **Export fails** → Show error, offer CSV export as fallback

---

### Feature 7: Time Controls (Speed Simulation)

**Priority:** P1 (HIGH - enables fast experimentation)

**User Story:**
> As a player, I want to speed up or slow down time, so that I can observe hundreds of generations in minutes without waiting.

**Description:**
Time controls allow players to run the simulation at 1x (real-time), 10x, 100x, or 1000x speed. At higher speeds, animations are simplified or skipped to maintain performance. This feature is critical for educators who want to demonstrate evolution in a single class period.

**Acceptance Criteria:**
- [ ] Speed selector in HUD: 1x, 10x, 100x, 1000x buttons
- [ ] Current speed displayed prominently
- [ ] Pause button stops simulation completely
- [ ] Play/resume button restarts from paused state
- [ ] At 1x: Full animations, particles, smooth movement
- [ ] At 10x: Reduced particle effects, interpolated animations
- [ ] At 100x: Minimal rendering, update every 10th frame
- [ ] At 1000x: Headless mode, show results only, no rendering
- [ ] Generation counter updates faster at higher speeds
- [ ] Keyboard shortcuts: Space (pause/play), 1/2/3/4 (speed levels)

**User Flow:**
1. Player starts at 1x speed (default)
2. Player clicks "10x" button
3. Simulation speeds up, animations simplify
4. Player observes 10 generations in 1 minute instead of 10 minutes
5. Player pauses, examines current state, resumes

**Business Rules:**
- At 100x+, auto-pause on reproduction to allow trait editing
- FPS target: 60 FPS at 1x, 30 FPS at 10x/100x, no FPS target at 1000x
- Speed changes take effect immediately (no animation)

**Data Needed:**
- Current speed multiplier
- Frame skip counter
- Performance metrics (FPS, frame time)

**Edge Cases:**
- **Performance drops below 30 FPS** → Auto-reduce quality, show warning
- **User pauses at 1000x** → Resume at 1x speed (prevent confusion)
- **Reproduction triggers at 1000x** → Auto-pause, show modal

---

### Feature 8: Save/Load Game System

**Priority:** P1 (HIGH - users want to save progress)

**User Story:**
> As a player, I want to save my game progress and load it later, so that I can continue my evolutionary experiment across multiple sessions.

**Description:**
The save/load system uses IndexedDB to persist game state locally in the browser. Players can save multiple games with custom names, load any saved game, and autosave prevents data loss.

**Acceptance Criteria:**
- [ ] "Save Game" button in pause menu
- [ ] Player can enter custom save name (default: "Generation N - YYYY-MM-DD")
- [ ] Saves are stored in IndexedDB (50MB+ capacity)
- [ ] "Load Game" menu shows list of all saves with timestamps
- [ ] Player can delete old saves
- [ ] Autosave every 5 minutes (toggleable in settings)
- [ ] "Quick save" keyboard shortcut (Ctrl+S or Cmd+S)
- [ ] Save includes: All entities, environment state, species data, evolution history

**User Flow:**
1. Player pauses game
2. Player clicks "Save Game"
3. Modal prompts for save name
4. Player enters name or uses default
5. Save completes, confirmation shown
6. Later: Player clicks "Load Game"
7. Player selects save from list
8. Game restores saved state

**Business Rules:**
- Save size limit: 10MB per save (compresssed)
- Max saves: 20 (oldest auto-deleted if exceeded)
- Autosave slot: Separate from manual saves
- Save format: JSON (for readability and debugging)

**Data Needed:**
- Game state: All entity data, biome map, AI species states
- Metadata: Save name, timestamp, generation number, player species traits
- Version tag (for migration if schema changes)

**Edge Cases:**
- **Save fails (quota exceeded)** → Prompt user to delete old saves
- **Load fails (corrupted data)** → Show error, offer to delete corrupted save
- **User loads save from older version** → Attempt migration, warn if incompatible

---

### Feature 9: Creature Export/Import System

**Priority:** P1 (HIGH - enables community sharing)

**User Story:**
> As a player, I want to export my evolved creature as a JSON file and import creatures made by others, so that I can share my creations and try community designs.

**Description:**
The export/import system allows players to save individual creatures (genomes + metadata) as standalone JSON files. These files can be shared on forums, GitHub, or social media. Other players can import creatures and spawn them in their own lakes.

**Acceptance Criteria:**
- [ ] "Export Creature" button in trait editor or creature browser
- [ ] Export downloads a `.evolab.json` file with creature data
- [ ] File includes: Genome, traits, generation number, creator name, creation date
- [ ] File is human-readable JSON (not binary)
- [ ] "Import Creature" button in main menu
- [ ] Player selects `.evolab.json` file from computer
- [ ] Imported creature is validated (check for malicious code, invalid traits)
- [ ] Imported creature appears in "Creature Library" panel
- [ ] Player can spawn imported creature in current game

**User Flow:**
1. Player evolves unique creature over 50 generations
2. Player opens creature browser
3. Player clicks "Export" on favorite creature
4. JSON file downloads to computer
5. Player shares file on Reddit /r/EvoLab
6. Another player downloads file
7. Other player imports file via "Import Creature" menu
8. Imported creature spawns in their lake

**Business Rules:**
- Export format: JSON with schema version
- Required fields: genome (all traits), metadata (name, date, generation)
- Optional fields: lineage history, notable mutations, creator notes
- Validation: Check trait bounds, no executable code, file size < 1MB

**Data Needed:**
- Creature genome
- Metadata: Name, generation, timestamp
- Optional: Lineage history (list of ancestors)

**Edge Cases:**
- **Import invalid file** → Show detailed error (e.g., "Speed trait out of bounds")
- **Import creature with future schema version** → Warn that game may need update
- **File size too large** → Reject, show max file size
- **Malicious JSON** → Validate all fields, sanitize strings, reject on failure

---

### Feature 10: Evolution History CSV Export

**Priority:** P2 (MEDIUM - nice for educators)

**User Story:**
> As an educator, I want to export my students' evolution data as CSV, so that they can analyze it in Excel or Google Sheets for a lesson on data analysis.

**Description:**
Players can export their entire evolution history (all generations, trait changes, population dynamics) as a CSV file. This enables deeper analysis in spreadsheet software and serves as a learning tool for data science.

**Acceptance Criteria:**
- [ ] "Export Evolution History" button in data dashboard
- [ ] CSV file includes: Generation number, timestamp, population, all 40+ trait values, fitness score
- [ ] One row per generation
- [ ] Headers are descriptive (e.g., "Generation", "ATP", "Speed", "Population")
- [ ] CSV is properly formatted (comma-delimited, quoted strings)
- [ ] File downloads with descriptive name (e.g., "evolab-history-2025-11-15.csv")

**User Flow:**
1. Player completes 100 generations
2. Player opens data dashboard
3. Player clicks "Export History"
4. CSV file downloads
5. Player opens in Excel, creates custom charts

**Business Rules:**
- Max rows: 10,000 (or last 10,000 generations)
- Column order: Generation, Timestamp, Population, then traits alphabetically

**Data Needed:**
- Time-series evolution data (stored during gameplay)
- Trait snapshots per generation

**Edge Cases:**
- **No history (new game)** → Disable button, show tooltip "Play for a few generations first"
- **Too much data** → Warn about large file size, offer to export last N generations only

---

## User Workflows

### Workflow 1: First-Time Player Experience

**Trigger:** Player launches game for the first time

**Steps:**
1. **User:** Sees main menu with "New Game", "Tutorial", "Settings" buttons
   **System:** Displays splash screen with game logo and version number
   
2. **User:** Clicks "Tutorial"
   **System:** Opens interactive tutorial overlay
   
3. **Tutorial:** "Welcome to EvoLab! You'll start as a single-celled organism. Your goal: survive and evolve."
   **User:** Clicks "Next"
   
4. **Tutorial:** "Move using WASD keys or click to move. Collect yellow glucose particles to restore your ATP (energy)."
   **System:** Spawns a cell, highlights glucose particles
   **User:** Moves cell, collects glucose
   
5. **Tutorial:** "Your ATP is draining. Don't let it reach zero or you'll die!"
   **System:** Shows ATP bar with warning color
   **User:** Collects more glucose
   
6. **Tutorial:** "Good! When you collect enough resources and survive long enough, you can reproduce and evolve."
   **User:** Clicks "Next"
   
7. **Tutorial:** "Experiment with traits in the editor. Every choice affects your survival!"
   **System:** Opens trait editor with pre-selected changes
   **User:** Reviews traits, clicks "Apply"
   
8. **System:** "Tutorial complete! Now try to become the dominant species."
   **User:** Begins first real game

**Error Paths:**
- If user closes tutorial, offer to restart it from settings menu
- If user struggles (ATP hits 0 multiple times), show hint: "Try increasing your absorption rate trait"

---

### Workflow 2: Evolution Cycle (Core Game Loop)

**Trigger:** Player starts a new game

**Steps:**
1. **User:** Spawns in safe biome (shallow warm water)
   **System:** Displays HUD (ATP, health, resources, generation counter)
   
2. **User:** Moves cell, explores environment
   **System:** Updates position, drains ATP based on metabolism
   
3. **User:** Collects resources (glucose, amino acids, phosphates)
   **System:** Increases resource storage, restores ATP
   
4. **User:** Encounters AI cell (herbivore)
   **System:** AI cell flees (non-aggressive)
   
5. **User:** Continues collecting resources until reproduction requirements met
   **System:** Shows "Reproduction Available" notification with glow effect
   
6. **User:** Clicks "Reproduce" button
   **System:** Pauses game, shows generation report modal:
   - "Generation 1 complete!"
   - "Survived: 2 minutes 34 seconds"
   - "Resources collected: 47 glucose, 23 amino acids, 15 phosphates"
   - "Threats avoided: 3"
   - "Population rank: #1 (you), #2 (Herbivore AI), #3 (Omnivore AI)"
   
7. **User:** Clicks "View Mutations" or "Edit Traits"
   **System:** Opens trait editor with current genome
   
8. **User:** Adjusts traits (e.g., increases speed, decreases size)
   **System:** Shows real-time stat changes, DNA point cost
   
9. **User:** Clicks "Confirm Changes"
   **System:** Applies mutations, spawns new generation cell
   
10. **Success:** Generation counter increments, new cell appears with updated traits
    **User:** Continues playing with evolved cell

**Error Paths:**
- If ATP hits 0 before reproduction, cell dies → Show death summary, offer restart
- If user cancels reproduction, continue playing with current cell

---

### Workflow 3: Speed Running Generations

**Trigger:** Player wants to observe long-term evolution quickly

**Steps:**
1. **User:** Clicks "100x" speed button
   **System:** Increases simulation speed, reduces rendering quality
   
2. **System:** Runs 100 generations per minute
   **User:** Observes population chart rising and falling rapidly
   
3. **System:** Auto-pauses on reproduction
   **User:** Reviews mutation summary, makes minor trait adjustments
   
4. **User:** Clicks "Resume" or "1000x"
   **System:** Continues at high speed
   
5. **System:** After 500 generations, shows milestone notification:
   "Milestone: 500 Generations! Your species has stabilized."
   
6. **User:** Pauses, opens evolution tree
   **System:** Displays full lineage with branching mutations
   
7. **User:** Exports evolution history as CSV
   **System:** Downloads file, user analyzes in Excel

**Error Paths:**
- If FPS drops below 20, system auto-reduces speed to maintain playability
- If user forgets to pause at high speed, autosave prevents data loss

---

### Workflow 4: Sharing Creatures with Community

**Trigger:** Player creates unique creature and wants to share

**Steps:**
1. **User:** Opens creature browser
   **System:** Shows list of all creatures from player's lineage
   
2. **User:** Selects favorite creature (e.g., "Generation 73 - Speed Demon")
   **System:** Displays creature stats and preview
   
3. **User:** Clicks "Export" button
   **System:** Generates `.evolab.json` file, downloads to computer
   
4. **User:** Opens Reddit /r/EvoLab, creates post: "Check out my ultra-fast carnivore!"
   **System:** (external) User uploads JSON file to Reddit post
   
5. **Other player:** Downloads JSON file
   **System:** (other player's instance) Opens "Import Creature" menu
   
6. **Other player:** Selects downloaded `.evolab.json` file
   **System:** Validates file, shows import preview:
   - "Creature: Speed Demon"
   - "Creator: PlayerUsername"
   - "Generation: 73"
   - "Notable traits: Speed 9.8, Aggression 8.5, Size 2.1"
   
7. **Other player:** Clicks "Import"
   **System:** Adds creature to their creature library
   
8. **Other player:** Clicks "Spawn in Lake"
   **System:** Spawns imported creature as new AI species

**Error Paths:**
- If import file is invalid, show detailed error message
- If creature has incompatible traits (e.g., from newer game version), warn user

---

## Non-Functional Requirements

### Performance

**Frame Rate:**
- 60 FPS target at 1x speed with 200 entities
- 30 FPS minimum at 10x speed with 200 entities
- No FPS target at 1000x (headless simulation)

**Load Time:**
- < 3 seconds on 3G connection (with code splitting)
- < 1 second on broadband

**Memory:**
- < 100MB sustained memory usage
- No memory leaks (verified with Chrome DevTools profiler)

**Responsiveness:**
- Input latency: < 16ms (feels instant)
- UI interactions: < 100ms response time

### Security

**Data Validation:**
- All imported files (creatures, saves) validated before processing
- No `eval()` or dynamic code execution from user input
- Sanitize all user-generated strings (creature names, save names)

**Browser Security:**
- Content Security Policy (CSP) headers enabled
- No inline scripts
- HTTPS only in production

**Data Privacy:**
- No personal data collected (no accounts, no tracking)
- Optional analytics (Umami) is privacy-friendly (no cookies, no fingerprinting)
- Data stored locally only (IndexedDB)

### Scalability

**Entity Count:**
- Support up to 500 entities simultaneously (stretch goal: 1000+)
- Use spatial hashing for collision detection (O(n) instead of O(n²))

**Data Storage:**
- IndexedDB capacity: 50MB+ (browser-dependent)
- Implement save rotation (keep last 20 saves, delete oldest)

**Future-Proofing:**
- Modular architecture for easy addition of new biomes, traits, mechanics
- Save format includes version tag for migration

### Accessibility

**Keyboard Navigation:**
- All UI elements accessible via keyboard (tab navigation)
- Keyboard shortcuts for common actions (Space: pause, 1-4: speed)

**Screen Readers:**
- Semantic HTML for UI components
- ARIA labels where needed
- Game canvas has text alternative description

**Visual:**
- High contrast mode option
- Colorblind-friendly palette (avoid red-green distinctions)
- Adjustable UI scale (80% - 120%)

**Cognitive:**
- Tutorial can be replayed anytime
- Tooltips explain complex concepts
- "Undo" option in trait editor

### Browser Compatibility

**Supported Browsers:**
- Chrome 120+ (primary)
- Firefox 120+
- Safari 17+
- Edge 120+ (Chromium)

**Not Supported:**
- Internet Explorer (lacks WebGL 2.0)
- Mobile browsers (Phase 2 feature)

**Graceful Degradation:**
- Detect WebGL support, show error if unavailable
- Fallback to Canvas2D rendering (reduced quality)

---

## Business Rules

### Rule: ATP Drain Calculation

**When:** Every frame (60 times per second)  
**Then:** `currentATP -= (baseRate * metabolismRate * (1 + size * 0.1)) / 60`  
**Why:** Larger cells need more energy; higher metabolism burns ATP faster

---

### Rule: Reproduction Requirements

**When:** Player triggers reproduction  
**Then:** Check all conditions:
- ATP ≥ 70% of maxATP
- Glucose ≥ 50 units
- Amino acids ≥ 30 units
- Phosphates ≥ 20 units
- Maturity timer ≥ 60 seconds since last reproduction
- Population < 80% of biome capacity

**Why:** Reproduction is energetically expensive; prevents spam

---

### Rule: Trait Modification Limits

**When:** Player adjusts traits in editor  
**Then:** Changes capped at ±2 points per generation  
**Why:** Prevents unrealistic evolutionary jumps; forces gradual adaptation

---

### Rule: Biome Fitness Penalty

**When:** Cell is in biome outside its tolerance range  
**Then:** Apply fitness penalty: `1 - abs(cellTolerance - biomeValue) / 10`  
**Why:** Simulates environmental pressure; encourages specialization

---

### Rule: AI Species Extinction

**When:** AI species population = 0 for 3 consecutive generations  
**Then:** Mark species as extinct, remove from active simulation  
**Why:** Realistic population dynamics; prevents empty slots

---

### Rule: DNA Point Awards

**When:** Cell survives or reproduces  
**Then:** Award DNA points: `survivalTime * 0.1 + resourcesCollected * 0.05`  
**Why:** Rewards both longevity and efficiency

---

## Integrations

### No External Integrations (MVP)

**Why:** EvoLab runs entirely in the browser with no backend server. All data is stored locally in IndexedDB. This maximizes privacy, reduces complexity, and enables offline play.

**Future Integrations (Phase 2+):**
- **GitHub OAuth** - For cloud saves and creature sharing (optional)
- **Discord webhook** - Post achievements to community server (opt-in)
- **Google Classroom API** - Teacher dashboard for tracking student progress (paid tier)

---

## Scope

### In Scope (MVP)

**Core Gameplay:**
- ✅ Cell stage with full trait system (40+ traits)
- ✅ Genetic algorithm with reproduction and mutations
- ✅ Procedurally generated lake with 5-7 biomes
- ✅ 0-5 AI-controlled competing species
- ✅ Resource collection (glucose, amino acids, phosphates)
- ✅ Day/night cycle

**UI & Data:**
- ✅ Real-time data visualization (5 core charts)
- ✅ Trait editor with DNA point system
- ✅ Time controls (1x, 10x, 100x, 1000x speed)
- ✅ Save/load system (local IndexedDB)
- ✅ Export creatures as JSON
- ✅ Export evolution history as CSV

**Polish:**
- ✅ Tutorial for first-time users
- ✅ Settings panel (graphics quality, controls, volume)
- ✅ Keyboard shortcuts

### Future Phases (Not in MVP)

**Phase 2: Creature Stage (Months 4-6)**
- 🔜 Transition from cell → creature when complexity threshold reached
- 🔜 Simple creature body editor (head + 1-4 limbs)
- 🔜 Land environment with new biomes
- 🔜 Hunting and social behaviors for creatures

**Phase 3: Advanced Features (Months 7-12)**
- 🔜 Tribal/civilization stage (simple base-building)
- 🔜 Sexual reproduction (crossover between two parents)
- 🔜 Player vs Player mode (compete with friends)
- 🔜 Mod support (custom biomes, traits, creatures via JSON configs)

**Phase 4: Educational Tools (Year 2)**
- 🔜 Classroom mode with teacher dashboard
- 🔜 Lesson plans and curriculum alignment
- 🔜 Student progress tracking
- 🔜 Quiz/assessment integration

### Out of Scope (Never)

**Not Building:**
- ❌ 3D graphics (stays 2D for accessibility and performance)
- ❌ Space stage (Spore's end-game; too large in scope)
- ❌ Realistic graphics (educational focus over photorealism)
- ❌ Blockchain/NFT integration (against open source ethos)
- ❌ Real-money microtransactions (violates free/open principle)
- ❌ Server infrastructure (backend-less by design)

---

## Open Questions

*All requirements are currently defined. No open questions remain for MVP scope.*

**Phase 2 Questions (for future consideration):**
1. Should creature stage have combat mechanics or stay peaceful? - TBD
2. How complex should creature AI be (simple FSM vs behavior trees)? - TBD
3. Should we support mobile (touch controls, responsive UI)? - TBD

---

**Last Updated:** November 15, 2025
