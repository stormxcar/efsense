import { Copy, Share2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { recordPostShare } from '@/services/api'
import {
  EmailIcon,
  EmailShareButton,
  FacebookIcon,
  FacebookShareButton,
  LinkedinIcon,
  LinkedinShareButton,
  RedditIcon,
  RedditShareButton,
  TelegramIcon,
  TelegramShareButton,
  TwitterIcon,
  TwitterShareButton,
  WhatsappIcon,
  WhatsappShareButton,
} from 'react-share'

type SocialShareProps = {
  postId: string
  url: string
  title: string
  description?: string | null
}

const iconSize = 38

export default function SocialShare({ postId, url, title, description }: SocialShareProps) {
  const { user } = useAuth()

  const trackShare = (platform: string) => {
    if (!user) return
    void recordPostShare(user.id, postId, platform)
  }

  const copyLink = async (platform = 'Sao chép liên kết') => {
    await navigator.clipboard.writeText(url)
    trackShare(platform)
    toast.success('Đã sao chép liên kết')
  }

  const shareOnDevice = async () => {
    if (!navigator.share) {
      await copyLink()
      return
    }
    try {
      await navigator.share({ title, text: description ?? undefined, url })
      trackShare('Chia sẻ trên thiết bị')
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') toast.error('Chưa thể mở bảng chia sẻ')
    }
  }

  return (
    <section className="share-panel" aria-labelledby="share-heading">
      <div>
        <p id="share-heading" className="font-extrabold">Chia sẻ câu chuyện</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Gửi bài viết đến bạn bè trên nền tảng bạn dùng.</p>
      </div>
      <div className="share-buttons" aria-label="Các lựa chọn chia sẻ">
        <FacebookShareButton url={url} hashtag="#FootballStories" aria-label="Chia sẻ lên Facebook" onClick={() => trackShare('Facebook')}>
          <FacebookIcon size={iconSize} round />
        </FacebookShareButton>
        <TwitterShareButton url={url} title={title} aria-label="Chia sẻ lên X" onClick={() => trackShare('X')}>
          <TwitterIcon size={iconSize} round />
        </TwitterShareButton>
        <LinkedinShareButton url={url} title={title} summary={description ?? undefined} aria-label="Chia sẻ lên LinkedIn" onClick={() => trackShare('LinkedIn')}>
          <LinkedinIcon size={iconSize} round />
        </LinkedinShareButton>
        <TelegramShareButton url={url} title={title} aria-label="Chia sẻ qua Telegram" onClick={() => trackShare('Telegram')}>
          <TelegramIcon size={iconSize} round />
        </TelegramShareButton>
        <WhatsappShareButton url={url} title={title} aria-label="Chia sẻ qua WhatsApp" onClick={() => trackShare('WhatsApp')}>
          <WhatsappIcon size={iconSize} round />
        </WhatsappShareButton>
        <RedditShareButton url={url} title={title} aria-label="Chia sẻ lên Reddit" onClick={() => trackShare('Reddit')}>
          <RedditIcon size={iconSize} round />
        </RedditShareButton>
        <EmailShareButton url={url} subject={title} body={description ?? undefined} aria-label="Chia sẻ qua email" onClick={() => trackShare('Email')}>
          <EmailIcon size={iconSize} round />
        </EmailShareButton>
        <button type="button" onClick={shareOnDevice} className="share-utility" aria-label="Mở bảng chia sẻ trên thiết bị" title="Chia sẻ khác">
          <Share2 size={17} />
        </button>
        <button type="button" onClick={() => copyLink()} className="share-utility" aria-label="Sao chép liên kết" title="Sao chép liên kết">
          <Copy size={17} />
        </button>
      </div>
    </section>
  )
}
