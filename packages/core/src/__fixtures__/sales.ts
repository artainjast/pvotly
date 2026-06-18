import type { DataRecord } from '../types';

/** Small, deterministic sales dataset reused across engine tests. */
export const SALES: DataRecord[] = [
  { country: 'USA', category: 'Cars', revenue: 100, units: 2, date: '2023-01-15' },
  { country: 'USA', category: 'Cars', revenue: 200, units: 3, date: '2023-02-10' },
  { country: 'USA', category: 'Bikes', revenue: 50, units: 5, date: '2023-01-20' },
  { country: 'Canada', category: 'Cars', revenue: 300, units: 4, date: '2023-03-05' },
  { country: 'Canada', category: 'Bikes', revenue: 80, units: 8, date: '2024-01-12' },
  { country: 'Canada', category: 'Bikes', revenue: 120, units: 10, date: '2024-02-18' },
];
