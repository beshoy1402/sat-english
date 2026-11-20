# Northstar English — SAT English Platform

Independent English exam-preparation platform for SAT English, EST English and ACT English. This repository is intentionally separate from the SAT Math repository.

## Current milestone

- Premium navy-blue responsive landing page.
- Animated 3D-inspired hero illustration and scroll-reveal sections.
- English and Arabic language switch with RTL layout.
- Program overview, teaching approach, FAQ and contact call-to-action.
- Student login entry modal placeholder.
- Reduced-motion accessibility support.
- React + TypeScript + Vite foundation.

## Local development

Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

## Architecture and security

The platform is planned to expand into separate permission-controlled experiences for students, parents, teachers, assistants, administrators, developers and designers. Authentication, backend authorization, data storage, exams, AI providers, payment processing, messaging and live-class integrations must be implemented as server-backed services before their workflows are enabled.

Never expose API keys or secrets in client-side code. Keep development, staging and production configuration and data separate. Staging must not use real student records or live payment credentials.

## Status

This is the initial frontend foundation only. Authentication, student and parent portals, staff dashboards, exam engine, AI workflows, payments, messaging, monitoring and production deployment remain future milestones.
