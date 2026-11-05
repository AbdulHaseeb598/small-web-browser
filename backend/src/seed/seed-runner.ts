import { Types } from 'mongoose';
import type { Collection, Model } from 'mongoose';
import type { Person } from '../people/person.schema.js';
import type { Site } from '../sites/site.schema.js';
import type { Visit } from '../visits/visit.schema.js';
import { SEED_PEOPLE, SEED_SITES, SEED_VISITS } from './seed-data.js';

export interface SeedModels {
  people: Model<Person>;
  sites: Model<Site>;
  visits: Model<Visit>;
}

type CollectionName = keyof SeedModels;
type SeedDocument = {
  _id: Types.ObjectId;
  [key: string]: string | Date | Types.ObjectId;
};
export type SeedSummary = Record<
  CollectionName,
  { inserted: number; updated: number; existing: number }
>;

export class SeedConflictError extends Error {
  constructor(collection: CollectionName, document: SeedDocument) {
    super(
      `Seed conflict in ${collection}: reserved identity ${document._id.toHexString()}${document.address ? ' (' + String(document.address) + ')' : ''} is occupied by different data. Existing documents were not overwritten. Resolve the conflict manually before retrying.`,
    );
    this.name = 'SeedConflictError';
  }
}

interface SeedGroup {
  name: CollectionName;
  collection: Collection;
  documents: SeedDocument[];
  validate: (document: SeedDocument) => Promise<void>;
}

function group<T>(
  name: CollectionName,
  model: Model<T>,
  documents: SeedDocument[],
): SeedGroup {
  return {
    name,
    collection: model.collection,
    documents,
    validate: async (document) => {
      await new model(document).validate();
    },
  };
}

function matches(
  existing: Record<string, unknown>,
  expected: SeedDocument,
): boolean {
  if (Object.keys(existing).length !== Object.keys(expected).length)
    return false;
  return Object.entries(expected).every(([key, value]) => {
    const actual = existing[key];
    if (value instanceof Date)
      return actual instanceof Date && actual.getTime() === value.getTime();
    if (value instanceof Types.ObjectId)
      return actual instanceof Types.ObjectId && value.equals(actual);
    return value === actual;
  });
}

function isDuplicateKey(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 11000
  );
}

export async function seedDatabase(models: SeedModels): Promise<SeedSummary> {
  const groups = [
    group(
      'people',
      models.people,
      SEED_PEOPLE.map((person) => ({
        ...person,
        _id: new Types.ObjectId(person._id),
        createdAt: new Date(person.createdAt),
      })),
    ),
    group(
      'sites',
      models.sites,
      SEED_SITES.map((site) => ({
        ...site,
        _id: new Types.ObjectId(site._id),
        authorId: new Types.ObjectId(site.authorId),
        createdAt: new Date(site.createdAt),
        updatedAt: new Date(site.updatedAt),
      })),
    ),
    group(
      'visits',
      models.visits,
      SEED_VISITS.map((visit) => ({
        ...visit,
        _id: new Types.ObjectId(visit._id),
        personId: new Types.ObjectId(visit.personId),
        visitedAt: new Date(visit.visitedAt),
      })),
    ),
  ];
  const summary: SeedSummary = {
    people: { inserted: 0, updated: 0, existing: 0 },
    sites: { inserted: 0, updated: 0, existing: 0 },
    visits: { inserted: 0, updated: 0, existing: 0 },
  };

  await Promise.all([
    models.people.init(),
    models.sites.init(),
    models.visits.init(),
  ]);

  // Preflight the whole dataset before writing: validate against the real schemas
  // and reject known ID/address collisions even if they occur late in the dataset.
  for (const current of groups) {
    for (const document of current.documents) {
      await current.validate(document);
      const existing = await current.collection.findOne({ _id: document._id });
      if (existing && !matches(existing, document))
        throw new SeedConflictError(current.name, document);
      if (current.name === 'sites') {
        const occupied = await current.collection.findOne({
          address: document.address,
        });
        if (occupied && !matches(occupied, document))
          throw new SeedConflictError(current.name, document);
      }
    }
  }

  // Parent records always precede sites and visits. Insert-only writes preserve
  // authored HTML, immutable visits, and fixed timestamps on every subsequent run.
  // The collection API is intentional: schema validation happened above, while
  // Mongoose timestamp/default hooks must not introduce the current clock here.
  for (const current of groups) {
    for (const document of current.documents) {
      let inserted = false;
      try {
        const result = await current.collection.updateOne(
          { _id: document._id },
          { $setOnInsert: document },
          { upsert: true },
        );
        inserted = result.upsertedCount === 1;
      } catch (error: unknown) {
        if (!isDuplicateKey(error)) throw error;
        // Another seed process may have won the same insert. Only accept its
        // result if every field agrees; a different owner's address is a conflict.
      }
      const persisted = await current.collection.findOne({ _id: document._id });
      if (!persisted || !matches(persisted, document))
        throw new SeedConflictError(current.name, document);
      if (inserted) summary[current.name].inserted++;
      else summary[current.name].existing++;
    }
  }
  return summary;
}
