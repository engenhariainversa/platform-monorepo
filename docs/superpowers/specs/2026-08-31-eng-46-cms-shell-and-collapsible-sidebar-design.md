# ENG-46 — CMS shell: viewport-locked scroll and a collapsible sidebar

Ticket: https://linear.app/engenharia-inversa/issue/ENG-46
Parent: ENG-8 · Status at writing: Backlog

## Problem

Two defects in the same file, `apps/cms/app/dashboard/layout.tsx`.

**The whole document scrolls, sidebar included.** The shell is:

```jsx
<div className="flex min-h-screen">
  <aside className="w-64 ...">
  <main className="flex-1 overflow-auto">
```

`overflow-auto` on `<main>` does nothing here. An element only becomes a scroll
container when its height is constrained, and nothing constrains it:
`min-h-screen` is a floor, not a ceiling, so the wrapper grows with the content
and `<main>` grows with it. The document scrolls instead, dragging the sidebar
out of view — worst on the table screens, which are the tallest.

**The sidebar is always expanded**, spending 256px of width on every screen.

## Decisions

Both are fixed in this ticket rather than split apart. They live in the same
file, a 64px-wide rail that scrolls away with the page makes no sense, and
splitting them would put two branches in direct conflict over the most contended
file of the three parallel tickets.

The preference is stored in **`localStorage`**, not the database. It is a
per-device UI preference, and the schema has no place to hang user settings —
adding one would mean a migration for a cosmetic toggle.

The default is **pinned open**, which is exactly today's behaviour, so nobody
who never touches the control sees a change.

Mobile is out of scope. ENG-48 owns it and is sequenced after this ticket.

## Design

### Shell

```jsx
<div className="flex h-screen overflow-hidden">
  <aside>            {/* full viewport height, never scrolls with the page */}
    <nav className="flex-1 overflow-y-auto">  {/* long menus scroll here */}
    ...user block, pinned to the bottom
  </aside>
  <main className="flex-1 overflow-y-auto">
```

`h-screen` plus `overflow-hidden` locks the shell to the viewport, which is what
finally gives `<main>` a constrained height and turns it into the scroll
container. The sidebar's `<nav>` gets its own `overflow-y-auto` so a menu longer
than the viewport scrolls inside the rail instead of pushing the user block and
the Sair button off-screen with no way to reach them.

### Two modes

- **Pinned** — the current 256px rail, always expanded, pushing the content.
- **Auto** — a 64px rail showing icons only, expanding over the content on hover
  and collapsing on leave. Overlaying rather than reflowing keeps the content
  from jumping under the pointer.

A pin button in the sidebar header toggles between them, and the choice is
persisted.

### Persistence

Read and write inside `try/catch`. Private windows, cleared site data and
browsers that block storage all throw on access, and the shell must still render
correctly with no stored value — falling back to pinned.

### Accessibility

Collapsed, the rail shows only the emoji icons. Each link gets an `aria-label`
and a `title` with its real label, otherwise the navigation becomes unlabelled
emoji. The pin button gets an `aria-label` describing what it will do next.

### Structure

The sidebar moves out of `layout.tsx` into its own component under
`apps/cms/components/`. The layout file currently mixes auth redirect, role
filtering, sidebar markup and the content shell; the sidebar is the part this
ticket grows, so it is the part worth extracting.

## Out of scope

- Mobile navigation, the tab bar and the hamburger menu (ENG-48).
- Page header styling (ENG-47).

## Verification

- On a screen taller than the viewport (Usuários), the sidebar stays put while
  the content scrolls, and the page itself no longer scrolls.
- The user block and Sair stay reachable at the bottom of the rail regardless of
  content height.
- Toggling the pin collapses to icons only and expands on hover; the choice
  survives a reload.
- With `localStorage` unavailable, the shell still renders pinned open.
- Collapsed links expose their label to assistive tech.
- `turbo run build lint` passes.
