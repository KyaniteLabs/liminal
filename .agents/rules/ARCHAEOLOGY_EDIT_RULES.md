# Archaeology.html Edit Rules

**Status:** MANDATORY  
**Applies to:** `narrative/archaeology.html`  
**Consequence of violation:** Revert + re-education

---

## Before You Start

1. **READ THE STYLE GUIDE** → `narrative/ARCHAEOLOGY_STYLE_GUIDE.md`
2. **RUN VALIDATION** → `node narrative/scripts/validate-archaeology.js`
3. **SCREENSHOT CURRENT STATE** → You'll need before/after comparison

---

## The Cardinal Rules

### Rule 1: NEVER Introduce [object Object]
**Why:** It means you're accessing an object when you need a primitive value.

**How to prevent:**
```javascript
// WRONG
const commits = a.commit_count; // Could be object

// RIGHT  
const commits = typeof a.commit_count === 'object' 
  ? a.commit_count.total 
  : a.commit_count;
```

### Rule 2: NEVER Truncate Era Names
**Why:** "he Great Consolidation" looks unprofessional.

**How to prevent:**
- Era Map left margin must be ≥140px
- Check that "The" is visible on all era labels

### Rule 3: NEVER Let Values Overflow
**Why:** "253" becomes "25" when text extends beyond container.

**How to prevent:**
- For long bars (>85% width), position text INSIDE with dark color
- For short bars, position text OUTSIDE with light color

### Rule 4: NEVER Use <12px Font Sizes
**Why:** Below 12px is illegible on most displays.

**How to prevent:**
- Chart labels: minimum 11px (already borderline)
- Data values: minimum 12px
- Axis labels: minimum 11px

### Rule 5: NEVER Delete Charts Without Approval
**Why:** Each chart tells part of the story.

**How to prevent:**
- If data is missing, show empty state message
- Never remove the container div

---

## Pre-Commit Checklist

### Visual Verification
- [ ] Open file in browser at 1280px width
- [ ] Open file in browser at 768px width  
- [ ] Open file in browser at 480px width
- [ ] Screenshot every modified chart
- [ ] Compare before/after screenshots

### Data Verification
- [ ] Run `node narrative/scripts/validate-archaeology.js`
- [ ] All 13 eras visible with correct colors
- [ ] No `[object Object]` text anywhere
- [ ] No truncated era names
- [ ] No console errors

### Responsive Verification
- [ ] Charts stack correctly at 768px
- [ ] Charts readable at 480px
- [ ] No horizontal overflow
- [ ] Text not overlapping

---

## Common Scenarios

### Adding a New Chart

1. Add container div with unique ID:
```html
<div class="chart-box" id="chart-my-new-chart">
  <div class="chart-title">My New Chart</div>
</div>
```

2. Add CSS variables to :root if new colors needed

3. Add D3/Chart.js code in appropriate script section

4. **TEST:** Screenshot at all breakpoints

### Modifying Chart Data

1. Update data in `window.LIMINAL_DATA` object

2. Ensure JSON is valid (use jsonlint.com)

3. Check for type consistency (numbers vs strings)

4. **TEST:** Run validation script

### Fixing Chart Rendering

1. Identify the rendering function

2. Make minimal change

3. **TEST:** Compare before/after screenshots

4. Document change in code comments

---

## Emergency Contacts

If you're unsure about a change:

1. **Check the style guide** → `narrative/ARCHAEOLOGY_STYLE_GUIDE.md`

2. **Run validation** → `node narrative/scripts/validate-archaeology.js`

3. **Ask for review** → Do not commit questionable changes

---

## Remember

> "The archaeology visualization is the public face of 675 commits and 37 days of work. Every pixel matters."

When in doubt, **screenshot and verify**.
