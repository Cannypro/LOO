# Loop — 10-second social video app

Loop is a mobile-first social video app built with React, TypeScript, Vite and Supabase. It is designed around short vertical videos (maximum 10 seconds), creator profiles and lightweight social interactions.

## Included in this project

- Email/password sign-up, sign-in and email confirmation through Supabase Auth.
- Profile handles, display names, bios and profile-photo uploads.
- Full-height short-video feed, autoplay when in view, mute/unmute and replay.
- Video uploads with browser-side duration validation, caption and hashtags.
- Public, followers-only and private post visibility.
- Follow requests for private profiles; accept/decline from Activity.
- Likes, comments, saved loops and notifications.
- Creator discovery, username search, caption/hashtag video search and profile grids.
- Report controls, plus atomic account blocking that removes existing follow links in both directions.
- Public draft Terms, Privacy and Community Guidelines pages linked from sign-up.
- Admin moderation queue, new-loop review, report actions (remove loops, hide comments, suspend accounts) and admin promotion by email.
- Postgres Row Level Security policies and private video storage.
- Demo preview when Supabase environment variables are not configured.

The initial release intentionally has no payments or direct messages. Keep the product focused on short-form video and safer public interactions first.

## 1. Requirements

- Node.js 22.12+ is recommended. Current Vite releases require Node 20.19+ or 22.12+.
- A Supabase project.
- A Vercel account or another static hosting provider for deployment.

## 2. Run locally

```bash
npm install
cp .env.example .env.local
```

Open `.env.local` and set:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Use the **Project URL** and **Publishable key** from the Supabase project API settings. The publishable key is designed for browser use when Row Level Security is enabled. Do not use a `service_role` key in a `VITE_` variable and do not commit `.env.local`.

Start the app:

```bash
npm run dev
```

Vite prints a local development URL (usually `http://localhost:5173`). Without Supabase credentials, the site opens in preview mode with sample content. Preview mode is not connected to real accounts and does not publish videos.

## 3. Create the Supabase database

1. Create a new Supabase project.
2. Open **SQL Editor** in the Supabase dashboard.
3. Paste the complete contents of `supabase/schema.sql` and run it.
4. Confirm the tables and two storage buckets were created: `loop-videos` (private) and `loop-avatars` (public).
5. In **Authentication → URL Configuration**, add your local URL and your production domain to the allowed redirect URLs. For local development add `http://localhost:5173/**`.
6. In **Authentication → Providers → Email**, enable email/password sign-in. Keep email confirmation enabled for public launch and configure the email templates / SMTP provider before inviting users.
7. Fill `.env.local`, restart Vite, then create a test account from `/login`.

The SQL setup creates a profile and private birth-date record when an auth user is created. The birth date is held in `private_user_data`, which is readable only by the account owner and admins. It is not stored in the public profile table.

## 4. Make the first admin

After creating your own account, run this once in Supabase SQL Editor, replacing the email with the email used for your Loop account:

```sql
update public.private_user_data pud
set role = 'admin'
from auth.users u
where pud.user_id = u.id
  and lower(u.email) = lower('YOUR_ADMIN_EMAIL');
```

Sign out and sign back in, then open **Safety centre** from the left menu or `/admin`. Existing admins can promote another already-registered Loop user by email from the admin dashboard. Admin grants are checked again inside Postgres; a browser-only flag cannot grant admin access.

## 5. Deploy to Vercel

1. Push this project to a private GitHub repository.
2. In Vercel, import the repository. The included `vercel.json` rewrites app routes to the Vite entry point so profile URLs work when opened directly.
3. Keep the default Vite build settings (`npm run build`, output directory `dist`).
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel → Project → Settings → Environment Variables.
5. Deploy, then add the Vercel production URL to Supabase Auth's allowed redirect URLs.
6. Redeploy after changing environment variables.

Never add a database password or Supabase service-role secret to Vercel's `VITE_*` variables. A Vite `VITE_` variable is bundled into browser code.

## 6. Product safety and launch requirements

This code includes useful baseline protections, but it is an MVP codebase—not a certification that a user-generated-content platform is ready for unrestricted public launch.

- **Age:** Sign-up requires a date of birth for users aged 13+. The database rejects dates indicating an age under 13. Accounts for users under 18 are forced private by a database trigger, and the UI does not allow them to turn that protection off. This is self-declared age, not verified age assurance. A public launch needs a lawful, privacy-preserving age-assurance process appropriate to the launch countries.
- **Video duration:** The browser reads video metadata and rejects clips over 10 seconds. Post rows also reject a submitted duration over 10 seconds. This does not prove that the uploaded file itself is 10 seconds; a modified client could lie about metadata. Before public launch, route uploads through a trusted server-side media-processing pipeline that probes the actual file, rejects overlength files, normalizes codecs/resolution, strips unnecessary metadata and produces safe renditions.
- **Moderation:** New uploads enter a review queue by default. Reporting, blocking, report actions (remove a loop, hide a comment or suspend an account) and admin promotion are implemented. They are not a substitute for a staffed moderation operation. Before public launch, add rate limits, spam detection, abuse escalation, copyright workflows, moderator coverage and an emergency response process.
- **Privacy:** Video objects live in a private bucket. The app issues time-limited signed URLs only after storage policies authorize the viewer. Public avatars use a separate bucket. Check all policies again before production and keep the project keys private.
- **Minors:** This starter intentionally does not include direct messages, live streaming, location sharing or public contact details. Add guardian/safety requirements and stronger default controls before expanding features for younger users.
- **Legal:** The included Terms, Privacy and Community Guidelines are starter drafts only. Have them reviewed and adapt them to local requirements, then add the copyright/takedown process, support contact and retention/deletion policy before opening the service to the public.

## 7. Useful commands

```bash
npm run dev       # local development server
npm run typecheck # TypeScript checks
npm run build     # production build
npm run preview   # preview the production build
```

## Architecture notes

- `src/pages` contains the main product screens.
- `src/components` contains the reusable feed, upload and moderation interactions.
- `src/lib/api.ts` contains Supabase queries and actions.
- `src/contexts/AuthContext.tsx` handles the signed-in user and profile.
- `supabase/schema.sql` contains schema, triggers, RLS policies and storage policies.
- `.env.local` is ignored by Git. Only `.env.example` is intended to be committed.

## Important implementation boundary

The current code does not include transcoding, content-classification AI, a dedicated media CDN, push notifications, passwordless login, account deletion workflow, or a full moderator audit log. Those are sensible next production milestones. Add them deliberately rather than exposing private database or storage credentials in the browser.
