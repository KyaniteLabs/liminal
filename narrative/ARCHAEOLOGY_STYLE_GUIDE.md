# Archaeology Visualization Style Guide

**Version:** 1.0  
**Date:** April 4, 2026  
**Applies to:** `narrative/archaeology.html`

---

## Color Palette

### Backgrounds
| Name | Hex | Usage |
|------|-----|-------|
| `--bg` | `#06090f` | Page background (near-black) |
| `--surface` | `#0c1018` | Card backgrounds |
| `--surface2` | `#141a24` | Hover states |
| `--surface3` | `#1c2432` | Elevated elements |

### Text
| Name | Hex | Usage |
|------|-----|-------|
| `--text` | `#e8ecf2` | Primary text (headings) |
| `--text2` | `#8d99aa` | Secondary text (descriptions) |
| `--text3` | `#6a7888` | Tertiary text (labels, captions) |

### Agent Colors
| Agent | Hex | Glow |
|-------|-----|------|
| Kai | `#ff6b6b` | `rgba(255,107,107,0.08)` |
| Cursor | `#ffa94d` | `rgba(255,169,77,0.08)` |
| Claude | `#51cf66` | `rgba(81,207,102,0.08)` |
| Unknown | `#495057` | — |

### Era Colors (13)
| Era | Name | Hex |
|-----|------|-----|
| 1 | The Seed | `#b197fc` |
| 2 | The Explosion | `#ff6b6b` |
| 3 | The Great Consolidation | `#ffa94d` |
| 4 | Quality Crusade | `#ffd43b` |
| 5 | The Conversational Turn | `#51cf66` |
| 6 | The Quiet | `#495057` |
| 7 | Multimedia Expansion | `#cc5de8` |
| 8 | The Dogfood Crucible | `#ff8787` |
| 9 | THE BIBLE | `#74c0fc` |
| 10 | The Cleanup | `#20b2a3` |
| 11 | The Architecture | `#4dabf7` |
| 12 | The Swarm | `#f06595` |
| 13 | The Pruning | `#a9e34b` |

---

## Typography

### Font Families
| Role | Font | Fallback |
|------|------|----------|
| Display | Space Grotesk | sans-serif |
| Body | DM Sans | sans-serif |
| Mono | JetBrains Mono | monospace |
| Quote | Playfair Display | serif |

### Font Sizes (Minimums)
| Element | Min Size | Notes |
|---------|----------|-------|
| Chart title | 0.88rem | Uppercase, letter-spacing 0.06em |
| Axis labels | 11px | Must be readable at all breakpoints |
| Data labels | 12px | Inside or outside bars |
| Legend text | 11px | Color-coded |
| Body text | 0.9rem | Line-height 1.6 |
| Quotes | 1.05rem | Italic, Playfair Display |

---

## Chart Specifications

### Dimensions
| Property | Value | Notes |
|----------|-------|-------|
| Min chart height | 280px | Prevents squashed appearance |
| Grid gap | 1.25rem | Between chart boxes |
| Border radius | 10px | For chart boxes |
| Padding | 1.5rem | Inside chart boxes |

### Responsive Breakpoints
| Width | Layout | Notes |
|-------|--------|-------|
| ≥1280px | 2-column grid | Full layout |
| 768-1279px | Stacked | Charts stack vertically |
| <768px | Single column | Simplified view |

### Chart-Specific Rules

#### Era Map
- Label margin: 140px left
- Bar height: 28px
- Text inside bar when >85% width (dark color)
- Text outside bar when <85% width (light color)

#### Sankey Diagram
- Node width: 80px (minimum)
- Node padding: 12px
- Extent margins: 100px left/right
- Labels: Full text, no truncation

#### Bar Charts
- Min bar width for label: 30px
- Value positioning: Right of bar or inside
- Colors: Must match era color palette

---

## Data Integrity Rules

### Required Data Fields
```javascript
const REQUIRED_FIELDS = [
  'commits_per_day',
  'loc_growth', 
  'eras', // Must have 13 eras
  'agent_attribution',
  'session_depth',
  'frustration_categories'
];
```

### Era Schema
```javascript
{
  id: number,           // 1-13
  name: string,         // Full name, not truncated
  dates: string,        // Human-readable range
  startDate: string,    // ISO date
  endDate: string,      // ISO date
  commits: number,      // Integer
  color: string,        // CSS var reference
  hex: string           // Hex color value
}
```

### Agent Data Schema
```javascript
{
  commit_count: number | { total: number },
  lines_changed: {
    insertions: number | { total: number }
  },
  economics: {
    fix_rate: number  // 0-1 decimal
  },
  velocity: {
    commits_per_hour: number
  },
  archetype: string
}
```

---

## Common Defects & Prevention

### [object Object] Bug
**Cause:** Accessing object instead of primitive value  
**Prevention:** Use type checking:
```javascript
const commits = typeof a.commit_count === 'object' 
  ? a.commit_count.total 
  : a.commit_count;
```

### Era Name Truncation
**Cause:** Missing first letter due to overflow  
**Prevention:** Ensure adequate left margin (≥140px)

### Value Truncation (e.g., "25" vs "253")
**Cause:** Text extends beyond SVG viewBox  
**Prevention:** Position long bars' text inside with contrasting color

### Sankey Label Truncation
**Cause:** Node width too narrow  
**Prevention:** Minimum 80px node width

### Empty Chart Sections
**Cause:** Missing data or failed initialization  
**Prevention:** Add defensive checks:
```javascript
if (!data || data.length === 0) {
  showEmptyState('Data not available');
  return;
}
```

---

## Validation Checklist

Before committing changes to archaeology.html:

- [ ] All 13 eras display with correct colors
- [ ] No `[object Object]` text appears anywhere
- [ ] All era names fully readable (not truncated)
- [ ] Era Map shows "253" for The Architecture
- [ ] Sankey diagram shows full labels on both sides
- [ ] All charts render at 1280px width
- [ ] All charts render at 768px width
- [ ] All charts render at 480px width
- [ ] No JavaScript console errors
- [ ] JSON data valid (run `validate-archaeology.js`)

---

## Change Log

| Date | Change |
|------|--------|
| 2026-04-04 | Initial style guide created |
| 2026-04-04 | Fixed [object Object] bug in agent cards |
| 2026-04-04 | Fixed Era Map value truncation |
| 2026-04-04 | Fixed Sankey diagram label truncation |
