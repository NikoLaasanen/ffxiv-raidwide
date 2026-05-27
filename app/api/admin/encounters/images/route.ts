import fs from "node:fs";
import path from "node:path";

export async function GET(): Promise<Response> {
  try {
    const dir = path.join(process.cwd(), "public", "encounters");
    const files = fs.readdirSync(dir).filter((f) => !f.startsWith("."));
    return Response.json({ images: files });
  } catch {
    return Response.json({ images: [] });
  }
}
