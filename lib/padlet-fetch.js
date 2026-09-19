// padlet-fetch.js （デバッグ版：Padletの応答構造をログに出す）
const BASE = "https://api.padlet.dev/v1";

export async function fetchBoard(boardId = process.env.PADLET_BOARD_ID) {
  if (!process.env.PADLET_API_KEY) throw new Error("PADLET_API_KEY が未設定です");
  if (!boardId) throw new Error("PADLET_BOARD_ID が未設定です");

  const url = `${BASE}/boards/${boardId}?include=posts`;
  console.log("▶ 取得URL:", url);

  const res = await fetch(url, {
    headers: {
      "X-API-KEY": process.env.PADLET_API_KEY,
      "Content-Type": "application/vnd.api+json",
    },
  });

  const data = await res.json();
  console.log("▶ HTTPステータス:", res.status);
  console.log("▶ 応答のトップレベルのキー:", Object.keys(data));
  if (data.data) console.log("▶ data のキー:", Object.keys(data.data));
  if (data.included) {
    console.log("▶ included の件数:", data.included.length);
    const types = [...new Set(data.included.map(r => r.type))];
    console.log("▶ included に含まれる type:", types);
    const firstPost = data.included.find(r => r.type === "post");
    if (firstPost) {
      console.log("▶ 最初のpostのattributesキー:", Object.keys(firstPost.attributes || {}));
      console.log("▶ 最初のpostのattributes中身:", JSON.stringify(firstPost.attributes).slice(0, 500));
    } else {
      console.log("▶ included に type:post が見つからない");
    }
  } else {
    console.log("▶ included が存在しない。応答全体（先頭1500字）:");
    console.log(JSON.stringify(data).slice(0, 1500));
  }

  if (!res.ok) throw new Error(`Padlet API エラー(${res.status}): ${JSON.stringify(data)}`);
  return data;
}

export function extractPosts(board) {
  const included = board.included || [];
  return included
    .filter((r) => r.type === "post")
    .map((r) => {
      const a = r.attributes || {};
      return {
        id: r.id,
        subject: a.subject || "",
        body: a.body || a.bodyHtml || a.content || "",
        createdAt: a.createdAt || a.created_at || a.publishedAt || null,
      };
    });
}

export async function fetchReflections({ sinceDays = 3, boardId } = {}) {
  const board = await fetchBoard(boardId);
  let posts = extractPosts(board);
  console.log("▶ 取り出せた投稿数:", posts.length);

  if (sinceDays && posts.some((p) => p.createdAt)) {
    const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
    posts = posts.filter((p) => !p.createdAt || new Date(p.createdAt).getTime() >= cutoff);
    console.log("▶ 日付フィルタ後の投稿数:", posts.length);
  }

  if (!posts.length) return "";

  return posts
    .map((p) => [p.subject, p.body].filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n---\n\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fetchReflections({ sinceDays: 1000 })
    .then((text) => { console.log("取得文字数:", text.length); console.log(text.slice(0, 300)); })
    .catch((err) => console.error("失敗:", err.message));
}
