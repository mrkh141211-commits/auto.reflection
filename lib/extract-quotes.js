// lib/extract-quotes.js
// 記事本文（またはリフレクション）から、カードに載せる「言葉」を長短まぜて5案抽出する。
// Claude API を使用。個人名は含めない。

const MODEL = "claude-sonnet-5";

const SYSTEM = `あなたは、小学校教員の文章から、SNSカードに載せる短い言葉を選び出す編集者です。
渡された文章の中から、心に残る一節を5つ選び、短いものから長いものまで混ぜてください。

【ルール】
- 文章の中に実在する表現を活かす（大きく創作しない。短く整えるのは可）。
- 個人を特定できる固有名詞は含めない。
- 1案目は最も短く印象的に（10字前後）、5案目は一文まるごと（〜40字）。だんだん長く。
- 教員自身の気づきや問いが立ち上がる一節を優先する。

【出力】
JSON配列のみ。前置き・コードフェンスなし。例: ["短い言葉","…","…","…","長めの一文"]`;

/**
 * @param {string} text 記事本文またはリフレクション
 * @returns {Promise<string[]>} 言葉5案（短→長）
 */
export async function extractQuotes(text) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY が未設定です");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL, max_tokens: 800, system: SYSTEM,
      messages: [{ role: "user", content: text }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Claude API エラー: ${JSON.stringify(data)}`);
  const raw = data.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
  const clean = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const arr = JSON.parse(clean);
  if (!Array.isArray(arr)) throw new Error("配列ではありません");
  return arr;
}
