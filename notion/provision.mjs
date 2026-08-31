#!/usr/bin/env node
/**
 * Provisions the PVI Notion project-management workspace.
 *
 * Usage:
 *   1. Copy .env.example to .env and fill NOTION_TOKEN + NOTION_PARENT_PAGE_ID
 *   2. npm install
 *   3. npm run provision
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@notionhq/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SCHEMA = JSON.parse(readFileSync(join(__dirname, "schema.json"), "utf8"));
const NOTION_VERSION = "2026-03-11";
const DELAY_MS = 350;

loadEnv();

const token = process.env.NOTION_TOKEN;
const parentRaw = process.env.NOTION_PARENT_PAGE_ID;

if (!token || token.includes("your_token_here")) {
  fail("Set NOTION_TOKEN in .env (see .env.example).");
}
if (!parentRaw) {
  fail("Set NOTION_PARENT_PAGE_ID in .env (page URL or ID).");
}

const parentPageId = parsePageId(parentRaw);
const notion = new Client({ auth: token, notionVersion: NOTION_VERSION });

const ctx = {
  pages: {},
  dbs: {},
  headingIds: {},
};

await main();

async function main() {
  console.log("PVI Notion workspace provisioner");
  console.log(`Parent page: ${parentPageId}`);

  await assertParentAccess();
  await assertNotAlreadyProvisioned();

  console.log("\n1. Creating folder pages…");
  for (const folder of SCHEMA.workspace.folders) {
    ctx.pages[folder.key] = await createPage(parentPageId, folder.title, folder.icon);
    console.log(`   ${folder.title}`);
  }

  console.log("\n2. Creating databases…");
  for (const [key, spec] of Object.entries(SCHEMA.databases)) {
    ctx.dbs[key] = await createDatabase(spec);
    console.log(`   ${spec.title}`);
  }

  console.log("\n3. Adding relations…");
  for (const rel of SCHEMA.relations) {
    await addRelation(rel);
    console.log(`   ${rel.from}.${rel.name} → ${rel.to}`);
  }

  console.log("\n4. Refreshing property maps…");
  for (const key of Object.keys(ctx.dbs)) {
    await refreshDataSource(key);
  }

  console.log("\n5. Creating database views…");
  for (const [key, spec] of Object.entries(SCHEMA.databases)) {
    await createViewsForDatabase(key, spec);
    console.log(`   ${spec.title} views`);
  }

  console.log("\n6. Seeding project-management data…");
  const milestoneIds = await seedMilestones();
  const week01Id = await seedWeek01(milestoneIds);
  await seedBilling(milestoneIds);
  await seedAgreement();
  await seedProjectControl(milestoneIds, week01Id);
  console.log("   Milestones, Week 01, billing rows, agreement, Project Control");

  console.log("\n7. Building dashboard, client portal, template, and README…");
  await buildDashboard();
  await buildClientPortal();
  await buildWeeklyReportTemplate();
  await buildHowToPage();

  const snapshot = {
    parentPageId,
    pages: Object.fromEntries(
      Object.entries(ctx.pages).map(([k, v]) => [k, { id: v.id, url: v.url }])
    ),
    databases: Object.fromEntries(
      Object.entries(ctx.dbs).map(([k, v]) => [
        k,
        { databaseId: v.databaseId, dataSourceId: v.dataSourceId, url: v.url },
      ])
    ),
  };
  writeFileSync(join(__dirname, ".provisioned.json"), JSON.stringify(snapshot, null, 2));

  console.log("\nDone.");
  console.log(`Internal dashboard: ${ctx.pages.dashboard.url}`);
  console.log(`Client portal:      ${ctx.pages.clientPortal.url}`);
  console.log("Share only the Client Portal with the client (Comment-only).");
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function loadEnv() {
  for (const file of [join(ROOT, ".env"), join(__dirname, ".env")]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function parsePageId(input) {
  const raw = String(input).trim();
  const dashed = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (dashed) return dashed[0].toLowerCase();
  const compact = raw.match(/[0-9a-f]{32}/i);
  if (!compact) fail("NOTION_PARENT_PAGE_ID must be a Notion page URL or 32-character ID.");
  const id = compact[0].toLowerCase();
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
}

function sleep(ms = DELAY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(label, fn) {
  await sleep();
  try {
    return await fn();
  } catch (error) {
    const body = error?.body ?? error?.message ?? error;
    console.error(`Notion API failed (${label}):`);
    console.error(typeof body === "string" ? body : JSON.stringify(body, null, 2));
    throw error;
  }
}

async function assertParentAccess() {
  await api("retrieve parent page", () => notion.pages.retrieve({ page_id: parentPageId }));
}

async function assertNotAlreadyProvisioned() {
  const children = await listBlockChildren(parentPageId);
  const exists = children.some(
    (block) =>
      block.type === "child_page" &&
      block.child_page?.title === "PVI Project Dashboard"
  );
  if (exists) {
    fail(
      "This parent page already has a “PVI Project Dashboard”. Use a fresh empty page, or delete the previous workspace first."
    );
  }
}

async function listBlockChildren(blockId) {
  const results = [];
  let cursor;
  do {
    const response = await api("list block children", () =>
      notion.blocks.children.list({
        block_id: blockId,
        start_cursor: cursor,
        page_size: 100,
      })
    );
    results.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);
  return results;
}

async function createPage(parentId, title, emoji, children = []) {
  const payload = {
    parent: { type: "page_id", page_id: parentId },
    icon: emoji ? { type: "emoji", emoji } : undefined,
    properties: {
      title: {
        title: [{ type: "text", text: { content: title } }],
      },
    },
  };
  if (children.length) payload.children = children;
  return api(`create page ${title}`, () => notion.pages.create(payload));
}

function selectOptions(spec) {
  if (spec.optionsKey) return SCHEMA[spec.optionsKey];
  return spec.options ?? [];
}

function toNotionProperties(properties) {
  const out = {};
  for (const [name, spec] of Object.entries(properties)) {
    switch (spec.type) {
      case "title":
        out[name] = { type: "title", title: {} };
        break;
      case "rich_text":
        out[name] = { type: "rich_text", rich_text: {} };
        break;
      case "date":
        out[name] = { type: "date", date: {} };
        break;
      case "checkbox":
        out[name] = { type: "checkbox", checkbox: {} };
        break;
      case "number":
        out[name] = { type: "number", number: { format: spec.format ?? "number" } };
        break;
      case "select":
        out[name] = { type: "select", select: { options: selectOptions(spec) } };
        break;
      case "unique_id":
        out[name] = { type: "unique_id", unique_id: { prefix: spec.prefix } };
        break;
      case "formula":
        out[name] = { type: "formula", formula: { expression: spec.expression } };
        break;
      default:
        fail(`Unknown property type ${spec.type} for ${name}`);
    }
  }
  return out;
}

async function createDatabase(spec) {
  const parentId = ctx.pages[spec.parent].id;
  const database = await api(`create database ${spec.title}`, () =>
    notion.databases.create({
      parent: { type: "page_id", page_id: parentId },
      title: [{ type: "text", text: { content: spec.title } }],
      icon: spec.icon ? { type: "emoji", emoji: spec.icon } : undefined,
      initial_data_source: {
        properties: toNotionProperties(spec.properties),
      },
    })
  );
  const dataSourceId = database.data_sources[0].id;
  const dataSource = await api(`retrieve data source ${spec.title}`, () =>
    notion.dataSources.retrieve({ data_source_id: dataSourceId })
  );
  return {
    databaseId: database.id,
    dataSourceId,
    url: database.url,
    properties: dataSource.properties,
  };
}

async function refreshDataSource(key) {
  const dataSource = await api(`refresh ${key}`, () =>
    notion.dataSources.retrieve({ data_source_id: ctx.dbs[key].dataSourceId })
  );
  ctx.dbs[key].properties = dataSource.properties;
}

async function addRelation(rel) {
  const from = ctx.dbs[rel.from];
  const to = ctx.dbs[rel.to];
  const relation = {
    data_source_id: to.dataSourceId,
    type: rel.type,
  };
  if (rel.type === "dual_property") {
    relation.dual_property = rel.syncedPropertyName
      ? { synced_property_name: rel.syncedPropertyName }
      : {};
  } else {
    relation.single_property = {};
  }
  await api(`relation ${rel.from}.${rel.name}`, () =>
    notion.dataSources.update({
      data_source_id: from.dataSourceId,
      properties: {
        [rel.name]: { type: "relation", relation },
      },
    })
  );
}

function propertyId(dbKey, name) {
  const prop = ctx.dbs[dbKey].properties[name];
  if (!prop) fail(`Property “${name}” not found on ${dbKey}`);
  return prop.id;
}

function hideConfig(dbKey, extraHide = []) {
  const names = new Set([
    ...(SCHEMA.internalProperties[dbKey] ?? []),
    ...extraHide,
  ]);
  return Object.entries(ctx.dbs[dbKey].properties).map(([name, prop]) => ({
    property_id: prop.id,
    visible: !names.has(name),
  }));
}

function resolveFilter(_dbKey, view) {
  if (view.filterKind === "upcomingDate") {
    return {
      property: view.dateProperty,
      date: { on_or_after: "today" },
    };
  }
  if (view.filterKind === "pastDate") {
    return {
      property: view.dateProperty,
      date: { before: "today" },
    };
  }
  return view.filter;
}

function viewConfiguration(dbKey, view) {
  const properties = hideConfig(dbKey, view.hideProperties ?? []);
  if (view.type === "table") {
    return { type: "table", properties, wrap_cells: true };
  }
  if (view.type === "board") {
    return {
      type: "board",
      properties,
      group_by: {
        type: view.groupBy.type,
        property_id: propertyId(dbKey, view.groupBy.property),
        sort: { type: "manual" },
        hide_empty_groups: false,
      },
    };
  }
  if (view.type === "timeline") {
    const config = {
      type: "timeline",
      date_property_id: propertyId(dbKey, view.dateProperty),
      end_date_property_id: propertyId(dbKey, view.endDateProperty),
      properties,
      show_table: view.showTable ?? true,
      table_properties: properties,
      preference: { zoom_level: "month" },
      color_by: view.colorBy ?? true,
    };
    if (view.arrowsBy && ctx.dbs[dbKey].properties[view.arrowsBy]) {
      config.arrows_by = { property_id: propertyId(dbKey, view.arrowsBy) };
    }
    return config;
  }
  return { type: view.type, properties };
}

async function viewsCreate(body) {
  if (notion.views?.create) return notion.views.create(body);
  return notion.request({ method: "post", path: "views", body });
}

async function viewsUpdate(body) {
  const { view_id, ...rest } = body;
  if (notion.views?.update) return notion.views.update(body);
  return notion.request({ method: "patch", path: `views/${view_id}`, body: rest });
}

async function viewsRetrieve(viewId) {
  if (notion.views?.retrieve) return notion.views.retrieve({ view_id: viewId });
  return notion.request({ method: "get", path: `views/${viewId}` });
}

async function listViews(databaseId) {
  const response = await api("list views", () => {
    if (notion.views?.list) return notion.views.list({ database_id: databaseId });
    return notion.request({
      method: "get",
      path: "views",
      query: { database_id: databaseId },
    });
  });
  const detailed = [];
  for (const item of response.results) {
    detailed.push(await api("retrieve view", () => viewsRetrieve(item.id)));
  }
  return detailed;
}

async function createViewsForDatabase(dbKey, spec) {
  const { databaseId, dataSourceId } = ctx.dbs[dbKey];
  const existing = await listViews(databaseId);
  const defaultView = existing.find((view) => view.type === "table") ?? existing[0];

  for (const view of spec.views) {
    const payload = {
      data_source_id: dataSourceId,
      name: view.name,
      type: view.type,
      configuration: viewConfiguration(dbKey, view),
    };
    const filter = resolveFilter(dbKey, view);
    if (filter) payload.filter = filter;
    if (view.sorts) payload.sorts = view.sorts;

    if (view.replaceDefault && defaultView) {
      const updateBody = {
        view_id: defaultView.id,
        name: view.name,
        configuration: payload.configuration,
        filter: filter ?? null,
      };
      if (view.sorts) updateBody.sorts = view.sorts;
      await api(`update view ${view.name}`, () => viewsUpdate(updateBody));
    } else {
      payload.database_id = databaseId;
      await api(`create view ${view.name}`, () => viewsCreate(payload));
    }
  }
}

function titleProp(content) {
  return { title: [{ type: "text", text: { content } }] };
}

function textProp(content) {
  if (!content) return { rich_text: [] };
  return { rich_text: [{ type: "text", text: { content: String(content) } }] };
}

function selectProp(name) {
  return { select: { name } };
}

function checkboxProp(value) {
  return { checkbox: Boolean(value) };
}

function numberProp(value) {
  return { number: value };
}

function relationProp(ids) {
  return { relation: ids.filter(Boolean).map((id) => ({ id })) };
}

async function createRow(dbKey, properties) {
  return api("create row", () =>
    notion.pages.create({
      parent: { type: "data_source_id", data_source_id: ctx.dbs[dbKey].dataSourceId },
      properties,
    })
  );
}

async function seedMilestones() {
  const ids = {};
  for (const [index, row] of SCHEMA.milestones.entries()) {
    const page = await createRow("milestones", {
      "Milestone Name": titleProp(row.name),
      Phase: selectProp(row.phase),
      Description: textProp(row.description),
      Deliverables: textProp(row.deliverables),
      Status: selectProp(row.status),
      Priority: selectProp(row.priority),
      "Progress %": numberProp(row.progress),
      "Client Review Required": checkboxProp(row.clientReview),
      "Client Approval Required": checkboxProp(row.clientApproval),
      Order: numberProp(index + 1),
    });
    ids[row.phase] = page.id;
  }
  return ids;
}

async function seedWeek01(milestoneIds) {
  const page = await createRow("weekly", {
    Week: titleProp("Week 01"),
    Objective: textProp(
      "Confirm working cadence, access, and how progress will be reviewed each week."
    ),
    "Planned Work": textProp(
      "Walk through this workspace with the client and agree how status, decisions, and approvals will be tracked."
    ),
    Deliverables: textProp("Shared project dashboard and agreed weekly review format."),
    "Demo Items": textProp(
      "Show the PVI Project Dashboard and Client Portal. Agree what “done for the week” looks like."
    ),
    Status: selectProp("In Progress"),
    "Progress %": numberProp(0),
    "Client Review": selectProp("Pending"),
    "Next Week Plan": textProp("Set dates on milestones once the delivery calendar is agreed."),
    Milestone: relationProp([milestoneIds["Project Initiation"]]),
  });
  return page.id;
}

async function seedBilling(milestoneIds) {
  for (const row of SCHEMA.milestones) {
    await createRow("billing", {
      "Invoice/Milestone ID": titleProp(`${row.name} — billing`),
      "Payment Status": selectProp("Upcoming"),
      Milestone: relationProp([milestoneIds[row.phase]]),
    });
  }
}

async function seedAgreement() {
  await createRow("documents", {
    "Document Name": titleProp("Software Development Agreement"),
    "Document Type": selectProp("Agreement"),
    Version: textProp("Signed"),
    Status: selectProp("Approved"),
    Owner: selectProp("Consultant"),
    "Client Review Required": checkboxProp(false),
    "Client Approval Required": checkboxProp(false),
    "Client Notes": textProp(
      "Signed agreement is on file. Upload the PDF to this row in Notion when convenient."
    ),
  });
}

async function seedProjectControl(milestoneIds, week01Id) {
  await createRow("projectControl", {
    "Project Name": titleProp("PVI"),
    Overview: textProp(
      "PVI software project. Delivery is tracked by milestone and reviewed with the client each week."
    ),
    "Consultant Role": textProp("Solo software consultant / agency owner"),
    "Communication Cadence": textProp("Weekly demo and written status report"),
    "Overall Status": selectProp("On Track"),
    "Overall Progress": numberProp(0),
    "Current Phase": relationProp([milestoneIds["Project Initiation"]]),
    "Current Milestone": relationProp([milestoneIds["Project Initiation"]]),
    "Next Milestone": relationProp([milestoneIds["Requirement Analysis"]]),
    "Current Week": relationProp([week01Id]),
  });
}

function paragraph(text) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: [{ type: "text", text: { content: text } }] },
  };
}

function heading(level, text) {
  const type = `heading_${level}`;
  return {
    object: "block",
    type,
    [type]: { rich_text: [{ type: "text", text: { content: text } }] },
  };
}

function callout(text, emoji, color = "gray_background") {
  return {
    object: "block",
    type: "callout",
    callout: {
      icon: { type: "emoji", emoji },
      color,
      rich_text: [{ type: "text", text: { content: text } }],
    },
  };
}

function bullet(text) {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [{ type: "text", text: { content: text } }] },
  };
}

function divider() {
  return { object: "block", type: "divider", divider: {} };
}

async function appendBlocks(pageId, children) {
  for (let i = 0; i < children.length; i += 90) {
    const chunk = children.slice(i, i + 90);
    await api("append blocks", () =>
      notion.blocks.children.append({ block_id: pageId, children: chunk })
    );
  }
}

async function headingMap(pageId) {
  const children = await listBlockChildren(pageId);
  const map = {};
  for (const block of children) {
    const type = block.type;
    if (!type?.startsWith("heading_")) continue;
    const text = (block[type].rich_text ?? []).map((t) => t.plain_text).join("");
    map[text] = block.id;
  }
  return map;
}

async function addLinkedView({ pageId, afterHeading, afterBlockId, dbKey, name, type = "table", filter, sorts, extraHide = [], dateProperty, endDateProperty, arrowsBy, colorBy, showTable, groupBy }) {
  const after = afterBlockId ?? (afterHeading ? ctx.headingIds[afterHeading] : undefined);
  const payload = {
    create_database: {
      parent: { type: "page_id", page_id: pageId },
      ...(after ? { position: { type: "after_block", block_id: after } } : {}),
    },
    data_source_id: ctx.dbs[dbKey].dataSourceId,
    name,
    type,
    configuration: viewConfiguration(dbKey, {
      type,
      hideProperties: extraHide,
      dateProperty,
      endDateProperty,
      arrowsBy,
      colorBy,
      showTable,
      groupBy,
    }),
  };
  if (filter) payload.filter = filter;
  if (sorts) payload.sorts = sorts;
  const view = await api(`linked view ${name}`, () => viewsCreate(payload));
  return view;
}

function linkedDbId(view) {
  return view?.parent?.database_id ?? view?.parent?.page_id;
}

async function buildDashboard() {
  const pageId = ctx.pages.dashboard.id;
  await appendBlocks(pageId, [
    callout(
      "Internal dashboard — do not share this page with the client. Share Client Portal instead (Comment-only).",
      "🔒",
      "red_background"
    ),
    paragraph(
      "Update Project Control each Monday. The linked views below read live from the databases."
    ),
    heading(2, "How we work"),
    paragraph(
      "Project Planning → Milestone → Weekly Plan → Development → Testing → Weekly Demo → Client Feedback → Decision/Approval → Update Plan → Next Week"
    ),
    paragraph(
      "GitHub and Cursor are used for development. This workspace is for project management only."
    ),
    divider(),
    heading(2, "1. Project Overview"),
    paragraph("Project name, client-facing summary, role, and cadence. Edit the Project Control row."),
    heading(2, "2. Overall Project Status"),
    paragraph("On Track / At Risk / Off Track — set on Project Control."),
    heading(2, "3. Current Phase"),
    paragraph("Relation on Project Control. Keep this aligned with the in-progress milestone."),
    heading(2, "4. Current Week"),
    paragraph("Relation on Project Control. Point this at the Weekly Delivery row that is In Progress."),
    heading(2, "5. Overall Progress"),
    paragraph("Percent complete for the whole project (0–100). Update when a milestone finishes."),
    heading(2, "6. Current Milestone"),
    heading(2, "7. Next Milestone"),
    heading(2, "8. This Week's Objectives"),
    heading(2, "9. Completed This Week"),
    heading(2, "10. In Progress"),
    heading(2, "11. Client Decisions Required"),
    heading(2, "12. Approvals Pending"),
    heading(2, "13. Risks / Blockers"),
    heading(2, "14. Upcoming Meeting"),
    heading(2, "15. Billing Summary"),
    heading(2, "16. Upcoming Deliverables"),
    heading(2, "17. Important Documents"),
  ]);

  ctx.headingIds = await headingMap(pageId);

  await addLinkedView({
    pageId,
    afterHeading: "1. Project Overview",
    dbKey: "projectControl",
    name: "Project Control",
  });
  await addLinkedView({
    pageId,
    afterHeading: "6. Current Milestone",
    dbKey: "milestones",
    name: "Current Milestone",
    filter: { property: "Status", select: { equals: "In Progress" } },
  });
  await addLinkedView({
    pageId,
    afterHeading: "7. Next Milestone",
    dbKey: "milestones",
    name: "Next Milestone",
    filter: { property: "Status", select: { equals: "Not Started" } },
    sorts: [{ property: "Order", direction: "ascending" }],
  });
  await addLinkedView({
    pageId,
    afterHeading: "8. This Week's Objectives",
    dbKey: "weekly",
    name: "This Week",
    filter: { property: "Status", select: { equals: "In Progress" } },
  });
  await addLinkedView({
    pageId,
    afterHeading: "9. Completed This Week",
    dbKey: "weekly",
    name: "Completed This Week",
    filter: { property: "Status", select: { equals: "In Progress" } },
  });
  await addLinkedView({
    pageId,
    afterHeading: "10. In Progress",
    dbKey: "milestones",
    name: "Milestones In Progress",
    filter: { property: "Status", select: { equals: "In Progress" } },
  });
  await addLinkedView({
    pageId,
    afterHeading: "11. Client Decisions Required",
    dbKey: "meetings",
    name: "Pending Decisions",
    filter: {
      and: [
        { property: "Decisions", rich_text: { is_not_empty: true } },
        { property: "Approval Status", select: { equals: "Pending" } },
      ],
    },
  });
  const approvals = await addLinkedView({
    pageId,
    afterHeading: "12. Approvals Pending",
    dbKey: "documents",
    name: "Documents Pending Approval",
    filter: { property: "Status", select: { equals: "Pending Approval" } },
  });
  const crApprovals = await addLinkedView({
    pageId,
    afterBlockId: linkedDbId(approvals),
    dbKey: "changeRequests",
    name: "Change Requests Pending Approval",
    filter: { property: "Approval Status", select: { equals: "Pending" } },
  });
  await addLinkedView({
    pageId,
    afterBlockId: linkedDbId(crApprovals) ?? linkedDbId(approvals),
    dbKey: "meetings",
    name: "Meeting Approvals Pending",
    filter: {
      and: [
        { property: "Client Approval Required", checkbox: { equals: true } },
        { property: "Approval Status", select: { equals: "Pending" } },
      ],
    },
  });
  const activeRisks = await addLinkedView({
    pageId,
    afterHeading: "13. Risks / Blockers",
    dbKey: "risks",
    name: "Active Risks",
    filter: {
      and: [
        { property: "Type", select: { equals: "Risk" } },
        { property: "Status", select: { equals: "Active" } },
      ],
    },
  });
  await addLinkedView({
    pageId,
    afterBlockId: linkedDbId(activeRisks),
    dbKey: "risks",
    name: "Open Blockers",
    filter: {
      and: [
        { property: "Type", select: { equals: "Blocker" } },
        { property: "Status", select: { does_not_equal: "Resolved" } },
      ],
    },
  });
  await addLinkedView({
    pageId,
    afterHeading: "14. Upcoming Meeting",
    dbKey: "meetings",
    name: "Upcoming Meetings",
    filter: { property: "Date", date: { on_or_after: "today" } },
    sorts: [{ property: "Date", direction: "ascending" }],
  });
  await addLinkedView({
    pageId,
    afterHeading: "15. Billing Summary",
    dbKey: "billing",
    name: "Billing Overview",
  });
  const weekDeliverables = await addLinkedView({
    pageId,
    afterHeading: "16. Upcoming Deliverables",
    dbKey: "weekly",
    name: "This Week Deliverables",
    filter: { property: "Status", select: { equals: "In Progress" } },
  });
  await addLinkedView({
    pageId,
    afterBlockId: linkedDbId(weekDeliverables),
    dbKey: "milestones",
    name: "Milestone Deliverables",
    filter: {
      or: [
        { property: "Status", select: { equals: "In Progress" } },
        { property: "Status", select: { equals: "Not Started" } },
      ],
    },
    sorts: [{ property: "Order", direction: "ascending" }],
  });
  await addLinkedView({
    pageId,
    afterHeading: "17. Important Documents",
    dbKey: "documents",
    name: "Important Documents",
    filter: { property: "Status", select: { equals: "Approved" } },
  });
}

async function buildClientPortal() {
  const pageId = ctx.pages.clientPortal.id;
  await appendBlocks(pageId, [
    callout(
      "Client view. Share this page only, as Can comment. Do not share the parent page, Internal Dashboard, or Internal Notes.",
      "👁️",
      "blue_background"
    ),
    paragraph(
      "This page shows delivery progress, upcoming work, decisions, approvals, and billing status. Private implementation notes and internal estimates are not shown here."
    ),
    heading(2, "Timeline"),
    heading(2, "Milestones"),
    heading(2, "Weekly progress"),
    heading(2, "Deliverables"),
    heading(2, "Meeting history"),
    heading(2, "Pending decisions"),
    heading(2, "Required approvals"),
    heading(2, "Approved change requests"),
    heading(2, "Billing status"),
    heading(2, "Upcoming activities"),
  ]);

  ctx.headingIds = await headingMap(pageId);

  await addLinkedView({
    pageId,
    afterHeading: "Timeline",
    dbKey: "milestones",
    name: "Project Timeline",
    type: "timeline",
    dateProperty: "Start Date",
    endDateProperty: "End Date",
    arrowsBy: "Dependencies",
    colorBy: true,
    showTable: true,
  });
  await addLinkedView({
    pageId,
    afterHeading: "Milestones",
    dbKey: "milestones",
    name: "Milestones",
    sorts: [{ property: "Order", direction: "ascending" }],
  });
  const currentWeekView = await addLinkedView({
    pageId,
    afterHeading: "Weekly progress",
    dbKey: "weekly",
    name: "Current Week",
    filter: { property: "Status", select: { equals: "In Progress" } },
  });
  await addLinkedView({
    pageId,
    afterBlockId: linkedDbId(currentWeekView),
    dbKey: "weekly",
    name: "Completed Weeks",
    filter: { property: "Status", select: { equals: "Completed" } },
    sorts: [{ property: "Week ID", direction: "descending" }],
  });
  await addLinkedView({
    pageId,
    afterHeading: "Deliverables",
    dbKey: "weekly",
    name: "This Week Deliverables",
    filter: { property: "Status", select: { equals: "In Progress" } },
  });
  await addLinkedView({
    pageId,
    afterHeading: "Meeting history",
    dbKey: "meetings",
    name: "Meeting History",
    filter: { property: "Date", date: { before: "today" } },
    sorts: [{ property: "Date", direction: "descending" }],
  });
  await addLinkedView({
    pageId,
    afterHeading: "Pending decisions",
    dbKey: "meetings",
    name: "Pending Decisions",
    filter: {
      and: [
        { property: "Decisions", rich_text: { is_not_empty: true } },
        { property: "Approval Status", select: { equals: "Pending" } },
      ],
    },
  });
  const clientDocApprovals = await addLinkedView({
    pageId,
    afterHeading: "Required approvals",
    dbKey: "documents",
    name: "Documents Pending Approval",
    filter: { property: "Status", select: { equals: "Pending Approval" } },
  });
  await addLinkedView({
    pageId,
    afterBlockId: linkedDbId(clientDocApprovals),
    dbKey: "meetings",
    name: "Approvals Pending",
    filter: {
      and: [
        { property: "Client Approval Required", checkbox: { equals: true } },
        { property: "Approval Status", select: { equals: "Pending" } },
      ],
    },
  });
  await addLinkedView({
    pageId,
    afterHeading: "Approved change requests",
    dbKey: "changeRequests",
    name: "Approved Change Requests",
    filter: { property: "Approval Status", select: { equals: "Approved" } },
  });
  await addLinkedView({
    pageId,
    afterHeading: "Billing status",
    dbKey: "billing",
    name: "Billing Status",
  });
  const upcomingMilestones = await addLinkedView({
    pageId,
    afterHeading: "Upcoming activities",
    dbKey: "milestones",
    name: "Upcoming Milestones",
    filter: { property: "Status", select: { equals: "Not Started" } },
    sorts: [{ property: "Order", direction: "ascending" }],
  });
  const upcomingMeetings = await addLinkedView({
    pageId,
    afterBlockId: linkedDbId(upcomingMilestones),
    dbKey: "meetings",
    name: "Upcoming Meetings",
    filter: { property: "Date", date: { on_or_after: "today" } },
    sorts: [{ property: "Date", direction: "ascending" }],
  });
  await addLinkedView({
    pageId,
    afterBlockId: linkedDbId(upcomingMeetings) ?? linkedDbId(upcomingMilestones),
    dbKey: "weekly",
    name: "Upcoming Deliverables",
    filter: { property: "Status", select: { equals: "In Progress" } },
  });
}

function emptyBullet() {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [{ type: "text", text: { content: "—" } }] },
  };
}

function labeledParagraph(label) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [
        { type: "text", text: { content: `${label} ` }, annotations: { bold: true } },
      ],
    },
  };
}

async function buildWeeklyReportTemplate() {
  const page = await createPage(
    ctx.pages.templates.id,
    "PVI — Weekly Status Report",
    "📝",
    [
      callout(
        "Duplicate this page into Weekly Reports each Friday (or after the demo). Keep it to one page. Write for the client — no internal estimates or engineering jargon.",
        "📝",
        "gray_background"
      ),
      labeledParagraph("Reporting Period:"),
      labeledParagraph("Overall Status:"),
      labeledParagraph("Overall Progress:"),
      heading(3, "Completed This Week"),
      emptyBullet(),
      heading(3, "In Progress"),
      emptyBullet(),
      heading(3, "Planned for Next Week"),
      emptyBullet(),
      heading(3, "Demo / Review"),
      emptyBullet(),
      heading(3, "Client Decisions Required"),
      emptyBullet(),
      heading(3, "Approvals Required"),
      emptyBullet(),
      heading(3, "Risks / Blockers"),
      emptyBullet(),
      heading(3, "Scope / Change Requests"),
      emptyBullet(),
      heading(3, "Billing Status"),
      emptyBullet(),
      heading(3, "Upcoming Milestone"),
      emptyBullet(),
      heading(3, "Client Action Items"),
      emptyBullet(),
    ]
  );

  await appendBlocks(ctx.pages.weeklyReports.id, [
    callout(
      "Duplicate “PVI — Weekly Status Report” from Templates into this page each week. Keep reports in date order.",
      "📝",
      "gray_background"
    ),
    {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          { type: "text", text: { content: "Template: " } },
          {
            type: "mention",
            mention: { type: "page", page: { id: page.id } },
          },
        ],
      },
    },
  ]);

  await createPage(ctx.pages.templates.id, "New Week", "📅", [
    callout(
      "When you add a Weekly Delivery row, copy this checklist. Duplicate Week 01 if that is faster.",
      "📅",
      "gray_background"
    ),
    paragraph("Required before the week starts:"),
    bullet("Week title (Week 02, Week 03, …)"),
    bullet("Objective — one sentence the client can understand"),
    bullet("Demo Items — something demonstrable or reviewable this week"),
    bullet("Deliverables — what will be handed over or shown"),
    bullet("Status = In Progress (and set last week to Completed or Client Review)"),
    bullet("Link the Milestone"),
    paragraph("Then update Project Control → Current Week to this new row."),
  ]);
}

async function buildHowToPage() {
  await appendBlocks(ctx.pages.howTo.id, [
    paragraph(
      "This workspace is the project-management layer for PVI. Use it as a solo consultant so the client always knows what is done, what is in play this week, and what they need to decide."
    ),
    heading(2, "Share the right page"),
    bullet("You work from PVI Project Dashboard."),
    bullet("The client only receives Client Portal, invited as Can comment."),
    bullet("Never share the parent page, Internal Notes, or this how-to page."),
    bullet(
      "Internal Notes, estimates, and personal commentary stay in Internal Notes or the Internal Notes property — those columns are hidden on the client portal."
    ),
    heading(2, "Monday (about 15 minutes)"),
    bullet("Open Project Control. Set Current Week, Current Phase, Current Milestone, and Next Milestone."),
    bullet("Open this week’s Weekly Delivery row. Fill Objective, Planned Work, Demo Items, and Deliverables."),
    bullet("Every week must have one thing the client can see or review."),
    heading(2, "During the week"),
    bullet("Log a blocker the day it appears (Risks & Blockers)."),
    bullet("Put decisions and approvals in Meetings or Change Requests — not only in chat."),
    bullet("Keep development work in GitHub and Cursor. Do not turn Weekly Delivery into a task tracker."),
    heading(2, "Before the demo"),
    bullet("Duplicate PVI — Weekly Status Report into Weekly Reports."),
    bullet("Fill it from the dashboard. One page, client language."),
    heading(2, "After the demo"),
    bullet("Add a Meetings row: decisions, owners, due dates, approval status."),
    bullet("Update Progress % and Status on the week and the current milestone."),
    heading(2, "Friday"),
    bullet("Mark the week Completed or Client Review."),
    bullet("Write Next Week Plan. Create the next Weekly Delivery row if needed — one week ahead is enough."),
    heading(2, "When scope changes"),
    bullet("Add a Change Request before doing the extra work."),
    bullet("Only Approved change requests appear on the Client Portal."),
    heading(2, "When billing happens"),
    bullet("Fill dates and amounts in Billing Tracker. Amount fields were left empty on purpose."),
    heading(2, "Filling dates"),
    bullet("Milestone Start Date and End Date are empty until you agree a calendar. The Timeline view fills in once those dates exist."),
    heading(2, "What this workspace is not"),
    bullet("Not a requirements specification, architecture pack, or development backlog."),
    bullet("Not connected to Jira or GitHub."),
  ]);
}
