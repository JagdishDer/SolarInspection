import type { SQLiteDatabase } from 'expo-sqlite';

import type { EquipmentStatus, EquipmentType, ItemCondition, CheckGrade } from '@/types';

const TECH_ID = 'tech-001';

/** Deterministic LCG so every install gets the same demo dataset. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

interface SitePlan {
  slug: string;
  name: string;
  location: string;
  capacityMw: number;
  panelBlocks: number;
  panelRowsPerBlock: number;
  inverters: number;
  transformers: number;
  combinerBoxes: number;
  electrical: number;
}

const SITE_PLANS: SitePlan[] = [
  {
    slug: 'alpha',
    name: 'Solar Farm Alpha',
    location: 'Mojave Desert, CA',
    capacityMw: 120,
    panelBlocks: 25,
    panelRowsPerBlock: 400,
    inverters: 60,
    transformers: 12,
    combinerBoxes: 30,
    electrical: 10,
  },
  {
    slug: 'beta',
    name: 'Solar Farm Beta',
    location: 'Pinal County, AZ',
    capacityMw: 28.5,
    panelBlocks: 12,
    panelRowsPerBlock: 200,
    inverters: 20,
    transformers: 6,
    combinerBoxes: 15,
    electrical: 4,
  },
  {
    slug: 'gamma',
    name: 'Solar Farm Gamma',
    location: 'Kern County, CA',
    capacityMw: 7.2,
    panelBlocks: 6,
    panelRowsPerBlock: 100,
    inverters: 10,
    transformers: 4,
    combinerBoxes: 8,
    electrical: 3,
  },
];

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function equipmentStatus(rand: () => number): EquipmentStatus {
  const r = rand();
  if (r < 0.92) return 'operational';
  if (r < 0.96) return 'maintenance';
  if (r < 0.99) return 'faulty';
  return 'offline';
}

const BASE_TIME = Date.parse('2026-10-01T09:00:00.000Z');

function isoAt(offsetMinutes: number): string {
  return new Date(BASE_TIME - offsetMinutes * 60_000).toISOString();
}

interface EquipmentSeedRow {
  id: string;
  siteId: string;
  name: string;
  type: EquipmentType;
  serialNumber: string;
  location: string;
  status: EquipmentStatus;
  createdAt: string;
  updatedAt: string;
}

function buildEquipmentForSite(
  plan: SitePlan,
  siteId: string,
  rand: () => number,
): EquipmentSeedRow[] {
  const rows: EquipmentSeedRow[] = [];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let tick = 0;

  const push = (
    name: string,
    type: EquipmentType,
    serialPrefix: string,
    serialIndex: number,
    location: string,
  ): void => {
    tick += 1;
    const createdAt = isoAt(Math.floor(rand() * 60 * 24 * 90) + tick);
    rows.push({
      id: `eq-${plan.slug}-${pad(tick, 6)}`,
      siteId,
      name,
      type,
      serialNumber: `${serialPrefix}-${pad(serialIndex, 4)}`,
      location,
      status: equipmentStatus(rand),
      createdAt,
      updatedAt: createdAt,
    });
  };

  for (let block = 0; block < plan.panelBlocks; block += 1) {
    const letter = letters[block % letters.length] ?? 'A';
    for (let row = 1; row <= plan.panelRowsPerBlock; row += 1) {
      push(
        `Panel Row ${letter}-${pad(row, 3)}`,
        'panel',
        `PNL-${plan.slug.slice(0, 2).toUpperCase()}`,
        block * plan.panelRowsPerBlock + row,
        `Block ${letter}, Row ${row}`,
      );
    }
  }

  for (let i = 1; i <= plan.inverters; i += 1) {
    push(`Inverter INV-${pad(i, 3)}`, 'inverter', 'INV', i, `Power block ${Math.ceil(i / 4)}`);
  }
  for (let i = 1; i <= plan.transformers; i += 1) {
    push(`Transformer TR-${pad(i, 3)}`, 'transformer', 'TR', i, `Substation ${Math.ceil(i / 2)}`);
  }
  for (let i = 1; i <= plan.combinerBoxes; i += 1) {
    push(`Combiner Box CB-${pad(i, 3)}`, 'combiner_box', 'CB', i, `Block ${letters[(i - 1) % plan.panelBlocks] ?? 'A'}`);
  }
  for (let i = 1; i <= plan.electrical; i += 1) {
    push(`Switchgear MX-${pad(i, 3)}`, 'electrical', 'MX', i, 'Main electrical room');
  }

  return rows;
}

function randomCondition(rand: () => number): ItemCondition {
  const r = rand();
  if (r < 0.7) return 'good';
  if (r < 0.9) return 'warning';
  return 'critical';
}

function randomGrade(rand: () => number): CheckGrade {
  const r = rand();
  if (r < 0.75) return 'good';
  if (r < 0.93) return 'fair';
  return 'poor';
}

/**
 * Seeds realistic demo data on first launch only (sites table empty).
 * Three solar farms, ~13k equipment records (10k+ on Alpha to exercise
 * list performance) and a few sample inspections, one of which is left
 * pending in the sync queue to demo automatic synchronization.
 */
export async function seedDatabaseIfEmpty(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM sites');
  if (!row || row.c > 0) return;

  const rand = createRandom(20261001);

  await db.withTransactionAsync(async () => {
    const siteStmt = await db.prepareAsync(
      `INSERT INTO sites (id, name, location, capacityMw, createdAt, updatedAt, syncStatus)
       VALUES (?, ?, ?, ?, ?, ?, 'synced')`,
    );
    const equipmentStmt = await db.prepareAsync(
      `INSERT INTO equipment (id, siteId, name, type, serialNumber, location, status, createdAt, updatedAt, syncStatus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
    );

    const siteIds = new Map<string, string>();
    let minute = 0;

    for (const plan of SITE_PLANS) {
      minute += 10;
      const siteId = `site-${plan.slug}`;
      siteIds.set(plan.slug, siteId);
      const ts = isoAt(minute);
      await siteStmt.executeAsync([
        siteId,
        plan.name,
        plan.location,
        plan.capacityMw,
        ts,
        ts,
      ]);
    }

    for (const plan of SITE_PLANS) {
      const siteId = siteIds.get(plan.slug);
      if (!siteId) continue;
      for (const eq of buildEquipmentForSite(plan, siteId, rand)) {
        await equipmentStmt.executeAsync([
          eq.id,
          eq.siteId,
          eq.name,
          eq.type,
          eq.serialNumber,
          eq.location,
          eq.status,
          eq.createdAt,
          eq.updatedAt,
        ]);
      }
    }

    await siteStmt.finalizeAsync();
    await equipmentStmt.finalizeAsync();
  });

  await seedSampleInspections(db, rand);
}

interface SampleEquipment {
  id: string;
  name: string;
  type: EquipmentType;
  serialNumber: string;
}

async function pickSampleEquipment(
  db: SQLiteDatabase,
  siteId: string,
  type: EquipmentType,
  limit: number,
): Promise<SampleEquipment[]> {
  return db.getAllAsync<SampleEquipment>(
    `SELECT id, name, type, serialNumber FROM equipment
     WHERE siteId = ? AND type = ? ORDER BY name LIMIT ?`,
    [siteId, type, limit],
  );
}

async function insertInspectionItem(
  db: SQLiteDatabase,
  params: {
    id: string;
    inspectionId: string;
    equipmentId: string;
    condition: ItemCondition | null;
    physicalDamage: CheckGrade | null;
    wiring: CheckGrade | null;
    cleanliness: CheckGrade | null;
    thermalCondition: number | null;
    notes: string;
    createdAt: string;
    updatedAt: string;
    syncStatus: 'pending' | 'synced';
  },
): Promise<void> {
  await db.runAsync(
    `INSERT INTO inspection_items
       (id, inspectionId, equipmentId, condition, physicalDamage, wiring, cleanliness,
        thermalCondition, notes, createdAt, updatedAt, syncStatus)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.id,
      params.inspectionId,
      params.equipmentId,
      params.condition,
      params.physicalDamage,
      params.wiring,
      params.cleanliness,
      params.thermalCondition,
      params.notes,
      params.createdAt,
      params.updatedAt,
      params.syncStatus,
    ],
  );
}

async function seedSampleInspections(
  db: SQLiteDatabase,
  rand: () => number,
): Promise<void> {
  const alphaId = 'site-alpha';
  const betaId = 'site-beta';
  const gammaId = 'site-gamma';

  const alphaPanels = await pickSampleEquipment(db, alphaId, 'panel', 3);
  const alphaInverters = await pickSampleEquipment(db, alphaId, 'inverter', 3);
  const betaInverters = await pickSampleEquipment(db, betaId, 'inverter', 2);
  const betaPanels = await pickSampleEquipment(db, betaId, 'panel', 2);
  const gammaPanels = await pickSampleEquipment(db, gammaId, 'panel', 3);

  await db.withTransactionAsync(async () => {
    // 1) Completed + fully synced inspection on Alpha.
    const inspection1Id = 'ins-seed-1';
    const t1 = isoAt(60 * 26);
    await db.runAsync(
      `INSERT INTO inspections
         (id, siteId, inspectorId, startedAt, completedAt, status, notes, latitude, longitude,
          createdAt, updatedAt, syncStatus, version)
       VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, 'synced', 1)`,
      [
        inspection1Id,
        alphaId,
        TECH_ID,
        t1,
        isoAt(60 * 25),
        'Quarterly thermal sweep. Two panels flagged for soiling, inverter INV-003 shows elevated temperatures.',
        35.0322,
        -117.3406,
        t1,
        isoAt(60 * 25),
      ],
    );

    const inspection1Targets = [...alphaPanels, ...alphaInverters].slice(0, 5);
    let itemTick = 1;
    for (const eq of inspection1Targets) {
      itemTick += 1;
      const condition = randomCondition(rand);
      const createdAt = isoAt(60 * 26 - itemTick);
      await insertInspectionItem(db, {
        id: `itm-seed-${pad(itemTick, 3)}`,
        inspectionId: inspection1Id,
        equipmentId: eq.id,
        condition,
        physicalDamage: condition === 'critical' ? 'poor' : 'good',
        wiring: condition === 'critical' ? 'fair' : 'good',
        cleanliness: condition === 'good' ? 'good' : randomGrade(rand),
        thermalCondition:
          condition === 'good' ? 34 + Math.round(rand() * 8) : condition === 'warning' ? 52 : 78,
        notes:
          condition === 'critical'
            ? 'Hotspot visible on thermal camera; panel strings 3-4 disconnected.'
            : condition === 'warning'
              ? 'Moderate soiling on frame, recommend cleaning cycle.'
              : 'No anomalies found.',
        createdAt,
        updatedAt: createdAt,
        syncStatus: 'synced',
      });
    }

    // 2) In-progress inspection on Beta, still pending sync (queued on seed).
    const inspection2Id = 'ins-seed-2';
    const t2 = isoAt(60 * 3);
    await db.runAsync(
      `INSERT INTO inspections
         (id, siteId, inspectorId, startedAt, completedAt, status, notes, latitude, longitude,
          createdAt, updatedAt, syncStatus, version)
       VALUES (?, ?, ?, ?, NULL, 'in_progress', ?, NULL, NULL, ?, ?, 'pending', 1)`,
      [inspection2Id, betaId, TECH_ID, t2, 'Mid-day spot check after dust storm.', t2, t2],
    );

    const inspection2Targets = [...betaInverters, ...betaPanels];
    itemTick = 10;
    let itemIndex = 0;
    for (const eq of inspection2Targets) {
      itemIndex += 1;
      itemTick += 1;
      const createdAt = isoAt(60 * 3 - itemTick);
      if (itemIndex <= 2) {
        const condition = randomCondition(rand);
        await insertInspectionItem(db, {
          id: `itm-seed-${pad(itemTick, 3)}`,
          inspectionId: inspection2Id,
          equipmentId: eq.id,
          condition,
          physicalDamage: 'good',
          wiring: condition === 'good' ? 'good' : 'fair',
          cleanliness: condition === 'good' ? 'good' : 'poor',
          thermalCondition: condition === 'good' ? 41 : 63,
          notes: condition === 'good' ? 'Normal readings.' : 'Heavy dust buildup on heat sink.',
          createdAt,
          updatedAt: createdAt,
          syncStatus: 'pending',
        });
      } else {
        await insertInspectionItem(db, {
          id: `itm-seed-${pad(itemTick, 3)}`,
          inspectionId: inspection2Id,
          equipmentId: eq.id,
          condition: null,
          physicalDamage: null,
          wiring: null,
          cleanliness: null,
          thermalCondition: null,
          notes: '',
          createdAt,
          updatedAt: createdAt,
          syncStatus: 'pending',
        });
      }
    }

    // Queue entry so the very first launch (if online) demonstrates auto-sync.
    const inspection2 = await db.getFirstAsync<{
      id: string;
      siteId: string;
      inspectorId: string;
      startedAt: string;
      completedAt: string | null;
      status: string;
      notes: string;
      latitude: number | null;
      longitude: number | null;
      createdAt: string;
      updatedAt: string;
      version: number;
    }>('SELECT * FROM inspections WHERE id = ?', [inspection2Id]);
    if (inspection2) {
      await db.runAsync(
        `INSERT INTO sync_queue
           (id, entityType, entityId, operation, payload, attempts, status, lastError, createdAt, updatedAt)
         VALUES (?, 'inspection', ?, 'create', ?, 0, 'pending', NULL, ?, ?)`,
        [
          'sq-seed-1',
          inspection2Id,
          JSON.stringify(inspection2),
          isoAt(60 * 3),
          isoAt(60 * 3),
        ],
      );
    }

    // 3) Freshly started inspection on Gamma, empty checklist.
    const inspection3Id = 'ins-seed-3';
    const t3 = isoAt(30);
    await db.runAsync(
      `INSERT INTO inspections
         (id, siteId, inspectorId, startedAt, completedAt, status, notes, latitude, longitude,
          createdAt, updatedAt, syncStatus, version)
       VALUES (?, ?, ?, ?, NULL, 'in_progress', '', NULL, NULL, ?, ?, 'pending', 1)`,
      [inspection3Id, gammaId, TECH_ID, t3, t3, t3],
    );

    itemTick = 30;
    for (const eq of gammaPanels) {
      itemTick += 1;
      await insertInspectionItem(db, {
        id: `itm-seed-${pad(itemTick, 3)}`,
        inspectionId: inspection3Id,
        equipmentId: eq.id,
        condition: null,
        physicalDamage: null,
        wiring: null,
        cleanliness: null,
        thermalCondition: null,
        notes: '',
        createdAt: isoAt(30 - (itemTick - 30)),
        updatedAt: isoAt(30 - (itemTick - 30)),
        syncStatus: 'pending',
      });
    }
  });
}
