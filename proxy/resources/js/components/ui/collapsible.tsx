import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"
import { useState } from "react"

import { ContentTransition } from "@/components/content-transition"
import { runUiTransition } from "@/lib/motion"

function Collapsible({
  open,
  defaultOpen = false,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)

  return (
    <ContentTransition default="none" update="disclosure-change">
      <CollapsiblePrimitive.Root
        data-slot="collapsible"
        {...props}
        open={open ?? uncontrolledOpen}
        onOpenChange={(nextOpen) => {
          runUiTransition(() => {
            if (open === undefined) {
              setUncontrolledOpen(nextOpen)
            }
            onOpenChange?.(nextOpen)
          })
        }}
      />
    </ContentTransition>
  )
}

function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      {...props}
    />
  )
}

function CollapsibleContent({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
