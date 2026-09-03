import { useEffect, useRef, useState, useCallback } from 'react';
import { realtimeEventsApi } from '../services/api';

export interface RealtimeEvent {
  event?: string;
  type?: string;
  resource_type?: string;
  resource_id?: string;
  case_id?: string;
  timestamp?: string;
  data?: any;
}

export type RealtimeCallback = (event: RealtimeEvent) => void;

export function useRealtime(caseId?: string, onEventReceived?: RealtimeCallback) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const callbacksRef = useRef<Set<RealtimeCallback>>(new Set());

  if (onEventReceived) {
    callbacksRef.current.add(onEventReceived);
  }

  const registerCallback = useCallback((cb: RealtimeCallback) => {
    callbacksRef.current.add(cb);
    return () => {
      callbacksRef.current.delete(cb);
    };
  }, []);

  const dispatchEvent = useCallback((event: RealtimeEvent) => {
    setLastEvent(event);
    callbacksRef.current.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.warn('Error in real-time callback subscriber:', err);
      }
    });
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('tracex_token');
    let isMounted = true;
    let pollInterval: any = null;
    let sseSource: EventSource | null = null;

    // 1. Attempt WebSocket Connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/events?token=${token || ''}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setIsConnected(true);
        if (caseId) {
          ws.send(JSON.stringify({ action: 'subscribe', case_id: caseId }));
        }
      };

      ws.onmessage = (msg) => {
        if (!isMounted) return;
        try {
          const parsed = JSON.parse(msg.data);
          dispatchEvent(parsed);
        } catch (e) {
          // ignore plain non-JSON heartbeats
        }
      };

      ws.onerror = () => {
        // Fallback to SSE or Polling
        if (isMounted) {
          setIsConnected(false);
          initSseOrPolling();
        }
      };

      ws.onclose = () => {
        if (isMounted) {
          setIsConnected(false);
          initSseOrPolling();
        }
      };
    } catch (err) {
      initSseOrPolling();
    }

    function initSseOrPolling() {
      // 2. Attempt SSE fallback
      if (typeof EventSource !== 'undefined') {
        try {
          const sseUrl = `/api/v1/events/stream?token=${token || ''}${caseId ? `&case_id=${caseId}` : ''}`;
          sseSource = new EventSource(sseUrl);

          sseSource.onopen = () => {
            if (isMounted) setIsConnected(true);
          };

          sseSource.onmessage = (e) => {
            if (!isMounted) return;
            try {
              const data = JSON.parse(e.data);
              dispatchEvent(data);
            } catch (err) {
              // ignore plain text heartbeats
            }
          };

          sseSource.onerror = () => {
            sseSource?.close();
            startPolling();
          };
          return;
        } catch (e) {
          startPolling();
        }
      } else {
        startPolling();
      }
    }

    function startPolling() {
      // 3. Fallback to periodic REST polling
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(async () => {
        if (!isMounted) return;
        try {
          const events = await realtimeEventsApi.poll();
          if (Array.isArray(events) && events.length > 0) {
            const latest = events[0];
            dispatchEvent({
              type: latest.event_type,
              resource_type: latest.aggregate_type,
              resource_id: latest.aggregate_id,
              timestamp: latest.created_at
            });
          }
        } catch (e) {
          // quiet polling catch
        }
      }, 10000);
    }

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (sseSource) {
        sseSource.close();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [caseId, dispatchEvent]);

  return { isConnected, lastEvent, registerCallback };
}

export default useRealtime;
