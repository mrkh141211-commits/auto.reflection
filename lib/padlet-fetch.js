// padlet-fetch.js
// Padlet の公式 API からボードの投稿（リフレクション）を取得する。
// パイプラインの先頭。ここで取ったテキストを suggest-topics.js に渡す。
//
// 必要な環境変数:
//   PADLET_API_KEY  … Padlet のAPIキー（ダッシュボード → 設定 → 開発者 で生成。要有料サブスク）
//   PADLET_BOARD_ID … 対象ボードのID（そのボードを開き ...メニュー → Developer で確認。16〜22文字）
//
// メモ:
// - この API は Padlet の有料サブスクが必要で、対象ボードの管理者/オーナーであることが条件です。
//   キーを生成できない場合はサブスクが要件を満たしていない可能性があります（その場合は RSS 版に切替）。
// - レスポンスは JSON:API 形式。投稿は included 配列に type:"post" として入り、
//   本文は attributes.subject（件名）と attributes.body（本文）に入ります。

const BASE = "https://api.padlet.dev/v1";

/**
 * ボード全体を取得する（投稿を含む）。
 * @param {string} boardId
 * @returns {Promise<object>} JSON:API 形式のボードデータ
 */
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

/**
 * ボードデータから投稿を取り出す。
 * @param {object} board fetchBoard の戻り値
 * @returns {Array<{id:string, subject:string, body:string, createdAt:string|null}>}
 */
export function extractPosts(board) {
  const included = board.included || [];
  return included
    .filter((r) => r.type === "post")
    .map((r) => {
      const a = r.attributes || {};
      return {
        id: r.id,
        subject: a.subject || "",
        body: a.body || "",
        // 日付フィールド名は環境で異なる場合があります。実データを見て合わせてください
        // （post-object のドキュメント参照）。
        createdAt: a.createdAt || a.created_at || a.publishedAt || null,
      };
    });
}

/**
 * 直近 sinceDays 日分のリフレクションを1つのテキストに連結して返す。
 * suggest-topics.js の suggestTopics() にそのまま渡せます。
 * @param {{sinceDays?:number, boardId?:string}} opts
 * @returns {Promise<string>}
 */
export async function fetchReflections({ sinceDays = 3, boardId } = {}) {
  const board = await fetchBoard(boardId);
  let posts = extractPosts(board);

  // createdAt が取れている場合のみ日付で絞り込む（取れないなら全件を対象に）
  if (sinceDays && posts.some((p) => p.createdAt)) {
    const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
    posts = posts.filter(
      (p) => !p.createdAt || new Date(p.createdAt).getTime() >= cutoff
    );
  }

  if (!posts.length) return "";

  // 件名＋本文を投稿ごとにまとめ、投稿間は区切りで連結
  return posts
    .map((p) => [p.subject, p.body].filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n---\n\n");
}

// --- 単体テスト（node padlet-fetch.js）---
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchReflections({ sinceDays: 3 })
    .then((text) => {
      console.log(`取得文字数: ${text.length}`);
      console.log("--- 先頭300字 ---");
      console.log(text.slice(0, 300));
    })
    .catch((err) => console.error("失敗:", err.message));
}
