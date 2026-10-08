import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getAllCategories,
    getAllPublishers,
    getFilteredGames,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

/** Seeds two categories, two publishers, and games spread across the combinations. */
async function seedCatalog(db: Database): Promise<{
    strategyId: number;
    puzzleId: number;
    pubOneId: number;
    pubTwoId: number;
}> {
    const [strategy] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [puzzle] = await db
        .insert(categories)
        .values({ name: 'Puzzle', description: 'cat' })
        .returning({ id: categories.id });
    const [pubOne] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });
    const [pubTwo] = await db
        .insert(publishers)
        .values({ name: 'Pub Two', description: 'pub' })
        .returning({ id: publishers.id });

    await db.insert(games).values([
        {
            title: 'Game A (Strategy, Pub One)',
            description: 'desc',
            starRating: 4.0,
            categoryId: strategy.id,
            publisherId: pubOne.id,
        },
        {
            title: 'Game B (Strategy, Pub Two)',
            description: 'desc',
            starRating: 4.0,
            categoryId: strategy.id,
            publisherId: pubTwo.id,
        },
        {
            title: 'Game C (Puzzle, Pub One)',
            description: 'desc',
            starRating: 4.0,
            categoryId: puzzle.id,
            publisherId: pubOne.id,
        },
        {
            title: 'Game D (Puzzle, Pub Two)',
            description: 'desc',
            starRating: 4.0,
            categoryId: puzzle.id,
            publisherId: pubTwo.id,
        },
    ]);

    return { strategyId: strategy.id, puzzleId: puzzle.id, pubOneId: pubOne.id, pubTwoId: pubTwo.id };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});

describe('getAllCategories', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all categories ordered by name', async () => {
        await seedCatalog(db);
        const all = await getAllCategories(db);
        expect(all.map((c) => c.name)).toEqual(['Puzzle', 'Strategy']);
    });

    it('returns an empty array when there are no categories', async () => {
        expect(await getAllCategories(db)).toEqual([]);
    });
});

describe('getAllPublishers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all publishers ordered by name', async () => {
        await seedCatalog(db);
        const all = await getAllPublishers(db);
        expect(all.map((p) => p.name)).toEqual(['Pub One', 'Pub Two']);
    });

    it('returns an empty array when there are no publishers', async () => {
        expect(await getAllPublishers(db)).toEqual([]);
    });
});

describe('getFilteredGames', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title when no filters are given', async () => {
        await seedCatalog(db);
        const all = await getFilteredGames(db);
        expect(all.map((g) => g.title)).toEqual([
            'Game A (Strategy, Pub One)',
            'Game B (Strategy, Pub Two)',
            'Game C (Puzzle, Pub One)',
            'Game D (Puzzle, Pub Two)',
        ]);
    });

    it('filters by a single category', async () => {
        const { strategyId } = await seedCatalog(db);
        const result = await getFilteredGames(db, { categoryIds: [strategyId] });
        expect(result.map((g) => g.title)).toEqual(['Game A (Strategy, Pub One)', 'Game B (Strategy, Pub Two)']);
    });

    it('filters by multiple categories (OR within the dimension)', async () => {
        const { strategyId, puzzleId } = await seedCatalog(db);
        const result = await getFilteredGames(db, { categoryIds: [strategyId, puzzleId] });
        expect(result).toHaveLength(4);
    });

    it('filters by a single publisher', async () => {
        const { pubOneId } = await seedCatalog(db);
        const result = await getFilteredGames(db, { publisherIds: [pubOneId] });
        expect(result.map((g) => g.title)).toEqual(['Game A (Strategy, Pub One)', 'Game C (Puzzle, Pub One)']);
    });

    it('combines category and publisher filters with AND', async () => {
        const { strategyId, pubTwoId } = await seedCatalog(db);
        const result = await getFilteredGames(db, { categoryIds: [strategyId], publisherIds: [pubTwoId] });
        expect(result.map((g) => g.title)).toEqual(['Game B (Strategy, Pub Two)']);
    });

    it('returns an empty array when no games match the combined filters', async () => {
        const { strategyId } = await seedCatalog(db);
        const result = await getFilteredGames(db, { categoryIds: [strategyId], publisherIds: [999999] });
        expect(result).toEqual([]);
    });

    it('returns an empty array for a non-existent category', async () => {
        await seedCatalog(db);
        const result = await getFilteredGames(db, { categoryIds: [999999] });
        expect(result).toEqual([]);
    });

    it('treats empty filter arrays as no constraint', async () => {
        await seedCatalog(db);
        const result = await getFilteredGames(db, { categoryIds: [], publisherIds: [] });
        expect(result).toHaveLength(4);
    });
});
