# Enhancement Ideas

Parking lot for enhancement ideas. Repo GitHub Issues are reserved for
bugs and actionable follow-ups; ideas live here until promoted to an issue.

**Status vocabulary:** `parked` (noted, not started) · `exploring` (spec/design
in progress) · `promoted` (moved to a GitHub Issue — link it) · `dropped`.

| # | Idea | Notes | Status |
|---|------|-------|--------|
| 1 | Contained Continuous viewer | Same **Continuous** page stack, but bounded in a fixed-height box that scrolls *internally* instead of growing into page flow (current behavior grows unbounded, whole page scrolls). Toolbar pinned to the box edge — like PDF.js's own default viewer. Not a new render mode; a layout wrapper on existing Continuous. Impl sketch: wrap page container in a fixed/`height`-attr element with `overflow:auto`; pin toolbar via sticky/absolute. | parked |
