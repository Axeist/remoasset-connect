import { useCallback, useState } from 'react';

export interface EmailSignature {
  id: string;
  name: string;
  content: string;
}

const STORAGE_KEY_PREFIX = 'email_signatures_';

function getKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function load(userId: string | undefined): EmailSignature[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(getKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(userId: string, signatures: EmailSignature[]) {
  localStorage.setItem(getKey(userId), JSON.stringify(signatures));
}

export function useEmailSignatures(userId: string | undefined) {
  const [signatures, setSignatures] = useState<EmailSignature[]>(() => load(userId));

  const add = useCallback(
    (name: string, content: string) => {
      if (!userId) return;
      const next: EmailSignature = {
        id: crypto.randomUUID(),
        name: name.trim() || 'Signature',
        content: content.trim() || '',
      };
      const list = [...signatures, next];
      setSignatures(list);
      save(userId, list);
      return next.id;
    },
    [userId, signatures]
  );

  const update = useCallback(
    (id: string, updates: { name?: string; content?: string }) => {
      if (!userId) return;
      const list = signatures.map((s) =>
        s.id === id
          ? {
              ...s,
              ...(updates.name !== undefined && { name: updates.name.trim() || s.name }),
              ...(updates.content !== undefined && { content: updates.content }),
            }
          : s
      );
      setSignatures(list);
      save(userId, list);
    },
    [userId, signatures]
  );

  const remove = useCallback(
    (id: string) => {
      if (!userId) return;
      const list = signatures.filter((s) => s.id !== id);
      setSignatures(list);
      save(userId, list);
    },
    [userId, signatures]
  );

  const refresh = useCallback(() => {
    setSignatures(load(userId));
  }, [userId]);

  return { signatures, add, update, remove, refresh };
}
