import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { recordPageVisit } from '@/lib/cookie-consent';

export function PageVisitTracker() {
  const { pathname } = useLocation();
  useEffect(() => {
    recordPageVisit(pathname);
  }, [pathname]);
  return null;
}
