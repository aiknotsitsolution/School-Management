// src/config/db.js

const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error("MONGODB_URI is not defined");
    }

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      bufferCommands: false,
    });

    console.log("✅ MongoDB connected");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
