import { useEffect, useState, useCallback } from "react";
import "./App.css";
import StreakGuard from "./StreakGuard";

const API = "http://localhost:5000";
const SPRINT_SIZE = 5;

export default function App() {
  const [cards, setCards] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("tenmin-cards")) || [];
    } catch {
      return [];
    }
  });
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [loading, setLoading] = useState(false); // waiting for the first cards
  const [processing, setProcessing] = useState(false); // more cards still coming
  const [progress, setProgress] = useState({ done: 0, batches: 0 });
  const [error, setError] = useState("");

  const total = cards.length;
  const sprintNo = Math.floor(index / SPRINT_SIZE) + 1;
  const sprintTotal = Math.ceil(total / SPRINT_SIZE);
  const sprintStart = (sprintNo - 1) * SPRINT_SIZE;
  const sprintLen = processing
    ? SPRINT_SIZE
    : Math.min(SPRINT_SIZE, total - sprintStart);
  const endOfSprint = index % SPRINT_SIZE === sprintLen - 1;
  const atLastLoaded = index >= total - 1;
  const finished = onBreak && atLastLoaded && !processing;

  const next = useCallback(() => {
    if (total === 0) return;
    if (onBreak) {
      if (!atLastLoaded) {
        setIndex(index + 1);
        setOnBreak(false);
        setRevealed(false);
      }
      return;
    }
    if (endOfSprint) {
      setOnBreak(true);
      return;
    }
    if (atLastLoaded) return; // next card is still being prepared
    setIndex(index + 1);
    setRevealed(false);
  }, [total, onBreak, index, endOfSprint, atLastLoaded]);

  const prev = useCallback(() => {
    if (onBreak) {
      setOnBreak(false);
      return;
    }
    if (index > 0) {
      setIndex(index - 1);
      setRevealed(false);
    }
  }, [onBreak, index]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " " && !onBreak && total > 0) {
        e.preventDefault();
        setRevealed((r) => !r);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onBreak, total]);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";

    setLoading(true);
    setProcessing(false);
    setError("");
    setCards([]);
    setIndex(0);
    setOnBreak(false);
    setRevealed(false);
    setProgress({ done: 0, batches: 0 });

    const all = [];
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`${API}/api/process`, { method: "POST", body: fd });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong");
      }

      setProcessing(true);
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.type === "meta") {
            setProgress({ done: 0, batches: msg.batches });
          } else if (msg.type === "cards") {
            all.push(...msg.cards);
            setCards([...all]);
            setProgress({ done: msg.done, batches: msg.batches });
            if (all.length > 0) setLoading(false);
          } else if (msg.type === "error") {
            setError(msg.message);
          }
        }
      }

      if (all.length === 0) {
        setError((prev) => prev || "No study cards could be made from this PDF.");
      } else {
        try {
          localStorage.setItem("tenmin-cards", JSON.stringify(all));
        } catch {
          /* storage unavailable */
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setProcessing(false);
    }
  }

  const card = cards[index];

  return (
    <div className="app">
      <header>
        <h1>TenMin</h1>
        <label className="upload">
          Upload slides (PDF)
          <input type="file" accept="application/pdf" onChange={handleUpload} hidden />
        </label>
      </header>

      <StreakGuard />

      {loading && (
        <p className="status">
          Reading your slides with a local model. Your first cards will appear
          in under a minute...
        </p>
      )}
      {error && <p className="status error">{error}</p>}

      {!loading && total === 0 && !error && !processing && (
        <p className="status">Upload a PDF of your slides to get started.</p>
      )}

      {total > 0 && (
        <>
          {processing && (
            <p className="progress-note">
              Still reading your slides: part {progress.done} of{" "}
              {progress.batches}. You can start studying now.
            </p>
          )}

          <div className="progress">
            <span>
              Sprint {sprintNo}
              {processing ? "" : ` of ${sprintTotal}`}
            </span>
            <div className="bar">
              <div
                className="fill"
                style={{
                  width: `${((index + (onBreak ? 1 : 0)) / total) * 100}%`,
                }}
              />
            </div>
            <span>
              Card {index + 1} / {total}
              {processing ? "+" : ""}
            </span>
          </div>

          {onBreak ? (
            <div className="card center">
              {finished ? (
                <>
                  <h2>All done</h2>
                  <p>You went through every card. Nice work.</p>
                </>
              ) : (
                <>
                  <h2>Sprint {sprintNo} complete</h2>
                  <p>Stand up, drink some water, then come back.</p>
                  {atLastLoaded ? (
                    <p className="status">Preparing your next sprint...</p>
                  ) : (
                    <button onClick={next}>Start sprint {sprintNo + 1}</button>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="card">
              <h2>{card.title}</h2>
              <ul>
                {card.points.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
              <div className="qa">
                <p className="q">{card.question}</p>
                {revealed ? (
                  <p className="a">{card.answer}</p>
                ) : (
                  <button onClick={() => setRevealed(true)}>Show answer</button>
                )}
              </div>
              <small>Source: slides {card.pages.replace("p.", "")}</small>
            </div>
          )}

          <div className="nav">
            <button onClick={prev}>Back</button>
            <button onClick={next}>Next</button>
          </div>
          <p className="hint">Keys: ← → to move, Space to reveal</p>
        </>
      )}
    </div>
  );
}