import mongoose from "mongoose";

let isConnected = false;

export async function connectMongo() {
  if (isConnected) {
    console.log("[Mongo] Already connected");
    return;
  }

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "metryxone";
  const mongoRequired =
    (process.env.MONGO_REQUIRED || "false").toLowerCase() === "true";

  if (!uri) {
    const message = "MONGODB_URI missing. Add it in server/.env";

    if (mongoRequired) {
      throw new Error(message);
    } else {
      console.warn(`[Mongo] ${message} (continuing because MONGO_REQUIRED=false)`);
      return;
    }
  }

  try {
    await mongoose.connect(uri, {
      dbName,
      autoIndex: process.env.NODE_ENV !== "production",
    });

    isConnected = true;
    console.log(`[Mongo] Connected (db=${dbName})`);
  } catch (err) {
    console.error("[Mongo] Connection failed:", err);

    if (mongoRequired) {
      throw err;
    } else {
      console.warn("[Mongo] Continuing without MongoDB (MONGO_REQUIRED=false)");
    }
  }
}
