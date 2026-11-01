import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Lists a public ("Anyone with the link") Drive folder without any API key,
// by reading Google's embedded folder view.
export const listDriveFolder = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ folderId: z.string().regex(/^[\w-]{10,100}$/) }).parse(i))
  .handler(async ({ data }) => {
    const res = await fetch(
      `https://drive.google.com/embeddedfolderview?id=${data.folderId}#list`,
      { headers: { "User-Agent": "Mozilla/5.0" } },
    );
    if (!res.ok) throw new Error(`Google Drive responded ${res.status}. Is the folder public?`);
    const html = await res.text();
    const files: { id: string; name: string }[] = [];
    const re = /id="entry-([\w-]+)"[\s\S]*?class="flip-entry-title">([^<]+)</g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const name = (m[2] ?? "")
        .replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
      files.push({ id: m[1] ?? "", name });
    }
    return files;
  });
