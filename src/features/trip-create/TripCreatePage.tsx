import { useState, useRef, useEffect } from "react";
import { css } from "@emotion/react";
import {
  FixedBottomCTA,
  TextField,
  Top,
  TopNavigation,
  TopNavigationBackButton,
} from "@toss/tds-mobile";
import { useNavigate } from "react-router-dom";
import { useAppNavigation } from "../../hooks/useAppNavigation.ts";
import { useCreateTripRoomMutation } from "./mutations.ts";
import { toUserMessage } from "../common/error-message.ts";
import {
  fixedCtaContainerStyle,
  tdsPageWithBottomCtaStyle,
} from "../common/tds-layout.ts";

const screenStyle = css`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 100vh;
  min-height: 100dvh;
`;

const formStyle = css`
  display: flex;
  flex-direction: column;
`;

const MAX_TITLE_LENGTH = 30;

export function TripCreatePage() {
  const navigate = useNavigate();
  const { goBack, platformNavigation } = useAppNavigation();
  const inputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);

  const [title, setTitle] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const createRoomMutation = useCreateTripRoomMutation();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmedTitle = title.trim();
  const isValid = trimmedTitle.length >= 1 && trimmedTitle.length <= MAX_TITLE_LENGTH;
  const handleSubmit = async () => {
    if (!isValid || createRoomMutation.isPending || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setErrorMsg(null);
    try {
      const newRoom = await createRoomMutation.mutateAsync({
        title: trimmedTitle,
      });

      // 생성 성공 시 여행방 계획 탭 홈으로 이동 (기획서 TR-02 명세)
      navigate(`/trips/${newRoom.id}/plans`, { replace: true });
    } catch (err: unknown) {
      setErrorMsg(toUserMessage(err, "여행을 만들지 못했어요. 다시 시도해주세요."));
    } finally {
      isSubmittingRef.current = false;
    }
  };

  return (
    <div css={screenStyle}>
      {!platformNavigation && (
        <TopNavigation leading={<TopNavigationBackButton aria-label="뒤로 가기" onClick={goBack} />} />
      )}

      <main css={tdsPageWithBottomCtaStyle}>
        <Top
          title={<Top.TitleParagraph>어떤 여행을 계획하고 있나요?</Top.TitleParagraph>}
          subtitleBottom={<Top.SubtitleParagraph>먼저 여행 이름만 정해주세요.</Top.SubtitleParagraph>}
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
          css={formStyle}
        >
          <TextField
            id="trip-title"
            ref={inputRef}
            variant="box"
            label="여행 이름 *"
            labelOption="sustain"
            placeholder="예: 일본 여행, 2026 제주 힐링"
            value={title}
            maxLength={MAX_TITLE_LENGTH}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            help={`${errorMsg ?? "여행방을 만든 후 첫 번째 여행안을 제안할 수 있어요."} (${title.length}/${MAX_TITLE_LENGTH})`}
            hasError={Boolean(errorMsg)}
            required
          />
        </form>
      </main>

      {/* 화면 하단 고정 CTA: 입력 중 키보드가 올라와도 가려지지 않아요. */}
      <FixedBottomCTA
        containerStyle={fixedCtaContainerStyle}
        loading={createRoomMutation.isPending}
        disabled={!isValid || createRoomMutation.isPending}
        onClick={() => void handleSubmit()}
      >
        {createRoomMutation.isPending ? "여행방 만드는 중..." : "여행 만들기"}
      </FixedBottomCTA>
    </div>
  );
}
