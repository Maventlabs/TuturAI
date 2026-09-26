# TuturAI — Full Design, UI/UX & Brand Overhaul

> This document controls the complete visual redesign of TuturAI after functional implementation is stable.
>
> The redesign MUST NOT alter working backend behavior, API contracts, database schemas, authentication logic, persistence models, authorization rules, business logic, assignment state machines, AI/provider contracts, or other verified functionality unless a concrete frontend integration bug requires a minimal fix.
>
> This is a **frontend visual/UX refactor with Human-in-the-Loop design direction**.

---

## 1. START CONDITION

Do NOT begin this phase until the functional implementation checkpoint is stable.

Required before starting:

- core backend/business functionality implemented;
- current `EXECUTION.md` functional tasks completed or explicitly externally gated;
- durable E2E exists for core flows;
- no active critical backend migration;
- current UI behavior can be captured as a baseline;
- working routes and user flows are documented.

Before touching UI:

1. read `PRD.md`;
2. read `AGENTS.md`;
3. read `MUST.md`;
4. read `EXECUTION.md`;
5. inspect current frontend architecture;
6. inventory existing components/routes/layouts;
7. capture screenshots of current important pages;
8. identify which tests/E2E flows must continue passing after visual changes.

The redesign must preserve existing application behavior.

---

# 2. PRIMARY OBJECTIVE

Completely redesign the TuturAI frontend visual system so it feels intentionally designed, distinctive, modern, premium, educational, youthful, and credible without looking childish, generic, overly playful, corporate, or AI-generated.

The redesign includes:

- typography;
- font hierarchy;
- color system;
- logo usage;
- navbar;
- landing page;
- every landing-page section;
- buttons;
- inputs;
- cards;
- dialogs;
- forms;
- tabs;
- tables;
- filters;
- empty states;
- loading states;
- error states;
- navigation;
- dashboard shell;
- sidebar;
- topbar;
- student interface;
- teacher interface;
- responsive states;
- micro-interactions;
- animations;
- iconography;
- spacing;
- borders;
- shadows;
- surfaces;
- copywriting;
- SEO-facing content.

All frontend components must visually belong to the same design system.

---

# 3. HARD PRODUCT BOUNDARY

## DO NOT MODIFY WORKING BACKEND BEHAVIOR

Frontend redesign MUST NOT casually modify:

- API routes;
- Firestore schemas;
- Firestore security rules;
- authentication/session architecture;
- role/RBAC behavior;
- classroom membership;
- assignment lifecycle;
- persistence model;
- offline queue semantics;
- AI/STT/TTS provider contracts;
- Google Drive integration;
- device protocol;
- analytics calculation;
- existing server-side validation;
- authorization behavior.

If frontend code currently contains business logic that must be touched during the redesign, preserve its observable behavior.

Before changing a functional component, identify:

```text
CURRENT BEHAVIOR
DATA SOURCE
USER ACTION
SERVER/API BOUNDARY
PERSISTED RESULT
CURRENT TEST/E2E COVERAGE
```

The redesign must change presentation, not silently change functionality.

---

# 4. HUMAN-IN-THE-LOOP IS MANDATORY

The user is the final design director.

Do NOT autonomously redesign the entire product in one pass.

Use explicit HIL checkpoints.

Required loop:

```text
INSPECT
↓
RESEARCH / REFERENCES
↓
PROPOSE
↓
USER REVIEW
↓
REFINE
↓
USER APPROVAL
↓
IMPLEMENT
↓
SCREENSHOT
↓
USER REVIEW
↓
FINALIZE
```

Never assume approval based on silence.

Do not proceed from major visual direction to full-site implementation until the user approves the direction.

Major HIL approval checkpoints:

### HIL-01 — Visual Direction
Present design references, typography direction, palette, density, shapes, navigation style, and visual language.

### HIL-02 — Design System
Present tokens and representative components.

### HIL-03 — Landing Hero
Implement one high-fidelity landing hero/header prototype and capture screenshots.

### HIL-04 — Landing Page
Complete landing page redesign and obtain approval before propagating the system.

### HIL-05 — Dashboard Shell
Redesign sidebar/topbar/dashboard shell while preserving information architecture.

### HIL-06 — Student UI
Apply approved system to student routes.

### HIL-07 — Teacher UI
Apply approved system to teacher routes.

### HIL-08 — Motion
Review animation/microinteraction behavior.

### HIL-09 — Responsive QA
Review desktop/tablet/mobile screenshots.

### HIL-10 — Final Visual Approval
Complete visual regression and product-wide consistency review.

---

# 5. DESIGN RESEARCH WORKFLOW

Use relevant design/research MCPs, browser automation, screenshots, page inspection, crawling, and reference collection where available.

Research must be purposeful.

Do NOT directly clone another product.

For each reference, identify specific useful properties such as:

- typography scale;
- navigation architecture;
- spacing;
- content density;
- hero composition;
- dashboard hierarchy;
- card structure;
- table treatment;
- sidebar interaction;
- responsive behavior;
- motion principles;
- information hierarchy;
- visual rhythm.

Store useful findings in this document or a dedicated references section.

Reference analysis must answer:

```text
WHAT IS GOOD?
WHY DOES IT WORK?
WHAT PRINCIPLE CAN TUTURAI ADOPT?
WHAT MUST NOT BE COPIED?
```

Use screenshots and visual inspection instead of relying only on textual descriptions.

---

# 6. ANTI AI-SLOP DESIGN RULES

The design MUST NOT look like a generic AI-generated SaaS template.

Strictly avoid:

- excessive gradients;
- gradient backgrounds;
- gradient text;
- purple-blue AI gradients;
- glowing blobs;
- random glassmorphism;
- excessive blur;
- arbitrary floating cards;
- meaningless abstract AI spheres;
- generic neural-network imagery;
- glowing borders;
- neon cyan/purple combinations;
- excessive pills;
- every container being rounded;
- oversized border radius everywhere;
- unnecessary icon decorations;
- excessive shadows;
- overuse of badges;
- generic "AI-powered" visual clichés;
- fake metrics;
- generic testimonial filler;
- repetitive three-column SaaS sections;
- excessive centered layouts;
- every section using identical cards;
- decorative elements without purpose.

## NO GRADIENTS

Do not use gradients unless the user explicitly approves an exception.

Default:

```text
gradient usage = prohibited
```

Use hierarchy through:

- typography;
- composition;
- whitespace;
- scale;
- contrast;
- solid color;
- imagery;
- illustration;
- borders;
- controlled shadow;
- layout.

---

# 7. VISUAL QUALITY PRINCIPLES

Target qualities:

- intentional;
- distinctive;
- clean;
- editorial;
- modern;
- premium;
- friendly;
- confident;
- educational;
- youthful but not childish;
- technically credible;
- accessible;
- calm;
- high-information clarity.

Avoid:

- sterile corporate dashboard appearance;
- children's learning-app aesthetic;
- generic startup aesthetic;
- overly futuristic interfaces;
- visual gimmicks;
- excessive animation;
- excessive whitespace that harms information density.

---

# 8. DESIGN SYSTEM FIRST

Before redesigning dozens of pages, establish reusable foundations.

Define centralized tokens for:

## Typography

Define:

- display;
- H1;
- H2;
- H3;
- H4;
- body large;
- body;
- body small;
- caption;
- label;
- button;
- data/table typography.

Choose font families deliberately.

Do not randomly mix fonts between routes.

Check:

- Indonesian text rendering;
- English text rendering;
- numerals;
- punctuation;
- UI legibility;
- loading/performance;
- variable font support where useful.

---

## Colors

Create semantic tokens rather than hardcoding colors throughout components.

Examples:

```text
background
surface
surface-subtle
surface-elevated

foreground
foreground-muted
foreground-subtle

brand
brand-hover
brand-active

border
border-strong

success
warning
danger
info

focus
```

Ensure WCAG contrast.

No gradient dependency.

---

## Spacing

Establish consistent spacing scale.

Avoid arbitrary per-component spacing.

---

## Radius

Use restrained radius.

Do not make every interface element a large rounded rectangle.

Differentiate:

- controls;
- cards;
- modals;
- navigation;
- tags.

---

## Shadow

Use shadows only to communicate elevation or hierarchy.

Avoid glowing shadows.

---

## Iconography

Use one consistent icon language.

Avoid decorative icons when typography alone communicates the concept.

---

# 9. LANDING PAGE — COMPLETE REDESIGN

Every landing-page section may be redesigned.

This includes:

- navbar;
- hero;
- social proof;
- problem framing;
- value proposition;
- product explanation;
- speaking workflow;
- learning features;
- teacher experience;
- classroom functionality;
- adaptive learning;
- analytics;
- assignment workflow;
- voice-cloning explanation;
- offline/PWA capabilities;
- student/teacher CTA;
- FAQ;
- footer;
- any existing marketing section.

The existing section structure is NOT sacred.

Sections may be:

- removed;
- reordered;
- combined;
- rewritten;
- visually reconstructed;

provided product claims remain accurate.

The landing page must tell one coherent story rather than behave like a collection of random SaaS blocks.

---

# 10. COPYWRITING

Use relevant copywriting skills/workflows.

Rewrite low-quality, generic, repetitive, or placeholder frontend copy.

Copy should be:

- clear;
- concise;
- specific;
- natural;
- confident;
- appropriate for Indonesian SMA/SMK students and teachers;
- non-corporate;
- non-childish;
- free of generic AI marketing clichés.

Avoid copy such as:

```text
Revolutionize your learning
Unlock your potential
AI-powered future
Transform your journey
Next-generation experience
```

unless genuinely justified.

Do not invent statistics, customer counts, endorsements, outcomes, or capabilities.

Maintain factual consistency with PRD.

---

# 11. SEO

SEO improvements are included for public-facing pages.

Review:

- page titles;
- descriptions;
- heading hierarchy;
- canonical metadata;
- structured data where justified;
- Open Graph metadata;
- social preview;
- semantic HTML;
- internal linking;
- crawlability;
- indexable content;
- image alt text;
- page performance;
- Core Web Vitals implications.

SEO MUST NOT degrade UX or produce keyword-stuffed copy.

Protected dashboard pages are application interfaces, not SEO landing pages.

---

# 12. DASHBOARD REDESIGN

Dashboard redesign is deliberately more conservative than landing-page redesign.

Preserve:

- menu names unless copy genuinely needs clarification;
- route structure;
- information architecture;
- existing data;
- existing functionality;
- actions;
- business workflows.

Allowed changes:

- typography;
- colors;
- spacing;
- sidebar styling;
- navigation hierarchy presentation;
- cards;
- data presentation;
- visual grouping;
- table appearance;
- buttons;
- forms;
- empty states;
- status treatment;
- iconography;
- responsive layout;
- loading/error states;
- subtle motion.

Do not redesign the dashboard merely to make it visually dramatic.

Priority:

```text
clarity > novelty
```

---

# 13. COMPONENT INVENTORY

Before implementation, inventory reusable components.

Classify:

```text
FOUNDATION
LAYOUT
NAVIGATION
INPUT
FEEDBACK
DATA DISPLAY
OVERLAY
CONTENT
MARKETING
STUDENT
TEACHER
```

Identify:

- duplicate components;
- inconsistent variants;
- one-off styles;
- missing primitives;
- components suitable for consolidation.

Do not create five visually similar components if one configurable component can serve them safely.

But do not create giant abstractions purely for abstraction's sake.

---

# 14. RESPONSIVE DESIGN IS MANDATORY

Every changed page must support at minimum representative viewport classes for:

```text
small mobile
large mobile
tablet portrait
tablet landscape
small laptop
desktop
large desktop
```

Do not optimize only for 1440px screenshots.

Test representative viewport widths such as:

```text
320
360
375
390
412
768
820
1024
1280
1440
1920
```

Exact testing matrix may be rationalized, but mobile, tablet, laptop, and desktop MUST be represented.

---

# 15. ZERO HORIZONTAL OVERFLOW

Horizontal overflow is considered a bug unless the component intentionally supports horizontal scrolling, such as a data table with an explicit responsive wrapper.

Check:

```text
document.documentElement.scrollWidth
<=
document.documentElement.clientWidth
```

on representative routes and viewport sizes.

Pay special attention to:

- tables;
- charts;
- code/text strings;
- sidebars;
- dropdowns;
- dialogs;
- navigation;
- cards;
- grid layouts;
- flex children;
- long names;
- translated copy.

Use responsive constraints intentionally.

Do not solve overflow by blindly adding:

```css
overflow-x: hidden;
```

to the whole application.

Fix the responsible layout.

---

# 16. RESPONSIVE BEHAVIOR

Components must reflow intentionally.

Do not merely scale desktop UI down.

Consider:

- sidebar → drawer/bottom interaction where appropriate;
- navigation collapse;
- card stacking;
- responsive tables;
- touch targets;
- modal sizing;
- typography scale;
- chart simplification;
- action placement;
- mobile form layout;
- sticky elements;
- viewport-safe dialogs.

Minimum touch target should remain usable on mobile.

---

# 17. MOTION & GSAP

Use GSAP or other animation tooling only where it materially improves the experience.

Motion should communicate:

- hierarchy;
- transition;
- causality;
- progress;
- feedback.

Suitable areas may include:

- landing hero;
- section reveals;
- storytelling sequences;
- controlled scroll interaction;
- menu transitions;
- contextual state changes.

Avoid:

- animating everything;
- excessive parallax;
- scroll hijacking;
- long intro animations;
- gratuitous cursor effects;
- motion that delays interaction;
- animation on every dashboard card.

Respect:

```css
prefers-reduced-motion
```

Dashboard motion should generally be subtler than marketing-page motion.

---

# 18. DESIGN SKILLS

Use relevant available skills/workflows such as:

- strong UI design/taste-oriented skills;
- frontend architecture skills;
- responsive design;
- accessibility;
- GSAP/motion;
- copywriting;
- SEO;
- browser automation;
- visual inspection;
- screenshot comparison;
- frontend testing.

If an available skill resembles high-quality visual taste systems such as `impeccable`, use it where relevant.

Do not invoke skills mechanically.

Use them when they materially improve the current design task.

---

# 19. SCREENSHOT-DRIVEN REVIEW

Every major design checkpoint must produce screenshots.

Required representative screenshots:

```text
Desktop
Tablet
Mobile
```

For important routes, compare:

```text
BEFORE
AFTER
```

Review:

- hierarchy;
- whitespace;
- typography;
- alignment;
- density;
- contrast;
- overflow;
- component consistency;
- responsive behavior;
- visual artifacts.

Do not assume code that compiles looks correct.

---

# 20. VISUAL REGRESSION

Maintain a screenshot baseline for critical pages if tooling allows.

Critical candidates:

- landing page;
- login;
- signup;
- student dashboard;
- teacher dashboard;
- assignments;
- speaking;
- analytics;
- settings.

A visual change must not accidentally remove functionality.

---

# 21. ACCESSIBILITY

Design quality includes accessibility.

Verify:

- color contrast;
- keyboard navigation;
- focus states;
- semantic structure;
- form labels;
- accessible names;
- modal focus handling;
- screen-reader behavior where practical;
- reduced motion;
- touch target size.

Do not remove accessible semantics for visual reasons.

---

# 22. PERFORMANCE

Avoid redesign decisions that materially degrade frontend performance.

Watch:

- webfont weight;
- image size;
- unnecessary JS;
- heavy animation;
- hydration;
- third-party libraries;
- layout shifts;
- oversized video;
- unnecessary client components.

Prefer CSS for simple interactions.

Use JavaScript animation only where justified.

---

# 23. IMPLEMENTATION STRATEGY

Do not rewrite all pages simultaneously.

Recommended sequence:

```text
DESIGN-00
Visual audit + component inventory

DESIGN-01
Reference research + HIL direction

DESIGN-02
Design tokens + typography + colors

DESIGN-03
Core component system

DESIGN-04
Navbar + landing hero

DESIGN-05
Full landing page

DESIGN-06
Auth/public application pages

DESIGN-07
Dashboard shell/navigation

DESIGN-08
Student interface

DESIGN-09
Teacher interface

DESIGN-10
Motion & microinteraction pass

DESIGN-11
Copywriting + SEO pass

DESIGN-12
Responsive & overflow QA

DESIGN-13
Accessibility + performance

DESIGN-14
Visual regression + affected E2E

DESIGN-15
Final HIL approval
```

Each stage must have evidence before moving forward.

---

# 24. DESIGN TASK STATE

Use:

```text
TODO
IN_RESEARCH
AWAITING_HUMAN_DIRECTION
APPROVED
IN_PROGRESS
VERIFYING
DONE
```

Do not treat:

```text
AWAITING_HUMAN_DIRECTION
```

as a generic blocker.

It means implementation must pause only for the design decision requiring user input while independent work may continue.

---

# 25. CHANGE SAFETY

Before modifying shared components, identify consumers.

A component-level visual change can affect many routes.

Use dependency search before changing:

- Button;
- Card;
- Dialog;
- Input;
- Select;
- Navbar;
- Sidebar;
- Layout;
- typography tokens;
- global CSS.

After shared-component changes:

- run focused tests;
- inspect representative consumers;
- capture screenshots.

---

# 26. NO BACKEND REGRESSION

After significant visual milestones, rerun affected functional E2E.

A successful redesign must preserve:

```text
authentication
RBAC
classroom
assignment
learning
speaking
teacher workflows
persistence
authorization
offline behavior
```

where applicable.

If an E2E fails after a frontend redesign, treat it as a regression until proven otherwise.

---

# 27. OUTPUT FORMAT DURING DESIGN PHASE

For each design unit, report only:

```text
TASK
WHAT WAS INSPECTED
DESIGN DECISION
FILES CHANGED
SCREENSHOTS
RESPONSIVE RESULT
ACCESSIBILITY RESULT
FUNCTIONAL VERIFICATION
OPEN HIL DECISION
NEXT TASK
```

Avoid long narrative status reports.

---

# 28. FINAL DESIGN ACCEPTANCE

The redesign is complete only if:

- all public pages use one coherent visual system;
- landing page has been fully redesigned;
- dashboard shell follows the same brand system;
- student/teacher experiences remain functionally unchanged;
- no unintended horizontal overflow exists;
- mobile/tablet/desktop behavior is verified;
- typography and spacing are consistent;
- gradients are absent unless explicitly approved;
- no obvious AI-template visual patterns remain;
- copywriting has been reviewed;
- SEO public surfaces are valid;
- accessibility checks pass;
- important routes have screenshot evidence;
- affected functional E2E remains green;
- the user has explicitly approved the final visual direction.

Final state:

```text
DESIGN_APPROVED=true
DESIGN_RESPONSIVE_VERIFIED=true
DESIGN_ACCESSIBILITY_VERIFIED=true
DESIGN_FUNCTIONAL_REGRESSION=false
```

Only after this should the project proceed to final production release verification.