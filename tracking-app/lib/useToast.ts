export type ToastKind = 'success' | 'error' | 'warning' | 'info';

// Temporary no-op implementation so code compiles.
// You can wire a real provider later.
export function useToast() {
  return {
    push: (_message: string, _kind?: ToastKind) => {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[toast]', _kind ?? 'info', _message);
      }
    }
  };
}