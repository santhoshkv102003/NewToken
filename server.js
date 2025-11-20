const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-memory queue state
let tokens = [];
let currentNumber = 1;
let nextTokenNumber = 1;

// GET /api/queue - return current queue status
app.get("/api/queue", (req, res) => {
  res.json({
    tokens,
    currentNumber,
  });
});

// POST /api/book-token - create a new token
app.post("/api/book-token", (req, res) => {
  try {
    const { name, phone, age, department, bookedAt } = req.body || {};

    if (!name || !phone || typeof age !== "number" || !department) {
      return res.status(400).json({ error: "Missing or invalid fields" });
    }

    const token = {
      tokenNumber: nextTokenNumber++,
      name,
      phone,
      age,
      department,
      bookedAt: bookedAt || new Date().toISOString(),
    };

    tokens.push(token);

    return res.status(201).json(token);
  } catch (error) {
    console.error("Error booking token:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/next-number - advance the queue
app.post("/api/next-number", (req, res) => {
  if (tokens.length === 0 || currentNumber > tokens[tokens.length - 1].tokenNumber) {
    return res.status(400).json({ error: "No more patients in queue" });
  }

  currentNumber += 1;
  return res.json({ currentNumber });
});

// POST /api/reset-queue - reset all state
app.post("/api/reset-queue", (req, res) => {
  tokens = [];
  currentNumber = 1;
  nextTokenNumber = 1;
  return res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`ClinicQueue backend running on http://localhost:${PORT}`);
});
