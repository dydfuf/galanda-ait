import { css } from "@emotion/react";
import type { BookingStatus, TransportSnapshot } from "../../../core/domain/room.ts";
import { PLAN_EDITOR_SECTION_PRESENTATION } from "../plan-editor-section.ts";

const cardStyle = css`
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 16px;
  margin-bottom: 20px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background-color: var(--surface-content);
  display: flex;
  flex-direction: column;
  gap: 20px;

  @media (min-width: 390px) {
    padding: 20px;
  }
`;

const sectionTitleStyle = css`
  margin: 0;
  color: var(--foreground);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.35;
`;

const itemListStyle = css`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const transItemStyle = css`
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background-color: var(--surface-subtle);
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const transHeaderStyle = css`
  min-width: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 8px;
`;

const transBadgeStyle = css`
  min-width: 0;
  max-width: 100%;
  margin: 0;
  padding: 6px 10px;
  border-radius: 8px;
  background-color: var(--muted);
  color: var(--secondary-foreground);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
  overflow-wrap: anywhere;
`;

const fieldStyle = css`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const fieldLabelStyle = css`
  display: block;
  color: var(--foreground-muted);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
`;

const inputStyle = css`
  width: 100%;
  min-width: 0;
  min-height: var(--touch-target-min);
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  outline: none;
  background-color: var(--surface-content);
  color: var(--foreground);
  font-size: 16px;
  line-height: 1.5;
  transition: border-color var(--motion-duration-fast)
    var(--motion-ease-standard);

  &:focus-visible {
    border-color: var(--primary);
  }
`;

const selectStyle = css`
  width: 100%;
  min-width: 0;
  min-height: var(--touch-target-min);
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  outline: none;
  background-color: var(--surface-content);
  color: var(--foreground);
  font-size: 16px;
  line-height: 1.5;

  &:focus-visible {
    border-color: var(--primary);
  }
`;

const checkboxLabelStyle = css`
  min-height: var(--touch-target-min);
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--foreground-muted);
  font-size: 16px;
  line-height: 1.5;
  cursor: pointer;

  input {
    width: 20px;
    height: 20px;
    flex: 0 0 20px;
    accent-color: var(--primary);
  }
`;

const responsiveGridStyle = (wideFirst = false) => css`
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;

  @media (min-width: 390px) {
    grid-template-columns: ${wideFirst
      ? "minmax(0, 2fr) minmax(0, 1fr)"
      : "repeat(2, minmax(0, 1fr))"};
  }
`;

const removeBtnStyle = css`
  min-width: var(--touch-target-min);
  min-height: var(--touch-target-min);
  padding: 8px 10px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--foreground-muted);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color var(--motion-duration-fast) var(--motion-ease-standard),
    background-color var(--motion-duration-fast) var(--motion-ease-standard);

  &:hover {
    background-color: var(--destructive-muted);
    color: var(--destructive);
  }
`;

const addTransButtonStyle = css`
  width: 100%;
  min-height: var(--touch-target-min);
  padding: 10px 14px;
  border: 1px dashed var(--primary-border);
  border-radius: 10px;
  background-color: var(--info-muted);
  color: var(--info);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
  cursor: pointer;
  transition: background-color var(--motion-duration-fast)
    var(--motion-ease-standard);

  &:hover {
    background-color: var(--primary-muted);
  }
`;

interface TransportSectionProps {
  readonly transports: ReadonlyArray<TransportSnapshot>;
  readonly onAdd: (trans: TransportSnapshot) => void;
  readonly onUpdate: (id: string, updated: Partial<TransportSnapshot>) => void;
  readonly onRemove: (id: string) => void;
}

export function TransportSection({
  transports,
  onAdd,
  onUpdate,
  onRemove,
}: TransportSectionProps) {
  const handleAddNew = () => {
    onAdd({
      id: `trans-${Date.now()}`,
      fromCity: "",
      toCity: "",
      mode: "",
      hasTransfer: false,
      durationText: "",
      bookingStatus: "NOT_CHECKED",
    });
  };

  return (
    <section css={cardStyle} data-galanda-surface="content">
      <h2 css={sectionTitleStyle}>
        {PLAN_EDITOR_SECTION_PRESENTATION.transport.sectionHeading}
      </h2>

      <div css={itemListStyle}>
        {transports.map((trans, idx) => (
          <div key={trans.id} css={transItemStyle}>
            <div css={transHeaderStyle}>
              <h3 css={transBadgeStyle}>
                이동 {idx + 1} · {trans.fromCity} → {trans.toCity}
              </h3>
              {transports.length > 0 && (
                <button
                  type="button"
                  css={removeBtnStyle}
                  aria-label={`${idx + 1}번째 이동 구간 삭제`}
                  onClick={() => onRemove(trans.id)}
                >
                  삭제
                </button>
              )}
            </div>

            <div css={responsiveGridStyle()}>
              <div css={fieldStyle}>
                <label css={fieldLabelStyle} htmlFor={`${trans.id}-from-city`}>
                  출발지
                </label>
                <input
                  id={`${trans.id}-from-city`}
                  type="text"
                  placeholder="예: 공항 / 제주시"
                  value={trans.fromCity}
                  onChange={(e) =>
                    onUpdate(trans.id, { fromCity: e.target.value })
                  }
                  css={inputStyle}
                />
              </div>
              <div css={fieldStyle}>
                <label css={fieldLabelStyle} htmlFor={`${trans.id}-to-city`}>
                  도착지
                </label>
                <input
                  id={`${trans.id}-to-city`}
                  type="text"
                  placeholder="예: 서귀포시"
                  value={trans.toCity}
                  onChange={(e) =>
                    onUpdate(trans.id, { toCity: e.target.value })
                  }
                  css={inputStyle}
                />
              </div>
            </div>

            <div css={responsiveGridStyle(true)}>
              <div css={fieldStyle}>
                <label css={fieldLabelStyle} htmlFor={`${trans.id}-mode`}>
                  교통수단
                </label>
                <input
                  id={`${trans.id}-mode`}
                  type="text"
                  placeholder="예: 렌터카 카니발 / KTX"
                  value={trans.mode}
                  onChange={(e) => onUpdate(trans.id, { mode: e.target.value })}
                  css={inputStyle}
                />
              </div>
              <div css={fieldStyle}>
                <label css={fieldLabelStyle} htmlFor={`${trans.id}-duration`}>
                  예상 소요시간
                </label>
                <input
                  id={`${trans.id}-duration`}
                  type="text"
                  placeholder="예: 약 50분"
                  value={trans.durationText}
                  onChange={(e) =>
                    onUpdate(trans.id, { durationText: e.target.value })
                  }
                  css={inputStyle}
                />
              </div>
            </div>

            <label css={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={trans.hasTransfer}
                onChange={(e) =>
                  onUpdate(trans.id, { hasTransfer: e.target.checked })
                }
              />
              환승 필요
            </label>

            <div css={responsiveGridStyle()}>
              <div css={fieldStyle}>
                <label css={fieldLabelStyle} htmlFor={`${trans.id}-price`}>
                  예상 그룹 금액(원)
                </label>
                <input
                  id={`${trans.id}-price`}
                  type="number"
                  placeholder="0"
                  step="10000"
                  min="0"
                  value={trans.priceRange?.min ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    onUpdate(trans.id, {
                      priceRange: value
                        ? { min: Number(value), max: Number(value) }
                        : undefined,
                    });
                  }}
                  css={inputStyle}
                />
              </div>
              <div css={fieldStyle}>
                <label
                  css={fieldLabelStyle}
                  htmlFor={`${trans.id}-booking-status`}
                >
                  예약 상태
                </label>
                <select
                  id={`${trans.id}-booking-status`}
                  value={trans.bookingStatus}
                  onChange={(e) =>
                    onUpdate(trans.id, {
                      bookingStatus: e.target.value as BookingStatus,
                    })
                  }
                  css={selectStyle}
                >
                  <option value="AVAILABLE">예약 가능</option>
                  <option value="NEED_CHECK">확인 필요</option>
                  <option value="FULL">매진/불가</option>
                  <option value="NOT_CHECKED">확인 전</option>
                </select>
              </div>
            </div>
          </div>
        ))}

        <button type="button" onClick={handleAddNew} css={addTransButtonStyle}>
          + 교통 이동 구간 추가
        </button>
      </div>
    </section>
  );
}
