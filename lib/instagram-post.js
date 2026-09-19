// instagram-post.js
// Instagram Graph API への自動投稿コア（画像1枚のフィード投稿）
// Node.js 18+（fetch がネイティブで使える）を想定。GitHub Actions の cron から呼ぶ前提。
//
// 必要な環境変数（GitHub の Secrets に入れる）:
//   IG_USER_ID        … Instagram ビジネス/クリエイターアカウントのユーザーID（数字）
//   IG_ACCESS_TOKEN   … 長期(long-lived)アクセストークン
//
// ※ Graph API のバージョンは四半期ごとに上がる。Meta for Developers で
//    最新の安定版を確認して GRAPH_VERSION を差し替えてください。

const GRAPH_VERSION = "v21.0"; // ← 最新版に要差し替え
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

const IG_USER_ID = process.env.IG_USER_ID;
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;

/**
 * 個人名などを伏字化する。
 * names に「クラスの児童名リスト」など伏せたい固有名詞を渡すと、
 * 本文中の該当箇所を replacement（既定は「〇〇さん」）に置き換える。
 * 完全一致ベースなので誤爆が少なく、教員のリフレクション向き。
 *
 * @param {string} text        元テキスト
 * @param {string[]} names     伏せたい固有名詞の配列
 * @param {string} replacement 置換後の文字列
 * @returns {string}
 */
export function sanitize(text, names = [], replacement = "〇〇さん") {
  let out = text;
  // 長い名前から先に処理（部分一致の取りこぼしを防ぐ）
  const sorted = [...names].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    if (!name) continue;
    // 正規表現の特殊文字をエスケープ
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // 名前の直後に「さん・くん・ちゃん・先生」などが付く場合はまとめて置換
    out = out.replace(new RegExp(`${escaped}(さん|くん|君|ちゃん|先生)?`, "g"), replacement);
  }
  return out;
}

/**
 * 画像1枚を Instagram に投稿する（2段階フロー）。
 * Step1: メディアコンテナを作成して creation_id を得る
 * Step2: creation_id を publish して実際に投稿する
 *
 * @param {string} imageUrl 公開アクセス可能な画像URL（Firebase Storage 等）
 * @param {string} caption  キャプション（本文）
 * @returns {Promise<string>} 投稿された media ID
 */
export async function postToInstagram(imageUrl, caption) {
  if (!IG_USER_ID || !IG_ACCESS_TOKEN) {
    throw new Error("IG_USER_ID / IG_ACCESS_TOKEN が未設定です");
  }

  // --- Step 1: メディアコンテナ作成 ---
  const containerRes = await fetch(`${GRAPH}/${IG_USER_ID}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: imageUrl,
      caption,
      access_token: IG_ACCESS_TOKEN,
    }),
  });
  const container = await containerRes.json();
  if (!containerRes.ok || !container.id) {
    throw new Error(`コンテナ作成失敗: ${JSON.stringify(container)}`);
  }
  const creationId = container.id;

  // --- Step 1.5: コンテナの処理完了を待つ ---
  // 画像取得に少し時間がかかることがあるので、status を数回ポーリングする
  await waitUntilReady(creationId);

  // --- Step 2: publish ---
  const publishRes = await fetch(`${GRAPH}/${IG_USER_ID}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: creationId,
      access_token: IG_ACCESS_TOKEN,
    }),
  });
  const published = await publishRes.json();
  if (!publishRes.ok || !published.id) {
    throw new Error(`publish失敗: ${JSON.stringify(published)}`);
  }
  return published.id;
}

/** コンテナが FINISHED になるまで待つ（最大 ~30 秒） */
async function waitUntilReady(creationId, tries = 10, intervalMs = 3000) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(
      `${GRAPH}/${creationId}?fields=status_code&access_token=${IG_ACCESS_TOKEN}`
    );
    const data = await res.json();
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR") {
      throw new Error(`コンテナ処理エラー: ${JSON.stringify(data)}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("コンテナ処理がタイムアウトしました");
}

// --- 単体で試すとき（node instagram-post.js を直接実行）---
if (import.meta.url === `file://${process.argv[1]}`) {
  const NAMES = ["山田太郎", "佐藤"]; // 伏せたい名前の例
  const raw = "今日は山田太郎さんの発表がよかった。佐藤も頑張っていた。";
  const caption = sanitize(raw, NAMES);
  console.log("投稿キャプション:", caption);

  const testImageUrl = "https://example.com/your-hosted-image.png"; // ← 公開URLに差し替え
  postToInstagram(testImageUrl, caption)
    .then((id) => console.log("投稿成功 media id:", id))
    .catch((err) => console.error("投稿失敗:", err.message));
}
