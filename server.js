const express = require("express");
const cors = require("cors");
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'queue-data.json');

app.use(cors());
app.use(express.json());

// Load queue state from file or initialize defaults
let queueState = {
  tokens: [],
  currentNumber: 1,
  nextTokenNumber: 1
};

// Load data from file if it exists
async function loadData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    const savedState = JSON.parse(data);
    queueState = { ...queueState, ...savedState };
    console.log('Queue state loaded from file');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('No saved queue state found, using defaults');
    } else {
      console.error('Error loading queue state:', error);
    }
  }
}

// Save data to file
async function saveData() {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(queueState, null, 2));
  } catch (error) {
    console.error('Error saving queue state:', error);
  }
}

// Initialize data
loadData();

// GET /api/queue - return current queue status
app.get("/api/queue", (req, res) => {
  res.json({
    tokens: queueState.tokens,
    currentNumber: queueState.currentNumber,
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
      tokenNumber: queueState.nextTokenNumber++,
      name,
      phone,
      age,
      department,
      bookedAt: bookedAt || new Date().toISOString(),
      visited: false
    };

    queueState.tokens.push(token);
    await saveData();

    return res.status(201).json(token);
  } catch (error) {
    console.error("Error booking token:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/next-number - advance the queue
app.post("/api/next-number", async (req, res) => {
  try {
    if (queueState.tokens.length === 0) {
      return res.status(400).json({ error: "No tokens in queue" });
    }

    // Mark the current token as visited
    const currentToken = queueState.tokens.find(t => t.tokenNumber === queueState.currentNumber);
    if (currentToken) {
      currentToken.visited = true;
    }
    
    // Move to the next number
    queueState.currentNumber++;
    
    // If we've gone through all tokens, reset the counter
    if (queueState.currentNumber >= queueState.nextTokenNumber) {
      queueState.currentNumber = 1;
      queueState.nextTokenNumber = 1;
      queueState.tokens = [];
    }
    
    await saveData();
    return res.json({ 
      success: true, 
      currentNumber: queueState.currentNumber,
      tokens: queueState.tokens
    });
  } catch (error) {
    console.error("Error advancing queue:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/reset-queue - reset all state
app.post("/api/reset-queue", async (req, res) => {
  try {
    queueState = {
      tokens: [],
      currentNumber: 1,
      nextTokenNumber: 1
    };
    
    await saveData();
    return res.json({ 
      success: true,
      message: "Queue has been reset"
    });
  } catch (error) {
    console.error("Error resetting queue:", error);
    return res.status(500).json({ error: "Failed to reset queue" });
  }
});

// Start the server
app.listen(PORT, async () => {
  console.log(`ClinicQueue backend running on http://localhost:${PORT}`);
  
  // Ensure data is loaded when server starts
  try {
    await loadData();
    console.log('Initial queue state:', {
      currentNumber: queueState.currentNumber,
      nextTokenNumber: queueState.nextTokenNumber,
      tokenCount: queueState.tokens.length
    });
  } catch (error) {
    console.error('Failed to load initial data:', error);
  }
});
