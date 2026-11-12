# SmartWaste Frontend Redesign Plan

## Project Overview
- Angular 20 standalone components
- Three portals: User (4200), Worker (4400), Admin (4300)
- Shared shell, components, services
- Firebase auth + custom backend API
- motion (Framer Motion) + animejs for animations

## Design System Overhaul

### Color Palette (Premium Environmental Theme)
```
Primary: #059669 (Emerald 600) - trust, growth, environmental
Primary Light: #10B981 (Emerald 500)
Primary Dark: #047857 (Emerald 700)
Accent: #F59E0B (Amber 500) - warnings, highlights
Success: #10B981 (Emerald 500)
Warning: #F59E0B (Amber 500)
Danger: #EF4444 (Red 500)
Info: #3B82F6 (Blue 500)

Neutral Light: #F8FAFC (Slate 50)
Surface: #FFFFFF (White)
Surface Elevated: #F1F5F9 (Slate 100)
Border: #E2E8F0 (Slate 200)
Border Strong: #CBD5E1 (Slate 300)
Text Primary: #0F172A (Slate 900)
Text Secondary: #475569 (Slate 600)
Text Muted: #94A3B8 (Slate 400)

Dark Mode:
Primary: #34D399 (Emerald 400)
Surface: #1E293B (Slate 800)
Surface Elevated: #334155 (Slate 700)
Border: #334155 (Slate 700)
Border Strong: #475569 (Slate 600)
Text Primary: #F1F5F9 (Slate 100)
Text Secondary: #CBD5E1 (Slate 300)
Text Muted: #94A3B8 (Slate 400)
```

### Typography Scale
```
Display XL: 48px / 1.1 / -0.02em (Hero headlines)
Display LG: 36px / 1.15 / -0.01em (Page titles)
Display MD: 28px / 1.2 / -0.01em (Section headers)
Display SM: 22px / 1.25 / 0 (Card titles)
Heading: 20px / 1.3 / 0 (Subsections)
Body LG: 18px / 1.6 / 0 (Lead text)
Body: 16px / 1.5 / 0 (Default)
Body SM: 14px / 1.5 / 0 (Secondary)
Caption: 12px / 1.4 / 0.01em (Labels, meta)
Micro: 11px / 1.3 / 0.02em (Badges, chips)
```

### Spacing Scale (4px base)
```
space-1: 4px
space-2: 8px
space-3: 12px
space-4: 16px
space-5: 20px
space-6: 24px
space-8: 32px
space-10: 40px
space-12: 48px
space-16: 64px
space-20: 80px
```

### Border Radius
```
radius-sm: 6px (inputs, chips)
radius-md: 10px (cards, buttons)
radius-lg: 16px (panels, modals)
radius-xl: 24px (hero cards)
radius-full: 9999px (pills, avatars)
```

### Shadows (Layered Elevation)
```
shadow-xs: 0 1px 2px rgba(15, 23, 42, 0.05)
shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.06)
shadow-md: 0 4px 6px rgba(15, 23, 42, 0.07), 0 2px 4px rgba(15, 23, 42, 0.06)
shadow-lg: 0 10px 15px rgba(15, 23, 42, 0.1), 0 4px 6px rgba(15, 23, 42, 0.05)
shadow-xl: 0 20px 25px rgba(15, 23, 42, 0.15), 0 10px 10px rgba(15, 23, 42, 0.04)
shadow-2xl: 0 25px 50px rgba(15, 23, 42, 0.25)
shadow-inner: inset 0 2px 4px rgba(15, 23, 42, 0.06)
```

### Animation Tokens
```
ease-out: cubic-bezier(0.22, 1, 0.36, 1)
ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)
ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)
duration-fast: 150ms
duration-normal: 250ms
duration-slow: 350ms
duration-page: 500ms
```

## Component Library Updates

### Buttons
- Primary: Emerald 600, white text, 12px 24px, radius-md, shadow-sm
- Secondary: White, Emerald 600 border/text, 12px 24px, radius-md
- Ghost: Transparent, Slate 600 text, hover: Slate 100 bg
- Danger: Red 500, white text
- Icon buttons: 40x40, radius-full
- Loading state: spinner + disabled
- Press: scale(0.98), 100ms

### Inputs
- Height: 48px (touch-friendly)
- Padding: 0 16px
- Border: 1px solid border, focus: 2px primary
- Radius: radius-md
- Label: caption, 6px gap
- Error: border-danger, error text below
- Password toggle: icon button inline

### Cards
- Base: surface, border, radius-lg, shadow-sm
- Hover: shadow-md, translateY(-2px)
- Interactive: cursor pointer, transition 200ms

### Badges/Chips
- Default: surface-elevated, border, text-secondary
- Primary: primary-light bg, primary-dark text
- Success/Warning/Danger: semantic colors
- Radius: radius-full
- Padding: 4px 10px

### Tables
- Header: caption, uppercase, tracking-wide, text-muted
- Row: hover surface-elevated
- Dividers: border
- Responsive: horizontal scroll on mobile

### Modals/Drawers
- Backdrop: rgba(15, 23, 42, 0.5), blur-sm
- Panel: surface, radius-xl, shadow-xl
- Slide up animation (300ms, ease-out)
- Focus trap, ESC to close

### Toasts
- Slide in from top-right
- Auto-dismiss (5s success, 8s error)
- Action button support
- Stack with gap

## Portal-Specific Redesigns

### User Portal (Public)
**Landing/Login/Signup:**
- Split layout with illustrated hero (left) + form card (right)
- Google auth with official SVG logo
- Smooth transitions between auth modes
- Password strength indicator
- Mobile: stacked, hero collapsible

**Dashboard:**
- Welcome header with quick stats
- Stat cards grid (4 cols desktop, 2 tablet, 1 mobile)
- Charts row: Donut (status), Sparkline (trend), Bar (waste types)
- Activity feed: Tickets + Hire Requests in tabs
- Quick actions: Create Ticket, Hire Worker
- Real-time refresh indicator

**Tickets:**
- Toolbar: search + status filter + priority filter
- Card list with: code, type, priority badge, status badge, location, requester, worker
- Expandable: description, timeline, images, chat
- Admin: assign worker dropdown, SLA overdue highlight
- Worker: stage buttons (Accept → In Progress → Complete)
- User: completion code display, rating after complete
- Mobile: stacked cards, swipe actions

**Hire Worker:**
- Form: title, purpose, address (prefill from profile)
- Admin: worker assignment dropdown with availability
- Worker: task cards with complete button
- List with status badges

**Profile/Settings:**
- Two-column form (desktop), stacked (mobile)
- Avatar upload with preview
- Theme toggle (Light/Dark/System)
- Notification preferences
- Connected accounts

### Worker Portal
**Login:**
- Dedicated branding (Field Operations)
- Simpler form, no Google auth
- "Enter Worker Console" CTA

**Dashboard:**
- Availability toggle (Online/Offline) - prominent
- Assigned tickets summary cards
- Quick actions: View Tickets, Go Online/Offline
- Rating display with stars
- Recent activity: tickets + hired tasks

**Tickets:**
- Filter: My Assigned (default), All
- Stage workflow buttons prominent
- Live location sharing indicator
- Chat with requester
- Directions button (Google Maps)

**Hired Tasks:**
- Task cards with requester info
- Directions, chat, complete button
- Purpose and address prominent

### Admin Portal
**Login:**
- "Administration Console" branding
- Secure, minimal
- No Google auth

**Admin Panel (Dashboard):**
- Hero: title + manage accounts CTA + live clock
- KPI Grid (4 cards): Total Accounts, Workers, Priority Load, Pending Tickets
- Metrics Bar (5): Open, Closed, Assign Requests, Online Workers, Overdue SLA
- Charts Row: Donut (status), Sparkline (week), Bar (waste types)
- Panels: Recent Tickets (5) + Pending Hire Requests (5)
- All with stagger entrance animations

**User/Worker Management:**
- Searchable, sortable table
- Role badge, status, last login
- Create user modal with role selection
- Edit inline (role, status)
- Delete with confirmation

**Broadcast Desk:**
- Rich text editor
- Target: All / Users / Workers / Specific
- Schedule send
- History list

**Activity Log:**
- Filterable table: date, admin, action, target
- Pagination
- Export CSV

## Mobile-First Responsive Strategy

### Breakpoints
```
Mobile: < 640px
Tablet: 640px - 1023px
Desktop: 1024px - 1439px
Wide: >= 1440px
```

### Layout Patterns
- Shell: 44px top bar + 52px workspace bar = 96px fixed
- Content: max-width 1440px, padding 24px (mobile), 32px (desktop)
- Grid: 1col mobile, 2col tablet, 4col desktop for stats
- Tables: horizontal scroll on mobile, full on desktop
- Forms: stacked on mobile, 2-col grid on desktop
- Navigation: hamburger drawer on mobile, top tabs on desktop
- Drawers: bottom sheet on mobile, right panel on desktop

### Touch Targets
- Minimum 44x44px
- 8px gap between interactive elements
- Swipe gestures for drawer, card actions

## Animation Implementation

### Page Transitions
- Route enter: fade + slide up (300ms)
- Route exit: fade + slide down (200ms)
- Stagger children: 60ms delay each

### Micro-interactions
- Button press: scale(0.98) 100ms
- Card hover: translateY(-2px) + shadow 200ms
- Input focus: border color 150ms
- Badge appear: scale 0→1 150ms spring
- Modal: backdrop fade + panel slide up 300ms
- Toast: slide right → left 300ms
- Loading skeletons: pulse 1.5s infinite

### Chart Animations
- Donut: stroke-dashoffset 700ms ease-out
- Sparkline: stroke-dashoffset 1000ms + area fade
- Bar: height 0→100% 600ms stagger 80ms

## Favicon & Branding

### Favicon Set
- SVG (primary, scalable)
- 16x16, 32x32, 48x48 PNG
- Apple touch icon 180x180
- Manifest icons 192x192, 512x512
- Theme color: #059669

### Brand Assets
- Logo: "SW" monogram in emerald gradient
- Wordmark: "SmartWaste" in Inter 600
- Illustration style: clean line art, emerald/amber accents

## Implementation Phases

### Phase 1: Design System Foundation
1. Update `styles.scss` with new tokens
2. Create utility classes
3. Update global component styles (buttons, inputs, cards, badges)
4. Add animation keyframes

### Phase 2: Shell & Navigation
1. Redesign global-nav (44px) + workspace-nav (52px)
2. Mobile drawer with smooth animation
3. Notifications dropdown + profile menu
4. Role pill, location status, user avatar

### Phase 3: Auth Pages
1. Login: split layout, Google button with SVG
2. Signup: multi-step or single form with validation
3. Forgot password: clean form
4. Admin/Worker login variants
5. Animations: stagger entrance

### Phase 4: Dashboard (User/Worker)
1. Hero header with actions
2. Stat cards grid
3. Charts row (donut, sparkline, bar)
4. Activity feed with tabs
5. Entrance animations

### Phase 5: Tickets Page
1. Toolbar with filters
2. Ticket cards with expandable details
3. Status timeline, images, chat
4. Role-specific actions
5. Form modal/drawer

### Phase 6: Hire Worker Page
1. Create request form
2. List with assignment UI
3. Worker task cards

### Phase 7: Admin Pages
1. Admin Panel dashboard
2. User/Worker management table
3. Broadcast desk
4. Activity log

### Phase 8: Profile & Settings
1. Profile form with avatar
2. Settings: theme, notifications, security
3. Two-column responsive layout

### Phase 9: Polish & Mobile
1. Touch targets, swipe gestures
2. Loading skeletons
3. Empty states with illustrations
4. Toast system
5. Confirmation dialogs
6. Favicon + manifest
7. Cross-browser testing

### Phase 10: Verification
1. Build all 3 portals
2. Run tests
3. Check console errors
4. Mobile device testing
4. Performance audit

## Files to Modify/Create

### Core Design System
- `src/styles.scss` - Complete rewrite
- `src/app/app.scss` - Global app styles
- `src/index.html` - Favicon, meta, theme-color

### Shell & Navigation
- `src/app/shell/shell.component.{html,scss,ts}`
- `src/app/shell/shell-navigation.ts`

### Auth Pages
- `src/app/pages/auth/login.component.{html,ts}`
- `src/app/pages/auth/signup.component.{html,ts}`
- `src/app/pages/auth/forgot-password.component.{html,ts}`
- `src/app/pages/auth/admin-login.component.{html,ts}`
- `src/app/pages/auth/auth.component.scss` - Complete rewrite

### Dashboard
- `src/app/pages/dashboard/dashboard.component.{html,scss,ts}`

### Tickets
- `src/app/pages/tickets/tickets.component.{html,scss,ts}`

### Hire Worker
- `src/app/pages/hire/hire-requests.component.{html,scss,ts}`

### Admin Pages
- `src/app/pages/admin/admin-panel.component.{html,scss,ts}`
- `src/app/pages/admin/admin-accounts.component.{html,scss,ts}`
- `src/app/pages/admin/admin-broadcast.component.{html,scss,ts}`
- `src/app/pages/admin/admin-activity.component.{html,scss,ts}`

### Profile & Settings
- `src/app/pages/profile/profile.component.{html,scss,ts}`
- `src/app/pages/settings/settings.component.{html,scss,ts}`

### Shared Components
- `src/app/shared/stat-card.component.ts`
- `src/app/shared/status-badge.component.ts`
- `src/app/shared/role-pill.component.ts`
- `src/app/shared/donut-chart.component.ts`
- `src/app/shared/sparkline.component.ts`
- `src/app/shared/bar-chart.component.ts`

### New Components
- `src/app/shared/toast/toast.component.ts`
- `src/app/shared/toast/toast.service.ts`
- `src/app/shared/confirm-dialog/confirm-dialog.component.ts`
- `src/app/shared/skeleton/skeleton.component.ts`
- `src/app/shared/empty-state/empty-state.component.ts`
- `src/app/shared/avatar/avatar.component.ts`

### Assets
- `src/assets/favicon.svg`
- `src/assets/icons/google.svg`
- `src/assets/icons/logo.svg`
- `src/assets/illustrations/*`
- `src/manifest.webmanifest`

## Technical Considerations

### Performance
- Lazy load admin modules (already done)
- Preload critical fonts
- Optimize images (WebP, proper sizing)
- Virtual scrolling for long lists
- Debounce search inputs (300ms)

### Accessibility
- Semantic HTML
- ARIA labels/roles
- Focus management
- Color contrast (WCAG AA)
- Reduced motion support
- Keyboard navigation
- Screen reader tested

### Browser Support
- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- CSS custom properties
- Modern JS (optional chaining, nullish coalescing)
- Graceful degradation for older browsers

## Success Criteria
- All 3 builds pass without errors
- All existing tests pass
- No console errors/warnings
- Lighthouse score > 90 (Performance, Accessibility, Best Practices, SEO)
- Mobile: works on iOS Safari + Android Chrome
- Desktop: works on Chrome, Firefox, Safari, Edge
- Animations smooth (60fps)
- Touch targets meet 44x44 minimum
- Zero horizontal overflow on mobile