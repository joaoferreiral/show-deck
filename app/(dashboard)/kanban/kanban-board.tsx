'use client'

import { useState, useCallback, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  Plus, Pencil, Trash2, Check, X, GripVertical,
  Tag, AlignLeft, MoreHorizontal,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type KanbanCard = {
  id: string
  column_id: string
  title: string
  description: string | null
  tag_label: string | null
  tag_color: string
  position: number
}

export type KanbanColumn = {
  id: string
  name: string
  color: string
  position: number
}

// ─── Color palettes ───────────────────────────────────────────────────────────

const COLUMN_COLORS = [
  { label: 'Cinza',    value: '#6b7280' },
  { label: 'Violeta',  value: '#7c3aed' },
  { label: 'Azul',     value: '#2563eb' },
  { label: 'Ciano',    value: '#0891b2' },
  { label: 'Verde',    value: '#059669' },
  { label: 'Âmbar',   value: '#d97706' },
  { label: 'Laranja',  value: '#ea580c' },
  { label: 'Rosa',     value: '#db2777' },
  { label: 'Vermelho', value: '#dc2626' },
]

const TAG_PRESETS = [
  { label: 'Sem tag',   color: '#6b7280' },
  { label: 'Urgente',   color: '#dc2626' },
  { label: 'Alta',      color: '#ea580c' },
  { label: 'Normal',    color: '#2563eb' },
  { label: 'Baixa',     color: '#059669' },
  { label: 'Bloqueado', color: '#7c3aed' },
  { label: 'Revisão',   color: '#d97706' },
  { label: 'Concluído', color: '#0891b2' },
]

// ─── Card dialog (create / edit) ──────────────────────────────────────────────

type CardDialogProps = {
  columnId: string
  initial?: KanbanCard
  onSave: (data: { title: string; description: string; tag_label: string; tag_color: string }) => void
  onClose: () => void
}

function CardDialog({ columnId: _columnId, initial, onSave, onClose }: CardDialogProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [tagLabel, setTagLabel] = useState(initial?.tag_label ?? '')
  const [tagColor, setTagColor] = useState(initial?.tag_color ?? '#6b7280')
  const [customTag, setCustomTag] = useState(!TAG_PRESETS.some(p => p.label === initial?.tag_label && p.color === initial?.tag_color))

  function applyPreset(preset: { label: string; color: string }) {
    setTagLabel(preset.label === 'Sem tag' ? '' : preset.label)
    setTagColor(preset.color)
    setCustomTag(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="font-semibold text-sm">{initial ? 'Editar card' : 'Novo card'}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Título *</label>
            <Input
              autoFocus
              placeholder="Ex: Finalizar contrato, Ligar para produtor..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && title.trim() && onSave({ title, description, tag_label: tagLabel, tag_color: tagColor })}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <AlignLeft className="h-3 w-3" /> Descrição (opcional)
            </label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring min-h-[72px]"
              placeholder="Detalhes, links, observações..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Tag */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Tag className="h-3 w-3" /> Tag / Prioridade
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TAG_PRESETS.map(p => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-all',
                    tagColor === p.color && tagLabel === (p.label === 'Sem tag' ? '' : p.label) && !customTag
                      ? 'border-transparent text-white'
                      : 'border-border bg-secondary/50 text-muted-foreground hover:text-foreground'
                  )}
                  style={
                    tagColor === p.color && tagLabel === (p.label === 'Sem tag' ? '' : p.label) && !customTag
                      ? { backgroundColor: p.color }
                      : {}
                  }
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCustomTag(true)}
                className={cn(
                  'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border transition-all',
                  customTag
                    ? 'border-primary text-primary bg-primary/10'
                    : 'border-border bg-secondary/50 text-muted-foreground hover:text-foreground'
                )}
              >
                <Pencil className="h-2.5 w-2.5" /> Personalizada
              </button>
            </div>

            {customTag && (
              <div className="flex gap-2 items-center pt-1">
                <Input
                  className="flex-1 h-8 text-xs"
                  placeholder="Nome da tag"
                  value={tagLabel}
                  onChange={e => setTagLabel(e.target.value)}
                />
                <div className="flex gap-1 shrink-0">
                  {COLUMN_COLORS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label}
                      onClick={() => setTagColor(c.value)}
                      className="w-5 h-5 rounded-full transition-transform hover:scale-110 focus:outline-none shrink-0"
                      style={{
                        backgroundColor: c.value,
                        boxShadow: tagColor === c.value ? `0 0 0 2px hsl(var(--background)), 0 0 0 3.5px ${c.value}` : undefined,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Tag preview */}
            {tagLabel && (
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="text-xs text-muted-foreground">Prévia:</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                  style={{ backgroundColor: tagColor }}
                >
                  {tagLabel}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 h-9" onClick={onClose}>Cancelar</Button>
            <Button
              className="flex-1 h-9"
              disabled={!title.trim()}
              onClick={() => onSave({ title, description, tag_label: tagLabel, tag_color: tagColor })}
            >
              {initial ? 'Salvar' : 'Criar card'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sortable card ─────────────────────────────────────────────────────────────

type CardProps = {
  card: KanbanCard
  overlay?: boolean
  onEdit: (card: KanbanCard) => void
  onDelete: (id: string) => void
}

function SortableCard({ card, overlay, onEdit, onDelete }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', card },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative rounded-lg border bg-card p-3 shadow-sm',
        overlay ? 'shadow-2xl rotate-2 border-primary/40 cursor-grabbing' : 'cursor-grab hover:border-border/80',
        isDragging && 'border-dashed',
      )}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </div>

      <div className="pl-3">
        {/* Tag */}
        {card.tag_label && (
          <div className="mb-1.5">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
              style={{ backgroundColor: card.tag_color }}
            >
              {card.tag_label}
            </span>
          </div>
        )}

        {/* Title */}
        <p className="text-sm font-medium leading-snug pr-5">{card.title}</p>

        {/* Description */}
        {card.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{card.description}</p>
        )}
      </div>

      {/* Actions */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded p-0.5 hover:bg-secondary transition-colors">
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => onEdit(card)} className="gap-2 text-xs cursor-pointer">
              <Pencil className="h-3 w-3" /> Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(card.id)}
              className="gap-2 text-xs cursor-pointer text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3 w-3" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

// ─── Sortable column ───────────────────────────────────────────────────────────

type ColumnProps = {
  column: KanbanColumn
  cards: KanbanCard[]
  overlay?: boolean
  onRename: (id: string, name: string) => void
  onRecolor: (id: string, color: string) => void
  onDelete: (id: string) => void
  onAddCard: (columnId: string) => void
  onEditCard: (card: KanbanCard) => void
  onDeleteCard: (id: string) => void
}

function SortableColumn({
  column, cards, overlay,
  onRename, onRecolor, onDelete,
  onAddCard, onEditCard, onDeleteCard,
}: ColumnProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: 'column', column },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const [renaming, setRenaming] = useState(false)
  const [nameInput, setNameInput] = useState(column.name)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function commitRename() {
    if (nameInput.trim() && nameInput.trim() !== column.name) {
      onRename(column.id, nameInput.trim())
    } else {
      setNameInput(column.name)
    }
    setRenaming(false)
  }

  const cardIds = cards.map(c => c.id)

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'flex flex-col w-72 shrink-0 rounded-xl border bg-secondary/30',
          overlay ? 'shadow-2xl border-primary/30 rotate-1' : '',
        )}
      >
        {/* Column header */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-t-xl border-b border-border/50"
          style={{ borderTop: `3px solid ${column.color}` }}
        >
          {/* Drag handle */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground/80 transition-colors shrink-0"
          >
            <GripVertical className="h-4 w-4" />
          </div>

          {/* Name */}
          {renaming ? (
            <input
              ref={inputRef}
              autoFocus
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') { setNameInput(column.name); setRenaming(false) }
              }}
              className="flex-1 min-w-0 bg-transparent text-sm font-semibold focus:outline-none border-b border-primary"
            />
          ) : (
            <span
              className="flex-1 min-w-0 text-sm font-semibold truncate cursor-default select-none"
              onDoubleClick={() => { setRenaming(true); setNameInput(column.name) }}
              title="Duplo-clique para renomear"
            >
              {column.name}
            </span>
          )}

          {/* Card count */}
          <span className="text-[10px] font-medium text-muted-foreground bg-secondary rounded-full px-1.5 py-0.5 shrink-0">
            {cards.length}
          </span>

          {/* Column menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                className="gap-2 text-xs cursor-pointer"
                onClick={() => { setRenaming(true); setNameInput(column.name) }}
              >
                <Pencil className="h-3 w-3" /> Renomear
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 text-xs cursor-pointer"
                onClick={() => setShowColorPicker(true)}
              >
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
                Cor da coluna
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 text-xs cursor-pointer text-destructive focus:text-destructive"
                onClick={() => setDeleteConfirm(true)}
              >
                <Trash2 className="h-3 w-3" /> Excluir coluna
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Color picker popover */}
        {showColorPicker && (
          <div className="mx-3 mt-2 p-2 rounded-lg border border-border bg-card shadow-md">
            <p className="text-[10px] text-muted-foreground mb-2 font-medium">Cor da coluna</p>
            <div className="flex flex-wrap gap-1.5">
              {COLUMN_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => { onRecolor(column.id, c.value); setShowColorPicker(false) }}
                  className="w-6 h-6 rounded-full transition-transform hover:scale-110 focus:outline-none"
                  style={{
                    backgroundColor: c.value,
                    boxShadow: column.color === c.value ? `0 0 0 2px hsl(var(--background)), 0 0 0 3.5px ${c.value}` : undefined,
                  }}
                />
              ))}
            </div>
            <button
              onClick={() => setShowColorPicker(false)}
              className="mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Cards */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px] max-h-[calc(100vh-240px)]">
          <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
            {cards.map(card => (
              <SortableCard
                key={card.id}
                card={card}
                onEdit={onEditCard}
                onDelete={onDeleteCard}
              />
            ))}
          </SortableContext>
          {cards.length === 0 && (
            <div className="flex items-center justify-center h-16 rounded-lg border border-dashed border-border/50">
              <p className="text-xs text-muted-foreground/50">Sem cards</p>
            </div>
          )}
        </div>

        {/* Add card */}
        <div className="p-2 border-t border-border/50">
          <button
            onClick={() => onAddCard(column.id)}
            className="flex items-center gap-1.5 w-full rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar card
          </button>
        </div>
      </div>

      {/* Delete column confirm */}
      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir coluna?</AlertDialogTitle>
            <AlertDialogDescription>
              A coluna <strong>"{column.name}"</strong> e todos os seus {cards.length} card{cards.length !== 1 ? 's' : ''} serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => { onDelete(column.id); setDeleteConfirm(false) }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─── Main board ────────────────────────────────────────────────────────────────

type Props = {
  initialColumns: KanbanColumn[]
  initialCards: KanbanCard[]
}

export function KanbanBoard({ initialColumns, initialCards }: Props) {
  const { toast } = useToast()
  const [columns, setColumns] = useState<KanbanColumn[]>(initialColumns)
  const [cards, setCards] = useState<KanbanCard[]>(initialCards)

  // DnD active items
  const [activeColumn, setActiveColumn] = useState<KanbanColumn | null>(null)
  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null)

  // Card dialog
  const [cardDialog, setCardDialog] = useState<{ columnId: string; card?: KanbanCard } | null>(null)

  // Adding new column
  const [addingColumn, setAddingColumn] = useState(false)
  const [newColName, setNewColName] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const columnIds = columns.map(c => c.id)

  // ── Helpers ────────────────────────────────────────────────────────────────

  function cardsForColumn(colId: string) {
    return cards.filter(c => c.column_id === colId).sort((a, b) => a.position - b.position)
  }

  async function saveColumnPositions(updated: KanbanColumn[]) {
    await Promise.all(
      updated.map((col, i) =>
        fetch(`/api/kanban/columns/${col.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position: i }),
        })
      )
    )
  }

  async function saveCardPositions(updated: KanbanCard[]) {
    await Promise.all(
      updated.map((card, i) =>
        fetch(`/api/kanban/cards/${card.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ column_id: card.column_id, position: i }),
        })
      )
    )
  }

  // ── Column actions ──────────────────────────────────────────────────────────

  async function handleAddColumn() {
    if (!newColName.trim()) return
    const position = columns.length
    const res = await fetch('/api/kanban/columns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newColName.trim(), color: '#6b7280', position }),
    })
    const json = await res.json()
    if (!res.ok) { toast({ title: 'Erro ao criar coluna', description: json.error, variant: 'destructive' }); return }
    setColumns(prev => [...prev, json.column])
    setNewColName('')
    setAddingColumn(false)
  }

  async function handleRenameColumn(id: string, name: string) {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, name } : c))
    await fetch(`/api/kanban/columns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  }

  async function handleRecolorColumn(id: string, color: string) {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, color } : c))
    await fetch(`/api/kanban/columns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color }),
    })
  }

  async function handleDeleteColumn(id: string) {
    setColumns(prev => prev.filter(c => c.id !== id))
    setCards(prev => prev.filter(c => c.column_id !== id))
    await fetch(`/api/kanban/columns/${id}`, { method: 'DELETE' })
  }

  // ── Card actions ────────────────────────────────────────────────────────────

  async function handleSaveCard(data: { title: string; description: string; tag_label: string; tag_color: string }) {
    if (!cardDialog) return

    if (cardDialog.card) {
      // Edit existing
      const updated = { ...cardDialog.card, ...data }
      setCards(prev => prev.map(c => c.id === cardDialog.card!.id ? updated : c))
      setCardDialog(null)
      await fetch(`/api/kanban/cards/${cardDialog.card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    } else {
      // Create new
      const colCards = cardsForColumn(cardDialog.columnId)
      const res = await fetch('/api/kanban/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: cardDialog.columnId, position: colCards.length, ...data }),
      })
      const json = await res.json()
      if (!res.ok) { toast({ title: 'Erro ao criar card', description: json.error, variant: 'destructive' }); return }
      setCards(prev => [...prev, json.card])
      setCardDialog(null)
    }
  }

  async function handleDeleteCard(id: string) {
    setCards(prev => prev.filter(c => c.id !== id))
    await fetch(`/api/kanban/cards/${id}`, { method: 'DELETE' })
  }

  // ── DnD handlers ────────────────────────────────────────────────────────────

  function onDragStart({ active }: DragStartEvent) {
    if (active.data.current?.type === 'column') {
      setActiveColumn(active.data.current.column)
    } else if (active.data.current?.type === 'card') {
      setActiveCard(active.data.current.card)
    }
  }

  const onDragOver = useCallback(({ active, over }: DragOverEvent) => {
    if (!over || active.id === over.id) return
    const isActiveCard = active.data.current?.type === 'card'
    const isOverCard = over.data.current?.type === 'card'
    const isOverColumn = over.data.current?.type === 'column'
    if (!isActiveCard) return

    // Card over another card (same or different column)
    if (isActiveCard && isOverCard) {
      setCards(prev => {
        const activeIdx = prev.findIndex(c => c.id === active.id)
        const overIdx = prev.findIndex(c => c.id === over.id)
        if (activeIdx === -1 || overIdx === -1) return prev
        const updated = [...prev]
        if (updated[activeIdx].column_id !== updated[overIdx].column_id) {
          updated[activeIdx] = { ...updated[activeIdx], column_id: updated[overIdx].column_id }
        }
        return arrayMove(updated, activeIdx, overIdx)
      })
    }

    // Card over an empty column
    if (isActiveCard && isOverColumn) {
      setCards(prev => {
        const activeIdx = prev.findIndex(c => c.id === active.id)
        if (activeIdx === -1) return prev
        const updated = [...prev]
        updated[activeIdx] = { ...updated[activeIdx], column_id: over.id as string }
        return updated
      })
    }
  }, [])

  async function onDragEnd({ active, over }: DragEndEvent) {
    setActiveColumn(null)
    setActiveCard(null)
    if (!over || active.id === over.id) return

    // Column reorder
    if (active.data.current?.type === 'column' && over.data.current?.type === 'column') {
      const oldIdx = columns.findIndex(c => c.id === active.id)
      const newIdx = columns.findIndex(c => c.id === over.id)
      if (oldIdx !== newIdx) {
        const updated = arrayMove(columns, oldIdx, newIdx)
        setColumns(updated)
        await saveColumnPositions(updated)
      }
      return
    }

    // Card drop — persist positions for affected columns
    if (active.data.current?.type === 'card') {
      const colIds = [...new Set(cards.map(c => c.column_id))]
      await Promise.all(
        colIds.map(colId => {
          const colCards = cards.filter(c => c.column_id === colId)
          return saveCardPositions(colCards)
        })
      )
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 h-full overflow-x-auto pb-4 px-4 md:px-6 pt-2 items-start">
          <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
            {columns.map(col => (
              <SortableColumn
                key={col.id}
                column={col}
                cards={cardsForColumn(col.id)}
                onRename={handleRenameColumn}
                onRecolor={handleRecolorColumn}
                onDelete={handleDeleteColumn}
                onAddCard={colId => setCardDialog({ columnId: colId })}
                onEditCard={card => setCardDialog({ columnId: card.column_id, card })}
                onDeleteCard={handleDeleteCard}
              />
            ))}
          </SortableContext>

          {/* Add column */}
          <div className="shrink-0 w-72">
            {addingColumn ? (
              <div className="rounded-xl border bg-secondary/30 p-3 space-y-2">
                <Input
                  autoFocus
                  placeholder="Nome da coluna"
                  value={newColName}
                  onChange={e => setNewColName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddColumn()
                    if (e.key === 'Escape') { setAddingColumn(false); setNewColName('') }
                  }}
                  className="h-8 text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleAddColumn} disabled={!newColName.trim()}>
                    <Check className="h-3 w-3 mr-1" /> Criar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAddingColumn(false); setNewColName('') }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingColumn(true)}
                className="flex items-center gap-2 w-full rounded-xl border border-dashed border-border/60 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border hover:bg-secondary/30 transition-all"
              >
                <Plus className="h-4 w-4" /> Nova coluna
              </button>
            )}
          </div>
        </div>

        {/* Drag overlays */}
        <DragOverlay>
          {activeColumn && (
            <SortableColumn
              column={activeColumn}
              cards={cardsForColumn(activeColumn.id)}
              overlay
              onRename={() => {}}
              onRecolor={() => {}}
              onDelete={() => {}}
              onAddCard={() => {}}
              onEditCard={() => {}}
              onDeleteCard={() => {}}
            />
          )}
          {activeCard && (
            <SortableCard card={activeCard} overlay onEdit={() => {}} onDelete={() => {}} />
          )}
        </DragOverlay>
      </DndContext>

      {/* Card create/edit dialog */}
      {cardDialog && (
        <CardDialog
          columnId={cardDialog.columnId}
          initial={cardDialog.card}
          onSave={handleSaveCard}
          onClose={() => setCardDialog(null)}
        />
      )}
    </>
  )
}
