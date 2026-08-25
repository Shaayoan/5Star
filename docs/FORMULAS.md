# 5 Star — Game Formulas

Every number the app shows is derived from the rules below. Implementations live in
`src/lib/game/` as pure functions; this file is the spec they satisfy.

---

## 1. Stars

A day's performance on a pillar is a **star rating from 1 to 5**. `0` means *not logged*
(distinct from a bad day). Thresholds used throughout:

| Constant | Value | Meaning |
|---|---|---|
| `STREAK_THRESHOLD` | 3 | minimum stars for a day to continue a pillar streak |
| `STRONG_THRESHOLD` | 4 | minimum stars for a pillar to count as "hit" |
| `DEFAULT_PILLAR_COUNT` | 5 | what a new season starts with |
| `MIN_PILLARS` | 5 | floor — below this the app stops being "5 Star" |
| `MAX_PILLARS` | 10 | ceiling — past this nothing gets real attention |

Five is the default and the floor, but a season may run up to ten. Every formula below is
written over "the active pillars", never over a hardcoded five, so the maths holds at any
count. The one place the count shows up directly is the daily total:

```
maxDayScore(n) = n * 5          // 25 at five pillars, 30 at six
```

Adding a pillar mid-season keeps all existing XP, levels and streaks; the new pillar simply
starts at level 1 with no logs. Note that it *does* interrupt the check-in streak until the
new pillar is logged too — a complete day means every active pillar, by design.

## 2. XP

```
xpFromStars(stars)        = stars * 10                    // 10 … 50
xpFromAction(action)      = action.xp_value               // default 5
fiveStarDayBonus          = 50                            // all pillars >= 4
perfectDayBonus           = 100                           // all pillars == 5
questCompletionReward     = 150
streakMilestoneBonus(n)   = 25 for every 7th consecutive day, doubled at 30, tripled at 100
```

XP is stored as an append-only ledger (`xp_events`) so any total can be recomputed and
audited. Pillar XP = sum of events for that pillar. Human XP = sum of all events.

## 3. Levels

A triangular curve — early levels are quick, later ones stretch out.

```
cumulativeXpForPillarLevel(n) = 50  * (n - 1) * n     // L2=100, L3=300, L4=600, L5=1000
cumulativeXpForHumanLevel(n)  = 250 * (n - 1) * n     // L2=500, L3=1500, L4=3000
```

Inverted to get a level from XP:

```
level(xp, k) = floor( (1 + sqrt(1 + 4 * xp / k)) / 2 )        where k = 50 or 250
```

Progress inside a level is `(xp - floorXp) / (ceilXp - floorXp)`.

## 4. Rank titles

Based on the **rolling 30-day mean star rating** across active pillars. Unlogged days do
not count, but at least `MIN_RANKED_DAYS = 10` distinct logged days are required — below
that the user is *Unranked*.

| Mean stars | Rank |
|---|---|
| — (< 10 days) | Unranked |
| < 2.0 | Bronze |
| 2.0 – 2.99 | Silver |
| 3.0 – 3.79 | Gold |
| 3.8 – 4.49 | Platinum |
| ≥ 4.5 | **5-Star** |

## 5. Streaks

- **Pillar streak** — consecutive days ending today (or yesterday, grace) where that pillar
  was logged at ≥ `STREAK_THRESHOLD`.
- **Check-in streak** — consecutive days where *every* active pillar has a log.
- **Star-day streak** — consecutive **5-star days** (every active pillar ≥ 4).

A streak survives if the most recent qualifying day is today *or* yesterday; it is only
broken once a full day passes with no qualifying entry.

### Streak freezes

One freeze is granted per 7 consecutive check-in days, capped at `MAX_FREEZES = 2`. When a
gap of exactly one day appears and a freeze is available, the freeze is consumed and the
streak continues. Freezes are applied automatically, newest gap first.

## 6. Balance score (0–100)

Balance is the point of the app, so it gets its own metric. Given the per-pillar mean stars
`x₁…x₅` over the window:

```
mean  = Σxᵢ / n
sd    = sqrt( Σ(xᵢ - mean)² / n )
cv    = sd / mean                            // coefficient of variation, 0 = perfectly even
balance = clamp( round(100 * (1 - cv)), 0, 100 )
```

A user averaging 5,5,5,5,5 scores 100. A user at 5,5,5,5,1 scores ~60. A user at 2,2,2,2,2
also scores 100 — balance measures *evenness*, not effort, which is why it is always shown
next to the overall average.

## 7. Day classifications

```
isLogged(day)     = every active pillar has a rating > 0
isFiveStarDay(day)= isLogged && every rating >= 4
isPerfectDay(day) = isLogged && every rating == 5
dayScore(day)     = Σ ratings                            // 0 … maxDayScore(n)
```

## 8. Weakest / strongest pillar

Over the trailing 7 days: mean stars per pillar, ignoring unlogged days. Ties broken by the
lower total count of logs, then by pillar slot. Pillars with **zero** logs in the window
sort weakest — neglect is the signal the app most wants to surface.

## 9. Weekly quests

Generated each Monday for the **weakest pillar**:

```
baseline = number of days last week that pillar scored >= STRONG_THRESHOLD
target   = clamp(baseline + 2, 3, 6)
reward   = questCompletionReward (150 XP)
```

The quest reads "Log *{pillar}* at 4★ or better on {target} days this week." A second
"balance quest" is added whenever the balance score is below 70: "Keep every pillar at 3★+
for 4 days."

## 10. Badges

Evaluated after every log write; each badge is awarded at most once.

| Key | Name | Condition |
|---|---|---|
| `first_light` | First Light | first ever log |
| `full_house` | Full House | first day with all 5 pillars logged |
| `five_star_day` | Five Star Day | first day with all pillars ≥ 4 |
| `flawless` | Flawless | first day with all pillars at 5 |
| `week_one` | Week One | 7-day check-in streak |
| `fortnight` | Fortnight | 14-day check-in streak |
| `iron_month` | Iron Month | 30-day check-in streak |
| `comeback` | Comeback | 3 consecutive check-in days following a gap of ≥ 3 days |
| `equilibrium` | Equilibrium | a week with balance score ≥ 85 |
| `well_rounded` | Well Rounded | a week with no pillar averaging below 3 |
| `centurion` | Centurion | 100 total pillar logs |
| `ascendant` | Ascendant | any pillar reaches level 5 |
| `quest_runner` | Quest Runner | 5 quests completed |
| `season_finisher` | Season Finisher | complete a full season |

## 11. Life tree

A single visual reading of the week, driven by two inputs:

```
vitality = mean stars over trailing 7 days / 5          // 0…1 → leaf density & colour
symmetry = balance score / 100                          // 0…1 → canopy evenness
```

Each pillar renders one branch whose length is that pillar's 7-day mean and whose leaf count
scales with its streak. A neglected pillar visibly bares its branch.

The canopy is drawn from the pillar count, not a fixed five: branches fan evenly across
`±min(78°, 54° + 4n)` and shorten slightly past five so a seventh branch has somewhere to go.
Adding a pillar therefore grows the tree a new branch rather than redrawing it.

---

## 12. Conversational logging (v2)

The chat never writes. Every tool call is a **proposal** the user sees, edits and confirms;
only then do the ordinary server actions run. This is deliberate — the app's only value is
an honest self-assessment, and a model that quietly inflates ratings makes the balance score
meaningless.

### Grounding

Each pillar already stores `definition`: the user's own sentence describing a good day. That
is the rubric the model grades against, quoted verbatim into the system prompt. Alongside it
go the pillar's 30-day mean (their personal calibration), days since last logged, what is
already rated today, the weakest pillar of the week, and the active quests.

### Anti-inflation rules

| Rule | Why |
|---|---|
| Grade against the user's definition, not the model's idea of a good day | Makes ratings personal and defensible |
| Ratings of 4–5 require an `evidence` field quoting the user | Forces a rating to be traceable to something actually said |
| The 30-day mean is stated as "their normal" | Anchors against drift |
| "3 is a solid, ordinary day. Most days are 3s." | Counteracts model agreeableness |
| Vague input ("it was fine") must trigger a follow-up, not a guess | Prevents invented data |

### `skip_pillar`

A pillar the user never mentioned is left **unrated**, not guessed at. Unlogged and bad are
different states throughout the scoring engine (§1), so the model is given an explicit tool
to say "not enough information" rather than defaulting to 3.

### Idempotency

Confirmed proposals go through the same `daily_logs` upsert and `xp_events` dedupe keys as
manual entry (§2). Chatting at lunch and again at midnight therefore *corrects* the day
rather than double-logging or double-paying XP.

### Privacy

`user_pillars.chat_enabled` excludes a pillar from the chat entirely — it is never named in
the prompt and its micro-actions are never offered. Financial and Relational are the ones
people most often want out.

### Model split

`gemini-2.5-flash` for the extraction loop: frequent, latency-sensitive, cheap.
`gemini-2.5-pro` for the weekly review: once a week, over a whole week of notes, and the
thing people actually read.

The weekly review stays **opt-in per week**. The rule-based narrative (§9) remains the
default because it is free, instant, and cannot invent a number; the AI version only earns
its keep once the chat has produced real notes to find patterns in.
