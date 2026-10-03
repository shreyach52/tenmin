const express = require("express");
const cors = require("cors");
const multer = require("multer");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const MODEL = "gemma3:4b";
const PAGES_PER_BATCH = 4;

app.get("/api/health", (req, res) => res.json({ ok: true }));

async function askModel(prompt) {
    const r = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: MODEL,
            prompt,
            stream: false,
            format: "json",
            options: { num_ctx: 8192, temperature: 0.3 },
        }),
    });
    const data = await r.json();
    return data.response;
}

function buildPrompt(text) {
    return `You are a study helper for an engineering student who loses focus quickly.
Turn the lecture slide text below into short study cards.

Rules:
Rules:
- Make 2 to 4 cards. Each card covers ONE concept.
- "title": the concept name, max 6 words.
- "points": a JSON array of 2 to 4 separate short strings. Each bullet is its own string.
- "question": one quick recall question.
- "answer": a one-line answer copied from or directly supported by the slide text.
- Use only what is in the slide text. If unsure, skip that concept.

Reply ONLY as JSON in exactly this shape:
{"cards":[{"title":"","points":["",""],"question":"","answer":""}]}

SLIDE TEXT:
${text}`;
}
function cleanPoints(points) {
    const list = Array.isArray(points) ? points : [String(points || "")];
    return list
        .flatMap((p) => String(p).split(/[”“"]\s*,?\s*[”“"]/))
        .map((p) => p.replace(/^[”“"\s]+|[”“"\s]+$/g, "").trim())
        .filter((p) => p.length > 0 && p.length < 90)
        .slice(0, 4);
}

app.post("/api/process", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const { extractText, getDocumentProxy } = await import("unpdf");
        const pdf = await getDocumentProxy(new Uint8Array(req.file.buffer));
        const { totalPages, text } = await extractText(pdf, { mergePages: false });

        const pageObjs = text
            .map((t, idx) => ({ n: idx + 1, t: t.trim() }))
            .filter((p) => p.t.length > 0);

        if (pageObjs.length === 0) {
            return res.status(422).json({
                error: "No text found. This PDF may be scanned images.",
            });
        }

        const cards = [];
        for (let i = 0; i < pageObjs.length; i += PAGES_PER_BATCH) {
            const batchPages = pageObjs.slice(i, i + PAGES_PER_BATCH);
            const batchText = batchPages.map((p) => p.t).join("\n\n---\n\n");
            const label =
                batchPages[0].n === batchPages[batchPages.length - 1].n
                    ? `p.${batchPages[0].n}`
                    : `p.${batchPages[0].n}-${batchPages[batchPages.length - 1].n}`;
            console.log(`Processing ${label} (batch ${Math.floor(i / PAGES_PER_BATCH) + 1} of ${Math.ceil(pageObjs.length / PAGES_PER_BATCH)})`);
            const raw = await askModel(buildPrompt(batchText));
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed.cards)) {
                    for (const c of parsed.cards) {
                        const card = {
                            title: String(c.title || "").trim(),
                            points: cleanPoints(c.points),
                            question: String(c.question || "").trim(),
                            answer: String(c.answer || "").trim(),
                            pages: label,
                        };
                        if (card.title && card.points.length && card.question && card.answer) {
                            cards.push(card);
                        }
                    }
                }
            } catch {
                console.log(`Skipped ${label}: model returned invalid JSON`);
            }
        }

        res.json({ totalPages, cardCount: cards.length, cards });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Processing failed. Is Ollama running?" });
    }
});

app.listen(5000, () => console.log("Server on http://localhost:5000"));