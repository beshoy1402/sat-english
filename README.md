# Northstar English — SAT English Platform

Independent English exam-preparation website for SAT English, EST English and ACT English.

This repository is intentionally separate from the SAT Math website repository.

Initial implementation is being established in phases. The first milestone is the premium bilingual landing page and frontend foundation. Authentication, backend authorization, student and parent portals, staff dashboards, exam engine, AI, payments and third-party integrations will be implemented in later milestones.

## Development

Node.js 20.19+ or 22.12+ is recommended.

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

Never commit API keys or secrets. Development, staging and production must use separate configuration and data.
