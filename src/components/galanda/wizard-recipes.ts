import { cva } from "class-variance-authority";

export const wizardQuestionPanel = cva(
  "mx-(--app-inline-padding) mt-3 flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5",
);

export const wizardChoiceCard = cva(
  "flex cursor-pointer flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-colors outline-none has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-3 has-[input:focus-visible]:outline-ring",
  {
    variants: {
      selected: {
        true: "border-primary bg-primary/5 text-foreground ring-2 ring-primary/20",
        false: "border-border bg-card text-muted-foreground hover:bg-muted/50",
      },
    },
    defaultVariants: { selected: false },
  },
);
