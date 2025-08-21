// Lazy-loaded Calendar Component with Performance Optimizations
'use client';

import React, { memo, useCallback, useMemo } from 'react';
import { LazyWrapper, usePerformanceMonitor, PERFORMANCE_BUDGETS, measurePerformance } from '@/lib/performanceOptimizations';

interface CalendarProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  events?: CalendarEvent[];
  view: 'month' | 'week' | 'day';
  isLoading?: boolean;
}

interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  type: 'capacity' | 'blackout' | 'maintenance' | 'reservation';
  metadata?: Record<string, any>;
}

// Memoized calendar cell component
const CalendarCell = memo<{
  date: Date;
  isSelected: boolean;
  isToday: boolean;
  events: CalendarEvent[];
  onSelect: (date: string) => void;
}>(({ date, isSelected, isToday, events, onSelect }) => {
  const handleClick = useCallback(() => {
    onSelect(date.toISOString().split('T')[0]);
  }, [date, onSelect]);

  const cellClasses = useMemo(() => {
    const classes = ['calendar-cell'];
    if (isSelected) classes.push('selected');
    if (isToday) classes.push('today');
    if (events.length > 0) classes.push('has-events');
    return classes.join(' ');
  }, [isSelected, isToday, events.length]);

  return (
    <div 
      className={cellClasses}
      onClick={handleClick}
      style={{
        padding: 'var(--space-xs)',
        border: '1px solid var(--light-gray)',
        cursor: 'pointer',
        backgroundColor: isSelected ? 'var(--accent)' : 'var(--pure-white)',
        color: isSelected ? 'var(--pure-white)' : 'var(--true-black)',
        position: 'relative',
        minHeight: '40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start'
      }}
    >
      <span style={{ fontSize: 'var(--font-small)', fontWeight: isToday ? 'bold' : 'normal' }}>
        {date.getDate()}
      </span>
      {events.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '2px',
          flexWrap: 'wrap',
          marginTop: '2px'
        }}>
          {events.slice(0, 3).map((event, index) => (
            <div
              key={event.id}
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 
                  event.type === 'capacity' ? 'var(--accent)' :
                  event.type === 'blackout' ? '#ef4444' :
                  event.type === 'maintenance' ? '#f59e0b' : '#10b981'
              }}
              title={event.title}
            />
          ))}
          {events.length > 3 && (
            <span style={{ fontSize: '8px', color: 'var(--muted)' }}>
              +{events.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

CalendarCell.displayName = 'CalendarCell';

// Main calendar component with lazy loading
const CalendarComponent: React.FC<CalendarProps> = ({
  selectedDate,
  onDateSelect,
  events = [],
  view,
  isLoading = false
}) => {
  const performanceMonitor = usePerformanceMonitor('Calendar Render');

  // Memoized date calculations
  const { currentDate, calendarDays, monthName, year } = useMemo(() => {
    performanceMonitor.start();
    
    const current = new Date(selectedDate);
    const firstDay = new Date(current.getFullYear(), current.getMonth(), 1);
    const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days: Date[] = [];
    const totalDays = view === 'month' ? 42 : view === 'week' ? 7 : 1;
    
    for (let i = 0; i < totalDays; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push(day);
    }
    
    const result = {
      currentDate: current,
      calendarDays: days,
      monthName: current.toLocaleDateString('en-US', { month: 'long' }),
      year: current.getFullYear()
    };
    
    performanceMonitor.end();
    return result;
  }, [selectedDate, view]);

  // Memoized events by date
  const eventsByDate = useMemo(() => {
    const eventsMap = new Map<string, CalendarEvent[]>();
    
    events.forEach(event => {
      const dateKey = event.date.split('T')[0];
      if (!eventsMap.has(dateKey)) {
        eventsMap.set(dateKey, []);
      }
      eventsMap.get(dateKey)!.push(event);
    });
    
    return eventsMap;
  }, [events]);

  const getEventsForDate = useCallback((date: Date): CalendarEvent[] => {
    const dateKey = date.toISOString().split('T')[0];
    return eventsByDate.get(dateKey) || [];
  }, [eventsByDate]);

  const handleOptimizedDateSelect = useCallback(async (date: string) => {
    await measurePerformance(
      () => onDateSelect(date),
      PERFORMANCE_BUDGETS.INTERACTION_LATENCY,
      'Date Selection'
    );
  }, [onDateSelect]);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '300px',
        color: 'var(--muted)'
      }}>
        Loading calendar...
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Calendar Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-md)',
        padding: 'var(--space-sm)',
        backgroundColor: 'var(--smoke)',
        borderRadius: '6px'
      }}>
        <h3 style={{
          fontSize: 'var(--font-medium)',
          fontWeight: 500,
          color: 'var(--true-black)'
        }}>
          {monthName} {year}
        </h3>
        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          <button
            onClick={() => handleOptimizedDateSelect(
              new Date(currentDate.setMonth(currentDate.getMonth() - 1))
                .toISOString().split('T')[0]
            )}
            style={{
              padding: 'var(--space-xs) var(--space-sm)',
              border: '1px solid var(--light-gray)',
              backgroundColor: 'var(--pure-white)',
              cursor: 'pointer',
              fontSize: 'var(--font-small)'
            }}
          >
            ←
          </button>
          <button
            onClick={() => handleOptimizedDateSelect(new Date().toISOString().split('T')[0])}
            style={{
              padding: 'var(--space-xs) var(--space-sm)',
              border: '1px solid var(--light-gray)',
              backgroundColor: 'var(--pure-white)',
              cursor: 'pointer',
              fontSize: 'var(--font-small)'
            }}
          >
            Today
          </button>
          <button
            onClick={() => handleOptimizedDateSelect(
              new Date(currentDate.setMonth(currentDate.getMonth() + 1))
                .toISOString().split('T')[0]
            )}
            style={{
              padding: 'var(--space-xs) var(--space-sm)',
              border: '1px solid var(--light-gray)',
              backgroundColor: 'var(--pure-white)',
              cursor: 'pointer',
              fontSize: 'var(--font-small)'
            }}
          >
            →
          </button>
        </div>
      </div>

      {/* Weekday Headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '1px',
        marginBottom: 'var(--space-xs)'
      }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div
            key={day}
            style={{
              padding: 'var(--space-xs)',
              textAlign: 'center',
              fontSize: 'var(--font-small)',
              fontWeight: 600,
              color: 'var(--muted)',
              backgroundColor: 'var(--smoke)'
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '1px',
        backgroundColor: 'var(--light-gray)'
      }}>
        {calendarDays.map((date, index) => {
          const dateStr = date.toISOString().split('T')[0];
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === new Date().toISOString().split('T')[0];
          const dayEvents = getEventsForDate(date);

          return (
            <CalendarCell
              key={`${dateStr}-${index}`}
              date={date}
              isSelected={isSelected}
              isToday={isToday}
              events={dayEvents}
              onSelect={handleOptimizedDateSelect}
            />
          );
        })}
      </div>

      {/* Event Legend */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-md)',
        marginTop: 'var(--space-md)',
        padding: 'var(--space-sm)',
        backgroundColor: 'var(--smoke)',
        borderRadius: '6px',
        fontSize: 'var(--font-small)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent)' }} />
          Capacity
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
          Blackout
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
          Maintenance
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
          Reservation
        </div>
      </div>
    </div>
  );
};

// Lazy-loaded wrapper component
const LazyCalendar: React.FC<CalendarProps> = (props) => {
  return (
    <LazyWrapper
      fallback={
        <div style={{
          height: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--smoke)',
          borderRadius: '6px',
          color: 'var(--muted)'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-medium)', marginBottom: 'var(--space-xs)' }}>
              Loading Calendar...
            </div>
            <div style={{ fontSize: 'var(--font-small)' }}>
              Optimizing for smooth rendering
            </div>
          </div>
        </div>
      }
      threshold={0.1}
    >
      <CalendarComponent {...props} />
    </LazyWrapper>
  );
};

export default LazyCalendar;
