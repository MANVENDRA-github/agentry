---
name: datetime-handling
description: Handle dates, times, and timezones correctly — store and compute in UTC, keep values timezone-aware, convert to local only at the display edge, measure elapsed time with a monotonic clock rather than wall-clock subtraction, and reckon deliberately with DST, leap days, and locale formatting. Invoke when writing code that stores, compares, does arithmetic on, schedules, or renders date/time values. Skip for code that never touches wall-clock time.
---

# Datetime handling

Time looks like a number and behaves like a minefield. The local clock you read is not monotonic — it jumps forward and back twice a year for DST, and a leap day or a leap second breaks the arithmetic you assumed. A timestamp with no zone is ambiguous the moment it leaves the machine that made it: the same string means a different instant in two offices. Almost every datetime bug is one of a handful of shapes — a naive value that silently assumed the server's zone, an hour that appeared or vanished across a DST boundary, a "duration" that went negative because the wall clock stepped back, a comparison between an aware value and a naive one. The discipline is to fix the representation at the boundaries — one instant type, one zone, aware everywhere — so the ambiguity never gets inside.

## When to invoke

- Storing, serializing, comparing, or doing arithmetic on a date or time value.
- Scheduling anything — a job, a reminder, an expiry, a "run at 2am" — or computing "N days from now."
- Measuring how long something took, rate-limiting, or setting a timeout or deadline.
- Rendering a timestamp for a user, or parsing one they entered, in their timezone or locale.

## When NOT to invoke

- Code that never touches wall-clock time — pure logic, an opaque token that happens to embed a date you never read, a counter that is not a duration.
- A monotonic tick count used only as a relative ordering, never converted to or compared against wall-clock time.

## The discipline

- **Store and compute in UTC; convert to local only at the display edge.** The instant a value enters your system, normalize it to UTC (or a Unix epoch instant), and keep it that way through storage, comparison, and arithmetic. Local time is a presentation format, not a storage format — apply the user's timezone once, at the last moment before you render, and drop it again the moment you read input back in. A database column of local timestamps is a bug waiting for the next DST transition.
- **Every value is timezone-aware — never naive.** A datetime without a zone is a number pretending to be an instant; it means whatever zone the reader assumes, which is how "works on my machine" happens when the server runs in UTC and the developer runs in local. Attach a zone at every boundary (parse, construct, deserialize) so a naive value can never propagate. Comparing or subtracting an aware value and a naive one should be an error, not a silent wrong answer — most good libraries make it one; do not defeat that.
- **Measure elapsed time with a monotonic clock, not wall-clock subtraction.** To time an operation, take a timeout, or compute a rate, read a monotonic source (`time.monotonic`, `System.nanoTime`, `Instant` from a steady clock, `performance.now`) — not the wall clock. The wall clock is adjusted by NTP and DST and can step backward, making `end - start` negative or wildly wrong. Wall-clock time answers "what instant is it"; monotonic time answers "how much time has passed" — never use one for the other's question.
- **Do calendar arithmetic with a real date/time library, in the right zone.** "Tomorrow at 9am" and "one month from now" are calendar operations, not "add 86400 seconds" — a DST day is 23 or 25 hours long, February has a leap day, and "one month" from Jan 31 is not obvious. Add days/months/years with the library's calendar-aware API against a zoned value, then resolve to an instant. Adding fixed seconds to cross a DST boundary is the classic off-by-one-hour bug.
- **Reckon with DST folds and gaps explicitly.** When clocks spring forward, an hour of local time does not exist; when they fall back, an hour occurs twice. A wall-clock time you schedule against can be skipped or run twice. Decide the behavior deliberately — pick the earlier or later of a folded time, roll a nonexistent time forward — using the library's fold/gap handling rather than pretending every local time maps to exactly one instant.
- **Format and parse for the locale at the edge, with an explicit format elsewhere.** Human-facing output uses the user's locale and zone (the library's locale-aware formatter), never a hand-rolled `dd/mm` that means something else in another country. For anything a machine reads — logs, APIs, storage — use an unambiguous explicit format: ISO 8601 with an offset (`2026-07-06T14:30:00Z`). Never parse a user-entered date with a format you merely assumed.

## Anti-patterns

- **A naive `now()` stored or compared** — no zone attached, so it silently means the server's timezone and breaks the day the server moves or the developer's machine differs.
- **`end - start` on wall-clock timestamps** to measure a duration — goes negative or jumps an hour when NTP or DST adjusts the clock mid-measurement. Use a monotonic clock.
- **Adding a fixed number of seconds** (`+ 86400`, `+ 3600`) to cross a day or hour boundary, so the result lands an hour off across a DST transition. Use calendar arithmetic on a zoned value.
- **A local-time database column or API field** with no offset — every consumer re-guesses the zone, and they don't all guess the same one.
- **Comparing an aware value against a naive one**, or mixing the two in arithmetic — either a crash or, worse, a silent answer computed against the wrong zone.
- **Hand-parsing or hand-formatting** dates with `split`/`substring` or an assumed `mm/dd` vs `dd/mm` order, instead of a locale-aware or explicit ISO 8601 parser.
- **Assuming a day is 24 hours, a year 365, or a minute 60 seconds** in scheduling logic — DST days, leap years, and leap seconds each break one of those.
