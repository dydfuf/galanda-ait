import type { ComponentProps } from "react";

import { platform } from "@/platform/index.ts";
import { cn } from "@/lib/utils";

interface ExternalLinkProps extends Omit<ComponentProps<"a">, "href" | "onClick"> {
  readonly href: string;
}

/**
 * 앱 밖 URL을 여는 링크예요.
 *
 * `href`를 유지해 링크 semantic(복사/새 탭 등)은 그대로 두고, 클릭은 플랫폼 어댑터로
 * 넘겨서 AIT WebView에서도 외부 브라우저가 정상적으로 열리게 해요.
 */
export function ExternalLink({ href, className, children, ...props }: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      onClick={(event) => {
        event.preventDefault();
        void platform.openExternalUrl(href);
      }}
      className={cn("w-fit text-xs font-semibold text-primary no-underline", className)}
      {...props}
    >
      {children}
    </a>
  );
}
