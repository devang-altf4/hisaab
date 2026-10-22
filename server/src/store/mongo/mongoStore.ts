import mongoose, { type Model } from 'mongoose';
import { newId } from '../../lib/ids.js';
import type { Filter, FindOptions, Repo, Store, UsageDay, UsageDelta } from '../types.js';
import {
  ChatHistoryModel,
  MealLogModel,
  UsageDayModel,
  UserModel,
  WaterLogModel,
  WorkoutLogModel,
} from './models.js';

// Our entities use `id`; Mongo stores it as `_id`.
const toDoc = <T extends { id: string }>({ id, ...rest }: T) => ({ _id: id, ...rest });
const fromDoc = <T>(doc: any): T | null => {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id, ...rest } as T;
};
const mapFilter = (filter: Record<string, unknown>) => {
  const { id, ...rest } = filter;
  return id === undefined ? rest : { _id: id, ...rest };
};

class MongoRepo<T extends { id: string }> implements Repo<T> {
  constructor(private model: Model<any>) {}

  async create(doc: T) {
    await this.model.create(toDoc(doc));
    return doc;
  }
  async get(id: string) {
    return fromDoc<T>(await this.model.findById(id).lean());
  }
  async findOne(filter: Filter<T>) {
    return fromDoc<T>(await this.model.findOne(mapFilter(filter)).lean());
  }
  async find(filter: Filter<T>, opts: FindOptions<T> = {}) {
    let q = this.model.find(mapFilter(filter));
    if (opts.sort) q = q.sort(opts.sort as Record<string, 1 | -1>);
    if (opts.limit) q = q.limit(opts.limit);
    const rows = await q.lean();
    return rows.map((r) => fromDoc<T>(r)!);
  }
  async count(filter: Filter<T>) {
    return this.model.countDocuments(mapFilter(filter));
  }
  async update(id: string, patch: Partial<T>) {
    const { id: _ignored, ...set } = patch as Record<string, unknown>;
    return fromDoc<T>(await this.model.findByIdAndUpdate(id, { $set: set }, { returnDocument: 'after' }).lean());
  }
  async delete(id: string) {
    const res = await this.model.deleteOne({ _id: id });
    return res.deletedCount > 0;
  }
}

export async function createMongoStore(uri: string, dbName: string): Promise<Store> {
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10000 });
  await Promise.all(
    [UserModel, MealLogModel, WorkoutLogModel, WaterLogModel, ChatHistoryModel, UsageDayModel].map((m) => m.syncIndexes()),
  );

  return {
    kind: 'mongo',
    users: new MongoRepo(UserModel),
    meals: new MongoRepo(MealLogModel),
    workouts: new MongoRepo(WorkoutLogModel),
    water: new MongoRepo(WaterLogModel),
    chat: new MongoRepo(ChatHistoryModel),
    usage: new MongoRepo(UsageDayModel),
    async incUsage(userId: string, date: string, delta: UsageDelta) {
      const doc = await UsageDayModel.findOneAndUpdate(
        { userId, date },
        { $inc: delta, $setOnInsert: { _id: newId() } },
        { upsert: true, returnDocument: 'after' },
      ).lean();
      return fromDoc<UsageDay>(doc)!;
    },
    async close() {
      await mongoose.disconnect();
    },
  };
}
