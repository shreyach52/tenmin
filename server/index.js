const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.post("/api/test-model", async (req, res) => {
    try {
        const r = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "gemma3:4b",
                prompt: req.body.prompt || "Say hi in one line.",
                stream: false,
            }),
        });
        const data = await r.json();
        res.json({ answer: data.response });
    } catch (e) {
        res.status(500).json({ error: "Could not reach Ollama. Is it running?" });
    }
});

app.listen(5000, () => console.log("Server on http://localhost:5000"));