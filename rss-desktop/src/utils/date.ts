import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'
import type { Feed } from '../types'

dayjs.extend(relativeTime)
dayjs.extend(utc)

export function formatDate(date?: string | null, insertedAt?: string | null): string {
    // Use insertedAt as fallback if primary date is null
    const effectiveDate = date || insertedAt;
    if (!effectiveDate) return '未知时间';

    // Backend time is UTC, convert to local then relative
    return dayjs.utc(effectiveDate).local().fromNow();
}

export function formatDateDetailed(date?: string | null, insertedAt?: string | null): string {
    const effectiveDate = date || insertedAt;
    if (!effectiveDate) return '未知时间';

    const d = dayjs.utc(effectiveDate).local();
    const now = dayjs();
    const diffDays = now.diff(d, 'day');

    // Show relative time for recent items
    if (diffDays < 7) {
        return d.fromNow();
    }

    // Show full date for older items
    return d.format('YYYY-MM-DD HH:mm');
}

export function formatLastChecked(date?: string | null): string {
    if (!date) return '未刷新'
    return dayjs.utc(date).local().fromNow()
}

export function getTimeRangeText(dateRange: string): string {
    const rangeMap: Record<string, string> = {
        '1d': '最近1天',
        '2d': '最近2天',
        '3d': '最近3天',
        '7d': '最近1周',
        '30d': '最近1个月',
        '90d': '最近3个月',
        '180d': '最近6个月',
        '365d': '最近1年',
        'all': '全部时间'
    }
    return rangeMap[dateRange] || dateRange
}

export function getFeedRefreshStatus(feed: Feed, intervalMinutes?: number): 'ok' | 'due' | 'never' {
    if (!feed.last_checked_at) return 'never'
    if (!intervalMinutes || intervalMinutes >= 1440) return 'ok'

    const nowLocal = dayjs()
    const lastLocal = dayjs.utc(feed.last_checked_at as string).local()
    const minutes = nowLocal.diff(lastLocal, 'minute')

    return minutes > intervalMinutes ? 'due' : 'ok'
}

export function getFeedRefreshTooltip(feed: Feed, intervalMinutes?: number): string {
    if (!feed.last_checked_at) return `尚未刷新\n抓取间隔: ${intervalMinutes} 分钟`

    const nowLocal = dayjs()
    const lastLocal = dayjs.utc(feed.last_checked_at).local()
    const minutes = nowLocal.diff(lastLocal, 'minute')
    const status = getFeedRefreshStatus(feed, intervalMinutes)

    const statusText = status === 'ok' ? '正常' : status === 'due' ? `已超时 ${Math.max(0, minutes - (intervalMinutes || 0))} 分钟` : '未刷新'

    return `最后刷新: ${lastLocal.fromNow()}\n抓取间隔: ${intervalMinutes} 分钟\n状态: ${statusText}`
}
