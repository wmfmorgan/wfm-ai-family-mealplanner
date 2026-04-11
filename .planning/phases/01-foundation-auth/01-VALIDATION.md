# Phase 1: Foundation & Auth - Validation Strategy

**Phase:** 01
**Date:** 2026-04-11

## Overview
This document defines the validation criteria for Phase 1: Foundation & Auth. Every task in the plan must contribute to satisfying these criteria.

## 1. Authentication (Supabase Auth)
- **V-01: Magic Link Flow**: User can request a magic link, receive it, and successfully sign in without a password.
- **V-02: Session Persistence**: Logged-in sessions persist across page refreshes for the expected 7-day duration.
- **V-03: Protected Routes**: Unauthenticated users are redirected from the Weekly Planner to the login page.
- **V-04: Post-Login Redirect**: First-time and returning users are landed directly on the `/planner` route after signing in.

## 2. Database & Schema (Supabase DB)
- **V-05: Household Direct Mapping**: Every user has exactly one corresponding household record in the `households` table.
- **V-06: Member CRUD**: Households can successfully have multiple members in the `household_members` table.
- **V-07: Row Level Security (RLS)**: Users CANNOT read or write data belonging to households they do not own.

## 3. UI/UX Foundation (Google Stitch)
- **V-08: Design System Compliance**: The `DESIGN.md` matches the Newsreader serif font and Sage Green color decisions.
- **V-09: Shell Responsiveness**: The app layout correctly switches from a sidebar (Desktop) to a bottom tab bar (Mobile).
- **V-10: Cookbook Aesthetic**: Content areas are centered with a max-width of 800px for a "cookbook" feel.

## 4. Technical Infrastructure (React + Vite)
- **V-11: Build Pipeline**: Project builds without errors using `npm run build`.
- **V-12: Type Safety**: TypeScript checks pass for all new components and hooks.

---

*Status: Finalized for Phase 01*
