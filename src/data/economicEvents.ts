// Economic Calendar — curated recurring events with dynamic date projection
import type { EconomicEvent } from '@/types';

interface RecurringEvent {
  title: string;
  country: string;
  impact: 'high' | 'medium' | 'low';
  category: string;
  frequency: 'monthly' | 'quarterly' | 'weekly' | 'bimonthly';
  dayOfMonth?: number;    // e.g., 1st Friday = calculated
  description?: string;
}

const RECURRING_EVENTS: RecurringEvent[] = [
  { title: 'US Non-Farm Payrolls (NFP)', country: 'US', impact: 'high', category: 'Employment', frequency: 'monthly', dayOfMonth: 5 },
  { title: 'FOMC Interest Rate Decision', country: 'US', impact: 'high', category: 'Interest Rate', frequency: 'bimonthly' },
  { title: 'US Consumer Price Index (CPI)', country: 'US', impact: 'high', category: 'Inflation', frequency: 'monthly', dayOfMonth: 13 },
  { title: 'US Producer Price Index (PPI)', country: 'US', impact: 'medium', category: 'Inflation', frequency: 'monthly', dayOfMonth: 14 },
  { title: 'US Retail Sales', country: 'US', impact: 'medium', category: 'Consumer', frequency: 'monthly', dayOfMonth: 16 },
  { title: 'US GDP (Preliminary)', country: 'US', impact: 'high', category: 'Growth', frequency: 'quarterly' },
  { title: 'US ISM Manufacturing PMI', country: 'US', impact: 'medium', category: 'Manufacturing', frequency: 'monthly', dayOfMonth: 1 },
  { title: 'US ISM Services PMI', country: 'US', impact: 'medium', category: 'Services', frequency: 'monthly', dayOfMonth: 3 },
  { title: 'US Initial Jobless Claims', country: 'US', impact: 'low', category: 'Employment', frequency: 'weekly' },
  { title: 'US Consumer Confidence', country: 'US', impact: 'medium', category: 'Sentiment', frequency: 'monthly', dayOfMonth: 25 },
  { title: 'ECB Interest Rate Decision', country: 'EU', impact: 'high', category: 'Interest Rate', frequency: 'bimonthly' },
  { title: 'Eurozone CPI Flash Estimate', country: 'EU', impact: 'high', category: 'Inflation', frequency: 'monthly', dayOfMonth: 28 },
  { title: 'Eurozone GDP Flash Estimate', country: 'EU', impact: 'medium', category: 'Growth', frequency: 'quarterly' },
  { title: 'German IFO Business Climate', country: 'DE', impact: 'medium', category: 'Sentiment', frequency: 'monthly', dayOfMonth: 22 },
  { title: 'German ZEW Economic Sentiment', country: 'DE', impact: 'medium', category: 'Sentiment', frequency: 'monthly', dayOfMonth: 15 },
  { title: 'BOE Interest Rate Decision', country: 'UK', impact: 'high', category: 'Interest Rate', frequency: 'bimonthly' },
  { title: 'UK CPI', country: 'UK', impact: 'high', category: 'Inflation', frequency: 'monthly', dayOfMonth: 17 },
  { title: 'UK GDP Monthly', country: 'UK', impact: 'medium', category: 'Growth', frequency: 'monthly', dayOfMonth: 12 },
  { title: 'UK Retail Sales', country: 'UK', impact: 'medium', category: 'Consumer', frequency: 'monthly', dayOfMonth: 20 },
  { title: 'BOJ Interest Rate Decision', country: 'JP', impact: 'high', category: 'Interest Rate', frequency: 'bimonthly' },
  { title: 'Japan CPI', country: 'JP', impact: 'medium', category: 'Inflation', frequency: 'monthly', dayOfMonth: 19 },
  { title: 'RBA Interest Rate Decision', country: 'AU', impact: 'high', category: 'Interest Rate', frequency: 'bimonthly' },
  { title: 'Australia Employment Change', country: 'AU', impact: 'medium', category: 'Employment', frequency: 'monthly', dayOfMonth: 18 },
  { title: 'BOC Interest Rate Decision', country: 'CA', impact: 'high', category: 'Interest Rate', frequency: 'bimonthly' },
  { title: 'Canada CPI', country: 'CA', impact: 'medium', category: 'Inflation', frequency: 'monthly', dayOfMonth: 21 },
  { title: 'China Manufacturing PMI', country: 'CN', impact: 'medium', category: 'Manufacturing', frequency: 'monthly', dayOfMonth: 30 },
  { title: 'RBNZ Interest Rate Decision', country: 'NZ', impact: 'medium', category: 'Interest Rate', frequency: 'bimonthly' },
  { title: 'SNB Interest Rate Decision', country: 'CH', impact: 'medium', category: 'Interest Rate', frequency: 'quarterly' },
];

const COUNTRY_FLAGS: Record<string, string> = {
  US: '🇺🇸', EU: '🇪🇺', UK: '🇬🇧', JP: '🇯🇵', AU: '🇦🇺',
  CA: '🇨🇦', CN: '🇨🇳', NZ: '🇳🇿', CH: '🇨🇭', DE: '🇩🇪',
};

function generateId(): string {
  return crypto.randomUUID?.() || Math.random().toString(36).substring(2);
}

// Project events forward from today
export function getUpcomingEvents(daysAhead: number = 30): EconomicEvent[] {
  const now = new Date();
  const events: EconomicEvent[] = [];

  for (const event of RECURRING_EVENTS) {
    const dates: Date[] = [];

    if (event.frequency === 'weekly') {
      // Generate weekly events (Thursdays for jobless claims)
      for (let d = 0; d < daysAhead; d += 7) {
        const date = new Date(now);
        date.setDate(date.getDate() + d);
        // Nearest Thursday
        const day = date.getDay();
        const diff = (4 - day + 7) % 7;
        date.setDate(date.getDate() + diff);
        if (date > now && date.getTime() - now.getTime() < daysAhead * 86400000) {
          dates.push(new Date(date));
        }
      }
    } else if (event.frequency === 'monthly') {
      // Generate for current and next month
      for (let m = 0; m <= 2; m++) {
        const date = new Date(now.getFullYear(), now.getMonth() + m, event.dayOfMonth || 15);
        if (date > now && date.getTime() - now.getTime() < daysAhead * 86400000) {
          dates.push(date);
        }
      }
    } else if (event.frequency === 'bimonthly') {
      // Every ~6 weeks
      for (let m = 0; m <= 3; m++) {
        const date = new Date(now.getFullYear(), now.getMonth() + m, 12 + Math.floor(Math.random() * 5));
        if (m % 2 === 0 && date > now && date.getTime() - now.getTime() < daysAhead * 86400000) {
          dates.push(date);
        }
      }
    } else if (event.frequency === 'quarterly') {
      // Every 3 months
      for (let m = 0; m <= 4; m++) {
        if (m % 3 === 0) {
          const date = new Date(now.getFullYear(), now.getMonth() + m, 25);
          if (date > now && date.getTime() - now.getTime() < daysAhead * 86400000) {
            dates.push(date);
          }
        }
      }
    }

    for (const date of dates) {
      events.push({
        id: generateId(),
        title: `${COUNTRY_FLAGS[event.country] || ''} ${event.title}`,
        country: event.country,
        date: date.toISOString(),
        impact: event.impact,
        category: event.category,
        previous: generateMockValue(event.category),
        forecast: generateMockValue(event.category),
      });
    }
  }

  // Sort by date
  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function generateMockValue(category: string): string {
  switch (category) {
    case 'Interest Rate': return `${(4.5 + Math.random() * 1.5).toFixed(2)}%`;
    case 'Inflation': return `${(2.0 + Math.random() * 2.0).toFixed(1)}%`;
    case 'Employment': return `${Math.floor(150 + Math.random() * 100)}K`;
    case 'Growth': return `${(0.5 + Math.random() * 2.5).toFixed(1)}%`;
    case 'Manufacturing':
    case 'Services': return `${(48 + Math.random() * 6).toFixed(1)}`;
    case 'Consumer':
    case 'Sentiment': return `${(90 + Math.random() * 20).toFixed(1)}`;
    default: return '—';
  }
}

// Get events happening today/this week for dashboard
export function getThisWeekEvents(): EconomicEvent[] {
  const upcoming = getUpcomingEvents(7);
  return upcoming.slice(0, 5);
}
