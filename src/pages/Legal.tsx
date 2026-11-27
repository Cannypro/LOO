import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, FileText, LockKeyhole } from 'lucide-react'

type LegalKind = 'terms' | 'privacy' | 'community'

const content: Record<LegalKind, { eyebrow: string; title: string; intro: string; sections: Array<{ title: string; body: string }> }> = {
  terms: {
    eyebrow: 'THE GROUND RULES',
    title: 'Terms of use.',
    intro: 'A plain-language starter draft for using Loop. The platform owner must review and adapt this before a public launch.',
    sections: [
      { title: 'Eligibility and accounts', body: 'Loop is intended for people aged 13 and above. You must provide accurate account information, keep your password private and use only one account for yourself. Accounts for people under 18 are kept private by default in this version.' },
      { title: 'Your videos and other content', body: 'You keep ownership of content you create. By uploading, you give Loop permission to store, process and display that content as needed to operate the service and according to the visibility settings you choose. Only upload content you created or have permission to share, including music, images and people shown in a clip.' },
      { title: 'Community rules', body: 'Do not use Loop to harass, threaten, impersonate, scam, exploit or expose another person. Do not post illegal content, private information, or content that violates another person’s rights. Do not try to bypass account, privacy, upload or moderation controls.' },
      { title: 'Moderation and account restrictions', body: 'Loop may review reported or newly uploaded content, remove content that breaks the rules, restrict features or suspend accounts when needed to protect the community. You can report content and block accounts from the app.' },
      { title: 'Service availability', body: 'This early version is provided as-is while it is being tested. Features may change, and the service may be interrupted. Do not rely on Loop as the only place where you store important videos.' },
      { title: 'Contact and local review', body: 'The owner must add a real support contact, local legal terms, a takedown process and an account/content deletion process before opening Loop to the public.' },
    ],
  },
  privacy: {
    eyebrow: 'YOUR DATA, YOUR BOUNDARIES',
    title: 'Privacy notice.',
    intro: 'This describes what the current Loop starter app is designed to store. It is a draft notice, not a substitute for a locally reviewed privacy policy.',
    sections: [
      { title: 'Information you provide', body: 'The app uses your email address for authentication; your date of birth for the minimum-age check and under-18 privacy setting; and your username, display name, bio, profile photo, videos, captions, comments and reports to provide social features.' },
      { title: 'Activity and connections', body: 'Loop stores follows and follow requests, likes, comments, saved videos, blocks and notifications so those features work. Your date of birth is stored separately from your public profile and is not displayed on creator pages.' },
      { title: 'Who can see your content', body: 'Your profile privacy and each video’s visibility setting control who can see your videos. Private video files are stored in a private bucket and are served through time-limited links after access checks. Profile photos are stored separately and may be publicly accessible.' },
      { title: 'Service providers', body: 'This build uses Supabase for authentication, database and file storage. The platform owner must document the actual hosting, email and analytics providers used in the deployed version, including their applicable privacy terms.' },
      { title: 'What this version does not include', body: 'This starter does not include direct messages, live streaming, location sharing, advertising trackers or purchase/payment flows. It also does not yet provide a complete self-service account deletion or data export workflow.' },
      { title: 'Before launch', body: 'The owner must add a privacy contact, explain retention and deletion periods, configure provider agreements, and review applicable privacy and children’s data requirements for every country where Loop will operate.' },
    ],
  },
  community: {
    eyebrow: 'MAKE LOOP A GOOD PLACE',
    title: 'Community guidelines.',
    intro: 'Loop is for short creative moments. Keep the space welcoming, respectful and safe for everyone.',
    sections: [
      { title: 'Treat people with respect', body: 'No bullying, targeted harassment, threats, hate, humiliation or encouraging others to pile onto a person. Disagree without attacking someone.' },
      { title: 'Protect privacy', body: 'Do not post someone’s address, phone number, school details, private messages or other personal information without clear permission. Ask before filming or sharing another person.' },
      { title: 'Keep content age-appropriate', body: 'Do not post sexual content, exploitation, graphic violence or dangerous challenges. Do not pressure others to share personal details or move conversations to unsafe spaces.' },
      { title: 'Share what you have rights to share', body: 'Use your own videos, sounds and images or material you have permission to use. Credit creators where appropriate; credit alone does not replace permission.' },
      { title: 'No spam or deception', body: 'Do not impersonate people, run scams, manipulate engagement, repeatedly post unwanted promotions or try to evade a moderation decision.' },
      { title: 'Report and block', body: 'Use the report control when a post, comment or account breaks these guidelines. Block accounts that make you uncomfortable. Moderators review reports and may remove content or restrict accounts.' },
    ],
  },
}

export function LegalPage({ kind }: { kind: LegalKind }) {
  const location = useLocation()
  const page = content[kind]
  const Icon = kind === 'privacy' ? LockKeyhole : kind === 'terms' ? FileText : ShieldCheck
  return (
    <main className="legal-screen">
      <div className="legal-shell">
        <Link to="/login" state={{ from: location.pathname }} className="auth-back-link"><ArrowLeft size={16} /> Back to Loop</Link>
        <div className="legal-card">
          <span className="eyebrow"><Icon size={14} /> {page.eyebrow}</span>
          <h1>{page.title}</h1>
          <p className="legal-intro">{page.intro}</p>
          <div className="legal-draft-note">DRAFT POLICY · REVIEW BEFORE PUBLIC LAUNCH</div>
          {page.sections.map((section) => <section className="legal-section" key={section.title}><h2>{section.title}</h2><p>{section.body}</p></section>)}
          <div className="legal-footer-links"><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><Link to="/community-guidelines">Community guidelines</Link></div>
        </div>
      </div>
    </main>
  )
}
