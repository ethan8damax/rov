'use client'

import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id:      number
  message: string
  type:    ToastType
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++nextId.current
    setItems(prev => [...prev, { id, message, type }])
    setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {items.length > 0 && (
        <div className="fixed bottom-20 md:bottom-5 inset-x-0 flex flex-col items-center gap-2 z-50 pointer-events-none px-4">
          {items.map(item => (
            <div
              key={item.id}
              className="px-4 py-2.5 rounded-xl text-[13px] text-center"
              style={{
                background:   item.type === 'success' ? 'var(--color-positive)' : item.type === 'error' ? 'var(--color-negative)' : 'var(--color-surface)',
                color:        item.type === 'info'    ? 'var(--color-foreground)' : '#fff',
                border:       item.type === 'info'    ? '0.5px solid var(--color-border)' : 'none',
                maxWidth:     '320px',
              }}
            >
              {item.message}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
