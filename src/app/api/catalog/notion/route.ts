import { NextResponse } from "next/server";
import { deleteCatalogFromNotion, pushCatalogToNotion } from "@/lib/notion";

export async function POST() {
  try {
    const result = await pushCatalogToNotion();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to push catalog to Notion.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE() {
  try {
    const result = await deleteCatalogFromNotion();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove catalog from Notion.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
