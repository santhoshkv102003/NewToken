const express = require("express");
const cors = require("cors");
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'queue-data.json');

// Ensure data directory exists
const dataDir = path.dirname(DATA_FILE);
if (!fsSync.existsSync(dataDir)) {
  fsSync.mkdirSync(dataDir, { recursive: true });
}

// Ensure data file exists with proper permissions
const ensureDataFileExists = async () => {
  try {
    await fs.access(DATA_FILE, fsSync.constants.F_OK | fsSync.constants.R_OK | fsSync.constants.W_OK);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, create it with default data
      console.log('Creating new queue data file...');
      await fs.writeFile(DATA_FILE, JSON.stringify({
        tokens: [],
        currentNumber: 1,
        nextTokenNumber: 1
      }, null, 2));
    } else {
      console.error('Error accessing data file:', error);
      throw error;
    }
  }
};

// Configure CORS to allow requests from the frontend
const corsOptions = {
  origin: ['http://localhost:8080', 'http://127.0.0.1:8080'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));
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
    
    // Only update the state if we have valid data
    if (savedState) {
      queueState.tokens = savedState.tokens || [];
      queueState.currentNumber = savedState.currentNumber || 1;
      queueState.nextTokenNumber = savedState.nextTokenNumber || (savedState.tokens ? Math.max(...savedState.tokens.map(t => t.tokenNumber), 0) + 1 : 1);
      
      console.log('Queue state loaded from file:', {
        tokens: queueState.tokens.length,
        currentNumber: queueState.currentNumber,
        nextTokenNumber: queueState.nextTokenNumber
      });
    }
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
    // Ensure directory exists
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    
    // Save the complete queue state including currentNumber and nextTokenNumber
    const dataToSave = {
      tokens: queueState.tokens || [],
      currentNumber: queueState.currentNumber || 1,
      nextTokenNumber: queueState.nextTokenNumber || 1
    };
    
    // Write to a temporary file first, then rename (atomic operation)
    const tempFile = `${DATA_FILE}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(dataToSave, null, 2));
    await fs.rename(tempFile, DATA_FILE);
    
    console.log('Queue state saved successfully');
  } catch (error) {
    console.error('Error saving queue state:', error);
    // Don't rethrow to prevent server crash, but log the error
  }
}

// Initialize data and start the server
async function initialize() {
  try {
    await ensureDataFileExists();
    
    // Always reset the queue state when the server starts
    queueState = {
      tokens: [],
      currentNumber: 1,
      nextTokenNumber: 1
    };
    
    // Save the reset state
    await saveData();
    
  } catch (error) {
    console.error('Error initializing data:', error);
    // Initialize with default values if loading fails
    queueState = {
      tokens: [],
      currentNumber: 1,
      nextTokenNumber: 1
    };
  }
  
  // Start the server
  app.listen(PORT, () => {
    console.log(`ClinicQueue backend running on http://localhost:${PORT}`);
    console.log('Queue has been reset. Initial state:', {
      currentNumber: queueState.currentNumber,
      nextTokenNumber: queueState.nextTokenNumber,
      tokenCount: 0
    });
  });
}

// POST /api/reset-queue - reset all state
app.post("/api/reset-queue", async (req, res) => {
  try {
    // Reset the queue state
    queueState = {
      tokens: [],
      currentNumber: 1,
      nextTokenNumber: 1
    };
    
    // Save the reset state
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

// Start the application
initialize();

// GET /api/queue - return current queue status
app.get("/api/queue", (req, res) => {
  res.json({
    tokens: queueState.tokens,
    currentNumber: queueState.currentNumber,
  });
});

// POST /api/book-token - create a new token
app.post("/api/book-token", async (req, res) => {
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

