// rewrite.js
// リフレクション本文から個人名・個人特定情報を「取り除いて」自然な文に書き換える。
// 伏字（〇〇さん）ではなく、「ある子」「一人の児童」のように痕跡を残さずリライトする。
// Claude API を使用。GitHub Actions の cron から呼ぶ前提。
//
// 必要な環境変数（GitHub の Secrets に入れる）:
//   ANTHROPIC_API_KEY … Anthropic の API キー

// モデルは用途に合わせて選択:
//   "claude-sonnet-4-5-20250929"            … 書き換えの自然さ重視（おすすめ）
//   "claude-haiku-4-5-20251001" … 速度・コスト重視（毎日回すなら十分）
const MODEL = "claude-sonnet-4-5-20250929";

const SYSTEM_PROMPT = `あなたは小学校教員のリフレクション（振り返り）を、SNSでの公開用に整える編集者です。
渡された本文を、次のルールに従ってリライトしてください。

【必須ルール】
- 児童・保護者・同僚など、個人を特定できる固有名詞（実名・あだ名・イニシャル・出席番号）を取り除く。
- 伏字（〇〇、A君 など）にするのではなく、「ある子」「一人の児童」「同僚」「保護者の方」のような
  自然な一般表現に置き換え、名前があったことが読者に分からないようにする。
- クラス内で一人しか当てはまらない具体的特徴や、家庭事情など個人が推測されうる記述もぼかす。
- 学校名・地名など所属が特定される情報も一般化する。

【保持すること】
- 元の気づき・学び・感情のニュアンス・語り口は保つ。
- 内容を新しく創作したり、誇張したりしない。事実を足さない。

【出力】
- 整えた本文だけを出力する。前置き・説明・注釈は一切つけない。`;

/**
 * 本文を個人情報なしの自然な文にリライトする。
 * @param {string} text 元のリフレクション本文
 * @returns {Promise<string>} 書き換え後の本文
 */
export async function rewriteWithoutNames(text) {
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
      messages: [{ role: "user", content: text }],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Claude API エラー: ${JSON.stringify(data)}`);
  }

  // content は複数ブロックのことがあるので text ブロックだけ結合する
  const out = data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  if (!out) throw new Error(`空の応答: ${JSON.stringify(data)}`);
  return out;
}

/**
 * （任意・二重ガード）既知の名前が書き換え後にまだ残っていないか確認する。
 * 万一の見落としを検知するための安全ネット。残っていれば投稿を止める用途に。
 * @param {string} text 書き換え後の本文
 * @param {string[]} knownNames クラスの児童名など、絶対に出したくない名前
 * @returns {string[]} 残ってしまっている名前（空配列なら安全）
 */
export function findRemainingNames(text, knownNames = []) {
  return knownNames.filter((n) => n && text.includes(n));
}

// --- 単体で試すとき（node rewrite.js を直接実行）---
if (import.meta.url === `file://${process.argv[1]}`) {
  const raw = "今日は山田太郎さんの発表がよかった。佐藤さんも、いつもは静かだけど今日は積極的に手を挙げていた。";
  const knownNames = ["山田太郎", "佐藤"];
  rewriteWithoutNames(raw)
    .then((clean) => {
      console.log("書き換え後:\n" + clean);
      const leftover = findRemainingNames(clean, knownNames);
      console.log(
        leftover.length ? `⚠️ 残存: ${leftover.join(", ")}` : "✅ 名前の残存なし"
      );
    })
    .catch((err) => console.error("失敗:", err.message));
}
