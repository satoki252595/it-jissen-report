# IT実践レポート

AI・Web・クラウド・データの動きを、現場の判断に使える形で毎日公開する静的サイトです。

公開先: https://satoki252595.github.io/it-jissen-report/

## 新しい号を追加する

1. Notionから書き出したMarkdownを `content/reports/YYYY-MM-DD.md` として置く。
2. ファイル名の日付が、その号の日付になる。フロントマターは不要。
3. `main` へプッシュすると、GitHub Actionsがビルドして GitHub Pages に公開する。

対応しているNotion由来の記法は、`<callout>`、`<details>`、見出しの `{color="..."}`、`header-row` 付きのHTML表、コードブロックです。`<table_of_contents/>` はビルド時に除き、ページ側の目次を使います。

## デザインの原則

国際アワード受賞作から蒸留した10か条に沿って組んでいます。

1. **タイポグラフィ主導** — 本文は Noto Sans JP、見出しは Inter。装飾より文字のサイズと太さで階層を作る。
2. **読みやすい本文** — 行幅は約40字、行間は1.85。
3. **余白の規律** — 余白は8px倍数。記事は本文と右目次の2カラム。
4. **情報階層** — 1ページに見出し1はひとつ。日付と読了時間は見出しの直下に置く。
5. **短いモーション** — 300ms以内。動かすのは transform と opacity だけ。`prefers-reduced-motion` では止める。
6. **抑制された色** — アクセントは1色。本文コントラストは7:1以上。
7. **ダークモード** — システムの設定に従い、手動切替は保存する。
8. **目次と回遊** — 広い画面では目次を固定。狭い画面では折りたたむ。号の末尾に前日・翌日と関連3件。
9. **アクセシビリティ** — ランドマーク、可視フォーカス、44px以上の操作対象、スキップリンク。
10. **速さ** — 静的HTML。シンタックスハイライトはビルド時。JavaScriptは小さく保つ。

## 開発

```bash
npm install
npm run dev
```

本番と同じベースパス `/it-jissen-report/` で起動します。

```bash
npm run build
npm run preview
```

## 公開

`.github/workflows/pages.yml` が `main` への push で Pages にデプロイします。リポジトリの Pages ソースは GitHub Actions です。初回に有効化できない場合は、Settings → Pages → Build and deployment → Source を GitHub Actions にしてください。
