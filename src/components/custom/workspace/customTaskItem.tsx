import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react'
import TaskItem from '@tiptap/extension-task-item'

/**
 * Custom React component for a single task-list item.
 * Using a NodeView gives us JSX-level control over the layout so we never
 * have to fight CSS specificity with .tiptap li or any other base rule.
 */
const TaskItemComponent = ({ node, updateAttributes }: any) => {
    const checked = !!node.attrs.checked

    return (
        <NodeViewWrapper
            as="li"
            data-type="taskItem"
            data-checked={String(checked)}
            // Inline flex so the checkbox and text are always side-by-side
            style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '0.5rem', padding: 0, listStyle: 'none' }}
        >
            {/* Checkbox — contentEditable={false} keeps ProseMirror hands off it */}
            <span
                contentEditable={false}
                style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginTop: '0.25em', lineHeight: 0 }}
            >
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => updateAttributes({ checked: e.target.checked })}
                    className="task-checkbox"
                />
            </span>

            {/* Editable text content — fills remaining width */}
            <NodeViewContent
                as="div"
                className={`task-item-content${checked ? ' task-item-checked' : ''}`}
            />
        </NodeViewWrapper>
    )
}

/** Drop-in replacement for the plain TaskItem extension with a React NodeView. */
export const CustomTaskItem = TaskItem.extend({
    addNodeView() {
        return ReactNodeViewRenderer(TaskItemComponent)
    },
})
