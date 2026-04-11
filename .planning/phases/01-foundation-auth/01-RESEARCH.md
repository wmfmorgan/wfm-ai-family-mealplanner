# Phase 1: Foundation & Auth - Research

## Research Summary

To plan Phase 1 effectively, the following key insights were gathered:

### 1. Auth Strategy
- **Mechanism**: Strictly Magic Link (no passwords) via Supabase Auth.
- **Redirect**: Post-login redirect to the Weekly Planner.
- **Session**: Session duration is 7 days.

### 2. Design System
- **Framework**: Use Google Stitch with a "cookbook" aesthetic.
- **Typography**: Newsreader (Serif) for headlines.
- **Color**: Sage Green (#4A6741) primary earthy tone.
- **Shape**: Corner roundness of 8px (Balanced).
- **Layout**: Sidebar on desktop, Bottom Tab Bar on mobile.
- **Width**: Narrow (800px) centered content area for high readability.

### 3. Database Schema
- **Household Relationship**: One User maps directly to One Household record.
- **Household Members**: A separate `household_members` table will store profiles (Calories, Macros, Allergies, Appliances).
- **Security**: Row Level Security (RLS) must be enabled from the start.

### 4. Project Setup
- **Stack**: React + Vite + TypeScript.
- **AI Routing**: Supabase Edge Functions should be structured early (AI implementation is Phase 3).
- **Deployment**: Netlify (Frontend) and Supabase (Backend).

### 5. Google Stitch Integration
- Since Google Stitch is an external tool/MCP, the initial setup should focus on defining the `DESIGN.md` and applying it to the shell layout using the `stitch-design` and `react-components` skills.

## Implementation Roadmap (Phase 1)
1. **Initialize Supabase**: Create project, set up `households` and `household_members` tables with initial RLS.
2. **Setup Frontend**: Scaffold React + Vite + TS project.
3. **Design Foundation**: Create `.stitch/DESIGN.md` reflecting Newsreader/Sage Green/Round 8 decisions.
4. **Auth Flow**: Implement Supabase Auth (Magic Link) with appropriate redirects.
5. **Shell Layout**: Build the Sidebar/Bottom Tab shell using Stitch components.

## Validation Architecture
- **Auth**: Verify magic link generation and 7-day session persistence.
- **Schema**: Confirm RLS prevents users from seeing other households.
- **Design**: Visual audit of Newsreader font and Sage Green palette in the shell.
