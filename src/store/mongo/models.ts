import { Schema, model, type Model } from 'mongoose';

/**
 * Mongoose models. We use our own string ids (UUIDs) as `_id`, so the
 * same ids work across the file store and Mongo, and the API never leaks ObjectIds.
 */

const opts = { versionKey: false as const, minimize: false };

const ProfileSchema = new Schema(
  {
    sex: { type: String, enum: ['male', 'female'] },
    age: Number,
    heightCm: Number,
    weightKg: Number,
    activityLevel: { type: String, enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'] },
    goal: { type: String, enum: ['lose', 'maintain', 'gain'] },
    targetWeightKg: Number,
  },
  { _id: false },
);

const TargetsSchema = new Schema(
  { calories: Number, proteinG: Number, carbsG: Number, fatG: Number, waterMl: Number },
  { _id: false },
);

const UserSchema = new Schema(
  {
    _id: { type: String, required: true },
    deviceId: { type: String, required: true, unique: true },
    // Sparse: guests have no email field at all (never store null here, or the unique index breaks).
    email: { type: String, unique: true, sparse: true },
    passwordHash: { type: String },
    name: { type: String, default: 'Friend' },
    role: { type: String, enum: ['user', 'trainer'], default: 'user' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    profile: { type: ProfileSchema, default: null },
    targets: { type: TargetsSchema, required: true },
    customTargets: { type: Boolean, default: false },
    isPro: { type: Boolean, default: false },
    proUntil: { type: String, default: null },
    pushTokens: { type: [String], default: [] },
    pushEnabled: { type: Boolean, default: false, index: true },
    notificationsPerDay: { type: Number, default: 10 },
    nudgesSent: { type: Schema.Types.Mixed, default: {} },
    healthSync: { appleHealth: { type: Boolean, default: false }, healthConnect: { type: Boolean, default: false } },
    trainerInviteCode: { type: String, required: true, unique: true },
    trainerIds: { type: [String], default: [], index: true },
    createdAt: { type: String, required: true },
    lastActiveAt: { type: String, required: true },
  },
  opts,
);

const IngredientSchema = new Schema(
  {
    name: String,
    quantity: String,
    calories: Number,
    grams: Number,
    proteinG: Number,
    carbsG: Number,
    fatG: Number,
    fiberG: Number,
    pieces: Number,
    pieceUnit: String,
  },
  { _id: false },
);

const MealLogSchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true },
    date: { type: String, required: true },
    loggedAt: { type: String, required: true },
    mealType: { type: String, enum: ['breakfast', 'lunch', 'snack', 'dinner'], required: true },
    source: { type: String, enum: ['photo', 'text', 'barcode', 'manual'], required: true },
    status: { type: String, enum: ['analyzing', 'done', 'failed'], required: true },
    imageUrl: { type: String, default: null },
    description: { type: String, default: null },
    dishName: String,
    calories: Number,
    proteinG: Number,
    carbsG: Number,
    fatG: Number,
    fiberG: Number,
    healthScore: Number,
    ingredients: { type: [IngredientSchema], default: [] },
    verdict: String,
    confidence: Number,
    error: { type: String, default: null },
    servings: { type: Number, default: 1 },
    edited: { type: Boolean, default: false },
    clarify: { type: Schema.Types.Mixed, default: null },
    corrections: { type: Number, default: 0 },
  },
  opts,
);
MealLogSchema.index({ userId: 1, date: 1 });

const WorkoutLogSchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true },
    date: { type: String, required: true },
    loggedAt: { type: String, required: true },
    type: String,
    durationMin: Number,
    caloriesBurned: Number,
    source: { type: String, enum: ['manual', 'apple_health', 'health_connect'], default: 'manual' },
    externalId: { type: String, default: null },
    notes: { type: String, default: null },
  },
  opts,
);
WorkoutLogSchema.index({ userId: 1, date: 1 });
WorkoutLogSchema.index({ userId: 1, externalId: 1 }, { sparse: true });

const WaterLogSchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true },
    date: { type: String, required: true },
    loggedAt: { type: String, required: true },
    ml: Number,
  },
  opts,
);
WaterLogSchema.index({ userId: 1, date: 1 });

const ChatHistorySchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true },
    role: { type: String, enum: ['user', 'model'], required: true },
    text: String,
    createdAt: { type: String, required: true },
  },
  opts,
);
ChatHistorySchema.index({ userId: 1, createdAt: -1 });

const UsageDaySchema = new Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true },
    date: { type: String, required: true },
    scans: { type: Number, default: 0 },
    chats: { type: Number, default: 0 },
    aiCalls: { type: Number, default: 0 },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    costUsd: { type: Number, default: 0 },
  },
  opts,
);
UsageDaySchema.index({ userId: 1, date: 1 }, { unique: true });
UsageDaySchema.index({ date: 1 });

export const UserModel: Model<any> = model('User', UserSchema);
export const MealLogModel: Model<any> = model('MealLog', MealLogSchema);
export const WorkoutLogModel: Model<any> = model('WorkoutLog', WorkoutLogSchema);
export const WaterLogModel: Model<any> = model('WaterLog', WaterLogSchema);
export const ChatHistoryModel: Model<any> = model('ChatHistory', ChatHistorySchema);
export const UsageDayModel: Model<any> = model('UsageDay', UsageDaySchema);
