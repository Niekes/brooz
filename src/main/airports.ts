import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, net } from 'electron';

/**
 * The ICAO to IATA airport codes, from the OurAirports dataset. OpenSky
 * reports airports by their ICAO code (LFPO); the flight tile shows the IATA
 * code a person knows (ORY). The main process downloads the dataset once,
 * caches it under `userData` and refreshes it at most every 30 days, so the
 * renderer still fetches nothing itself. A missing or unreachable dataset
 * answers null, and the caller falls back to the ICAO code.
 */

const DATASET = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const CACHE_FILE = 'airports.csv';
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
/** A request that has not answered by then is given up. */
const REQUEST_TIMEOUT = 10_000;

/** The dataset's column indexes: icao_code, iata_code. */
const COL_ICAO = 12;
const COL_IATA = 13;

let codes: Map<string, string> | null = null;

function cachePath(): string {
    return join(app.getPath('userData'), CACHE_FILE);
}

/** Splits one CSV line, honoring quoted fields with commas and doubled quotes. */
function csvColumns(line: string): string[] {
    const columns: string[] = [];
    let current = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quoted) {
            if (ch === '"') {
                if (line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    quoted = false;
                }
            } else {
                current += ch;
            }
        } else if (ch === '"') {
            quoted = true;
        } else if (ch === ',') {
            columns.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    columns.push(current);
    return columns;
}

/** Parses the dataset into ICAO to IATA; entries without both codes are skipped. */
export function parseCodes(csv: string): Map<string, string> {
    const map = new Map<string, string>();
    for (const line of csv.split('\n')) {
        const columns = csvColumns(line);
        const icao = columns[COL_ICAO];
        const iata = columns[COL_IATA];
        if (icao && iata && iata.length === 3) {
            map.set(icao, iata);
        }
    }
    return map;
}

/** The cached dataset, downloaded when missing or stale; empty when unreachable. */
async function load(): Promise<Map<string, string>> {
    if (codes !== null) {
        return codes;
    }
    codes = new Map();
    let raw: string | null = null;
    try {
        if (Date.now() - statSync(cachePath()).mtimeMs <= MAX_AGE) {
            raw = readFileSync(cachePath(), 'utf8');
        }
    } catch {
        // No usable cache yet.
    }
    if (raw === null) {
        try {
            const response = await net.fetch(DATASET, {
                signal: AbortSignal.timeout(REQUEST_TIMEOUT)
            });
            if (response.ok) {
                raw = await response.text();
                writeFileSync(cachePath(), raw);
            }
        } catch {
            // Offline: no codes this session.
        }
    }
    if (raw !== null) {
        codes = parseCodes(raw);
    }
    return codes;
}

/** The IATA code of an ICAO airport, or null when the dataset has none. */
export async function iataOf(icao: string): Promise<string | null> {
    return (await load()).get(icao) ?? null;
}
