import { useEffect, useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock,
  AlertTriangle, Filter, Globe
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { getUpcomingEvents } from '@/data/economicEvents';
import type { EconomicEvent } from '@/types';

type ImpactFilter = 'all' | 'high' | 'medium' | 'low';
type ViewMode = 'list' | 'calendar';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  const then = new Date(dateStr);
  return Math.ceil((then.getTime() - now.getTime()) / 86400000);
}

function ImpactDot({ impact }: { impact: EconomicEvent['impact'] }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3].map(i => (
        <div
          key={i}
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            impact === 'high' ? (i <= 3 ? 'bg-red-500' : 'bg-slate-600') :
            impact === 'medium' ? (i <= 2 ? 'bg-amber-500' : 'bg-slate-600') :
            (i <= 1 ? 'bg-emerald-500' : 'bg-slate-600')
          )}
        />
      ))}
    </div>
  );
}

export default function CalendarPage() {
  const [daysAhead, setDaysAhead] = useState(30);
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const events = useMemo(() => getUpcomingEvents(daysAhead), [daysAhead]);

  const filtered = useMemo(() => {
    return events.filter(e => {
      if (impactFilter !== 'all' && e.impact !== impactFilter) return false;
      if (countryFilter !== 'all' && e.country !== countryFilter) return false;
      return true;
    });
  }, [events, impactFilter, countryFilter]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, EconomicEvent[]> = {};
    for (const event of filtered) {
      const dateKey = formatDate(event.date);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(event);
    }
    return groups;
  }, [filtered]);

  const countries = useMemo(() => {
    const set = new Set(events.map(e => e.country));
    return ['all', ...Array.from(set).sort()];
  }, [events]);

  useEffect(() => {
    document.title = 'Economic Calendar — HamaFX';
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-5 h-5 text-purple-400" />
          <div>
            <h1 className="text-xl font-bold">Economic Calendar</h1>
            <p className="text-xs text-slate-500">
              {filtered.length} events • Next {daysAhead} days
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDaysAhead(Math.max(7, daysAhead - 7))}
            className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-400 w-12 text-center">{daysAhead}d</span>
          <button
            onClick={() => setDaysAhead(Math.min(90, daysAhead + 7))}
            className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Impact Filter */}
        <div className="flex gap-1.5">
          {(['all', 'high', 'medium', 'low'] as ImpactFilter[]).map(impact => (
            <button
              key={impact}
              onClick={() => setImpactFilter(impact)}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-medium capitalize flex items-center gap-1.5 transition-colors',
                impactFilter === impact
                  ? impact === 'high' ? 'bg-red-500/15 text-red-400 border border-red-500/30' :
                    impact === 'medium' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                    impact === 'low' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                    'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                  : 'bg-nexus-elevated text-slate-400 border border-nexus-border hover:text-slate-200'
              )}
            >
              {impact !== 'all' && <ImpactDot impact={impact as EconomicEvent['impact']} />}
              {impact === 'all' ? <Filter className="w-3 h-3" /> : null}
              {impact}
            </button>
          ))}
        </div>

        {/* Country Filter */}
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
          {countries.map(country => (
            <button
              key={country}
              onClick={() => setCountryFilter(country)}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1 whitespace-nowrap transition-colors',
                countryFilter === country
                  ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                  : 'bg-nexus-elevated text-slate-400 border border-nexus-border hover:text-slate-200'
              )}
            >
              {country === 'all' ? <Globe className="w-3 h-3" /> : null}
              {country === 'all' ? 'All Countries' : country}
            </button>
          ))}
        </div>

        {/* View Toggle */}
        <div className="flex gap-1 bg-nexus-elevated rounded-lg p-0.5 self-start">
          <button
            onClick={() => setViewMode('list')}
            className={cn('px-2.5 py-1.5 rounded-md text-xs font-medium', viewMode === 'list' ? 'bg-nexus-card text-white' : 'text-slate-500')}
          >
            List
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={cn('px-2.5 py-1.5 rounded-md text-xs font-medium', viewMode === 'calendar' ? 'bg-nexus-card text-white' : 'text-slate-500')}
          >
            Grid
          </button>
        </div>
      </div>

      {/* Impact Legend */}
      <div className="flex items-center gap-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> High Impact</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Medium</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Low</span>
      </div>

      {/* Events */}
      {filtered.length === 0 ? (
        <div className="bg-nexus-card rounded-xl border border-nexus-border p-8 text-center">
          <CalendarIcon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No events match your filters</p>
          <p className="text-xs text-slate-500 mt-1">Try adjusting the time range or filters</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-4">
          {Object.entries(grouped).map(([date, dateEvents]) => {
            const days = daysUntil(dateEvents[0].date);
            const isToday = days === 0;
            const isTomorrow = days === 1;

            return (
              <div key={date}>
                {/* Date Header */}
                <div className="flex items-center gap-3 mb-2">
                  <h3 className={cn(
                    'text-sm font-semibold',
                    isToday ? 'text-indigo-400' : isTomorrow ? 'text-amber-400' : 'text-slate-300'
                  )}>
                    {isToday ? '📅 Today' : isTomorrow ? '📅 Tomorrow' : date}
                  </h3>
                  {!isToday && !isTomorrow && (
                    <span className="text-[10px] text-slate-600">in {days} days</span>
                  )}
                  <div className="flex-1 border-t border-nexus-border" />
                </div>

                {/* Events for this date */}
                <div className="space-y-2">
                  {dateEvents.map(event => (
                    <div
                      key={event.id}
                      className={cn(
                        'bg-nexus-card rounded-xl border p-4 transition-colors',
                        event.impact === 'high' ? 'border-red-500/20 hover:border-red-500/40' :
                        event.impact === 'medium' ? 'border-amber-500/15 hover:border-amber-500/30' :
                        'border-nexus-border hover:border-nexus-border'
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <ImpactDot impact={event.impact} />
                            <span className={cn(
                              'text-[10px] px-2 py-0.5 rounded-full font-medium uppercase',
                              event.impact === 'high' ? 'bg-red-500/10 text-red-400' :
                              event.impact === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                              'bg-emerald-500/10 text-emerald-400'
                            )}>
                              {event.impact}
                            </span>
                            <span className="text-[10px] text-slate-600">{event.category}</span>
                          </div>
                          <h4 className="text-sm font-medium">{event.title}</h4>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <p className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatTime(event.date)}
                          </p>
                        </div>
                      </div>

                      {/* Previous / Forecast / Actual */}
                      <div className="flex items-center gap-4 mt-3">
                        {event.previous && (
                          <div>
                            <span className="text-[10px] text-slate-600 block">Previous</span>
                            <span className="text-xs font-mono text-slate-400">{event.previous}</span>
                          </div>
                        )}
                        {event.forecast && (
                          <div>
                            <span className="text-[10px] text-slate-600 block">Forecast</span>
                            <span className="text-xs font-mono text-slate-300">{event.forecast}</span>
                          </div>
                        )}
                        {event.actual && (
                          <div>
                            <span className="text-[10px] text-slate-600 block">Actual</span>
                            <span className="text-xs font-mono font-bold text-white">{event.actual}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Grid/Calendar view
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(event => {
            const days = daysUntil(event.date);
            return (
              <div
                key={event.id}
                className={cn(
                  'bg-nexus-card rounded-xl border p-4',
                  event.impact === 'high' ? 'border-red-500/20' :
                  event.impact === 'medium' ? 'border-amber-500/15' :
                  'border-nexus-border'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <ImpactDot impact={event.impact} />
                  <span className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full',
                    days === 0 ? 'bg-indigo-500/15 text-indigo-400' :
                    days <= 2 ? 'bg-amber-500/10 text-amber-400' :
                    'bg-slate-500/10 text-slate-500'
                  )}>
                    {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`}
                  </span>
                </div>
                <h4 className="text-sm font-medium mb-1 leading-tight">{event.title}</h4>
                <p className="text-[10px] text-slate-500">{formatDate(event.date)} · {formatTime(event.date)}</p>
                {event.forecast && (
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    {event.previous && <span className="text-slate-500">Prev: {event.previous}</span>}
                    <span className="text-slate-300">Fcst: {event.forecast}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Economic calendar events are based on known schedules. Dates and values are approximate and may differ from official releases. Always verify with official sources.
          </p>
        </div>
      </div>
    </div>
  );
}
