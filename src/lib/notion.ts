import { getScenarioFolders, getScenarios, scenarioStatus, type Scenario } from "./make";
import { groupScenariosByFolder } from "./catalog";

const NOTION_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const CATALOG_PAGE_TITLE = "Automation Catalog";

// Keep each blocks-append call comfortably under Notion's 100-block-per-request limit.
const APPEND_BATCH_SIZE = 90;

function token(): string {
  const t = process.env.NOTION_TOKEN;
  if (!t) throw new Error("NOTION_TOKEN is not set");
  return t;
}

function normalizePageId(id: string): string {
  const hex = id.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) return id;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function parentPageId(): string {
  const id = process.env.NOTION_AUTOMATION_DOCS_PAGE_ID;
  if (!id) throw new Error("NOTION_AUTOMATION_DOCS_PAGE_ID is not set");
  return normalizePageId(id);
}

async function notionRequest(path: string, init: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(`${NOTION_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Notion API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

type NotionBlock = Record<string, unknown>;

function richText(content: string) {
  return [{ type: "text", text: { content } }];
}

function heading2Block(content: string): NotionBlock {
  return { object: "block", type: "heading_2", heading_2: { rich_text: richText(content) } };
}

function tableRowBlock(cells: string[]): NotionBlock {
  return { object: "block", type: "table_row", table_row: { cells: cells.map(richText) } };
}

function scenarioTableRow(s: Scenario): NotionBlock {
  const lastEdit = new Date(s.lastEdit).toLocaleDateString();
  const nextExec = s.nextExec ? new Date(s.nextExec).toLocaleString() : "—";
  const status = scenarioStatus(s);
  return tableRowBlock([s.name, status.charAt(0).toUpperCase() + status.slice(1), lastEdit, nextExec]);
}

function folderTableBlock(scenarios: Scenario[]): NotionBlock {
  return {
    object: "block",
    type: "table",
    table: {
      table_width: 4,
      has_column_header: true,
      has_row_header: false,
      children: [tableRowBlock(["Name", "Status", "Last edited", "Next run"]), ...scenarios.map(scenarioTableRow)],
    },
  };
}

async function findCatalogPage(): Promise<{ id: string } | null> {
  let cursor: string | undefined;
  do {
    const qs = cursor ? `?page_size=100&start_cursor=${cursor}` : "?page_size=100";
    const data = await notionRequest(`/blocks/${parentPageId()}/children${qs}`, { method: "GET" });
    const results = (data.results ?? []) as Array<Record<string, unknown>>;
    for (const block of results) {
      if (block.type === "child_page") {
        const childPage = block.child_page as { title?: string } | undefined;
        if (childPage?.title === CATALOG_PAGE_TITLE) {
          return { id: block.id as string };
        }
      }
    }
    cursor = data.has_more ? (data.next_cursor as string) : undefined;
  } while (cursor);
  return null;
}

async function archivePage(pageId: string): Promise<void> {
  await notionRequest(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ archived: true }),
  });
}

async function createCatalogPage(): Promise<{ url: string; scenarioCount: number; folderCount: number }> {
  const [scenarios, folders] = await Promise.all([getScenarios(), getScenarioFolders()]);
  const groups = groupScenariosByFolder(scenarios, folders);
  const generatedAt = new Date().toLocaleString();

  const page = await notionRequest("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { page_id: parentPageId() },
      properties: {
        title: { type: "title", title: richText(CATALOG_PAGE_TITLE) },
      },
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: richText(
              `Last synced ${generatedAt} from Make.com. ${scenarios.length} scenarios across ${groups.length} folders.`
            ),
          },
        },
      ],
    }),
  });

  let batch: NotionBlock[] = [];
  async function flush() {
    if (batch.length === 0) return;
    await notionRequest(`/blocks/${page.id}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: batch }),
    });
    batch = [];
  }

  for (const group of groups) {
    const blocks = [heading2Block(`${group.name} (${group.scenarios.length})`), folderTableBlock(group.scenarios)];
    if (batch.length + blocks.length > APPEND_BATCH_SIZE) await flush();
    batch.push(...blocks);
  }
  await flush();

  return { url: page.url as string, scenarioCount: scenarios.length, folderCount: groups.length };
}

export async function pushCatalogToNotion(): Promise<{
  url: string;
  scenarioCount: number;
  folderCount: number;
  replaced: boolean;
}> {
  const existing = await findCatalogPage();
  if (existing) await archivePage(existing.id);
  const created = await createCatalogPage();
  return { ...created, replaced: existing !== null };
}

export async function deleteCatalogFromNotion(): Promise<{ deleted: boolean }> {
  const existing = await findCatalogPage();
  if (!existing) return { deleted: false };
  await archivePage(existing.id);
  return { deleted: true };
}
