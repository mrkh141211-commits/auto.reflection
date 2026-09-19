// lib/firebase.js
// Firebase Admin SDK の初期化（サーバー側＝GitHub Actions 用）。
// Firestore（候補・記事の保管）と Storage（カード画像の公開ホスト）を扱う。
//
// 必要な環境変数:
//   FIREBASE_SERVICE_ACCOUNT … サービスアカウントJSON（丸ごと文字列で GitHub Secrets に）
//   FIREBASE_STORAGE_BUCKET  … 例: your-project.appspot.com

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function init() {
  if (getApps().length) return;
  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({
    credential: cert(svc),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

export function db() { init(); return getFirestore(); }
export function bucket() { init(); return getStorage().bucket(); }

export const COLLECTION = "topicBatches";
