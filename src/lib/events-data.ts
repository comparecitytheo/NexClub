// Shared data source for the NEX Events page. The calendar and the event list
// both read from EVENTS, so the two panels always show the same set. Dates are
// generated relative to the current month so the page is always populated; swap
// this for a Prisma model/query later without changing either consumer.
import { startOfMonth, addDays, addMonths } from "date-fns";

export type ClubEvent = {
  id: string;
  title: string;
  date: Date;
  time: string;
  location: string;
  description: string;
};

const thisMonth = startOfMonth(new Date());
const nextMonth = startOfMonth(addMonths(new Date(), 1));
// day-of-month is 1-based; all values are <= 28 so they're valid in every month.
const day = (base: Date, d: number) => addDays(base, d - 1);

export const EVENTS: ClubEvent[] = [
  {
    id: "ev-welcome",
    title: "New Member Welcome Breakfast",
    date: day(thisMonth, 4),
    time: "7:30 AM",
    location: "The Establishment, Sydney CBD",
    description: "Meet the club's newest members over coffee and pastries.",
  },
  {
    id: "ev-lender",
    title: "Lender Panel: Rate Outlook",
    date: day(thisMonth, 9),
    time: "12:00 PM",
    location: "Aon Tower, Level 12",
    description: "Major lenders discuss where rates are heading this quarter.",
  },
  {
    id: "ev-network",
    title: "After-Hours Networking Drinks",
    date: day(thisMonth, 12),
    time: "5:30 PM",
    location: "The Rook, Sydney",
    description: "Casual drinks and introductions across the broker network.",
  },
  {
    id: "ev-workshop",
    title: "Commercial Lending Workshop",
    date: day(thisMonth, 17),
    time: "9:00 AM",
    location: "NEX Club HQ, Barangaroo",
    description: "A hands-on session on structuring commercial deals.",
  },
  {
    id: "ev-lunch",
    title: "Members Lunch & Referrals Roundtable",
    date: day(thisMonth, 23),
    time: "12:30 PM",
    location: "Cafe Sydney",
    description: "Share referrals and swap notes over a long lunch.",
  },
  {
    id: "ev-showcase",
    title: "Quarterly Club Showcase",
    date: day(thisMonth, 28),
    time: "6:00 PM",
    location: "Doltone House, Pyrmont",
    description: "Highlights from the quarter and a look at what's ahead.",
  },
  {
    id: "ev-golf",
    title: "Charity Golf Day",
    date: day(nextMonth, 6),
    time: "8:00 AM",
    location: "The Lakes Golf Club",
    description: "A full round in support of this year's chosen charity.",
  },
  {
    id: "ev-gala",
    title: "Annual Awards Gala",
    date: day(nextMonth, 15),
    time: "7:00 PM",
    location: "The Star Event Centre",
    description: "Black-tie celebration of the year's standout members.",
  },
];
