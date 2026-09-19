// suggest-topics.js （デバッグ版：Claudeの生応答を表示）
const MODEL = "claude-sonnet-4-5-20250929"; // ← 確実に存在するモデル名に変更

const PHILOSOPHY = `
「子ども中心」と「自己調整学習」。子どもを学びを調整する主体として見る。
教師の役割は正解を与えるより、気づき・選び・振り返る場をつくること。
小さな行動変化に学びの芽を読み取る。感覚でなく子ども自身の変化の事実に立つ。
`.trim();

const SYSTEM_PROMPT = `あなたは、ある小学校教員の数日分のリフレクションを読み、
note に書けそうな記事テーマの候補を洗い出す編集者です。

【この教員の教育観】
${PHILOSOPHY}

【やること】
- 記録の中から、独立した記事になりうるテーマを拾い出す。
- 教育観に深く関わるテーマほど高く評価する。
- 各テーマに、読者を引きつける見出し案と、どんな記事になるかの一言をつける。

【厳守】
- 見出し・要約に、個人を特定できる固有名詞を含めない。「ある子」等の一般表現にする。
- 記録に書かれていない出来事を作らない。

【出力形式】
JSON配列のみを出力する。前置き・説明・コードフェンスは一切つけない。
各要素: {"id":1,"title":"見出し(20字前後)","summary":"一言","angle":"軸","richness":"濃|中|軽"}
濃いテーマを上に。2〜6件。`;

export async function suggestTopics(reflectionText) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY が未設定です");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL, max_tokens: 1500, system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: reflectionText }],
    }),
  });

  const data = await res.json();
  // ▼ デバッグ：Claudeが何を返したか丸ごと表示
  console.log("▶ Claude HTTPステータス:", res.status);
  console.log("▶ Claude 応答(先頭1200字):", JSON.stringify(data).slice(0, 1200));

  if (!res.ok) throw new Error(`Claude API エラー: ${JSON.stringify(data)}`);

  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
  const clean = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const topics = JSON.parse(clean);
  if (!Array.isArray(topics)) throw new Error("配列ではありません");
  return topics;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  suggestTopics("国語で問い出しをしたが出てこず切り上げた。算数の自由進度で久しぶりに来た子が何度も聞いてくる。社会は漫談。")
    .then((t) => console.log(JSON.stringify(t, null, 2)))
    .catch((e) => console.error("失敗:", e.message));
}
