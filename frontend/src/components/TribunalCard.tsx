import type { TribunalVerdicts } from '../store/sessionStore'

interface TribunalCardProps {
  idea: string
  verdicts: TribunalVerdicts
  sessionId: string
}

const GRADE_STYLE: Record<string, { color: string; glow: string; label: string }> = {
  GREENLIT:   { color: '#34d399', glow: 'rgba(52,211,153,0.25)',   label: 'GREENLIT' },
  STRONG:     { color: '#f59e0b', glow: 'rgba(245,158,11,0.22)',   label: 'STRONG' },
  CHALLENGED: { color: '#e85d26', glow: 'rgba(232,93,38,0.22)',    label: 'CHALLENGED' },
  REJECTED:   { color: '#dc2626', glow: 'rgba(220,38,38,0.22)',    label: 'REJECTED' },
}

const PERSONA_ORDER = ['investor', 'customer', 'competitor']

export function TribunalCard({ idea, verdicts, sessionId }: TribunalCardProps) {
  const grade = GRADE_STYLE[verdicts.grade] ?? GRADE_STYLE.CHALLENGED
  const ideaText = idea.length > 110 ? idea.slice(0, 107) + '…' : idea
  const score = verdicts.composite_score

  const scoreGradient =
    score >= 70 ? 'linear-gradient(135deg, #34d399, #10b981)' :
    score >= 50 ? 'linear-gradient(135deg, #f59e0b, #e85d26)' :
                  'linear-gradient(135deg, #e85d26, #dc2626)'

  const personaEntries = PERSONA_ORDER
    .map((key) => verdicts.personas[key])
    .filter(Boolean)

  return (
    <div
      id="tribunal-card"
      style={{
        background: 'linear-gradient(160deg, #0a0908 0%, #080810 55%, #0c0810 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '24px',
        padding: '40px 44px 36px',
        width: '100%',
        maxWidth: '680px',
        fontFamily: "'DM Mono', monospace",
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow blob */}
      <div style={{
        position: 'absolute', top: '-80px', right: '-80px',
        width: '320px', height: '320px', borderRadius: '50%',
        background: `radial-gradient(circle, ${grade.glow} 0%, transparent 65%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-60px', left: '-40px',
        width: '220px', height: '220px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: '#f59e0b', boxShadow: '0 0 10px #f59e0b',
          }} />
          <span style={{ fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>
            Socra
          </span>
        </div>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Startup Tribunal
        </span>
      </div>

      {/* Idea */}
      <p style={{
        fontSize: '16px', color: 'rgba(255,255,255,0.82)', lineHeight: 1.55,
        marginBottom: '36px',
        fontFamily: "'Onest', sans-serif",
        fontWeight: 500, letterSpacing: '-0.01em',
      }}>
        "{ideaText}"
      </p>

      {/* Score + grade row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div>
          <div style={{
            fontSize: '80px', fontWeight: 700, lineHeight: 1,
            fontFamily: "'DM Mono', monospace",
            background: scoreGradient,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            {score}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em', marginTop: '4px' }}>
            / 100  ·  {verdicts.passes} of {verdicts.total} passed
          </div>
        </div>

        {/* Grade badge */}
        <div style={{
          padding: '10px 22px', borderRadius: '100px',
          border: `1px solid ${grade.color}35`,
          background: `${grade.color}10`,
          display: 'flex', alignItems: 'center', gap: '9px',
        }}>
          <div style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: grade.color, boxShadow: `0 0 10px ${grade.color}`,
          }} />
          <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.18em', color: grade.color }}>
            {grade.label}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '28px 0' }} />

      {/* Persona verdict rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
        {personaEntries.map((p) => {
          const passColor = p.pass ? '#34d399' : '#dc2626'
          return (
            <div key={p.name} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              {/* Icon + pass/fail */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: `${p.color}15`,
                  border: `1px solid ${p.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px',
                }}>
                  {p.icon}
                </div>
                <span style={{
                  fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em',
                  color: passColor, textTransform: 'uppercase',
                }}>
                  {p.pass ? 'PASS' : 'FAIL'}
                </span>
              </div>

              {/* Name + verdict + insight */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: p.color, letterSpacing: '0.06em' }}>
                    {p.name}
                  </span>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>·</span>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', letterSpacing: '0.03em' }}>
                    {p.role}
                  </span>
                </div>
                <p style={{
                  fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5,
                  margin: '0 0 5px',
                  fontFamily: "'Onest', sans-serif",
                  fontStyle: 'italic',
                }}>
                  "{p.verdict}"
                </p>
                {p.key_insight && (
                  <p style={{
                    fontSize: '11px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.4,
                    margin: 0,
                  }}>
                    Key insight: {p.key_insight}
                  </p>
                )}
              </div>

              {/* Score chip */}
              <div style={{
                flexShrink: 0,
                width: '40px', height: '40px', borderRadius: '10px',
                background: `${passColor}12`,
                border: `1px solid ${passColor}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 700, color: passColor,
                fontFamily: "'DM Mono', monospace",
              }}>
                {p.score}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.05)',
        paddingTop: '20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.18)', letterSpacing: '0.08em' }}>
          socra.app
        </span>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.12)', letterSpacing: '0.05em' }}>
          {window.location.hostname}/card/{sessionId}
        </span>
      </div>
    </div>
  )
}
