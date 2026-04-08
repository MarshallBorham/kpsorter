import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
  type: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
});

eventSchema.index({ type: 1, createdAt: -1 });

export const Event = mongoose.model("Event", eventSchema);