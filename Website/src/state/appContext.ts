import { createContext } from 'react';
import type { AppApi } from './store';
// Stable identity across presentation hot updates. The AppApi import is type-only.
export const AppContext = createContext<AppApi | null>(null);
