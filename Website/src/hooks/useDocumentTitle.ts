import { useEffect } from 'react';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title === 'FamilyMind AI' ? 'FamilyMind AI — Understand the signals. Strengthen the family.' : `${title} · FamilyMind AI`;
  }, [title]);
}
