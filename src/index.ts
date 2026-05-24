import "dotenv/config";
import express from "express";
import cors from "cors";
import testRoute from "./routes/testRoute.js";
import gameRoutes from "./routes/gameRoutes.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("PitchIQ backend is alive!"));
app.use("/api/test", testRoute);
app.use("/api/games", gameRoutes);

app.listen(4000, () => console.log("Server running on port 4000"));
