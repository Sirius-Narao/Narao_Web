import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { CodeBlock } from '@tiptap/extension-code-block'
import katex from 'katex'

const MathAwareCodeBlockComponent = (props: any) => {
  const { node, editor, extension } = props
  const isMath = node.attrs.language === 'math'
  const isFocused = props.selected || (editor.isActive('codeBlock') && editor.state.selection.$head.parent === node)

  if (!isMath) {
    return (
      <NodeViewWrapper className="relative group w-full max-w-full overflow-hidden">
        <pre className="my-4 rounded-xl bg-popover p-4 overflow-x-auto border border-border/50 w-full">
            {node.attrs.language && (
                <div className="flex items-center justify-between gap-2 pb-2 px-2 border-b border-foreground/10 text-lg mb-2 text-foreground/50">
                    <span className="uppercase text-sm font-medium">{node.attrs.language}</span>
                </div>
            )}
            <NodeViewContent className="rounded-lg bg-popover! whitespace-pre-wrap break-words text-foreground font-mono" />
        </pre>
      </NodeViewWrapper>
    )
  }

  // Math Rendering Logic (Obsidian Style)
  return (
    <NodeViewWrapper className="math-block my-4 relative">
      <div className={`p-4 rounded-xl border border-border/50 bg-popover transition-all ${isFocused ? 'ring-2 ring-primary/20' : ''}`}>
        
        {/* Rendered Math View (Visible when not focused) */}
        {!isFocused && (
          <div 
             contentEditable={false}
             className="flex justify-center w-full min-h-[2rem] overflow-x-auto select-none cursor-pointer"
             onClick={() => editor.commands.setNodeSelection(props.getPos())}
             dangerouslySetInnerHTML={{
                 __html: node.textContent.trim() 
                     ? katex.renderToString(node.textContent, { displayMode: true, throwOnError: false }) 
                     : '<span class="text-muted-foreground italic">Empty LaTeX block</span>'
             }}
          />
        )}

        {/* Editor View (Visible only when focused) */}
        <div className={`${isFocused ? 'flex' : 'hidden'} flex-col font-mono text-sm text-foreground/80 relative`}>
          <div className="absolute -top-2 right-0 text-xs text-muted-foreground select-none">LaTeX Block</div>
          <NodeViewContent as="div" className="outline-none whitespace-pre-wrap break-words min-h-[1.5em] focus:outline-none w-full" />
        </div>
      </div>
    </NodeViewWrapper>
  )
}

import { textblockTypeInputRule } from '@tiptap/core'

export const MathAwareCodeBlock = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(MathAwareCodeBlockComponent)
  },
  addInputRules() {
    const parentRules = this.parent?.() || [];
    return [
      ...parentRules,
      textblockTypeInputRule({
        find: /^\$\$$/,
        type: this.type,
        getAttributes: () => ({ language: 'math' }),
      }),
    ]
  },
})
