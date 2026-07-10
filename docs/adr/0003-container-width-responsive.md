# ADR-0003 — Container-width responsive via ResizeObserver, not viewport

**Status:** accepted
**Cites:** I.wp · relates to invariant V3

## Context

Multiple viewers can sit on one page, each in a different-width column or
container. Viewport-based media queries would force every viewer on the page to
the same breakpoint decision regardless of its actual box.

## Decision

Drive single-vs-double layout from the **container's** measured width via
`ResizeObserver`, not the viewport. `≥ breakpoint` (default 768px) → spread;
`< breakpoint` → single. Each instance adapts independently.

## Consequences

- `setupResponsiveBehavior()` observes each container.
- Two viewers on the same page can show different arrangements simultaneously.
- The arrangement decision is available for the native/image engines now;
  flipbook arrangement is limited by the library (always a spread — see V24).
