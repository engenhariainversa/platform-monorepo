# ENG-48 — CMS navigation and views on mobile

Ticket: https://linear.app/engenharia-inversa/issue/ENG-48
Parent: ENG-8 · Status at writing: Backlog

## Sequencing

**This ticket runs last, after ENG-46 and ENG-47 are merged into the feature
branch.** Its own description says so — "depende das telas já estabilizadas
pelas demais" — and the code agrees: it rewrites navigation in the same
`layout.tsx` ENG-46 restructures, and touches the same screen bodies ENG-47
converts. Its branch is cut from the feature branch once both have landed, so it
is written against the shell and headers that will actually ship.

## Problem

The CMS reuses the desktop sidebar and tables on mobile, which makes it
impractical to operate from a phone.

## Design

### Navigation

A bottom tab bar carries the primary destinations — Conteúdo, Usuários and
Configurações — visible only below the `md` breakpoint, where the desktop
sidebar is hidden. It sits fixed above the content, which the viewport-locked
shell from ENG-46 already supports: the content is its own scroll container, so
a fixed bar does not overlap scrolled content.

Secondary destinations live behind a hamburger button that opens a dedicated
screen listing every menu entry, including the role-gated ones. Role filtering
reuses the existing `menuItems` roles logic rather than a second copy of it.

### Tables to lists

Only **two** screens render a `<table>`: Usuários and Configurações ›
Permissões. The ticket's "tabelas em todo o CMS" is those two. Below `md`, each
row becomes a stacked list item — label above value — so nothing depends on
horizontal scrolling. The desktop table is unchanged.

## Out of scope

- The collapsible sidebar and shell scrolling (ENG-46).
- Page header hierarchy (ENG-47).

## Verification

- At a phone viewport the sidebar is hidden, the tab bar shows the three primary
  destinations, and the hamburger screen lists all entries the current role can
  reach.
- A MANAGER and an ADMIN see different entries, matching the sidebar's rules.
- Usuários and Permissões scroll vertically only; no horizontal scrolling.
- The desktop layout is untouched at `md` and above.
- `turbo run build lint` passes.
