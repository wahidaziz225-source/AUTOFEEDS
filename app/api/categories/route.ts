import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const rows = getDb()
    .prepare("SELECT id, name FROM categories ORDER BY name")
    .all();
  return NextResponse.json({ categories: rows });
}