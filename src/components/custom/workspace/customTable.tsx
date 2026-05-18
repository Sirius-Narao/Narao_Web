import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { Table } from '@tiptap/extension-table'
import { Plus } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const CustomTableComponent = (props: any) => {
  const { editor, node } = props

  const addRow = () => {
    editor.chain().focus().addRowAfter().run()
  }

  const addColumn = () => {
    editor.chain().focus().addColumnAfter().run()
  }

  const firstRow = node.firstChild
  const colWidths: (number | null)[] = []
  let totalWidth = 0
  let fixedWidth = true

  if (firstRow) {
    firstRow.forEach((cell: any) => {
      const colwidth = cell.attrs.colwidth
      const colspan = cell.attrs.colspan || 1
      for (let i = 0; i < colspan; i++) {
        const hasWidth = colwidth && colwidth[i]
        colWidths.push(hasWidth || null)
        totalWidth += hasWidth || 25
        if (!hasWidth) {
          fixedWidth = false
        }
      }
    })
  }

  const tableStyle = fixedWidth
    ? { width: `${totalWidth}px` }
    : { width: 'max-content', minWidth: `${Math.max(totalWidth, 120)}px` }

  return (
    <NodeViewWrapper
      style={{ display: 'block', width: 'fit-content', maxWidth: '100%' }}
      className="custom-table-container group/table my-6"
    >
      <div style={{ maxWidth: '100%' }} className="overflow-x-auto scrollbar-no-bg rounded-lg">
        <table style={tableStyle} className="table-auto border-collapse">
          <colgroup>
            {colWidths.map((w, i) => (
              <col key={i} style={{ width: w ? `${w}px` : '', minWidth: '80px' }} />
            ))}
          </colgroup>
          {/* @ts-ignore */}
          <NodeViewContent as="tbody" />
        </table>
      </div>

      {/* Add Column Handle (Right) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            onClick={addColumn}
            className="custom-table-handle-right group/right-handle"
          >
            <Plus className="plus-icon opacity-0 group-hover/right-handle:opacity-100 transition-opacity" size={14} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="font-bold">Click to add a new column</p>
        </TooltipContent>
      </Tooltip>

      {/* Add Row Handle (Bottom) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            onClick={addRow}
            className="custom-table-handle-bottom group/bottom-handle"
          >
            <Plus className="plus-icon opacity-0 group-hover/bottom-handle:opacity-100 transition-opacity" size={14} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="flex flex-col items-center gap-1">
          <p className="font-bold">Click to add a new row</p>
          <p className="text-xs opacity-80">Drag to add or remove rows</p>
        </TooltipContent>
      </Tooltip>
    </NodeViewWrapper>
  )
}

export const CustomTable = Table.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CustomTableComponent)
  },
})
