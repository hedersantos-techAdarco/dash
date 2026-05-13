import express from "express";

const app = express();
app.use(express.json({ limit: '10mb' }));

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Adarco API is running (Client-Side Only)" });
});

export default app;
