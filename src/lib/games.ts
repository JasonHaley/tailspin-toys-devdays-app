import { eq, asc, and, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game, Category, Publisher } from '../types/game';

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

/** All games ordered by title. */
export async function getAllGames(db: Database): Promise<Game[]> {
    const rows = await baseGamesQuery(db).orderBy(asc(games.title));
    return rows.map(mapGame);
}

/** All game ids ordered by title. */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}

/**
 * All categories ordered by name, for populating filter controls.
 *
 * @param db - Injectable Drizzle database client.
 * @returns Every category, ordered alphabetically by name.
 */
export async function getAllCategories(db: Database): Promise<Category[]> {
    return db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name));
}

/**
 * All publishers ordered by name, for populating filter controls.
 *
 * @param db - Injectable Drizzle database client.
 * @returns Every publisher, ordered alphabetically by name.
 */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    return db.select({ id: publishers.id, name: publishers.name }).from(publishers).orderBy(asc(publishers.name));
}

/** Filter options for {@link getFilteredGames}. Omitted/empty arrays apply no constraint on that dimension. */
export interface GameFilters {
    /** Category ids to match, OR'd together. Omit or pass an empty array to apply no category constraint. */
    categoryIds?: number[];
    /** Publisher ids to match, OR'd together. Omit or pass an empty array to apply no publisher constraint. */
    publisherIds?: number[];
}

/**
 * Games matching the given filters, ordered by title. Categories (and
 * publishers) are OR'd together within their own dimension; the category and
 * publisher dimensions are AND'd together. Omitting or passing an empty array
 * for a dimension applies no constraint on that dimension.
 *
 * @param db - Injectable Drizzle database client.
 * @param filters - Category/publisher id constraints to apply; defaults to no filtering.
 * @returns Games matching the filters, ordered by title.
 */
export async function getFilteredGames(db: Database, filters: GameFilters = {}): Promise<Game[]> {
    const conditions = [];
    if (filters.categoryIds && filters.categoryIds.length > 0) {
        conditions.push(inArray(games.categoryId, filters.categoryIds));
    }
    if (filters.publisherIds && filters.publisherIds.length > 0) {
        conditions.push(inArray(games.publisherId, filters.publisherIds));
    }

    const query = baseGamesQuery(db);
    const rows = await (conditions.length > 0 ? query.where(and(...conditions)) : query).orderBy(asc(games.title));
    return rows.map(mapGame);
}
