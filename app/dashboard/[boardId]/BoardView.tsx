'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import type { User, Board, List, Card } from '@/lib/types'
import CardModal from './CardModal'
import InviteModal from './InviteModal'

interface BoardData extends Board {
  lists: List[]
  cards: Card[]
  members: Array<{ id: string; name: string; email: string; role: string }>
  role: string
}

interface Props {
  boardId: string
  currentUser: User
}

export default function BoardView({ boardId, currentUser }: Props) {
  const [board, setBoard] = useState<BoardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [newListTitle, setNewListTitle] = useState('')
  const [addingList, setAddingList] = useState(false)
  const [addingCardToList, setAddingCardToList] = useState<string | null>(null)
  const [newCardTitle, setNewCardTitle] = useState('')
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [editingListId, setEditingListId] = useState<string | null>(null)
  const [editingListTitle, setEditingListTitle] = useState('')
  const dragCard = useRef<{ cardId: string; fromListId: string; fromPosition: number } | null>(null)
  const isEditor = board?.role === 'owner' || board?.role === 'editor'

  const fetchBoard = useCallback(async () => {
    const res = await fetch(`/api/boards/${boardId}`)
    if (res.ok) {
      const data = await res.json()
      setBoard(data)
    }
    setLoading(false)
  }, [boardId])

  useEffect(() => {
    fetchBoard()
    // Poll every 15 seconds for collaboration updates
    const interval = setInterval(fetchBoard, 15000)
    return () => clearInterval(interval)
  }, [fetchBoard])

  // --- Lists ---
  async function addList(e: React.FormEvent) {
    e.preventDefault()
    if (!newListTitle.trim()) return
    const res = await fetch('/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board_id: boardId, title: newListTitle }),
    })
    if (res.ok) { setNewListTitle(''); setAddingList(false); fetchBoard() }
  }

  async function renameList(listId: string, title: string) {
    if (!title.trim()) return
    await fetch(`/api/lists/${listId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    setEditingListId(null)
    fetchBoard()
  }

  async function deleteList(listId: string) {
    if (!confirm('Delete this list and all its cards?')) return
    await fetch(`/api/lists/${listId}`, { method: 'DELETE' })
    fetchBoard()
  }

  // --- Cards ---
  async function addCard(e: React.FormEvent, listId: string) {
    e.preventDefault()
    if (!newCardTitle.trim()) return
    const res = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list_id: listId, title: newCardTitle }),
    })
    if (res.ok) { setNewCardTitle(''); setAddingCardToList(null); fetchBoard() }
  }

  async function deleteCard(cardId: string) {
    await fetch(`/api/cards/${cardId}`, { method: 'DELETE' })
    fetchBoard()
  }

  // --- Drag and Drop ---
  function onDragStart(cardId: string, fromListId: string, fromPosition: number) {
    dragCard.current = { cardId, fromListId, fromPosition }
  }

  async function onDropOnList(toListId: string) {
    if (!dragCard.current) return
    const { cardId } = dragCard.current
    const cardsInTarget = cardsForList(toListId).filter(c => c.id !== cardId)
    await fetch(`/api/cards/${cardId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toListId, toPosition: cardsInTarget.length }),
    })
    dragCard.current = null
    fetchBoard()
  }

  async function onDropOnCard(toListId: string, toPosition: number) {
    if (!dragCard.current) return
    const { cardId } = dragCard.current
    await fetch(`/api/cards/${cardId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toListId, toPosition }),
    })
    dragCard.current = null
    fetchBoard()
  }

  // --- Helpers ---
  function cardsForList(listId: string): Card[] {
    if (!board) return []
    return board.cards.filter(c => c.list_id === listId).sort((a, b) => a.position - b.position)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading board...</p>
      </div>
    )
  }

  if (!board) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Board not found. <Link href="/dashboard" className="text-blue-600 underline">Go back</Link></p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-blue-700 flex flex-col">
      {/* Top nav */}
      <nav className="bg-blue-800 text-white px-4 py-3 flex items-center gap-4">
        <Link href="/dashboard" className="text-blue-200 hover:text-white text-sm">← Boards</Link>
        <h1 className="text-xl font-bold flex-1">{board.title}</h1>
        <span className="text-blue-200 text-sm">{board.members.length} member{board.members.length !== 1 ? 's' : ''}</span>
        {isEditor && (
          <button
            onClick={() => setShowInvite(true)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm"
          >
            + Invite
          </button>
        )}
        <span className="text-blue-200 text-sm">{currentUser.name}</span>
      </nav>

      {/* Board description */}
      {board.description && (
        <div className="bg-blue-700 px-4 py-2 text-blue-100 text-sm">{board.description}</div>
      )}

      {/* Lists */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-3 p-4 items-start min-h-full">
          {board.lists.map(list => (
            <div
              key={list.id}
              className="bg-gray-100 rounded-xl w-72 flex-shrink-0 flex flex-col"
              onDragOver={e => e.preventDefault()}
              onDrop={() => onDropOnList(list.id)}
            >
              {/* List header */}
              <div className="px-3 py-2 flex items-center gap-2">
                {editingListId === list.id ? (
                  <form
                    onSubmit={e => { e.preventDefault(); renameList(list.id, editingListTitle) }}
                    className="flex-1 flex gap-1"
                  >
                    <input
                      autoFocus
                      value={editingListTitle}
                      onChange={e => setEditingListTitle(e.target.value)}
                      onBlur={() => renameList(list.id, editingListTitle)}
                      className="flex-1 px-2 py-1 rounded text-sm font-semibold border border-blue-400 focus:outline-none"
                    />
                  </form>
                ) : (
                  <h3
                    className="flex-1 font-semibold text-gray-800 text-sm cursor-pointer"
                    onClick={() => isEditor && (setEditingListId(list.id), setEditingListTitle(list.title))}
                  >
                    {list.title}
                    <span className="ml-2 text-gray-400 font-normal">{cardsForList(list.id).length}</span>
                  </h3>
                )}
                {isEditor && (
                  <button
                    onClick={() => deleteList(list.id)}
                    className="text-gray-400 hover:text-red-500 text-lg leading-none"
                    title="Delete list"
                  >×</button>
                )}
              </div>

              {/* Cards */}
              <div className="px-2 pb-1 flex flex-col gap-2 flex-1">
                {cardsForList(list.id).map(card => (
                  <div
                    key={card.id}
                    draggable={isEditor}
                    onDragStart={() => isEditor && onDragStart(card.id, list.id, card.position)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.stopPropagation(); isEditor && onDropOnCard(list.id, card.position) }}
                    className="bg-white rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow group"
                    onClick={() => setSelectedCardId(card.id)}
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex-1 text-sm text-gray-800">{card.title}</span>
                      {isEditor && (
                        <button
                          onClick={e => { e.stopPropagation(); deleteCard(card.id) }}
                          className="text-gray-300 hover:text-red-500 text-lg leading-none opacity-0 group-hover:opacity-100"
                        >×</button>
                      )}
                    </div>
                    {card.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{card.description}</p>
                    )}
                    {Array.isArray((card as any).tags) && (card as any).tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(card as any).tags.map((tag: string) => (
                          <span key={tag} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Add card */}
                {isEditor && addingCardToList === list.id ? (
                  <form onSubmit={e => addCard(e, list.id)} className="space-y-1">
                    <textarea
                      autoFocus
                      value={newCardTitle}
                      onChange={e => setNewCardTitle(e.target.value)}
                      placeholder="Card title..."
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                    />
                    <div className="flex gap-2">
                      <button type="submit" className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">Add</button>
                      <button type="button" onClick={() => setAddingCardToList(null)} className="text-gray-500 text-sm hover:text-gray-700">Cancel</button>
                    </div>
                  </form>
                ) : (
                  isEditor && (
                    <button
                      onClick={() => setAddingCardToList(list.id)}
                      className="w-full text-left text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded px-3 py-2"
                    >
                      + Add a card
                    </button>
                  )
                )}
              </div>
            </div>
          ))}

          {/* Add list */}
          {isEditor && (
            <div className="w-72 flex-shrink-0">
              {addingList ? (
                <form onSubmit={addList} className="bg-gray-100 rounded-xl p-3 space-y-2">
                  <input
                    autoFocus
                    type="text"
                    value={newListTitle}
                    onChange={e => setNewListTitle(e.target.value)}
                    placeholder="List title..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">Add list</button>
                    <button type="button" onClick={() => setAddingList(false)} className="text-gray-500 text-sm hover:text-gray-700">Cancel</button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setAddingList(true)}
                  className="w-full text-left px-4 py-3 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-xl text-sm font-medium"
                >
                  + Add a list
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card detail modal */}
      {selectedCardId && (
        <CardModal
          cardId={selectedCardId}
          currentUser={currentUser}
          isEditor={isEditor}
          onClose={() => { setSelectedCardId(null); fetchBoard() }}
        />
      )}

      {/* Invite modal */}
      {showInvite && (
        <InviteModal
          boardId={boardId}
          members={board.members}
          onClose={() => { setShowInvite(false); fetchBoard() }}
        />
      )}
    </div>
  )
}
