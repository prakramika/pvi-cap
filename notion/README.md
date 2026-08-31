# PVI Notion project workspace

Project-management workspace for the PVI software project. This is not the application, not a backlog, and not connected to GitHub or Jira.

Use Notion for status, milestones, decisions, approvals, billing, and client transparency. Use GitHub and Cursor for development.

## One-time setup (about 5 minutes)

1. In Notion, create an empty page named **PVI Project**.
2. Open **Settings → Connections → Develop or manage integrations** (or [notion.so/my-integrations](https://www.notion.so/my-integrations)).
3. Create an **internal integration** with the ability to read, update, and insert content.
4. Open the PVI Project page → **…** → **Connections** → add the integration.
5. Copy `.env.example` to `.env` and paste:
   - `NOTION_TOKEN` — the integration secret
   - `NOTION_PARENT_PAGE_ID` — the page URL or 32-character ID
6. From this repo:

```bash
npm install
npm run provision
```

The script creates the dashboard, client portal, seven databases, views, seed rows, weekly report template, and a how-to page. It will refuse to run if a dashboard already exists on that parent page.

Do not commit `.env`.

## After provision: share with the client

Share **only** the **Client Portal** page as **Can comment**.

Do not share:

- the parent **PVI Project** page
- **PVI Project Dashboard** (internal)
- **Internal Notes**
- **How to use this workspace**

Hidden columns (Internal Notes, estimates, cost/timeline impact) are turned off on client views. A guest with enough access can still unhide properties. Keep real private commentary in **Internal Notes**, which is not on the portal.

## What was seeded

- 12 milestones, one per delivery phase, all without real dates
- **Week 01** (In Progress) for project initiation only — not a development plan
- Empty billing rows (one per milestone, no amounts)
- Software Development Agreement document row (upload the signed PDF onto that row)

Fill **Start Date** / **End Date** on milestones when you agree a calendar. The Timeline / Gantt view stays empty until then. Fill billing amounts only when you have them.

## How to use this every week

### Monday (~15 minutes)

1. Open **PVI Project Dashboard**.
2. Edit the **Project Control** row: Current Week, Current Phase, Current Milestone, Next Milestone, Overall Status, Overall Progress.
3. Open this week’s **Weekly Delivery** row. Fill Objective, Planned Work, Demo Items, and Deliverables.
4. Every week needs one thing the client can see or review.

### During the week

- Log a blocker the day it appears (**Risks & Blockers**).
- Put decisions and approvals in **Meetings** or **Change Requests**, not only in chat.
- Keep coding in GitHub/Cursor. Do not turn Weekly Delivery into a task list.

### Before the demo

1. Duplicate **Templates → PVI — Weekly Status Report** into **Weekly Reports**.
2. Fill it from the dashboard. One page. Client language. No internal estimates.

### After the demo

1. Add a **Meetings** row: discussion, decisions, owners, due dates, approval status.
2. Update Progress % and Status on the week and the current milestone.

### Friday

1. Mark the week **Completed** or **Client Review**.
2. Write **Next Week Plan**. Create the next Weekly Delivery row if needed — one week ahead is enough. Use **Templates → New Week** as the checklist, or duplicate Week 01.

### When scope changes

Add a **Change Request** before doing the extra work. Only **Approved** change requests show on the Client Portal.

### When billing happens

Fill dates and amounts in **Billing Tracker**. The amount fields exist so you can enter values later; they were left blank on purpose.

## Workflow

Project Planning → Milestone → Weekly Plan → Development → Testing → Weekly Demo → Client Feedback → Decision/Approval → Update Plan → Next Week

## Databases

| Database | Purpose |
|---|---|
| Project Milestones | Phases, progress, timeline |
| Weekly Delivery | One row per week, always with a demo/review item |
| Client Meetings & Decisions | Agenda, decisions, approvals |
| Billing Tracker | Planned vs billed vs received |
| Change Requests | Scope changes and approval |
| Risks & Blockers | Active risks and blockers |
| Project Documents | Agreements and review packs |
| Project Control | Single row that drives the dashboard summary |
| Internal Notes | Private notes — never on the client portal |
