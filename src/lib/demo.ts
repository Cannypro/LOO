import type { Post, Profile } from './types'

export const demoProfile: Profile = {
  id: 'demo-user',
  username: 'youonloop',
  display_name: 'Your Loop profile',
  bio: 'A little moment, on repeat. ✳',
  avatar_url: null,
  is_private: false,
}

const demoCreators: Profile[] = [
  { id: 'creator-1', username: 'mila.moves', display_name: 'Mila James', bio: 'Finding magic in ordinary days.', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&h=160&fit=crop&crop=faces', is_private: false },
  { id: 'creator-2', username: 'kai.frames', display_name: 'Kai Rivers', bio: 'Little clips. Big feelings.', avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&h=160&fit=crop&crop=faces', is_private: false },
  { id: 'creator-3', username: 'nora.jpg', display_name: 'Nora Lee', bio: 'Collecting tiny adventures.', avatar_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=160&h=160&fit=crop&crop=faces', is_private: false },
]

const sampleVideo = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'

export const demoPosts: Post[] = [
  {
    id: 'demo-post-1', user_id: 'creator-1', caption: 'Proof that the small things are the big things. 🌼', hashtags: ['littlejoys', 'dailyloop'],
    video_url: sampleVideo, duration_seconds: 5, created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(), visibility: 'public',
    profile: demoCreators[0]!, likes_count: 2841, comments_count: 93, liked_by_me: false, saved_by_me: false,
  },
  {
    id: 'demo-post-2', user_id: 'creator-2', caption: 'A five-second reset for your feed.', hashtags: ['slowdown', 'moments'],
    video_url: sampleVideo, duration_seconds: 5, created_at: new Date(Date.now() - 1000 * 60 * 54).toISOString(), visibility: 'public',
    profile: demoCreators[1]!, likes_count: 1204, comments_count: 41, liked_by_me: true, saved_by_me: false,
  },
  {
    id: 'demo-post-3', user_id: 'creator-3', caption: 'Tiny reminder: look up once in a while.', hashtags: ['perspective', 'life'],
    video_url: sampleVideo, duration_seconds: 5, created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(), visibility: 'public',
    profile: demoCreators[2]!, likes_count: 987, comments_count: 28, liked_by_me: false, saved_by_me: true,
  },
]
