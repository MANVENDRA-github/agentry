---
name: agentry-eval-harness
description: Discipline of knowing whether a change to an LLM or agent system actually improved its output — build a fixed eval set, define graders, measure a baseline, gate regressions. Invoke when tuning a prompt, model, tool, or agent whose quality is otherwise judged by eyeballing. Skip for deterministic code where a normal test suite already proves correctness.
---

# Eval harness

When you change a prompt, swap a model, or rewire an agent, "it looks better" is not a measurement — it is the same trap as shipping without tests, wearing a different hat. LLM output is stochastic and multi-dimensional, so a single hand-checked example tells you almost nothing, and the change that fixed your one example often broke five you did not look at. An eval harness is the test suite for non-deterministic systems: a fixed set of inputs, a way to grade the outputs, and a baseline number you can move on purpose and watch for regressions. Build it before you start tuning, not after you have shipped a regression.

## When to invoke

- Tuning a prompt, switching models, or changing generation parameters and needing to know if quality moved.
- Building or modifying an agent, a RAG pipeline, an extraction/classification step, or an LLM-as-judge — anything where the output is graded, not computed.
- A change "felt" like an improvement and you are about to ship it on that feeling.

## When NOT to invoke

- Deterministic code with a right answer — a parser, a formatter, an API handler. A normal unit/integration test proves it; an eval harness is overkill.
- A one-off throwaway prompt you will run once and discard. The harness must outlive the change to be worth building.

## Build the harness

- **A fixed dataset.** Collect representative inputs — real ones where possible, including the hard and adversarial cases, not just the happy path. Freeze it and version it. It must be big enough that one lucky example cannot swing the score, and stable enough that yesterday's number is comparable to today's. Hold out a slice you never look at while tuning, so you can detect overfitting.
- **Graders that match the task.** Reach for the cheapest grader that captures what you care about:
  - *Exact / structural* — string match, JSON-schema validation, a regex, a numeric tolerance. Deterministic, free, unambiguous. Use it whenever the task has a checkable answer.
  - *Programmatic rubric* — assertions over the output (contains the required field, cites a real source, stays under the length limit, never emits the forbidden token).
  - *LLM-as-judge* — a separate model scoring against an explicit rubric, for open-ended quality where no exact answer exists. Powerful but noisy: the judge has its own biases (length, position, self-preference), so pin its prompt, prefer pairwise "is A better than B" over absolute 1–10 scores, and spot-check the judge against human labels before you trust it.
- **A baseline.** Run the current system over the set and record the score *before* you change anything. Without a baseline, "82%" is a number with no meaning.

## Run it like a test

- **Change one thing, re-measure.** Move the prompt, or the model, or the tool — not all three — then re-run the whole set. If the number goes up, you know *what* moved it. If it goes down, you caught the regression before your users did.
- **Look at the failures, not just the score.** The aggregate hides the shape. Read the cases that regressed; a 2-point average drop can be one category collapsing while everything else improved.
- **Gate on it.** Wire the harness into CI or a pre-merge step so a change that drops the score below a threshold fails loudly, the same way a broken test does.

## Anti-patterns

- **Vibe-checking.** Running a change against the same two prompts you always try and declaring victory. That set is memorized, not representative.
- **Moving the goalposts.** Editing the dataset or the rubric until the new version wins. The set is the contract; change the system, not the exam.
- **Grading on the training examples.** Tuning against the exact cases you score on. The held-out slice exists precisely to catch this.
- **Trusting an unvalidated judge.** Deploying an LLM grader whose scores you never compared to human judgment. A biased judge produces confident, wrong numbers.
- **A single aggregate with no breakdown.** One score for everything hides which capability you just broke. Segment by category.
