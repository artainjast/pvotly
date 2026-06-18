import type { DataRecord } from '@pvotly/core';

const countries = ['USA', 'Canada', 'Germany', 'France'];
const categories = ['Cars', 'Bikes', 'Accessories'];
const channels = ['Online', 'Retail'];

// Deterministic pseudo-random generator so the docs are stable across reloads.
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function buildSales(): DataRecord[] {
  const rng = makeRng(42);
  const rows: DataRecord[] = [];
  for (let i = 0; i < 240; i++) {
    const country = countries[Math.floor(rng() * countries.length)]!;
    const category = categories[Math.floor(rng() * categories.length)]!;
    const channel = channels[Math.floor(rng() * channels.length)]!;
    const month = 1 + Math.floor(rng() * 12);
    const day = 1 + Math.floor(rng() * 28);
    const year = rng() > 0.5 ? 2023 : 2024;
    const units = 1 + Math.floor(rng() * 20);
    const price = Math.round((50 + rng() * 950) * 100) / 100;
    rows.push({
      country,
      category,
      channel,
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      units,
      price,
      revenue: Math.round(units * price * 100) / 100,
      discount: Math.round(rng() * 100 * 100) / 100,
    });
  }
  return rows;
}

/** Rich, deterministic sales dataset used across the docs samples. */
export const SALES: DataRecord[] = buildSales();

/** Small CSV string used by the CSV sample. */
export const SALES_CSV = `country,category,units,revenue,date
USA,Cars,4,12000,2023-01-15
USA,Bikes,12,3600,2023-02-10
Canada,Cars,3,9000,2023-03-05
Canada,Bikes,8,2400,2024-01-12
Germany,Accessories,40,2000,2024-02-18
France,Cars,2,7000,2024-03-22`;
