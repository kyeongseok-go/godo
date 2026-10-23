import { Send, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Comment, ID } from '../../domain/types'
import { useTable } from '../../hooks/data'
import { useApp } from '../../store/app'
import { newId } from '../../store/id'
import { Markdown } from '../../ui/Markdown'

export function CommentSection({ taskId }: { taskId: ID }) {
  const all = useTable('comments')
  const commit = useApp((s) => s.commit)
  const [text, setText] = useState('')

  const comments = useMemo(
    () => all.filter((c) => c.taskId === taskId).sort((a, b) => a.createdAt - b.createdAt),
    [all, taskId],
  )

  const add = () => {
    const body = text.trim()
    if (!body) return
    const comment: Comment = { id: newId(), taskId, body, createdAt: Date.now() }
    commit({ puts: { comments: [comment] }, deletes: {} }, '댓글 추가')
    setText('')
  }

  return (
    <section className="detail-block" aria-label="댓글">
      <h3 className="detail-block__title">
        댓글{comments.length > 0 ? <span>{comments.length}</span> : null}
      </h3>
      <ul className="comments">
        {comments.map((c) => (
          <li key={c.id}>
            <div className="comments__meta">
              <time dateTime={new Date(c.createdAt).toISOString()}>
                {new Date(c.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </time>
              <button
                type="button"
                aria-label="댓글 삭제"
                onClick={() => commit({ puts: {}, deletes: { comments: [c.id] } }, '댓글 삭제')}
              >
                <Trash2 size={12} aria-hidden="true" />
              </button>
            </div>
            <Markdown source={c.body} />
          </li>
        ))}
      </ul>
      <div className="comment-form">
        <textarea
          rows={2}
          value={text}
          placeholder="댓글 남기기 (⌘Enter로 등록)"
          aria-label="댓글 입력"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              add()
            }
            // 쓰던 댓글이 있으면 Esc 는 그 글만 버린다. 상세 패널까지 닫히면 쓴 내용이 통째로 사라진다.
            if (e.key === 'Escape' && text !== '') {
              e.stopPropagation()
              setText('')
            }
          }}
        />
        <button type="button" className="icon-btn" aria-label="댓글 등록" disabled={!text.trim()} onClick={add}>
          <Send size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
