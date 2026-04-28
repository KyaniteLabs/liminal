# Layer-Based Architecture: Complete Implementation Plan

## Overview
Execute Phases 3-5 using sub-agent driven development with TDD (red, green, refactor).

## Task Breakdown

### Phase 3: Full Layer Stack (Adapters)

Each adapter task follows TDD:
1. Write failing tests (RED)
2. Implement adapter to pass tests (GREEN)
3. Refactor for quality

#### Task 3.1: ThreeAdapter
- **File**: `src/composition/adapters/ThreeAdapter.ts`
- **Tests**: `test/unit/composition/adapters/ThreeAdapter.test.ts`
- **Docs**: JSDoc comments + inline documentation
- **Requirements**:
  - Render Three.js scene to container
  - Exports: camera position, scene objects, renderer
  - Imports: from p5 (mouse coordinates for camera control)
  - Validation: check for scene, camera, renderer
  - HTML generation with Three.js CDN

#### Task 3.2: ShaderAdapter
- **File**: `src/composition/adapters/ShaderAdapter.ts`
- **Tests**: `test/unit/composition/adapters/ShaderAdapter.test.ts`
- **Requirements**:
  - Render GLSL shader via WebGL
  - Exports: uniform values, texture outputs
  - Imports: from p5/Three (input textures)
  - Validation: check for vertex/fragment shaders
  - HTML generation with shader code

#### Task 3.3: StrudelAdapter
- **File**: `src/composition/adapters/StrudelAdapter.ts`
- **Tests**: `test/unit/composition/adapters/StrudelAdapter.test.ts`
- **Requirements**:
  - Render Strudel pattern
  - Exports: current pattern, BPM, cycle position
  - Imports: from Tone (sync), from p5 (visual triggers)
  - Validation: check for pattern definitions
  - HTML generation with Strudel REPL

#### Task 3.4: HydraAdapter
- **File**: `src/composition/adapters/HydraAdapter.ts`
- **Tests**: `test/unit/composition/adapters/HydraAdapter.test.ts`
- **Requirements**:
  - Render Hydra video synthesis
  - Exports: current frame, synth outputs
  - Imports: from other visual layers
  - Validation: check for Hydra syntax
  - HTML generation with Hydra CDN

#### Task 3.5: ASCIIArtAdapter
- **File**: `src/composition/adapters/ASCIIArtAdapter.ts`
- **Tests**: `test/unit/composition/adapters/ASCIIArtAdapter.test.ts`
- **Requirements**:
  - Render ASCII art to DOM
  - Exports: character data, dimensions
  - Imports: minimal (self-contained)
  - Validation: check for ASCII characters
  - HTML generation with preformatted output

#### Task 3.6: HTMLAdapter
- **File**: `src/composition/adapters/HTMLAdapter.ts`
- **Tests**: `test/unit/composition/adapters/HTMLAdapter.test.ts`
- **Requirements**:
  - Render HTML/CSS to container
  - Exports: DOM elements, computed styles
  - Imports: from all layers (for styling based on data)
  - Validation: check for valid HTML
  - HTML generation (pass-through)

#### Task 3.7: VideoAdapter (Revideo + HyperFrames)
- **Status**: Replaced — RemotionAdapter was removed in PR #391. Video rendering now uses RevideoRenderer and HyperFramesRenderer via the shared VideoRenderer interface.
- **See**: `docs/ARCHITECTURE_QUICKREF.md` → Video Rendering section for current architecture.

#### Task 3.8: Register All Adapters
- **File**: `src/composition/adapters/registerAdapters.ts`
- **Tests**: `test/unit/composition/adapters/registerAdapters.test.ts`
- **Requirements**:
  - Function to register all adapters with engine
  - Singleton export with all adapters pre-registered

---

### Phase 4: Smart Composition

#### Task 4.1: CompositionAnalyzer
- **File**: `src/composition/CompositionAnalyzer.ts`
- **Tests**: `test/unit/composition/CompositionAnalyzer.test.ts`
- **Docs**: Full JSDoc + algorithm explanation
- **Requirements**:
  - Analyze prompt to determine required domains
  - Use keyword matching + LLM for complex prompts
  - Return ordered list of DomainTypes
  - Confidence scores for each domain
  - Dependencies between domains (e.g., Tone after P5 for sync)

#### Task 4.2: LayerSequencer
- **File**: `src/composition/LayerSequencer.ts`
- **Tests**: `test/unit/composition/LayerSequencer.test.ts`
- **Requirements**:
  - Sequential generation with context passing
  - Prompt enhancement for subsequent layers
  - Optimal generation order (base layers first)
  - Parallel generation where safe
  - Error handling and rollback

#### Task 4.3: Cross-Layer Prompt Enhancement
- **File**: `src/composition/PromptEnhancer.ts`
- **Tests**: `test/unit/composition/PromptEnhancer.test.ts`
- **Requirements**:
  - Extract context from existing layers
  - Format context for LLM consumption
  - Add integration instructions
  - Handle different domain combinations

---

### Phase 5: Advanced Features

#### Task 5.1: Layer Groups
- **File**: Update `src/composition/LayerManager.ts` + `src/composition/types.ts`
- **Tests**: `test/unit/composition/LayerGroups.test.ts`
- **Requirements**:
  - Group layers with parentLayerId
  - Group-level operations (toggle, opacity, move)
  - Nested groups (limit depth to 3)
  - Visual representation in exports

#### Task 5.2: Blend Modes
- **File**: Update adapters to support blend modes
- **Tests**: `test/unit/composition/BlendModes.test.ts`
- **Requirements**:
  - CSS mix-blend-mode for DOM layers
  - Canvas globalCompositeOperation for canvas layers
  - WebGL blending for Three.js
  - All standard blend modes: normal, multiply, screen, overlay, etc.

#### Task 5.3: Keyframe Animation
- **File**: `src/composition/KeyframeAnimation.ts`
- **Tests**: `test/unit/composition/KeyframeAnimation.test.ts`
- **Requirements**:
  - Define keyframes for layer properties
  - Time-based interpolation
  - Easing functions
  - Export animation to CSS or JS

#### Task 5.4: Layer Masks
- **File**: `src/composition/LayerMask.ts`
- **Tests**: `test/unit/composition/LayerMask.test.ts`
- **Requirements**:
  - Use one layer as mask for another
  - Support alpha and luminance masking
  - Mask groups of layers
  - Export with canvas/CSS mask properties

#### Task 5.5: Composition Import/Export v2
- **File**: Update `src/composition/CompositionEngine.ts`
- **Tests**: `test/unit/composition/ImportExport.test.ts`
- **Requirements**:
  - Version 2.0 project format with groups/animation
  - Backward compatibility with v1.0
  - ZIP export with assets
  - Import from URL

---

### Documentation Tasks

#### Task D.1: API Documentation
- **File**: `docs/composition-api.md`
- **Requirements**:
  - Complete API reference
  - Type definitions
  - Usage examples

#### Task D.2: Tutorial: Your First Composition
- **File**: `docs/tutorials/first-composition.md`
- **Requirements**:
  - Step-by-step guide
  - P5 + Tone example
  - Common pitfalls

#### Task D.3: Architecture Documentation
- **File**: `docs/architecture/composition-system.md`
- **Requirements**:
  - System design
  - Adapter pattern explanation
  - Cross-layer communication

---

## TDD Process for Each Task

For each task, the sub-agent MUST follow:

1. **RED**: Write failing tests first
   - Test the interface/contracts
   - Test expected behavior
   - Test edge cases

2. **GREEN**: Implement to pass tests
   - Minimal implementation
   - Make tests pass
   - No refactoring yet

3. **REFACTOR**: Clean up code
   - Remove duplication
   - Improve naming
   - Add documentation
   - Ensure test coverage

4. **COMMIT**: Save progress
   - Clear commit message
   - Reference task number

---

## Parallel Wave Structure

Wave 1 (Phase 3 - Independent): Tasks 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
Wave 2 (Phase 3 - Depends on Wave 1): Task 3.8
Wave 3 (Phase 4 - Independent): Tasks 4.1, 4.2, 4.3
Wave 4 (Phase 5 - Independent): Tasks 5.1, 5.2, 5.3, 5.4
Wave 5 (Phase 5 - Depends on Wave 4): Task 5.5
Wave 6 (Documentation): Tasks D.1, D.2, D.3

---

## Quality Standards

- All code must have >80% test coverage
- All public APIs must have JSDoc
- All examples must be runnable
- No TypeScript errors
- Pass ESLint checks
