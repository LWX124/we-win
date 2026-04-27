"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type PriceUpdate = {
  fundId: string;
  marketPrice: number;
  realtimeNAV: number | null;
  premium: number | null;
  timestamp: string;
};

type SignalUpdate = {
  id: string;
  fundId: string;
  type: string;
  premiumRate: number;
  zScore: number;
  netSpread: number;
  fundSymbol: string;
  fundName: string;
  timestamp: string;
};

type WSContextValue = {
  prices: Map<string, PriceUpdate>;
  latestSignal: SignalUpdate | null;
  connected: boolean;
};

const WSContext = createContext<WSContextValue>({
  prices: new Map(),
  latestSignal: null,
  connected: false,
});

export function useWS() {
  return useContext(WSContext);
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [prices] = useState(() => new Map<string, PriceUpdate>());
  const [latestSignal, setLatestSignal] = useState<SignalUpdate | null>(null);
  const [connected, setConnected] = useState(false);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const eventSource = new EventSource("/api/ws");

    eventSource.onopen = () => setConnected(true);

    eventSource.addEventListener("arbitrage_signals", (e) => {
      try {
        const signal = JSON.parse(e.data) as SignalUpdate;
        setLatestSignal(signal);
      } catch {}
    });

    eventSource.addEventListener("arbitrage_prices", (e) => {
      try {
        const update = JSON.parse(e.data) as PriceUpdate;
        prices.set(update.fundId, update);
        forceRender((n) => n + 1);
      } catch {}
    });

    eventSource.onerror = () => {
      setConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, [prices]);

  return (
    <WSContext.Provider value={{ prices, latestSignal, connected }}>
      {children}
    </WSContext.Provider>
  );
}
