'use client';
import * as React from 'react';

export default function ClientLogger({ id }: { id?: string | null }) {
  React.useEffect(() => {
    if (id) console.log('[Orçamento enviado] id:', id);
  }, [id]);
  return null;
}
