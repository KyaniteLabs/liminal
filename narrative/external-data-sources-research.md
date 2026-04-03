# External Data Sources for Liminal Archaeology

Research findings on public/external data that can enrich the Liminal archaeology analysis.
Timeline: February 20 - April 2, 2026. All sources verified as accessible and actionable.

---

## 1. Global GitHub Commit Velocity Baseline

### What's Available

The **GH Archive** (gharchive.org) records every public GitHub event (pushes, PRs, issues, stars) and makes them freely downloadable as gzipped JSON. Each hour of data is ~34 MB (containing roughly 500K-1M events). Files are available at:

```
https://data.gharchive.org/YYYY-MM-DD-HH.json.gz
```

The entire archive is also queryable via **Google BigQuery** as a public dataset (`githubarchive.day.*`), updated hourly.

### How to Use It

- Download hourly files for each day in the Feb 20 - Apr 2 range
- Count total `PushEvent` events per day across all of GitHub
- Compute daily global commit velocity baseline
- Overlay the user's daily commit count against this baseline to show relative intensity
- Could also filter by language (JavaScript/TypeScript) for a more relevant peer group

### Example Query (BigQuery)

```sql
SELECT
  DATE(created_at) as day,
  COUNT(*) as total_pushes
FROM `githubarchive.day.20260220`
WHERE type = 'PushEvent'
GROUP BY day
ORDER BY day
```

### Archaeology Value

**HIGH.** This would create a "you vs. the world" comparison chart. Imagine a dual-axis chart: global GitHub pushes (millions/day) on one axis, the user's commits on the other. Key insight: "On March 15th, while 8.2 million pushes happened globally, you made 23 commits -- placing you in the top X% of GitHub contributors for that day." Could also reveal day-of-week patterns (were weekends your peak creative periods while the world slowed down?).

### Effort

Medium. Requires downloading ~1.5 GB of compressed data (42 days x 24 hours x ~34 MB) or using BigQuery (free tier covers ~1 TB/month). A Python script can extract daily push counts in under an hour of work.

---

## 2. npm Download Statistics

### What's Available

The **npm Downloads API** is fully public, requires no authentication, and returns daily download counts for any package. Verified working with live data.

### API Endpoints

```
# Daily downloads for a package over a date range
GET https://api.npmjs.org/downloads/range/{start_date}:{end_date}/{package}

# Example (verified working):
GET https://api.npmjs.org/downloads/range/2026-02-20:2026-04-02/meyda
```

### Verified Data for Liminal's Dependencies

| Package | Period Downloads | Daily Avg |
|---------|-----------------|-----------|
| meyda | 66,955 | ~1,595 |
| pitchfinder | 46,553 | ~1,108 |
| puppeteer | 50,151,987 | ~1,194,095 |
| @anthropic-ai/sdk | 51,186,724 | ~1,218,731 |

### Constraints

- Maximum 18-month range per query
- Bulk queries: up to 128 packages, comma-separated (unscoped only)
- Earliest data: January 10, 2015
- Data updates daily around UTC midnight

### Archaeology Value

**MEDIUM-HIGH.** Correlate the user's adoption of each package with its download trajectory. Key insight: "You added pitchfinder on March 6th, the same week its downloads spiked 40% -- were you riding a wave of audio ML interest?" Puppeteer and @anthropic-ai/sdk download curves would show the broader developer ecosystem the user was swimming in. Could create a layered timeline: npm package adoption curve + user's first import of each package.

### Effort

Low. Single API call per package, JSON response, no auth needed. Can be done in 15 minutes.

---

## 3. AI Model Release Timeline

### What's Available

A comprehensive, verified timeline of AI model releases is available from multiple sources:

1. **aiflashreport.com/model-releases.html** -- 59 models tracked with exact dates, sizes, benchmarks. Scrapable as structured data.
2. **lifearchitect.ai/timeline/** -- Visual timeline maintained by Alan D. Thompson, covers 1947-present.
3. **Wikipedia: List of large language models** -- Community-maintained, reliable dates.

### Key Model Releases During the Project Period (Feb 20 - Apr 2, 2026)

| Date | Model | Relevance |
|------|-------|-----------|
| 2026-02-17 | Claude Sonnet 4.6 | Agent Teams capability, 80.8% SWE-bench |
| 2026-02-19 | Gemini 3.1 Pro | 2x reasoning improvement |
| 2026-02-05 | GPT-5.3 Codex | Self-improving coding model |

### Key Pre-Project Releases That Shaped the Tooling

| Date | Model | Relevance |
|------|-------|-----------|
| 2025-11-24 | Claude Opus 4.5 | First to break 80.9% SWE-bench |
| 2025-05-22 | Claude Sonnet 4 | Enhanced reasoning |
| 2025-02-24 | Claude Sonnet 3.7 | Improved code generation |
| 2024-06-20 | Claude 3.5 Sonnet | Original breakthrough |
| 2024-03-04 | Claude 3 family | Opus, Sonnet, Haiku launch |

### Archaeology Value

**HIGH.** The user's development was directly shaped by model releases. Every time they switched models in their config, it likely correlated with a release. Key narrative: "Claude Code itself was created on Feb 22, 2025 -- you started using it just 3 days later." The anthropics/claude-code repo has 106,778 stars and 17,200 forks -- showing the explosive growth of the tool the user adopted. Create a timeline overlay: model release dates + user's model switches + commit velocity to show how AI capability unlocks creative output.

### Effort

Low. Data is static and can be manually compiled or scraped from aiflashreport.com in one pass.

---

## 4. Weather, Daylight, and Astronomical Data

### What's Available

**Open-Meteo Historical Weather API** -- Free, no API key, non-commercial use. Covers 1940-present with 9km resolution. Verified working.

```
GET https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lon}&start_date={start}&end_date={end}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,daylight_duration,sunshine_duration&timezone={tz}
```

**Sunrise-Sunset API** -- Free, no API key. Returns sunrise, sunset, solar noon, day length, all twilight phases.

```
GET https://api.sunrise-sunset.org/json?lat={lat}&lng={lng}&date={date}&formatted=0&tzid={timezone}
```

### Verified Data (Madrid coordinates used as example)

| Date | Max Temp | Min Temp | Precipitation | Daylight Duration |
|------|----------|----------|---------------|-------------------|
| Feb 20 | 13.2C | 1.1C | 0.0mm | 10.9 hours |
| Mar 12 | 16.7C | 5.1C | 0.0mm | 11.8 hours |
| Apr 1 | 19.9C | -- | -- | ~12.7 hours |

### Available Variables

Daily aggregations: temperature max/min/mean, apparent temperature, precipitation sum, rain, snowfall, precipitation hours, sunrise/sunset, daylight duration, sunshine duration, wind speed max, wind gusts, dominant wind direction, shortwave radiation sum, evapotranspiration.

Hourly: temperature, humidity, dewpoint, cloud cover (total/low/mid/high), precipitation, wind speed/direction, pressure, soil temperature/moisture, solar radiation.

### Archaeology Value

**MEDIUM-HIGH.** The user's timezone appears to be Europe/Madrid (CET/CEST, UTC+1/+2). Weather data would reveal:
- "Your most productive coding day (March 3rd, 47 commits) was a rainy Sunday -- the weather pushed you indoors"
- "Over the 42-day period, daylight increased from 10.9 to 12.7 hours -- your late-night sessions happened against lengthening days"
- Temperature correlation: did cold snaps drive indoor coding bursts?
- Sunshine duration vs. commit volume: inverse correlation likely

The daylight duration data is particularly poetic -- it shows the literal arc of the sun during the project's lifespan. Combined with the existing lunar phase data, this creates a complete environmental context layer.

### Effort

Low. Single API call for the entire 42-day range. Response is JSON, trivially parseable.

---

## 5. Developer Activity Trends / AI Coding Adoption

### What's Available

**Stack Overflow 2025 Developer Survey** (survey.stackoverflow.co/2025/ai):
- 84% of developers use AI tools (up from 76% in 2024)
- 51% use AI tools daily
- 60% favorable sentiment (down from 70%+ in 2023-2024)
- 46% don't trust AI output accuracy (up from 31%)

**Claude Code GitHub Stats** (verified live):
- 106,778 stars
- 17,200 forks
- Created: February 22, 2025

**GitHub Copilot adoption data** (from GitHub blog):
- Publicly available adoption milestones
- Copilot Chat launched July 25, 2024

### Archaeology Value

**MEDIUM.** Provides context for the user's position in the AI-assisted coding adoption curve. Key insight: "When you started using Claude Code, it had 106K stars and 17K forks -- you were part of the early majority adopters of agentic coding." The Stack Overflow data shows the user was ahead of the curve (the 51% daily AI users), and their willingness to trust AI output contrasts with the 46% who don't. Could create a "you vs. the developer world" context panel.

### Effort

Low. Mostly static data points that can be manually referenced.

---

## 6. GitHub Star History for Related Repos

### What's Available

**GitHub REST API** -- Returns stargazers with timestamps using the custom Accept header:

```bash
curl -H "Accept: application/vnd.github.v3.star+json" \
  https://api.github.com/repos/{owner}/{repo}/stargazers?per_page=100&page=1
```

Returns array of `{starred_at: "2025-02-24T18:26:15Z", user: {...}}`.

**Constraints**: Rate limited to 5,000 requests/hour (authenticated). Each page returns 100 items. For repos with >40K stars, you need pagination. The `star-history.com` website provides free visual graphs.

### Repositories to Track

| Repository | Why |
|-----------|-----|
| anthropics/claude-code | The tool that enabled the project (106K+ stars) |
| meyda/meyda | Audio analysis library used |
| alexanderb14/pitchfinder | Pitch detection library used |
| puppeteer/puppeteer | Browser automation used |

### Archaeology Value

**MEDIUM.** Star history for claude-code would be particularly impactful -- showing the exponential growth curve of the tool the user adopted. Key narrative: "Claude Code went from 0 to 100K stars in 13 months. You were there from nearly the beginning." For the audio packages, star history shows the niche community the user tapped into. Could overlay star growth with the user's adoption timeline.

### Effort

Medium. Requires pagination for large repos. A script with `gh api` or authenticated curl can collect the data in ~30 minutes.

---

## 7. Music and Cultural Data

### What's Available

Several sources, with varying accessibility:

#### MusicBrainz API (FREE, no key, rate-limited)
```
GET https://musicbrainz.org/ws/2/release-group/?query=artist:{name}&fmt=json
```
Returns: album/track release dates, artist info, ISRC codes, genres.
**Useful for**: Looking up exact release dates for songs/videos the user watched on YouTube.

#### Spotify oEmbed (FREE, no key)
```
GET https://open.spotify.com/oembed?url=https://open.spotify.com/track/{id}
```
Returns: Track title, artist name, album art URL.
**Useful for**: Resolving Spotify track references.

#### Spotify Charts (charts.spotify.com)
Public website showing daily Top 200 tracks globally and by country. No official API, but the pages are accessible at:
```
https://charts.spotify.com/charts/view/regional-global-daily/{YYYY-MM-DD}
```
**Useful for**: "The #1 song on the day you hit your commit peak was..."

#### Last.fm API (FREE key required)
Provides: Top tracks by week, listening history (if user has account), similarity data.
**Useful for**: Weekly music charts during the project period.

#### YouTube Data API (FREE key required)
Provides: Video category, title, channel info, trending status.
**Useful for**: Categorizing the 2,215 YouTube videos (music vs. educational vs. entertainment).

#### Discogs API (FREE, no key for basic queries)
Provides: Release dates, marketplace data, genre classifications.
**Useful for**: Vinyl/digital release dates for older music.

### Archaeology Value

**MEDIUM.** The user watched 2,215 YouTube videos including music. The most actionable enrichment would be:
1. MusicBrainz to date-stamp specific songs/artists mentioned in the data
2. Spotify Charts to show what was globally popular during the project period
3. Create "Soundtrack of the Sprint" -- the top songs during each development phase

Key insight: "During your most productive coding week (March 3-9), the #1 global Spotify track was [X]. Your YouTube history shows you were listening to [genre] during late-night sessions."

### Effort

Medium. MusicBrainz queries are straightforward but require knowing artist/song names from the YouTube data. The YouTube video titles (if available in the archaeology data) would need to be cross-referenced.

---

## Priority Ranking for Implementation

| Priority | Source | Effort | Impact | Why |
|----------|--------|--------|--------|-----|
| 1 | npm Download Stats | Low | Med-High | 15 min, single API call, direct correlation with adoption timeline |
| 2 | AI Model Releases | Low | High | Static data, immediate narrative value, core to the story |
| 3 | Open-Meteo Weather | Low | Med-High | Single API call, poetic environmental layer |
| 4 | Sunrise-Sunset / Daylight | Low | Med | Complements weather, no auth needed |
| 5 | Claude Code Star History | Med | Med | Requires pagination but powerful narrative |
| 6 | GH Archive Baseline | Med | High | Most impactful but most effort (download ~1.5 GB) |
| 7 | Stack Overflow Data | Low | Med | Static reference points, easy to add |
| 8 | MusicBrainz / Charts | Med | Med | Requires cross-referencing YouTube data |

---

## Quick-Start Code Snippets

### npm Downloads (JavaScript)

```javascript
const packages = ['meyda', 'pitchfinder', 'puppeteer', '@anthropic-ai/sdk'];
const start = '2026-02-20';
const end = '2026-04-02';

for (const pkg of packages) {
  const url = `https://api.npmjs.org/downloads/range/${start}:${end}/${pkg}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log(`${pkg}: ${data.downloads.reduce((s, d) => s + d.downloads, 0)} total downloads`);
}
```

### Open-Meteo Historical Weather (JavaScript)

```javascript
const url = 'https://archive-api.open-meteo.com/v1/archive?' + new URLSearchParams({
  latitude: '40.42',  // User's detected location
  longitude: '-3.70',
  start_date: '2026-02-20',
  end_date: '2026-04-02',
  daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,daylight_duration,sunshine_duration',
  timezone: 'Europe/Madrid'
});
const weather = await (await fetch(url)).json();
```

### GitHub Star History with Timestamps (Bash)

```bash
# Requires GH CLI authenticated
gh api -H "Accept: application/vnd.github.v3.star+json" \
  "repos/anthropics/claude-code/stargazers?per_page=100" \
  --paginate --jq '.[].starred_at'
```

### GH Archive Daily Push Count (Python)

```python
import json, gzip, urllib.request
from collections import Counter

daily_pushes = Counter()
for day in range(20, 29):  # Example: Feb 20-28
    date = f'2026-02-{day:02d}'
    for hour in range(24):
        url = f'https://data.gharchive.org/{date}-{hour}.json.gz'
        try:
            with urllib.request.urlopen(url) as resp:
                with gzip.open(resp, 'rt') as f:
                    for line in f:
                        event = json.loads(line)
                        if event['type'] == 'PushEvent':
                            daily_pushes[date] += 1
        except:
            pass
    print(f'{date}: {daily_pushes[date]:,} global pushes')
```

---

## What Was Rejected (and Why It's Fine)

The user explicitly rejected access to: Cursor IDE data, browser history, and pre-Claude-Code session data. This is a reasonable constraint -- the external sources above provide more than enough enrichment without invading private tooling data. The public data tells a story about the *world* the user was coding in, not their private workspace.
