# Event Booking System Design Guidelines

## Design Approach
**Reference-Based Approach**: Drawing inspiration from **Airbnb** and **Calendly** for their excellent event booking and calendar interfaces, combined with **Linear** for the kanban workflow experience.

## Design Principles
- **Professional Swedish institutional feel** - clean, trustworthy, and accessible
- **Clear public/admin distinction** - public views are simplified, admin views are feature-rich
- **Seasonal warmth** - subtle nods to Swedish Christmas traditions without being overwhelming

## Color Palette

**Primary Colors:**
- Deep Forest Green: `140 35% 25%` (professional, Swedish nature-inspired)
- Warm White: `45 25% 98%` (clean backgrounds)

**Accent Colors:**
- Warm Gold: `45 85% 65%` (sparingly for highlights and CTAs)
- Soft Red: `355 65% 55%` (for important actions, seasonal touch)

**Neutral Grays:**
- Light Gray: `210 10% 95%` (backgrounds, subtle borders)
- Medium Gray: `210 8% 60%` (secondary text)
- Dark Gray: `210 15% 25%` (primary text)

## Typography
- **Primary Font**: Inter (clean, professional, excellent readability)
- **Accent Font**: Playfair Display (for headings, adds institutional elegance)
- **Scale**: 14px base, 16px body text, 18px-32px headings

## Layout System
**Spacing Units**: Tailwind classes `p-3`, `p-6`, `p-8`, `p-12` for consistent rhythm
- `3` (12px): Tight spacing, form elements
- `6` (24px): Standard component spacing
- `8` (32px): Section spacing
- `12` (48px): Major layout divisions

## Component Library

### Public Registration Form
- **Card-based design** with subtle shadow and rounded corners
- **Event type selector** as prominent radio buttons with icons
- **DateTime picker** with clear duration display (default 2 hours)
- **Form validation** with gentle error states in soft red

### Public Calendar View
- **Month grid layout** similar to Google Calendar
- **Blocked slots** shown as subtle gray overlays with "Booked" text
- **Available slots** remain clean and inviting
- **No sensitive information** displayed

### Admin Kanban Board
- **Column-based layout** with drag-and-drop functionality
- **Card design** with event type badges, datetime, and contact preview
- **Status indicators** using color-coded left borders
- **Smooth transitions** for drag operations

### Admin Calendar View
- **Full event details** on hover/click
- **Color-coded events** by type and status
- **Detailed tooltips** with booking information

### Navigation
- **Top navigation bar** with clean logo placement
- **Public/Admin toggle** clearly distinguished
- **Authentication status** prominently displayed

## Interactions
- **Minimal animations** - subtle fade-ins and smooth transitions only
- **Clear feedback** for all user actions
- **Loading states** with simple spinners
- **Toast notifications** for successful actions

## Responsive Design
- **Mobile-first** approach for public forms
- **Desktop-optimized** kanban and calendar views
- **Side-by-side layout** for kanban/calendar on large screens (1200px+)

## Images
**No hero image needed** - this is a utility-focused booking system. Focus on:
- **Small decorative icons** for event types (luciatåg, sjungande julgran)
- **Subtle background patterns** in form areas (very light, Swedish-inspired motifs)
- **Calendar icons** and **status indicators** throughout the interface

The design should feel professional and trustworthy while maintaining the warmth appropriate for Swedish Christmas event bookings.