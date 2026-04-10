# Gemma 4 - Full Multimodal for Creative Coding (Music Focus)

**Why This Changes Everything for Liminal**

## The Breakthrough: Native Audio I/O

Gemma 4 E2B and E4B models have **native audio encoders** (~300M parameters):
- **Audio IN**: ASR (Automatic Speech Recognition)
- **Audio IN**: Speech-to-text translation
- **Audio OUT**: Can generate audio descriptions, music code

This means **audio as first-class input**, not just text descriptions of sound.

## Multimodal Creative Coding Applications

### 1. Audio-to-Code Generation 🎵

**Input**: Audio file (music, sound, voice)
**Output**: Code that generates/replicates that sound

```
[Upload: jazz_riff.wav]
Prompt: "Create Tone.js code that recreates this jazz guitar riff"
→ Generates: Tone.js synthesizer code with envelope matching
```

**Use Cases**:
- Feed in a drum loop → Generate Strudel/Tone.js pattern
- Feed in a synth sound → Generate matching synth parameters
- Feed in voice → Generate vocoder or speech synthesis code
- Feed in nature sounds → Generative ambient music code

### 2. Video-to-Code Generation 🎬

**Input**: Video (as frame sequence)
**Output**: Code that recreates the visuals

```
[Upload: particle_system_demo.mp4]
Prompt: "Create p5.js code that recreates these particle effects"
→ Generates: Physics-based particle system
```

**Use Cases**:
- Motion graphics → Generative animation code
- Nature videos → Procedural nature simulation
- Abstract visuals → Shader code
- Dance videos → Motion-reactive visuals

### 3. Image-to-Code Generation 🖼️

**Input**: Image
**Output**: Code that generates similar visuals

```
[Upload: mondrian_painting.jpg]
Prompt: "Create p5.js code that generates compositions like this"
→ Generates: Geometric generative art
```

### 4. Combined Multimodal 🎭

**Input**: Video + Audio (music video)
**Output**: Synchronized audio-reactive visuals

```
[Upload: music_video.mp4]
Prompt: "Create code where visuals react to the audio beats"
→ Generates: Audio-reactive shader/animation
```

## Model Selection for Creative Coding

| Use Case | Model | Why |
|----------|-------|-----|
| **Audio-to-music-code** | E2B/E4B | Native audio encoder |
| **Video-to-animation** | 26B/31B | Best vision, 256K context |
| **Image-to-code** | Any | All support vision |
| **Complex reasoning** | 26B/31B | Better code quality |
| **Edge/real-time** | E2B/E4B | Runs on phones/laptops |
| **Audio + Vision** | E4B | Best balance of both |

## Audio Input Specifics

### Supported Audio (E2B/E4B only)
- **Max duration**: 30 seconds
- **Sample rate**: Flexible (40ms frame duration)
- **Formats**: Standard audio formats via API
- **Tasks**: ASR, translation, audio understanding

### Audio Prompt Template
```
[audio input]
Transcribe this music into code. Output a Tone.js synthesizer 
configuration that would produce similar sounds.
```

## Video Input Specifics

### Supported Video (All models)
- **Max duration**: 60 seconds
- **Processing**: 1 frame per second (60 frames max)
- **Resolution**: Variable aspect ratios
- **Token budgets**: 70-1120 tokens per image

### Video Prompt Template
```
[Frame 1] [Frame 2] [Frame 3] ... [Frame 60]
Create p5.js animation code that replicates these visual effects.
Focus on the particle system and color gradients.
```

## Revolutionary Workflow: Audio→Code→Audio

```
1. Upload audio sample (drum beat, synth, voice)
   ↓
2. Gemma E4B analyzes audio features
   ↓
3. Generates Tone.js/Strudel code
   ↓
4. Code produces new audio
   ↓
5. Can feed output back as input (feedback loop)
```

## Use Cases for Liminal

### 1. Sound Palette Extraction
Upload any audio → Get code that generates that "sound palette"

### 2. Visual-to-Audio Translation
Upload video → Get audio-reactive code → Audio drives visuals

### 3. Style Transfer (Audio)
Upload jazz riff + Upload electronic beat → Get hybrid generative code

### 4. Interactive Music Videos
Upload song → Get code where visuals react to frequency bands

### 5. Generative Album Art
Upload album → Get code that generates variations of the visual style

## Implementation Notes

### LM Studio Multimodal API
```javascript
// Audio input (E2B/E4B)
{
  "messages": [{
    "role": "user",
    "content": [
      { "type": "audio_url", "audio_url": { "url": "data:audio/wav;base64,..." } },
      { "type": "text", "text": "Generate Tone.js code for this sound" }
    ]
  }]
}

// Video input (all models - as frame sequence)
{
  "messages": [{
    "role": "user", 
    "content": [
      { "type": "image_url", "image_url": { "url": "frame1.jpg" } },
      { "type": "image_url", "image_url": { "url": "frame2.jpg" } },
      // ... up to 60 frames
      { "type": "text", "text": "Generate p5.js animation code" }
    ]
  }]
}
```

### Critical: Order Matters
**Audio/Video BEFORE text in the content array**

## Next Steps

1. **Test E2B/E4B audio input** with music samples
2. **Test video-to-code** with creative coding demos
3. **Build feedback loops**: Audio→Code→Audio→Code
4. **Explore audio+vision combined** (E4B best for this)

## The Vision

Liminal becomes **truly multimodal**:
- Upload a song → Get generative visuals that react to it
- Upload a video → Get code that recreates the aesthetic
- Upload a painting + Upload music → Get synesthetic experience
- Upload voice description → Get code → Hear the result

**Gemma 4 E4B is the missing piece** for audio-native creative coding.
