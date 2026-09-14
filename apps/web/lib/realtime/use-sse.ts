'use client';

import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  OperationsEventType,
  type OperationsEvent,
} from '@visaflow/shared-types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function useOperationsEvents() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<OperationsEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;

    function connect() {
      const eventSource = new EventSource(`${API_BASE_URL}/operations/events`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.onmessage = (message) => {
        try {
          const parsed = JSON.parse(message.data);
          if (parsed.type === 'PING') {
            return;
          }

          const event = parsed as OperationsEvent;
          setLastEvent(event);

          // Invalidate specific and global queries according to event type
          queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
          queryClient.invalidateQueries({ queryKey: ['attention-list'] });

          if (
            event.type === OperationsEventType.CASE_CREATED ||
            event.type === OperationsEventType.CASE_UPDATED ||
            event.type === OperationsEventType.CASE_STATUS_CHANGED ||
            event.type === OperationsEventType.CASE_ATTENTION_REQUIRED ||
            event.type === OperationsEventType.CASE_CONFIRMED
          ) {
            queryClient.invalidateQueries({ queryKey: ['booking-cases'] });
            if (event.caseId) {
              queryClient.invalidateQueries({ queryKey: ['case-detail', event.caseId] });
              queryClient.invalidateQueries({ queryKey: ['case-timeline', event.caseId] });
            }
          }

          if (event.type === OperationsEventType.NOTIFICATION_CREATED) {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
          }
        } catch (err) {
          console.warn('Failed to parse SSE event message:', err);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource.close();
        // Exponential backoff reconnect
        reconnectTimeout = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [queryClient]);

  return { isConnected, lastEvent };
}
