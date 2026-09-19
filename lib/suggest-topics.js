// suggest-topics.js
// 数日分のリフレクションを渡すと、「書けるnote記事のテーマ候補」を
// 見出し・一言要約・濃さつきで抽出する。おのちゃんが候補から「これ！」を選ぶための一覧を作る。
// Claude API を使用。出力は構造化された JSON。
//
// 必要な環境変数:
//   ANTHROPIC_API_KEY … Anthropic の API キー

const MODEL = "claude-sonnet-5"; // 選定の判断力重視

// note-compose.js と同じ教育観。共通化するなら別ファイルに切り出して両方から import を。
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
- 教育観に深く関わるテーマほど高く評価する（授業デザインの気づき、子どもの見立ての転換、
  教師自身の内省などは濃い。手立ての軽い紹介や日常の一コマは軽い）。
- 各テーマに、読者を引きつける見出し案と、どんな記事になるかの一言をつける。

【厳守】
- 見出し・要約に、個人を特定できる固有名詞（実名・あだ名）を含めない。「ある子」等の一般表現にする。
- 記録に書かれていない出来事を作らない。

【出力形式】
JSON配列のみを出力する。前置き・説明・マークダウンのコードフェンスは一切つけない。
各要素は次の形:
{
  "id": 1,
  "title": "見出し案（20字前後）",
  "summary": "どんな記事になるかの一言",
  "angle": "教育観のどの軸に触れるか（短く）",
  "richness": "濃" | "中" | "軽"
}
濃いテーマを上に並べる。件数は素材に応じて2〜6件。`;

/**
 * リフレクションから記事テーマ候補を抽出する。
 * @param {string} reflectionText 数日分の記録（連結でOK）
 * @returns {Promise<Array<{id:number,title:string,summary:string,angle:string,richness:string}>>}
 */
export async function suggestTopics(reflectionText) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY が未設定です");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: reflectionText }],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Claude API エラー: ${JSON.stringify(data)}`);

  const text = data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  // 念のためコードフェンスが付いても剥がす
  const clean = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();

  try {
    const topics = JSON.parse(clean);
    if (!Array.isArray(topics)) throw new Error("配列ではありません");
    return topics;
  } catch (e) {
    throw new Error(`JSONパース失敗: ${e.message}\n生の応答:\n${text}`);
  }
}

// --- 単体テスト（node suggest-topics.js）---
if (import.meta.url === `file://${process.argv[1]}`) {
  const sample = `
国語はネットでニュースを読もう。1時間目に問い出しをしたが全く出てこず、切り上げた。お題は生成AIを宿題に使う是非。
算数は自由進度。久しぶりに来た子が何でも聞いてくる。5年までほぼ授業に出ていなかったが6年でほぼ出ている。今日はすねてしまった。作図は全員クリア。
社会は関ケ原。漫談的に授業している。自分は漫談で歴史好きになったが、考えさせる授業は苦手だった。
外国語はオールイングリッシュを目指す。トトロの英語の歌で大意がつかめるか試した。
放課後ダンス。15人が踊り残りは盛り上げ役。毎年こうなる。
`.trim();

  suggestTopics(sample)
    .then((topics) => {
      for (const t of topics) {
        console.log(`【${t.richness}】${t.id}. ${t.title}`);
        console.log(`    ${t.summary}（軸: ${t.angle}）`);
      }
    })
    .catch((err) => console.error("失敗:", err.message));
}
