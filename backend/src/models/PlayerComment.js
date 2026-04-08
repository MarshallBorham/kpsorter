import mongoose from "mongoose";

const playerCommentSchema = new mongoose.Schema(
  {
    playerId: { type: String, required: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    username: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

playerCommentSchema.index({ playerId: 1, createdAt: -1 });

export const PlayerComment = mongoose.model("PlayerComment", playerCommentSchema);
