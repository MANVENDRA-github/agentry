---
name: agentry-accessibility
description: Build UI that works for everyone — semantic HTML first, full keyboard operability, sufficient contrast, accessible names, and ARIA only as a last resort. Invoke when writing or changing any user-facing UI, component, or template. Skip for non-UI code with no rendered surface.
---

# Accessibility

An interface that only works with a mouse, perfect vision, and a steady hand excludes a large share of the people who will use it — and the same properties that make it accessible (real semantics, keyboard support, clear labels) make it more robust, more testable, and better for everyone. Accessibility is not a compliance chore bolted on at the end; it is a set of decisions you make while writing the markup, and almost all of it is free if you make them then. The single highest-leverage rule: use the right HTML element, and most of accessibility is handled for you.

## When to invoke

- Writing or modifying any user-facing UI — a component, a page, a template, an email.
- Adding an interactive control: a button, link, form field, dialog, menu, tab, tooltip.
- Reviewing a design or a diff for whether it can be used without a mouse or with a screen reader.

## When NOT to invoke

- Non-UI code — a data pipeline, a build script, an internal API with no rendered surface.
- As a substitute for real testing on a critical product. This discipline catches the common, self-inflicted barriers; a product with serious accessibility requirements still needs testing with actual assistive technology and users.

## The discipline

- **Semantic HTML first.** A real `<button>` is focusable, keyboard-operable, announced as a button, and styleable — for free. A `<div onclick>` is none of those until you rebuild all of it by hand, badly. Use `<button>`, `<a href>`, `<label>`, `<nav>`, `<main>`, `<h1>`–`<h6>`, `<ul>`, native form controls. Reach for a `div` only when no element carries the meaning.
- **Keyboard operability.** Everything you can do with a mouse must work from the keyboard: Tab reaches every control in a logical order, Enter/Space activate, Escape dismisses, arrow keys move within composite widgets. Focus must be visible — never `outline: none` without a stronger replacement — and must not get trapped anywhere except a modal (which should trap it deliberately and return it on close).
- **Accessible names.** Every control and meaningful image has a name a screen reader can announce: a `<label>` associated with its input (not a placeholder — placeholders vanish on typing and fail contrast), `alt` text on informative images (empty `alt=""` on decorative ones), an `aria-label` on an icon-only button. A control with no name is unusable non-visually.
- **Perceivable, not color-alone.** Text meets contrast (WCAG AA: 4.5:1 for body, 3:1 for large text and UI boundaries), and no information is carried by color alone — an error is red *and* has text/an icon; a required field says so, not just a red border. Respect `prefers-reduced-motion` for anything that animates.
- **ARIA as a last resort.** ARIA can name and describe things HTML can't, but it only changes what is *announced*, never what the element *does* — `role="button"` does not make a `div` focusable or clickable. A wrong ARIA attribute is worse than none: it lies to the screen reader. Prefer the native element; use ARIA only to fill a genuine gap, following an established pattern.

## Anti-patterns

- **`<div onclick>` as a button.** Not focusable, not keyboard-operable, not announced. Use `<button>`.
- **Placeholder as the label.** It disappears on input, fails contrast, and is not a name. Use a real `<label>`.
- **`outline: none`** with no visible focus replacement. Keyboard users lose their place.
- **ARIA to paper over non-semantic markup** — `role="button"` on a `div` instead of a `button`. Fix the element, don't relabel it.
- **Positive `tabindex`** (`tabindex="1"`+). It hijacks the tab order and desynchronizes it from the visual order. Use `0` or `-1` only.
- **Color as the only signal** for state, error, or meaning.
