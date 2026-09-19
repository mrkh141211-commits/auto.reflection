// scripts/run-instagram.js
// 【Instagram 毎日ライン｜全自動・選択なし】
// その日のリフレクションから、名言カードを1枚作って Instagram に自動投稿する。
// GitHub Actions で毎日 cron 実行。

import { fetchReflections } from "../lib/padlet-fetch.js";
import { rewriteWithoutNames } from "../lib/rewrite.js";
import { extractQuotes } from "../lib/extract-quotes.js";
import { renderAndUploadCard } from "../lib/make-card.js";
import { postToInstagram } from "../lib/instagram-post.js";

const RICH_BY_WEEKDAY = ["軽","濃","中","濃","中","濃","軽"]; // 日替わりで色に変化を（任意）

async function main() {
  // 1. 当日のリフレクションを取得
  const raw = await fetchReflections({ sinceDays: 1 });
  if (!raw.trim()) { console.log("今日のリフレクションが無いのでスキップ"); return; }

  // 2. 個人名を消す
  const clean = await rewriteWithoutNames(raw);

  // 3. 言葉を抽出して1つ選ぶ（ここでは2案目＝短めを採用。好みで変更可）
  const quotes = await extractQuotes(clean);
  const quote = quotes[1] || quotes[0];

  // 4. カードを画像化して公開URLを得る
  const rich = RICH_BY_WEEKDAY[new Date().getDay()];
  const imageUrl = await renderAndUploadCard({ quote, rich, sig: "日々のリフレクションより" });
  console.log("カード:", imageUrl);

  // 5. Instagram に投稿
  const caption = `${quote}\n\n#教育 #学級経営 #リフレクション #小学校`;
  const id = await postToInstagram(imageUrl, caption);
  console.log("投稿成功:", id);
}

main().catch((e) => { console.error("失敗:", e.message); process.exit(1); });
