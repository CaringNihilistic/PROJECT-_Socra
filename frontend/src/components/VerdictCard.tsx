import type { Scores, ScoreExplanation } from '../store/sessionStore'

interface VerdictCardProps {
  idea: string
  totalScore: number
  scores: Scores
  explanations: ScoreExplanation[]
  sessionId: string
}

function getGrade(score: number): { label: string; color: string; glow: string } {
  if (score >= 80) return { label: 'GREENLIT', color: '#34d399', glow: 'rgba(52,211,153,0.3)' }
  if (score >= 60) return { label: 'STRONG', color: '#f59e0b', glow: 'rgba(245,158,11,0.3)' }
  if (score >= 40) return { label: 'DEVELOPING', color: '#e85d26', glow: 'rgba(232,93,38,0.3)' }
  return { label: 'EARLY STAGE', color: '#6b7280', glow: 'rgba(107,114,128,0.2)' }
}

const DIM_SHORT: Record<string, string> = {
  problem_clarity: 'Problem Clarity',
  scale_constraints: 'Scale & Constraints',
  tech_context: 'Tech Context',
  success_definition: 'Success Definition',
  risk_awareness: 'Risk Awareness',
}

export function VerdictCard({ idea, totalScore, explanations, sessionId }: VerdictCardProps) {
  const score = Math.round(totalScore * 100)
  const grade = getGrade(score)
  const ideaText = idea.length > 100 ? idea.slice(0, 97) + '…' : idea

  return (
    <div
      id="verdict-card"
      style={{
        background: 'linear-gradient(145deg, #0d0c0b 0%, #080809 60%, #0a0b10 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '20px',
        padding: '36px 40px 32px',
        width: '100%',
        maxWidth: '640px',
        fontFamily: "'DM Mono', monospace",
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: '-60px', right: '-60px',
        width: '260px', height: '260px', borderRadius: '50%',
        background: `radial-gradient(circle, ${grade.glow} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: '#f59e0b', boxShadow: '0 0 8px #f59e0b',
          }} />
          <span style={{ fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>
            Socra
          </span>
        </div>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em' }}>
          STARTUP ANALYSIS
        </span>
      </div>

      {/* Idea */}
      <p style={{
        fontSize: '17px', color: 'rgba(255,255,255,0.85)', lineHeight: '1.5',
        marginBottom: '32px', fontFamily: "'Onest', sans-serif",
        fontWeight: 500, letterSpacing: '-0.01em',
      }}>
        "{ideaText}"
      </p>

      {/* Score row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <div style={{
            fontSize: '72px', fontWeight: 700, lineHeight: 1,
            fontFamily: "'DM Mono', monospace",
            background: score >= 80
              ? 'linear-gradient(135deg, #34d399, #10b981)'
              : score >= 60
              ? 'linear-gradient(135deg, #f59e0b, #e85d26)'
              : 'linear-gradient(135deg, #e85d26, #dc2626)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            {score}
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', marginTop: '2px' }}>
            / 100
          </div>
        </div>

        {/* Grade badge */}
        <div style={{
          padding: '8px 18px', borderRadius: '100px',
          border: `1px solid ${grade.color}40`,
          background: `${grade.color}12`,
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: grade.color, boxShadow: `0 0 8px ${grade.color}` }} />
          <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.15em', color: grade.color }}>
            {grade.label}
          </span>
        </div>
      </div>

      {/* Dimension bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '11px', marginBottom: '32px' }}>
        {explanations.map((exp) => {
          const pct = Math.round(exp.score * 100)
          const barColor = exp.score >= 0.7 ? '#34d399' : exp.score >= 0.4 ? '#f59e0b' : '#e85d26'
          return (
            <div key={exp.dimension} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', width: '130px', flexShrink: 0, letterSpacing: '0.05em' }}>
                {DIM_SHORT[exp.dimension] || exp.label}
              </span>
              <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '2px',
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${barColor}cc, ${barColor})`,
                  boxShadow: `0 0 6px ${barColor}60`,
                }} />
              </div>
              <span style={{ fontSize: '10px', color: barColor, width: '30px', textAlign: 'right', tabularNums: true } as React.CSSProperties}>
                {pct}%
              </span>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        paddingTop: '20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.18)', letterSpacing: '0.08em' }}>
          socra.app
        </span>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.12)', letterSpacing: '0.06em' }}>
          {window.location.hostname}/card/{sessionId}
        </span>
      </div>
    </div>
  )
}
