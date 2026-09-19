// lib/make-card.js
// Instagram用カードを、ダッシュボードと同じ見た目で画像化する。
// カードのHTMLをそのままレンダリングしてPNG化 → Firebase Storage にアップ → 公開URLを返す。
// puppeteer を使うので見た目がサイトのプレビューと完全一致する。
//
// GitHub Actions では日本語フォントが必要: ワークフローで fonts-noto-cjk を入れておくこと。

import puppeteer from "puppeteer";
import { bucket } from "./firebase.js";
import crypto from "node:crypto";

const RICH_COLOR = {
  "濃": { accent: "#234641", soft: "rgba(35,70,65,.13)" },
  "中": { accent: "#5f7a58", soft: "rgba(95,122,88,.14)" },
  "軽": { accent: "#84a35b", soft: "rgba(132,163,91,.16)" },
  "藍": { accent: "#2f4858", soft: "rgba(47,72,88,.13)" },
};

/** カード1枚分のHTML（600x600の高解像度で描画） */
function cardHtml({ quote, sig = "日々のリフレクションより", rich = "濃", leaf = true }) {
  const c = RICH_COLOR[rich] || RICH_COLOR["濃"];
  const len = (quote || "").length;
  const qSize = len <= 12 ? 52 : len <= 22 ? 42 : len <= 34 ? 36 : 32;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { margin:0; box-sizing:border-box; }
    body { width:600px; height:600px; }
    .card { position:relative; width:600px; height:600px; overflow:hidden; padding:60px;
      --accent:${c.accent}; --accent-soft:${c.soft};
      background: radial-gradient(circle at 82% 16%, var(--accent-soft), transparent 42%), #fdfdfb;
      color:#1e2a28; display:flex; flex-direction:column; justify-content:center;
      font-family:"Noto Serif CJK JP","Noto Serif JP",serif; }
    .card::before { content:""; position:absolute; inset:0;
      background-image: radial-gradient(var(--accent-soft) 2px, transparent 2px);
      background-size:30px 30px; opacity:.5; }
    .frame { position:absolute; inset:26px; border:2px solid var(--accent); opacity:.28; border-radius:16px; }
    .qmark { position:absolute; top:10px; left:40px; font-size:190px; line-height:1; color:var(--accent); opacity:.16; }
    .q { position:relative; z-index:1; font-size:${qSize}px; line-height:1.8; font-weight:600; }
    .foot { position:relative; z-index:1; margin-top:36px; display:flex; align-items:center; gap:16px; }
    .rule { flex:1; height:2px; background:var(--accent); opacity:.4; }
    .sig { font-size:22px; color:var(--accent); font-weight:600; white-space:nowrap; }
    .leaf { position:absolute; right:40px; bottom:36px; width:66px; height:66px; color:var(--accent); opacity:.55; ${leaf ? "" : "display:none;"} }
  </style></head><body>
    <div class="card">
      <div class="frame"></div><div class="qmark">“</div>
      <div class="q">${escapeHtml(quote)}</div>
      <div class="foot"><span class="rule"></span><span class="sig">${escapeHtml(sig)}</span></div>
      <svg class="leaf" viewBox="0 0 32 32" fill="none">
        <path d="M16 30C16 30 4 24 4 13C4 7 9 3 16 3C23 3 28 7 28 13C28 24 16 30 16 30Z" stroke="currentColor" stroke-width="1.4"/>
        <path d="M16 27V9M16 15L11 11M16 18L21 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      </svg>
    </div></body></html>`;
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

/**
 * カードをPNG化してFirebase Storageにアップし、公開URLを返す。
 * @param {{quote:string, sig?:string, rich?:string, leaf?:boolean}} card
 * @returns {Promise<string>} 公開画像URL
 */
export async function renderAndUploadCard(card) {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 600, height: 600, deviceScaleFactor: 1 });
    await page.setContent(cardHtml(card), { waitUntil: "networkidle0" });
    const png = await page.screenshot({ type: "png" });

    const name = `ig-cards/${new Date().toISOString().slice(0,10)}-${crypto.randomBytes(4).toString("hex")}.png`;
    const file = bucket().file(name);
    await file.save(png, { metadata: { contentType: "image/png" } });
    await file.makePublic();
    return `https://storage.googleapis.com/${bucket().name}/${name}`;
  } finally {
    await browser.close();
  }
}
