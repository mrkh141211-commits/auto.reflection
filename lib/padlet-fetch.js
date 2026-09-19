// padlet-fetch.js
// Padlet の公式APIからボードの投稿を取得する。
// ※Padletの投稿本文は attributes.content の中（subject/bodyHtml など）に入っている。

const BASE = "https://api.padlet.dev/v1";

export async function fetchBoard(boardId = process.env.PADLET_BOARD_ID) {
  if (!process.env.PADLET_API_KEY) throw new Error("PADLET_API_KEY が未設定です");
  if (!boardId) throw new Error("PADLET_BOARD_ID が未設定です");

  const res = await fetch(`${BASE}/boards/${boardId}?include=posts`, {
    headers: {
      "X-API-KEY": process.env.PADLET_API_KEY,
      "Content-Type": "application/vnd.api+json",
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Padlet API エラー(${res.status}): ${JSON.stringify(data)}`);
  return data;
}

// content の中から本文テキストを取り出す（Padletは content.subject / content.bodyHtml などに入れる）
function textFromContent(content) {
  if (!content) return { subject: "", body: "" };
  const subject = content.subject || content.title || "";
  // 本文候補をいくつか見る。HTMLならタグを軽く除去
  let body = content.body || content.bodyHtml || content.bodyText || content.text || "";
  body = String(body).replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
  return { subject: String(subject).trim(), body };
}

export function extractPosts(board) {
  const included = board.included || [];
  return included
    .filter((r) => r.type === "post")
    .map((r) => {
      const a = r.attributes || {};
      const { subject, body } = textFromContent(a.content);
      return {
        id: r.id,
        subject,
        body,
        createdAt: a.createdAt || a.created_at || null,
        sortIndex: a.sortIndex ?? 0,
      };
    });
}

export async function fetchReflections({ sinceDays = 3, boardId } = {}) {
  const board = await fetchBoard(boardId);
  let posts = extractPosts(board);

  if (sinceDays && posts.some((p) => p.createdAt)) {
    const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
    posts = posts.filter((p) => !p.createdAt || new Date(p.createdAt).getTime() >= cutoff);
  }

  // 新しい順（createdAtがあれば新しい順、無ければ sortIndex 順）に整える
  posts.sort((x, y) => {
    if (x.createdAt && y.createdAt) return new Date(y.createdAt) - new Date(x.createdAt);
    return (y.sortIndex ?? 0) - (x.sortIndex ?? 0);
  });

  const chunks = posts
    .map((p) => [p.subject, p.body].filter(Boolean).join("\n"))
    .filter((s) => s.trim().length > 0);

  return chunks.join("\n\n---\n\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fetchReflections({ sinceDays: 1000 })
    .then((text) => { console.log("取得文字数:", text.length); console.log(text.slice(0, 400)); })
    .catch((err) => console.error("失敗:", err.message));
}
