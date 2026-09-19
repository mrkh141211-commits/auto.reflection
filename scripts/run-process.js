// scripts/run-process.js
// 【note 2日ライン｜後半】
// サイトで選ばれた候補（status:"selected"）を記事化して Firestore に戻す（status:"composed"）。
// rewrite（個人名除去）→ note-compose（教育観＆文体で記事化）→ extract-quotes（カード言葉5案）。
// GitHub Actions で数時間おき cron 実行、または手動実行。

import { rewriteWithoutNames } from "../lib/rewrite.js";
import { composeNoteArticle } from "../lib/note-compose.js";
import { extractQuotes } from "../lib/extract-quotes.js";
import { db, COLLECTION } from "../lib/firebase.js";

async function main() {
  const snap = await db().collection(COLLECTION).where("status", "==", "selected").get();
  if (snap.empty) { console.log("処理待ちの選択はありません"); return; }

  for (const docSnap of snap.docs) {
    const batch = docSnap.data();
    const chosen = (batch.topics || []).filter((t) => (batch.selectedIds || []).includes(t.id));
    console.log(`${docSnap.id}: ${chosen.length}本を記事化`);

    const articles = [];
    for (const t of chosen) {
      // このテーマに絞って記事化するよう、テーマ名を頭に添えて渡す
      const focused = `次のテーマに絞って書いてください：「${t.title}」（${t.summary}）\n\n---参考にする記録---\n${batch.reflectionText}`;
      const clean = await rewriteWithoutNames(focused);
      const markdown = await composeNoteArticle(clean);
      const quotes = await extractQuotes(markdown);
      articles.push({
        id: t.id,
        title: markdown.split("\n")[0].replace(/^#\s*/, ""),
        markdown,
        quotes,
        rich: t.richness || "濃",
        card: { quote: quotes[0], sig: "日々のリフレクションより", rich: t.richness || "濃", leaf: true },
      });
    }

    await docSnap.ref.update({ status: "composed", articles });
    console.log(`  → 記事化完了`);
  }
}

main().catch((e) => { console.error("失敗:", e.message); process.exit(1); });
