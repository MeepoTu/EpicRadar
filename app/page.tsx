"use client";

import { FormEvent, useMemo, useState } from "react";

const PROGRAM_ID = "CLAY4M7BDfzpaTeuizZgyVw16fE7qiQhPywQzSsGLV3z";
const DEFAULT_WALLET = "EG4W2vAkH23pk4DwFy2dnPke5sBcBxvZ7WjkmwUdWvZh";

const EPICS = [
  ["Zombie Ghost Gang", 171],
  ["Dactyl Flight Squadron", 101],
  ["Captain Flea and the Cursed Hat", 147],
] as const;

type Card = { id: string; heeboo: number; timestamp: number };

const percent = (value: number) => `${(value * 100).toFixed(3)}%`;
const date = (seconds: number) => new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(seconds * 1000));

function decodeCards(records: Array<{ account: { data: [string, string] } }>): Card[] {
  return records.map(({ account }) => {
    const binary = atob(account.data[0]);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const view = new DataView(bytes.buffer);
    return {
      id: view.getBigUint64(8, true).toString(),
      timestamp: Number(view.getBigUint64(18, true)),
      heeboo: view.getUint32(27, true),
    };
  }).sort((a, b) => b.timestamp - a.timestamp || Number(b.id) - Number(a.id));
}

export default function Home() {
  const [wallet, setWallet] = useState(DEFAULT_WALLET);
  const [cards, setCards] = useState<Card[]>([]);
  const [baseline, setBaseline] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const nextProbability = EPICS.reduce((total, [, denominator]) => total + 1 / denominator, 0);
  const openedSinceEpic = baseline ? cards.filter((card) => Number(card.id) > Number(baseline)).length : 0;
  const summary = useMemo(() => ({
    total: cards.reduce((total, card) => total + card.heeboo, 0),
    drought: (1 - nextProbability) ** openedSinceEpic,
    nextTen: 1 - (1 - nextProbability) ** 10,
  }), [cards, openedSinceEpic, nextProbability]);

  async function lookup(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("https://api.mainnet-beta.solana.com", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "getProgramAccounts",
          params: [PROGRAM_ID, { encoding: "base64", filters: [{ dataSize: 64 }, { memcmp: { offset: 32, bytes: wallet.trim() } }] }],
        }),
      });
      const payload = await response.json();
      if (!response.ok || payload.error) throw new Error(payload.error?.message || "无法读取这条钱包记录");
      const nextCards = decodeCards(payload.result);
      setCards(nextCards);
      if (nextCards.length && !baseline) setBaseline(nextCards[0].id);
    } catch (reason) {
      setCards([]);
      setError(reason instanceof Error ? reason.message : "查询失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <section className="hero">
        <div className="eyebrow"><span className="dot" /> LIVE ODDS · SOLANA</div>
        <h1>HEEBOO<br /><em>Epic Radar</em></h1>
        <p>追踪开包空窗，读懂概率，而不是被“该出了”的感觉牵着走。</p>
      </section>

      <section className="lookup-card">
        <label htmlFor="wallet">Solana 钱包地址</label>
        <form onSubmit={lookup}>
          <input id="wallet" value={wallet} onChange={(event) => setWallet(event.target.value)} spellCheck="false" aria-label="Solana 钱包地址" />
          <button type="submit" disabled={loading}>{loading ? "读取中…" : "检查钱包"}</button>
        </form>
        <p className="note">仅读取公开的 Claynosaurz reveal 记录，不连接钱包、不请求签名。</p>
        {error && <p className="error">{error}</p>}
      </section>

      <section className="metrics" aria-label="Epic 概率统计">
        <article className="metric primary"><span>下一包任一 Epic</span><strong>{percent(nextProbability)}</strong><small>约 1 / {(1 / nextProbability).toFixed(2)}</small></article>
        <article className="metric"><span>未来 10 包至少一次</span><strong>{percent(summary.nextTen)}</strong><small>固定概率模型</small></article>
        <article className="metric"><span>已开基础 HEEBOO</span><strong>{cards.length ? summary.total.toLocaleString() : "—"}</strong><small>{cards.length ? `${cards.length} 张已揭示卡` : "先查询钱包"}</small></article>
      </section>

      {cards.length > 0 && <>
        <section className="drought">
          <div>
            <span className="label">最近一次 Epic</span>
            <select value={baseline} onChange={(event) => setBaseline(event.target.value)} aria-label="选择最近一次 Epic 的 reveal 记录">
              {cards.map((card) => <option key={card.id} value={card.id}>#{card.id} · {date(card.timestamp)} · {card.heeboo.toLocaleString()} HEEBOO</option>)}
            </select>
          </div>
          <div className="drought-number"><strong>{openedSinceEpic}</strong><span>张卡自该次 Epic 后揭示</span></div>
          <p>连续 {openedSinceEpic} 张未出 Epic 的概率是 <b>{percent(summary.drought)}</b>。这描述空窗的罕见程度；在独立随机的前提下，下一包仍是 {percent(nextProbability)}。</p>
        </section>

        <section className="records">
          <div className="section-heading"><span>REVEAL LEDGER</span><h2>基础额度记录</h2></div>
          <div className="table-head"><span>记录</span><span>揭示时间</span><span>HEEBOO</span></div>
          {cards.map((card) => <div className={`record ${card.id === baseline ? "baseline" : ""}`} key={card.id}>
            <span>#{card.id}</span><span>{date(card.timestamp)}</span><b>{card.heeboo.toLocaleString()}</b>
          </div>)}
        </section>
      </>}

      <section className="odds">
        <div><span className="label">公布概率</span><h2>三张 Epic</h2></div>
        <div className="epic-grid">{EPICS.map(([name, denominator]) => <div key={name}><span>{name}</span><b>1 / {denominator}</b></div>)}</div>
      </section>
      <footer>概率按三张 Epic 在单张卡中互斥、且每次开包独立计算。若存在保底或非公开的随机机制，实际结果可能不同。</footer>
    </main>
  );
}
