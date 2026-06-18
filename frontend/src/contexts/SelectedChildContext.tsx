// src/context/SelectedChildContext.tsx
import React, { createContext, useContext, useState, ReactNode } from "react";

type SelectedChild = {
  id: string;
  name?: string;
  age?: number;
  grade?: string;
  board?: string;
};

type Ctx = {
  selectedChild: SelectedChild | null;
  setSelectedChild: (c: SelectedChild | null) => void;
};

const SelectedChildContext = createContext<Ctx | null>(null);

export function SelectedChildProvider({ children }: { children: ReactNode }) {
  const [selectedChild, setSelectedChild] = useState<SelectedChild | null>(null);
  return (
    <SelectedChildContext.Provider value={{ selectedChild, setSelectedChild }}>
      {children}
    </SelectedChildContext.Provider>
  );
}

export function useSelectedChild() {
  const ctx = useContext(SelectedChildContext);
  if (!ctx) throw new Error("useSelectedChild must be used within SelectedChildProvider");
  return ctx;
}
