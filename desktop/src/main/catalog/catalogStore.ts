export const CATALOG_SEARCH_LIMIT = 20;
export const CATALOG_SEARCH_LIMIT_MAX = 50;
export const CATALOG_QUERY_MAX = 80;

export interface CatalogRow {
    id: number;
    name: string;
    active: number;
    created_at?: string;
    updated_at?: string;
}

export interface MedicineCatalogRow extends CatalogRow {
    form: string | null;
    dosage: string | null;
    route: string | null;
    frequency: string | null;
    duration: string | null;
    instruction: string | null;
}

export interface PrescriptionLine {
    medicine: string;
    form: string;
    dosage: string;
    route: string;
    frequency: string;
    duration: string;
    instruction: string;
    medicine_id?: number | null;
}

type SqliteDb = {
    prepare: (sql: string) => {
        get: (...args: any[]) => any;
        all: (...args: any[]) => any[];
        run: (...args: any[]) => { lastInsertRowid: number | bigint; changes: number };
    };
    exec: (sql: string) => unknown;
    transaction: <T extends (...args: any[]) => any>(fn: T) => T & { immediate: T };
};

interface CatalogWriteFields {
    name: string;
    form?: string;
    dosage?: string;
    route?: string;
    frequency?: string;
    duration?: string;
    instruction?: string;
}

export function searchConditions(db: SqliteDb, query?: string, limit?: number): CatalogRow[] {
    return searchActive(db, 'condition_catalog', query, limit);
}

export function searchMedicines(db: SqliteDb, query?: string, limit?: number): MedicineCatalogRow[] {
    return searchActive(db, 'medicine_catalog', query, limit) as MedicineCatalogRow[];
}

export function createCondition(db: SqliteDb, input: { name?: string } | string): CatalogRow {
    const name = normalizeName(typeof input === 'string' ? input : input?.name);
    return insertNamed(db, 'condition_catalog', { name });
}

export function createMedicine(db: SqliteDb, input: Partial<MedicineCatalogRow> & { name?: string }): MedicineCatalogRow {
    const name = normalizeName(input?.name);
    const defaults = defaultRxFields(input);
    const row = insertNamed(db, 'medicine_catalog', {
        name,
        ...defaults
    });
    return { ...row, ...defaults };
}

export function getConditionMedPresets(db: SqliteDb, conditionId: number): PrescriptionLine[] {
    const id = Number(conditionId);
    if (!Number.isInteger(id) || id <= 0) return [];
    const rows = db.prepare(`
        SELECT p.medicine_id, p.medicine, p.form, p.dosage, p.route, p.frequency, p.duration, p.instruction
        FROM condition_med_presets p
        LEFT JOIN medicine_catalog m ON m.id = p.medicine_id
        WHERE p.condition_id = ?
          AND (p.medicine_id IS NULL OR m.active = 1)
        ORDER BY p.sort_order ASC, p.id ASC
    `).all(id);
    return rows.map((row) => toRxLine(row));
}

export function listConditions(db: SqliteDb, includeRetired = false): CatalogRow[] {
    return listCatalog(db, 'condition_catalog', includeRetired);
}

export function listMedicines(db: SqliteDb, includeRetired = false): MedicineCatalogRow[] {
    return listCatalog(db, 'medicine_catalog', includeRetired) as MedicineCatalogRow[];
}

export function updateCondition(db: SqliteDb, input: { id?: number; name?: string }): CatalogRow {
    const id = requireId(input?.id);
    const name = normalizeName(input?.name);
    return updateNamed(db, 'condition_catalog', id, { name });
}

export function updateMedicine(db: SqliteDb, input: Partial<MedicineCatalogRow> & { id?: number; name?: string }): MedicineCatalogRow {
    const id = requireId(input?.id);
    const existing = db.prepare('SELECT * FROM medicine_catalog WHERE id = ?').get(id) as MedicineCatalogRow | undefined;
    if (!existing) throw new Error('CATALOG_NOT_FOUND');
    const name = normalizeName(input?.name != null ? input.name : existing.name);
    const defaults = defaultRxFields(mergeMedicineFields(existing, input));
    return updateNamed(db, 'medicine_catalog', id, { name, ...defaults }) as MedicineCatalogRow;
}

export function retireCondition(db: SqliteDb, id: number): { id: number; active: number } {
    return retireRow(db, 'condition_catalog', id);
}

export function retireMedicine(db: SqliteDb, id: number): { id: number; active: number } {
    return retireRow(db, 'medicine_catalog', id);
}

export function replaceConditionMedPresets(
    db: SqliteDb,
    input: { conditionId?: number; lines?: Array<Partial<PrescriptionLine>> }
): PrescriptionLine[] {
    const conditionId = requireId(input?.conditionId);
    const condition = db.prepare('SELECT id FROM condition_catalog WHERE id = ?').get(conditionId);
    if (!condition) throw new Error('CONDITION_NOT_FOUND');

    const lines = Array.isArray(input?.lines) ? input.lines : [];
    const run = db.transaction(() => {
        db.prepare('DELETE FROM condition_med_presets WHERE condition_id = ?').run(conditionId);
        const insert = db.prepare(`
            INSERT INTO condition_med_presets (
                condition_id, sort_order, medicine_id, medicine, form, dosage, route, frequency, duration, instruction
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        lines.forEach((line, index) => {
            const rx = resolvePresetLine(db, line);
            insert.run(
                conditionId,
                index,
                rx.medicine_id || null,
                rx.medicine,
                rx.form,
                rx.dosage,
                rx.route,
                rx.frequency,
                rx.duration,
                rx.instruction
            );
        });
        return getConditionMedPresets(db, conditionId);
    });
    return typeof (run as any).immediate === 'function' ? (run as any).immediate() : run();
}

function searchActive(db: SqliteDb, table: 'condition_catalog' | 'medicine_catalog', query?: string, limit?: number) {
    const capped = capLimit(limit);
    const term = String(query || '').trim().slice(0, CATALOG_QUERY_MAX);
    if (!term) {
        return db.prepare(`SELECT * FROM ${table} WHERE active = 1 ORDER BY name COLLATE NOCASE LIMIT ?`).all(capped);
    }
    const contains = likeContains(term);
    const prefix = likePrefix(term);
    return db.prepare(`
        SELECT * FROM ${table}
        WHERE active = 1 AND name LIKE ? ESCAPE '\\'
        ORDER BY CASE WHEN name LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END, name COLLATE NOCASE
        LIMIT ?
    `).all(contains, prefix, capped);
}

function listCatalog(db: SqliteDb, table: 'condition_catalog' | 'medicine_catalog', includeRetired: boolean) {
    if (includeRetired) {
        return db.prepare(`SELECT * FROM ${table} ORDER BY active DESC, name COLLATE NOCASE`).all();
    }
    return db.prepare(`SELECT * FROM ${table} WHERE active = 1 ORDER BY name COLLATE NOCASE`).all();
}

function insertNamed(db: SqliteDb, table: 'condition_catalog' | 'medicine_catalog', fields: CatalogWriteFields) {
    try {
        if (table === 'condition_catalog') {
            const result = db.prepare(`
                INSERT INTO condition_catalog (name, active, created_at, updated_at)
                VALUES (?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run(fields.name);
            return db.prepare('SELECT * FROM condition_catalog WHERE id = ?').get(Number(result.lastInsertRowid));
        }
        const result = db.prepare(`
            INSERT INTO medicine_catalog (
                name, form, dosage, route, frequency, duration, instruction, active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(fields.name, fields.form, fields.dosage, fields.route, fields.frequency, fields.duration, fields.instruction);
        return db.prepare('SELECT * FROM medicine_catalog WHERE id = ?').get(Number(result.lastInsertRowid));
    } catch (error) {
        throw mapConstraint(error);
    }
}

function updateNamed(db: SqliteDb, table: 'condition_catalog' | 'medicine_catalog', id: number, fields: CatalogWriteFields) {
    const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    if (!existing) throw new Error('CATALOG_NOT_FOUND');
    try {
        if (table === 'condition_catalog') {
            db.prepare(`
                UPDATE condition_catalog SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
            `).run(fields.name, id);
        } else {
            db.prepare(`
                UPDATE medicine_catalog
                SET name = ?, form = ?, dosage = ?, route = ?, frequency = ?, duration = ?, instruction = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(fields.name, fields.form, fields.dosage, fields.route, fields.frequency, fields.duration, fields.instruction, id);
        }
        return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    } catch (error) {
        throw mapConstraint(error);
    }
}

function retireRow(db: SqliteDb, table: 'condition_catalog' | 'medicine_catalog', id: number) {
    const numericId = requireId(id);
    const existing = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(numericId);
    if (!existing) throw new Error('CATALOG_NOT_FOUND');
    db.prepare(`UPDATE ${table} SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(numericId);
    return { id: numericId, active: 0 };
}

function resolvePresetLine(db: SqliteDb, line: Partial<PrescriptionLine>): PrescriptionLine {
    let medicineId = line.medicine_id != null ? Number(line.medicine_id) : null;
    let catalog: MedicineCatalogRow | undefined;
    if (medicineId && Number.isInteger(medicineId)) {
        catalog = db.prepare('SELECT * FROM medicine_catalog WHERE id = ?').get(medicineId);
    }
    const medicine = normalizeOptionalName(line.medicine) || catalog?.name || '';
    if (!medicine) throw new Error('NAME_REQUIRED');
    const defaults = catalog ? defaultRxFields(catalog) : defaultRxFields(line);
    return {
        medicine_id: catalog?.id || medicineId || null,
        medicine,
        form: line.form || defaults.form,
        dosage: line.dosage ?? defaults.dosage,
        route: line.route || defaults.route,
        frequency: line.frequency || defaults.frequency,
        duration: line.duration || defaults.duration,
        instruction: line.instruction || defaults.instruction
    };
}

function toRxLine(row: any): PrescriptionLine {
    const defaults = defaultRxFields(row);
    return {
        medicine_id: row.medicine_id || null,
        medicine: row.medicine,
        form: row.form || defaults.form,
        dosage: row.dosage ?? defaults.dosage,
        route: row.route || defaults.route,
        frequency: row.frequency || defaults.frequency,
        duration: row.duration || defaults.duration,
        instruction: row.instruction || defaults.instruction
    };
}

function mergeMedicineFields(
    existing: MedicineCatalogRow,
    input: Partial<MedicineCatalogRow>
): Partial<MedicineCatalogRow> {
    return {
        form: input.form !== undefined ? input.form : existing.form,
        dosage: input.dosage !== undefined ? input.dosage : existing.dosage,
        route: input.route !== undefined ? input.route : existing.route,
        frequency: input.frequency !== undefined ? input.frequency : existing.frequency,
        duration: input.duration !== undefined ? input.duration : existing.duration,
        instruction: input.instruction !== undefined ? input.instruction : existing.instruction
    };
}

function defaultRxFields(input: Partial<MedicineCatalogRow> | Partial<PrescriptionLine> = {}): Omit<PrescriptionLine, 'medicine' | 'medicine_id'> {
    const instruction = (input as any).instruction || (input as any).instructions || 'After Food';
    return {
        form: (input as any).form || 'Tab',
        dosage: (input as any).dosage || '',
        route: (input as any).route || 'Oral',
        frequency: (input as any).frequency || '1-0-1',
        duration: (input as any).duration || '3 days',
        instruction
    };
}

function normalizeName(value: unknown): string {
    const name = normalizeOptionalName(value);
    if (!name) throw new Error('NAME_REQUIRED');
    return name;
}

function normalizeOptionalName(value: unknown): string {
    return String(value || '').trim().replace(/\s+/g, ' ').slice(0, CATALOG_QUERY_MAX);
}

function requireId(value: unknown): number {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) throw new Error('CATALOG_NOT_FOUND');
    return id;
}

function capLimit(limit?: number): number {
    const parsed = Number(limit);
    if (!Number.isInteger(parsed) || parsed <= 0) return CATALOG_SEARCH_LIMIT;
    return Math.min(parsed, CATALOG_SEARCH_LIMIT_MAX);
}

function likeContains(term: string): string {
    return `%${escapeLike(term)}%`;
}

function likePrefix(term: string): string {
    return `${escapeLike(term)}%`;
}

function escapeLike(term: string): string {
    return term.replace(/([%_\\])/g, '\\$1');
}

function mapConstraint(error: unknown): Error {
    const message = String((error as Error)?.message || error || '');
    if (/UNIQUE|constraint/i.test(message)) return new Error('DUPLICATE_ACTIVE_NAME');
    if (error instanceof Error) return error;
    return new Error(message || 'CATALOG_WRITE_FAILED');
}
