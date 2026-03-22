# frag-1ff739f0d6fc

**Score:** 3.8482705067109797

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
5. Mutation summ
... [truncated]

---

Sources: text
Collision: heuristic
Promoted: 2026-03-21T06:55:19.763Z
