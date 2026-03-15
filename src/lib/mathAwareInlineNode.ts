import { InlineMathNode } from "@aarkue/tiptap-math-extension";

export const MathAwareInlineNode = InlineMathNode.extend({
  addStorage() {
    return {
      ...(this.parent?.() || {}),
      markdown: {
        serialize(state: any, node: any) {
          state.write(`$${node.attrs.latex}$`);
        }
      }
    }
  }
});
