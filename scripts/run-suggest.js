// scripts/run-suggest.js
// 【note 2日ライン｜前半】
// 直近2日分のリフレクションから記事テーマの候補を作り、Firestore に pending で保存する。
// これをサイトで開いて「これ！」と選ぶ。GitHub Actions で2日ごと cron 実行。

import { fetchReflections } from "../lib/padlet-fetch.js";
import { suggestTopics } from "../lib/suggest-topics.js";
import { db, COLLECTION } from "../lib/firebase.js";
import { FieldValue } from "firebase-admin/firestore";

async function main() {
  const reflectionText = await fetchReflections({ sinceDays: 2 });
  if (!reflectionText.trim()) { console.log("リフレクションが無いのでスキップ"); return; }

  const topics = await suggestTopics(reflectionText);
  if (!topics.length) { console.log("候補が出なかったのでスキップ"); return; }

  const doc = await db().collection(COLLECTION).add({
    date: new Date().toISOString().slice(0, 10),
    createdAt: FieldValue.serverTimestamp(),
    reflectionText,          // 記事化に使う（Firestoreルールで本人のみ閲覧可にすること）
    topics,
    status: "pending",
    selectedIds: [],
    articles: [],
  });
  console.log(`候補 ${topics.length}件を保存: ${doc.id}`);
}

main().catch((e) => { console.error("失敗:", e.message); process.exit(1); });
