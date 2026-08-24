import { css } from "@emotion/react";
import type { BookingStatus, TransportSnapshot } from "../../../core/domain/room.ts";

const cardStyle = css`
  background-color: var(--background);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--border);
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const sectionTitleStyle = css`
  font-size: 16px;
  font-weight: 700;
  color: var(--foreground);
  margin: 0;
`;

const transItemStyle = css`
  background-color: var(--surface-subtle);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const transHeaderStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const transBadgeStyle = css`
  font-size: 13px;
  font-weight: 700;
  color: var(--secondary-foreground);
  background-color: var(--border);
  padding: 4px 8px;
  border-radius: 6px;
`;

const fieldLabelStyle = css`
  font-size: 12px;
  font-weight: 600;
  color: var(--foreground-muted);
  margin-bottom: 4px;
  display: block;
`;

const inputStyle = css`
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-strong);
  font-size: 13px;
  outline: none;
  background-color: var(--background);
  color: var(--foreground);
  box-sizing: border-box;

  &:focus {
    border-color: var(--primary);
  }
`;

const selectStyle = css`
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-strong);
  font-size: 13px;
  outline: none;
  background-color: var(--background);
  color: var(--foreground);
`;

const checkboxLabelStyle = css`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--foreground-muted);
  cursor: pointer;
`;

const removeBtnStyle = css`
  background: none;
  border: none;
  color: var(--border-stronger);
  font-size: 14px;
  cursor: pointer;

  &:hover {
    color: var(--destructive);
  }
`;

const addTransButtonStyle = css`
  padding: 10px 14px;
  border: 1px dashed var(--primary-border);
  background-color: var(--info-muted);
  border-radius: 10px;
  color: var(--info);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;

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
    <section css={cardStyle}>
      <h2 css={sectionTitleStyle}>이동 교통편</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {transports.map((trans, idx) => (
          <div key={trans.id} css={transItemStyle}>
            <div css={transHeaderStyle}>
              <span css={transBadgeStyle}>
                이동 {idx + 1} · {trans.fromCity} → {trans.toCity}
              </span>
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label css={fieldLabelStyle} htmlFor={`${trans.id}-from-city`}>
                  출발지
                </label>
                <input
                  id={`${trans.id}-from-city`}
                  type="text"
                  placeholder="예: 공항 / 제주시"
                  value={trans.fromCity}
                  onChange={(e) => onUpdate(trans.id, { fromCity: e.target.value })}
                  css={inputStyle}
                />
              </div>
              <div>
                <label css={fieldLabelStyle} htmlFor={`${trans.id}-to-city`}>
                  도착지
                </label>
                <input
                  id={`${trans.id}-to-city`}
                  type="text"
                  placeholder="예: 서귀포시"
                  value={trans.toCity}
                  onChange={(e) => onUpdate(trans.id, { toCity: e.target.value })}
                  css={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
              <div>
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
              <div>
                <label css={fieldLabelStyle} htmlFor={`${trans.id}-duration`}>
                  예상 소요시간
                </label>
                <input
                  id={`${trans.id}-duration`}
                  type="text"
                  placeholder="예: 약 50분"
                  value={trans.durationText}
                  onChange={(e) => onUpdate(trans.id, { durationText: e.target.value })}
                  css={inputStyle}
                />
              </div>
            </div>

            <label css={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={trans.hasTransfer}
                onChange={(e) => onUpdate(trans.id, { hasTransfer: e.target.checked })}
              />
              환승 필요
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
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
                      priceRange: value ? { min: Number(value), max: Number(value) } : undefined,
                    });
                  }}
                  css={inputStyle}
                />
              </div>
              <div>
                <label css={fieldLabelStyle} htmlFor={`${trans.id}-booking-status`}>
                  예약 상태
                </label>
                <select
                  id={`${trans.id}-booking-status`}
                  value={trans.bookingStatus}
                  onChange={(e) => onUpdate(trans.id, { bookingStatus: e.target.value as BookingStatus })}
                  css={selectStyle}
                  style={{ width: "100%" }}
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
