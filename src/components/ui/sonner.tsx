"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
} from "lucide-react";

import { Spinner } from "@/components/ui/spinner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      // 앱이 light 단일 테마이므로 OS 다크 모드를 따라가지 않아요.
      theme="light"
      richColors
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon aria-hidden="true" className="size-4 text-success" />
        ),
        info: <InfoIcon aria-hidden="true" className="size-4 text-info" />,
        warning: (
          <TriangleAlertIcon
            aria-hidden="true"
            className="size-4 text-warning"
          />
        ),
        error: (
          <OctagonXIcon
            aria-hidden="true"
            className="size-4 text-destructive-strong"
          />
        ),
        loading: <Spinner aria-hidden="true" />,
      }}
      style={
        {
          "--normal-bg": "var(--surface-overlay)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border-overlay)",
          "--success-bg": "var(--success-muted)",
          "--success-text": "var(--success)",
          "--success-border": "var(--success)",
          "--info-bg": "var(--info-muted)",
          "--info-text": "var(--info)",
          "--info-border": "var(--info)",
          "--warning-bg": "var(--warning-muted)",
          "--warning-text": "var(--warning)",
          "--warning-border": "var(--warning-border)",
          "--error-bg": "var(--destructive-muted)",
          "--error-text": "var(--destructive-strong)",
          "--error-border": "var(--destructive-border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        style: {
          boxShadow: "var(--elevation-overlay)",
          WebkitBackdropFilter: "var(--overlay-backdrop-filter)",
          backdropFilter: "var(--overlay-backdrop-filter)",
        },
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
}

export { Toaster }
