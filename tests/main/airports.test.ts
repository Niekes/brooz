import { mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const fetchMock = vi.fn();
const holder = { dir: '' };

vi.mock('electron', () => ({
    app: { getPath: () => holder.dir },
    net: { fetch: (...args: unknown[]) => fetchMock(...args) }
}));

/** A fresh module and cache dir, so every test starts without the dataset. */
async function airports(): Promise<typeof import('../../src/main/airports')> {
    return import('../../src/main/airports');
}

const CSV = [
    '"id","ident","type","name","latitude_deg","longitude_deg","elevation_ft","continent","iso_country","iso_region","municipality","scheduled_service","icao_code","iata_code","gps_code"',
    '1,"LFPO","large_airport","Paris Orly, with a comma","48.72","2.37",, "EU","FR","FR-IDF","Orly","yes","LFPO","ORY","LFPO"',
    '2,"EDDF","large_airport","Frankfurt ""am Main""","50.03","8.56",, "EU","DE","DE-HE","Frankfurt","yes","EDDF","FRA","EDDF"',
    '3,"00A","heliport","Total RF Heliport","40.07","-74.93",11,"NA","US","US-PA","Bensalem","no",,,"K00A"',
    '4,"ZZZZ","small_airport","No IATA here","1","2",, "EU","XX","XX-XX","Nowhere","no","ZZZZ",,"ZZZZ"'
].join('\n');

describe('the airport codes', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        vi.resetModules();
        holder.dir = mkdtempSync(join(tmpdir(), 'brooz-airports-'));
    });

    it('parses ICAO to IATA, honoring quoted commas and doubled quotes', async () => {
        const api = await airports();
        const codes = api.parseCodes(CSV);
        expect(codes.get('LFPO')).toBe('ORY');
        expect(codes.get('EDDF')).toBe('FRA');
        // No ICAO or no IATA: skipped.
        expect(codes.has('00A')).toBe(false);
        expect(codes.has('ZZZZ')).toBe(false);
    });

    it('downloads the dataset once and caches it on disk', async () => {
        fetchMock.mockResolvedValue(new Response(CSV, { status: 200 }));
        const api = await airports();
        expect(await api.iataOf('LFPO')).toBe('ORY');
        expect(await api.iataOf('ZZZZ')).toBe(null);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        // The cache file holds the dataset, and a fresh file is not refetched.
        expect(readFileSync(join(holder.dir, 'airports.csv'), 'utf8')).toBe(CSV);
        const again = await airports();
        expect(await again.iataOf('EDDF')).toBe('FRA');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('refreshes a stale cache file', async () => {
        const file = join(holder.dir, 'airports.csv');
        writeFileSync(file, CSV);
        const stale = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
        utimesSync(file, stale, stale);
        fetchMock.mockResolvedValue(new Response(CSV, { status: 200 }));
        const api = await airports();
        expect(await api.iataOf('LFPO')).toBe('ORY');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('answers null when the dataset cannot be fetched', async () => {
        fetchMock.mockRejectedValue(new Error('offline'));
        const api = await airports();
        expect(await api.iataOf('LFPO')).toBe(null);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('answers null when the dataset answers with an error status', async () => {
        fetchMock.mockResolvedValue(new Response('no', { status: 500 }));
        const api = await airports();
        expect(await api.iataOf('LFPO')).toBe(null);
    });

    it('reads a fresh cache file without fetching', async () => {
        writeFileSync(join(holder.dir, 'airports.csv'), CSV);
        const api = await airports();
        expect(await api.iataOf('LFPO')).toBe('ORY');
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
