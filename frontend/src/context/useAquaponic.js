import { useContext } from 'react';
import { AquaponicContext } from './AquaponicContext';

export function useAquaponic() {
  const ctx = useContext(AquaponicContext);
  if (!ctx) {
    throw new Error('useAquaponic debe usarse dentro de AquaponicProvider');
  }
  return ctx;
}
