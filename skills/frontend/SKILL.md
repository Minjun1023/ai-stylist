---
name: aistylist-frontend-brand
description: Apply AI Stylist frontend brand and layout guardrails for React/Tailwind UI tasks. Use when implementing or updating frontend pages/components so design stays consistent with the app's visual identity: primary color #3C91E6, secondary color #342E37, mobile-first card layout, clear hierarchy, and dashboard-style sections.
---

# AI Stylist Frontend Brand Skill

Keep visual implementation consistent with this product style when creating or editing frontend UI.

## Enforce Brand Tokens

- Use `primary` as `#3C91E6`.
- Use `secondary` as `#342E37`.
- Keep Tailwind token usage semantic: use `primary-*` and `secondary-*` classes instead of hardcoded hex values.
- If a component needs inline style for dynamic values, fallback to `#3C91E6` and `#342E37` only.

## Tailwind Rules

- Ensure `frontend/tailwind.config.js` has:
- `colors.primary.DEFAULT = #3C91E6`
- `colors.secondary.DEFAULT = #342E37`
- Keep shade scales (`50~900`) for both so existing utility classes remain compatible.

## Layout Direction

- Build mobile-first screens first, then scale up.
- Use dashboard composition:
- Top app bar with logo/title and one right-side action icon.
- Hero greeting block with bold title and supportive subtitle.
- One featured analysis card with image background and strong CTA.
- Two compact info cards in a 2-column grid.
- Trend/Recommendation section with horizontal or 2-column cards.
- Bottom navigation fixed/anchored for mobile dashboard pages.

## Component Styling Rules

- Prefer rounded cards (`rounded-xl` or larger) with soft borders and light backgrounds.
- Keep primary CTA in solid `primary`, secondary actions in neutral or outline.
- Use `secondary` for high-contrast text and heading anchors.
- Keep spacing predictable:
- Section stack: `space-y-4` or `space-y-6`
- Card inner padding: `p-4` or `p-6`
- Avoid dense blocks without breathing room.

## Typography Rules

- Headline: strong contrast and short copy.
- Subcopy: calmer tone (`gray-500`/`gray-600` equivalent), 1~2 lines.
- Highlighted names/keywords can use `text-primary-500` or `text-primary-600`.

## Do Not

- Do not switch to unrelated theme colors.
- Do not use purple-biased defaults.
- Do not apply overly dark backgrounds unless explicitly requested.
- Do not break the dashboard hierarchy with long uninterrupted text blocks.

## Implementation Checklist

- Confirm `primary/secondary` token usage in changed components.
- Confirm CTA hierarchy is clear (one dominant action).
- Confirm mobile viewport is readable without layout collisions.
- Confirm card paddings and section gaps are visually consistent.
