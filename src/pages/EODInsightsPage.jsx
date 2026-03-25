import { useMemo, useState, useEffect } from 'react'
import { ResponsiveContainer, BarChart, Bar, Cell, CartesianGrid, Tooltip, XAxis, YAxis, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, LineChart, Line, PieChart, Pie } from 'recharts'
import { THEME as T } from '../lib/theme'
import { fmt } from '../lib/data'
import { Card, SectionHead, Select, KpiCard, ChartTooltip } from '../components/UI'

const PERIOD_OPTIONS = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All Time' },
]

function loadEntries() {
  try { return JSON.parse(localStorage.getItem('tl_eod') || '[]') } catch { return [] }
}

function getRangeStart(period) {
  const days = { week: 7, month: 30, quarter: 90, year: 365 }
  return period === 'all' ? 0 : Date.now() - (days[period] || 30) * 24 * 60 * 60 * 1000
}

function average(entries, key) {
  if (!entries.length) return 0
  return entries.reduce((sum, entry) => sum + (Number(entry[key]) || 0), 0) / entries.length
}

function countLesson(entries, label) {
  return entries.filter((entry) => entry.lessons?.includes(label)).length
}

function countMood(entries, label) {
  return entries.filter((entry) => entry.mood === label).length
}

function buildAnalytics(entries, period) {
  const cutoff = getRangeStart(period)
  const filtered = entries.filter((entry) => new Date(`${entry.date}T12:00:00`).getTime() >= cutoff).sort((a, b) => a.date.localeCompare(b.date))
  const issueData = [
    { label: 'Overtrading', value: countLesson(filtered, 'Overtraded'), color: T.red },
    { label: 'FOMO', value: countMood(filtered, 'FOMO') + countLesson(filtered, 'Chased entries'), color: T.accent },
    { label: 'Revenge', value: countMood(filtered, 'Revenge'), color: '#fb7185' },
    { label: 'Rule Breaks', value: filtered.reduce((sum, entry) => sum + (Number(entry.ruleBreaks) || 0), 0), color: '#f97316' },
    { label: 'Discipline', value: countMood(filtered, 'Disciplined') + countLesson(filtered, 'Good risk management') + filtered.filter((entry) => entry.followedPlan === true).length, color: T.green },
  ]
  const radarData = [
    { metric: 'Confidence', value: average(filtered, 'confidence') },
    { metric: 'Focus', value: average(filtered, 'focus') },
    { metric: 'Sleep', value: average(filtered, 'sleepQuality') },
    { metric: 'Stress', value: 10 - average(filtered, 'stress') },
    { metric: 'Clarity', value: average(filtered, 'marketClarity') },
    { metric: 'Discipline', value: filtered.length ? filtered.filter((entry) => entry.followedPlan === true).length / filtered.length * 10 : 0 },
  ]
  const timeline = filtered.map((entry) => ({ date: entry.date.slice(5), rating: Number(entry.rating) || 0, confidence: Number(entry.confidence) || 0, focus: Number(entry.focus) || 0, stress: Number(entry.stress) || 0 }))
  const planData = [
    { name: 'On Plan', value: filtered.filter((entry) => entry.followedPlan === true).length, color: T.green },
    { name: 'Partial', value: filtered.filter((entry) => entry.followedPlan === 'partial').length, color: T.accent },
    { name: 'Off Plan', value: filtered.filter((entry) => entry.followedPlan === false).length, color: T.red },
  ].filter((item) => item.value > 0)
  return {
    filtered,
    issueData,
    radarData,
    timeline,
    planData,
    avgRating: average(filtered, 'rating'),
    avgConfidence: average(filtered, 'confidence'),
    avgFocus: average(filtered, 'focus'),
    avgSleep: average(filtered, 'sleepQuality'),
    avgStress: average(filtered, 'stress'),
    avgClarity: average(filtered, 'marketClarity'),
    avgRuleBreaks: average(filtered, 'ruleBreaks'),
    planFollowRate: filtered.length ? filtered.filter((entry) => entry.followedPlan === true).length / filtered.length * 100 : 0,
    partialPlanRate: filtered.length ? filtered.filter((entry) => entry.followedPlan === 'partial').length / filtered.length * 100 : 0,
    overtradingRate: filtered.length ? countLesson(filtered, 'Overtraded') / filtered.length * 100 : 0,
    chaseRate: filtered.length ? countLesson(filtered, 'Chased entries') / filtered.length * 100 : 0,
  }
}

export default function EODInsightsPage() {
  const [period, setPeriod] = useState('month')
  const [entries, setEntries] = useState(loadEntries)

  useEffect(() => {
    const onStorage = (event) => {
      if (!event.key || event.key === 'tl_eod') setEntries(loadEntries())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const analytics = useMemo(() => buildAnalytics(entries, period), [entries, period])

  return (
    <div style={{ padding: '24px 28px', fontFamily: T.fontSans }}>
      <div style={{ marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4, fontWeight: 500 }}>Tools</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: -0.5 }}>EOD Insights</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>Patterns from your saved End of Day reviews</div>
          </div>
          <Select value={period} onChange={setPeriod} options={PERIOD_OPTIONS} style={{ minWidth: 130 }} />
        </div>
      </div>

      {analytics.filtered.length === 0 ? <Card glow><div style={{ textAlign: 'center', padding: '48px 0', color: T.muted, fontSize: 12 }}>No End of Day reviews saved in this range yet.</div></Card> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10 }}>
            <KpiCard label="Reviews" value={analytics.filtered.length} color={T.text} sub="Saved entries in range" />
            <KpiCard label="Plan Follow" value={`${fmt(analytics.planFollowRate, 1)}%`} color={analytics.planFollowRate >= 60 ? T.green : T.red} sub="Fully on plan days" />
            <KpiCard label="Avg Rating" value={`${fmt(analytics.avgRating, 1)}/10`} color={analytics.avgRating >= 7 ? T.green : analytics.avgRating >= 5 ? T.accent : T.red} sub="How the days felt" />
            <KpiCard label="Avg Rule Breaks" value={fmt(analytics.avgRuleBreaks, 1)} color={analytics.avgRuleBreaks <= 1 ? T.green : analytics.avgRuleBreaks <= 3 ? T.accent : T.red} sub="Per review" />
            <KpiCard label="Avg Focus" value={`${fmt(analytics.avgFocus, 1)}/10`} color={analytics.avgFocus >= 7 ? T.green : analytics.avgFocus >= 5 ? T.accent : T.red} sub="Execution attention" />
            <KpiCard label="Avg Confidence" value={`${fmt(analytics.avgConfidence, 1)}/10`} color={analytics.avgConfidence >= 7 ? T.green : analytics.avgConfidence >= 5 ? T.accent : T.red} sub="Conviction quality" />
            <KpiCard label="Overtrading Rate" value={`${fmt(analytics.overtradingRate, 1)}%`} color={analytics.overtradingRate <= 15 ? T.green : analytics.overtradingRate <= 35 ? T.accent : T.red} sub="Reviews with overtrading" />
            <KpiCard label="Chase Rate" value={`${fmt(analytics.chaseRate, 1)}%`} color={analytics.chaseRate <= 15 ? T.green : analytics.chaseRate <= 35 ? T.accent : T.red} sub="Reviews with chase entries" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 16 }}>
            <Card glow>
              <SectionHead title="Behavior Pressure Map" sub="What shows up most in your reviews" />
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={analytics.issueData} margin={{ left: 4, right: 4, top: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: T.muted, fontSize: 10 }} tickLine={false} axisLine={{ stroke: T.border }} />
                  <YAxis tick={{ fill: T.muted, fontSize: 10 }} tickLine={false} axisLine={false} width={36} />
                  <Tooltip content={<ChartTooltip formatter={(value) => `${value} reviews`} />} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={700}>{analytics.issueData.map((item, index) => <Cell key={index} fill={item.color} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <SectionHead title="Plan Discipline Split" sub="How often you stayed aligned" />
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={analytics.planData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={4} isAnimationActive animationDuration={700}>{analytics.planData.map((item, index) => <Cell key={index} fill={item.color} />)}</Pie>
                  <Tooltip content={<ChartTooltip formatter={(value) => `${value} reviews`} />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: -6 }}>{analytics.planData.map((item) => <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.textMid }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} /><span>{item.name}</span></div>)}</div>
            </Card>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card>
              <SectionHead title="Mindset Radar" sub="Stress is inverted so higher is healthier" />
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={analytics.radarData}>
                  <PolarGrid stroke={T.border} />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: T.muted, fontSize: 10 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fill: T.muted, fontSize: 9 }} />
                  <Radar dataKey="value" stroke={T.accent} fill={T.accent} fillOpacity={0.28} isAnimationActive animationDuration={850} />
                </RadarChart>
              </ResponsiveContainer>
            </Card>

            <Card glow>
              <SectionHead title="Review Trendline" sub="Rating, confidence, focus and stress over time" />
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={analytics.timeline} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke={T.border} vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: T.muted, fontSize: 10 }} tickLine={false} axisLine={{ stroke: T.border }} />
                  <YAxis domain={[0, 10]} tick={{ fill: T.muted, fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip content={<ChartTooltip formatter={(value) => `${fmt(value, 1)}/10`} />} />
                  <Line type="monotone" dataKey="rating" stroke={T.accent} strokeWidth={2.5} dot={false} isAnimationActive animationDuration={800} />
                  <Line type="monotone" dataKey="confidence" stroke={T.green} strokeWidth={2} dot={false} isAnimationActive animationDuration={900} />
                  <Line type="monotone" dataKey="focus" stroke={T.cyan} strokeWidth={2} dot={false} isAnimationActive animationDuration={1000} />
                  <Line type="monotone" dataKey="stress" stroke={T.red} strokeWidth={2} dot={false} isAnimationActive animationDuration={1100} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10 }}>
            <Card><SectionHead title="Sleep Quality" sub="Average in range" /><div style={{ fontSize: 30, fontWeight: 700, color: analytics.avgSleep >= 7 ? T.green : analytics.avgSleep >= 5 ? T.accent : T.red, fontFamily: T.fontMono }}>{fmt(analytics.avgSleep, 1)}/10</div></Card>
            <Card><SectionHead title="Stress Load" sub="Lower is healthier" /><div style={{ fontSize: 30, fontWeight: 700, color: analytics.avgStress <= 4 ? T.green : analytics.avgStress <= 6 ? T.accent : T.red, fontFamily: T.fontMono }}>{fmt(analytics.avgStress, 1)}/10</div></Card>
            <Card><SectionHead title="Market Clarity" sub="How clean setups felt" /><div style={{ fontSize: 30, fontWeight: 700, color: analytics.avgClarity >= 7 ? T.green : analytics.avgClarity >= 5 ? T.accent : T.red, fontFamily: T.fontMono }}>{fmt(analytics.avgClarity, 1)}/10</div></Card>
            <Card><SectionHead title="Partial Plan Days" sub="Borderline discipline" /><div style={{ fontSize: 30, fontWeight: 700, color: analytics.partialPlanRate <= 20 ? T.green : analytics.partialPlanRate <= 40 ? T.accent : T.red, fontFamily: T.fontMono }}>{fmt(analytics.partialPlanRate, 1)}%</div></Card>
          </div>
        </div>
      )}
    </div>
  )
}
