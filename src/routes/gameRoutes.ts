import { Router } from "express";
import type { Request, Response } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { supabase } from "../lib/supabaseClient.js";

const router = Router();

// Generate a unique 6-character uppercase game code
function generateGameCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// POST /api/games - Create a new game session
router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { mode, max_players } = req.body;
    const gameCode = generateGameCode();
    const hostId = req.user?.id;

    if (!hostId) {
      res.status(401).json({ error: "User ID not found" });
      return;
    }

    if (!mode || !max_players) {
      res.status(400).json({ error: "mode and max_players are required" });
      return;
    }

    const { data, error } = await supabase
      .from("game_sessions")
      .insert([
        {
          host_id: hostId,
          mode,
          max_players,
          code: gameCode,
          status: "waiting",
        },
      ])
      .select();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/games/:code - Fetch game session and players
router.get("/:code", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { code } = req.params;

    // Fetch game session
    const { data: gameData, error: gameError } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("code", code)
      .single();

    if (gameError || !gameData) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    // Fetch players in the game
    const { data: playersData, error: playersError } = await supabase
      .from("game_players")
      .select("*")
      .eq("game_id", gameData.id);

    if (playersError) {
      res.status(500).json({ error: playersError.message });
      return;
    }

    res.json({ game: gameData, players: playersData || [] });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/games/:code/join - Join a game session
router.post(
  "/:code/join",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { code } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: "User ID not found" });
        return;
      }

      // Fetch game session
      const { data: gameData, error: gameError } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("code", code)
        .single();

      if (gameError || !gameData) {
        res.status(404).json({ error: "Game not found" });
        return;
      }

      // Check if game is in "waiting" status
      if (gameData.status !== "waiting") {
        res.status(400).json({ error: "Game is not accepting new players" });
        return;
      }

      // Count current players
      const { data: playersData, error: countError } = await supabase
        .from("game_players")
        .select("id", { count: "exact" })
        .eq("game_id", gameData.id);

      if (countError) {
        res.status(500).json({ error: countError.message });
        return;
      }

      const currentPlayerCount = playersData?.length || 0;

      if (currentPlayerCount >= gameData.max_players) {
        res.status(400).json({ error: "Game is full" });
        return;
      }

      // Insert player into game_players
      const { data: insertData, error: insertError } = await supabase
        .from("game_players")
        .insert([{ game_id: gameData.id, user_id: userId }])
        .select();

      if (insertError) {
        res.status(500).json({ error: insertError.message });
        return;
      }

      // Fetch updated player list
      const { data: updatedPlayers } = await supabase
        .from("game_players")
        .select("*")
        .eq("game_id", gameData.id);

      res.status(201).json(updatedPlayers || []);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// PATCH /api/games/:code/start - Start a game session
router.patch(
  "/:code/start",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { code } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: "User ID not found" });
        return;
      }

      // Fetch game session
      const { data: gameData, error: gameError } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("code", code)
        .single();

      if (gameError || !gameData) {
        res.status(404).json({ error: "Game not found" });
        return;
      }

      // Check if user is the host
      if (gameData.host_id !== userId) {
        res.status(403).json({ error: "Only the host can start the game" });
        return;
      }

      // Update game status to "in_progress"
      const { data: updatedGame, error: updateError } = await supabase
        .from("game_sessions")
        .update({ status: "in_progress" })
        .eq("id", gameData.id)
        .select()
        .single();

      if (updateError) {
        res.status(500).json({ error: updateError.message });
        return;
      }

      res.json(updatedGame);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
