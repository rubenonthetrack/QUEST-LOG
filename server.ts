import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("questlog.db");

// Initialize database and handle migrations
db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_stats (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1
  );

  INSERT OR IGNORE INTO user_stats (id, xp, level) VALUES (1, 0, 1);
`);

// Migrations: Add color column if missing
try {
  db.prepare("ALTER TABLE goals ADD COLUMN color TEXT DEFAULT '#10b981'").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE subtasks ADD COLUMN color TEXT DEFAULT '#10b981'").run();
} catch (e) {}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes for User Stats
  app.get("/api/stats", (req, res) => {
    const stats = db.prepare("SELECT * FROM user_stats WHERE id = 1").get();
    res.json(stats);
  });

  app.post("/api/stats/add-xp", (req, res) => {
    const { amount } = req.body;
    const stats = db.prepare("SELECT * FROM user_stats WHERE id = 1").get();
    let newXp = stats.xp + amount;
    let newLevel = stats.level;
    
    while (newXp >= 100) {
      newXp -= 100;
      newLevel += 1;
    }
    
    db.prepare("UPDATE user_stats SET xp = ?, level = ? WHERE id = 1").run(newXp, newLevel);
    res.json({ xp: newXp, level: newLevel });
  });

  // Export all data
  app.get("/api/export", (req, res) => {
    const notes = db.prepare("SELECT * FROM notes").all();
    const goals = db.prepare("SELECT * FROM goals").all();
    const subtasks = db.prepare("SELECT * FROM subtasks").all();
    const stats = db.prepare("SELECT * FROM user_stats WHERE id = 1").get();
    res.json({ notes, goals, subtasks, stats });
  });

  // Import all data
  app.post("/api/import", (req, res) => {
    const { notes, goals, subtasks, stats } = req.body;
    
    db.transaction(() => {
      db.prepare("DELETE FROM notes").run();
      db.prepare("DELETE FROM goals").run();
      db.prepare("DELETE FROM subtasks").run();
      
      if (notes) {
        const insertNote = db.prepare("INSERT INTO notes (id, content, created_at) VALUES (?, ?, ?)");
        notes.forEach(n => insertNote.run(n.id, n.content, n.created_at));
      }
      
      if (goals) {
        const insertGoal = db.prepare("INSERT INTO goals (id, title, description, status, color, created_at) VALUES (?, ?, ?, ?, ?, ?)");
        goals.forEach(g => insertGoal.run(g.id, g.title, g.description, g.status, g.color || '#10b981', g.created_at));
      }
      
      if (subtasks) {
        const insertSubtask = db.prepare("INSERT INTO subtasks (id, goal_id, title, completed, color) VALUES (?, ?, ?, ?, ?)");
        subtasks.forEach(s => insertSubtask.run(s.id, s.goal_id, s.title, s.completed, s.color || '#10b981'));
      }
      
      if (stats) {
        db.prepare("UPDATE user_stats SET xp = ?, level = ? WHERE id = 1").run(stats.xp, stats.level);
      }
    })();
    
    res.json({ success: true });
  });

  // API Routes for Notes
  app.get("/api/notes", (req, res) => {
    const notes = db.prepare("SELECT * FROM notes ORDER BY created_at DESC").all();
    res.json(notes);
  });

  app.post("/api/notes", (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: "Content is required" });
    const info = db.prepare("INSERT INTO notes (content) VALUES (?)").run(content);
    res.json({ id: info.lastInsertRowid, content });
  });

  app.delete("/api/notes/:id", (req, res) => {
    db.prepare("DELETE FROM notes WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // API Routes for Goals
  app.get("/api/goals", (req, res) => {
    const goals = db.prepare("SELECT * FROM goals ORDER BY created_at DESC").all();
    const goalsWithSubtasks = goals.map(goal => {
      const subtasks = db.prepare("SELECT * FROM subtasks WHERE goal_id = ?").all(goal.id);
      return { ...goal, subtasks };
    });
    res.json(goalsWithSubtasks);
  });

  app.post("/api/goals", (req, res) => {
    const { title, description, color } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    const info = db.prepare("INSERT INTO goals (title, description, color) VALUES (?, ?, ?)").run(title, description || "", color || "#10b981");
    res.json({ id: info.lastInsertRowid, title, description, status: 'pending', color: color || "#10b981", subtasks: [] });
  });

  app.patch("/api/goals/:id", (req, res) => {
    const { status, color, title, description } = req.body;
    if (status && !['pending', 'completed', 'failed'].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    
    if (status !== undefined) db.prepare("UPDATE goals SET status = ? WHERE id = ?").run(status, req.params.id);
    if (color !== undefined) db.prepare("UPDATE goals SET color = ? WHERE id = ?").run(color, req.params.id);
    if (title !== undefined) db.prepare("UPDATE goals SET title = ? WHERE id = ?").run(title, req.params.id);
    if (description !== undefined) db.prepare("UPDATE goals SET description = ? WHERE id = ?").run(description, req.params.id);
    
    res.json({ success: true });
  });

  app.delete("/api/goals/:id", (req, res) => {
    db.prepare("DELETE FROM goals WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // API Routes for Subtasks
  app.post("/api/goals/:id/subtasks", (req, res) => {
    const { title, color } = req.body;
    const info = db.prepare("INSERT INTO subtasks (goal_id, title, color) VALUES (?, ?, ?)").run(req.params.id, title, color || "#10b981");
    res.json({ id: info.lastInsertRowid, title, completed: 0, color: color || "#10b981" });
  });

  app.patch("/api/subtasks/:id", (req, res) => {
    const { completed, color, title } = req.body;
    if (completed !== undefined) db.prepare("UPDATE subtasks SET completed = ? WHERE id = ?").run(completed ? 1 : 0, req.params.id);
    if (color !== undefined) db.prepare("UPDATE subtasks SET color = ? WHERE id = ?").run(color, req.params.id);
    if (title !== undefined) db.prepare("UPDATE subtasks SET title = ? WHERE id = ?").run(title, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/subtasks/:id", (req, res) => {
    db.prepare("DELETE FROM subtasks WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
