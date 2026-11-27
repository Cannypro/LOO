import { useCallback, useEffect, useState } from 'react'
import { ArrowUpRight, Hash, Search, Sparkles, TrendingUp, Users } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { searchCreators, searchPosts, getSuggestedCreators, getTrendingTags } from '../lib/api'
import { demoPosts } from '../lib/demo'
import type { Post, Profile } from '../lib/types'
import { useAuth } from '../contexts/AuthContext'

const fallbackTags = [
  { tag: 'tinyjoys', count: '2.4k loops', note: 'The little things' },
  { tag: 'onrepeat', count: '1.8k loops', note: 'Worth another watch' },
  { tag: 'weekendmood', count: '986 loops', note: 'A softer pace' },
  { tag: 'creativeprocess', count: '821 loops', note: 'Made by hand' },
  { tag: 'goodenergy', count: '704 loops', note: 'Pass it on' },
  { tag: 'soundcheck', count: '526 loops', note: 'The rhythm of now' },
]

export function ExplorePage() {
  const { user, configured } = useAuth()
  const [searchParams] = useSearchParams()
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [postResults, setPostResults] = useState<Post[]>([])
  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)
  const [suggestedCreators, setSuggestedCreators] = useState<Profile[]>([])
  const [trendingTags, setTrendingTags] = useState(fallbackTags)
  useEffect(() => {
    let alive = true
    Promise.all([getSuggestedCreators(user?.id ?? 'demo-user'), getTrendingTags()]).then(([creators, tags]) => {
      if (alive) { setSuggestedCreators(creators); if (tags.length) setTrendingTags(tags) }
    }).catch((error) => { if (alive) toast.error(error instanceof Error ? error.message : 'Could not load Explore.') })
    return () => { alive = false }
  }, [user])
  const search = useCallback(async (query: string) => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const isTagSearch = query.trim().startsWith('#')
      const [people, loops] = await Promise.all([
        isTagSearch ? Promise.resolve([] as Profile[]) : searchCreators(query),
        searchPosts(query, user?.id ?? 'demo-user'),
      ])
      setResults(people); setPostResults(loops); setSearched(true)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Search failed.') }
    finally { setSearching(false) }
  }, [user])
  useEffect(() => {
    const tag = searchParams.get('tag')
    if (!tag) return
    const query = `#${tag.replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 40)}`
    setTerm(query)
    void search(query)
  }, [searchParams, search])
  const localMatches = demoPosts.map((post) => post.profile).filter((creator, index, all) => all.findIndex((item) => item.id === creator.id) === index && `${creator.username} ${creator.display_name}`.toLowerCase().includes(term.toLowerCase()))
  const shown = results.length ? results : (searched && !configured ? localMatches : [])

  return (
    <div className="content-page explore-page">
      <div className="page-heading-block"><span className="eyebrow"><Sparkles size={13} /> FIND YOUR NEXT FAVOURITE</span><h1>Explore the <em>loop.</em></h1><p>Fresh creators, new perspectives and the tags everyone is watching.</p></div>
      <div className="explore-search"><Search size={19} /><input value={term} onChange={(event) => setTerm(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void search(term) }} placeholder="Search creators or usernames…" /><button onClick={() => void search(term)} disabled={searching}>{searching ? 'Searching…' : 'Search'} <ArrowUpRight size={15} /></button></div>
      {searched && <><section className="search-results"><div className="section-header"><h2><Users size={18} /> People</h2><span>{shown.length} results</span></div>{shown.length ? <div className="creator-results">{shown.map((creator) => <Link to={`/@${creator.username}`} className="creator-result" key={creator.id}><div className="avatar avatar-large">{creator.avatar_url ? <img src={creator.avatar_url} alt="" /> : creator.display_name.slice(0, 1)}</div><div className="creator-result-info"><strong>{creator.display_name}</strong><span>@{creator.username}</span><p>{creator.bio}</p></div><ArrowUpRight size={17} /></Link>)}</div> : <div className="empty-inline">No creators found for this search.</div>}</section><section className="search-results search-loop-results"><div className="section-header"><h2><Sparkles size={18} /> Loops</h2><span>{postResults.length} results</span></div>{postResults.length ? <div className="search-loop-grid">{postResults.map((post) => <article className="search-loop-card" key={post.id}><video src={post.video_url} muted controls playsInline loop preload="metadata" /><div><Link to={`/@${post.profile.username}`}><strong>{post.profile.display_name}</strong> <span>@{post.profile.username}</span></Link><p>{post.caption}</p>{post.hashtags?.length ? <span className="search-loop-tags">{post.hashtags.map((tag) => `#${tag}`).join(' ')}</span> : null}</div></article>)}</div> : <div className="empty-inline">No loops found. Try a caption word or a #hashtag.</div>}</section></>}
      <section className="explore-section"><div className="section-header"><div><span className="eyebrow">WHAT'S MOVING</span><h2><TrendingUp size={20} /> Trending right now</h2></div><span className="subtle-counter">BASED ON RECENT LOOPS</span></div><div className="tag-grid">{trendingTags.map((item, index) => <Link to={`/explore?tag=${item.tag}`} className="tag-card" key={item.tag}><span className="tag-index">0{index + 1}</span><span className="tag-icon"><Hash size={17} /></span><strong>#{item.tag}</strong><span className="tag-note">{item.note}</span><span className="tag-count">{item.count}</span><ArrowUpRight className="tag-arrow" size={17} /></Link>)}</div></section>
      <section className="explore-section featured-creators"><div className="section-header"><div><span className="eyebrow">GOOD PEOPLE, GOOD LOOPS</span><h2><Users size={20} /> Creators to know</h2></div><span className="subtle-counter">NEW TO THE COMMUNITY</span></div><div className="featured-creator-grid">{suggestedCreators.length ? suggestedCreators.map((creator, index) => <Link to={`/@${creator.username}`} className={`featured-creator-card creator-tone-${(index % 4) + 1}`} key={creator.id}><div className="featured-creator-cover"><span className="creator-cover-stamp">LOOP<br />PICK</span>{creator.avatar_url && <img src={creator.avatar_url} alt="" />}</div><div className="featured-creator-details"><div><strong>{creator.display_name}</strong><span>@{creator.username}</span></div><ArrowUpRight size={16} /></div><p>{creator.bio}</p></Link>) : <div className="empty-inline">New creators will appear here as the community grows.</div>}</div></section>
      <div className="explore-bottom-note"><span className="endnote-mark">✳</span> THE NEXT BIG THING COULD BE 10 SECONDS AWAY.</div>
    </div>
  )
}
