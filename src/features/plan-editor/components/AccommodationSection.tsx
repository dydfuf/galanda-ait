import { css } from "@emotion/react";
import { getStayNightCount, type AccommodationSnapshot, type BookingStatus, type CityStay } from "../../../core/domain/room.ts";

const cardStyle = css`
  background-color: var(--adaptiveBackground, #ffffff);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const sectionTitleStyle = css`
  font-size: 16px;
  font-weight: 700;
  color: var(--adaptiveGrey900, #191f28);
  margin: 0;
`;

const accItemStyle = css`
  background-color: var(--adaptiveGrey50, #f9fafb);
  border: 1px solid var(--adaptiveGrey200, #e5e8eb);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const accHeaderStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const accCityBadgeStyle = css`
  font-size: 13px;
  font-weight: 700;
  color: var(--adaptiveBlue600, #1b64da);
  background-color: var(--adaptiveBlue50, #e8f3ff);
  padding: 4px 8px;
  border-radius: 6px;
`;

const fieldRowStyle = css`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const fieldLabelStyle = css`
  font-size: 12px;
  font-weight: 600;
  color: var(--adaptiveGrey700, #4e5968);
  margin-bottom: 4px;
  display: block;
`;

const inputStyle = css`
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--adaptiveGrey300, #d1d6db);
  font-size: 13px;
  outline: none;
  background-color: var(--adaptiveBackground, #ffffff);
  color: var(--adaptiveGrey900, #191f28);
  box-sizing: border-box;

  &:focus {
    border-color: var(--adaptiveBlue500, #3182f6);
  }
`;

const selectStyle = css`
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--adaptiveGrey300, #d1d6db);
  font-size: 13px;
  outline: none;
  background-color: var(--adaptiveBackground, #ffffff);
  color: var(--adaptiveGrey900, #191f28);
`;

const checkboxLabelStyle = css`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--adaptiveGrey700, #4e5968);
  cursor: pointer;
`;

const removeBtnStyle = css`
  background: none;
  border: none;
  color: var(--adaptiveGrey400, #b0b8c1);
  font-size: 14px;
  cursor: pointer;

  &:hover {
    color: var(--adaptiveRed500, #f04452);
  }
`;

const addAccButtonStyle = css`
  padding: 10px 14px;
  border: 1px dashed var(--adaptiveBlue300, #82b6ff);
  background-color: var(--adaptiveBlue50, #f2f7ff);
  border-radius: 10px;
  color: var(--adaptiveBlue600, #1b64da);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;

  &:hover {
    background-color: var(--adaptiveBlue100, #e0edff);
  }
`;

interface AccommodationSectionProps {
  readonly accommodations: ReadonlyArray<AccommodationSnapshot>;
  readonly routes: ReadonlyArray<CityStay>;
  readonly onAdd: (acc: AccommodationSnapshot) => void;
  readonly onUpdate: (id: string, updated: Partial<AccommodationSnapshot>) => void;
  readonly onRemove: (id: string) => void;
}

export function AccommodationSection({
  accommodations,
  routes,
  onAdd,
  onUpdate,
  onRemove,
}: AccommodationSectionProps) {
  const handleAddNew = () => {
    const route = routes[accommodations.length] ?? routes[0];
    onAdd({
      id: `stay-${Date.now()}`,
      city: route?.city || "방문 도시",
      period: "체류 기간",
      nights: route ? Math.max(0, getStayNightCount(route)) : 0,
      hotelName: "숙소 찾는 중",
      isSearching: true,
      bookingStatus: "NEED_CHECK",
      priceRange: { min: 0, max: 0 },
    });
  };

  return (
    <section css={cardStyle}>
      <h2 css={sectionTitleStyle}>3. 숙소 체류 구간 스냅샷</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {accommodations.map((acc, idx) => (
          <div key={acc.id} css={accItemStyle}>
            <div css={accHeaderStyle}>
              <span css={accCityBadgeStyle}>
                구간 {idx + 1} · {acc.city} ({acc.nights}박)
              </span>
              {accommodations.length > 1 && (
                <button
                  type="button"
                  css={removeBtnStyle}
                  aria-label={`${idx + 1}번째 숙소 구간 삭제`}
                  onClick={() => onRemove(acc.id)}
                >
                  삭제
                </button>
              )}
            </div>

            <div>
              <label css={fieldLabelStyle} htmlFor={`${acc.id}-hotel-name`}>
                숙소명 / 호텔명
              </label>
              <input
                id={`${acc.id}-hotel-name`}
                type="text"
                placeholder="예: 그랜드 조선 호텔 제주"
                value={acc.hotelName}
                onChange={(e) => onUpdate(acc.id, { hotelName: e.target.value, isSearching: false })}
                css={inputStyle}
              />
            </div>

            <div css={fieldRowStyle}>
              <label css={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={Boolean(acc.isSearching)}
                  onChange={(e) =>
                    onUpdate(acc.id, {
                      isSearching: e.target.checked,
                      hotelName: e.target.checked ? "숙소 찾는 중" : "",
                    })
                  }
                />
                숙소 찾는 중 (미정)
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label css={fieldLabelStyle} htmlFor={`${acc.id}-price-min`}>
                  예상 최소 금액(원)
                </label>
                <input
                  id={`${acc.id}-price-min`}
                  type="number"
                  placeholder="0"
                  step="10000"
                  value={acc.priceRange?.min || ""}
                  onChange={(e) => {
                    const min = parseInt(e.target.value, 10) || 0;
                    const max = Math.max(min, acc.priceRange?.max || 0);
                    onUpdate(acc.id, { priceRange: { min, max } });
                  }}
                  css={inputStyle}
                />
              </div>
              <div>
                <label css={fieldLabelStyle} htmlFor={`${acc.id}-price-max`}>
                  예상 최대 금액(원)
                </label>
                <input
                  id={`${acc.id}-price-max`}
                  type="number"
                  placeholder="0"
                  step="10000"
                  value={acc.priceRange?.max || ""}
                  onChange={(e) => {
                    const max = parseInt(e.target.value, 10) || 0;
                    const min = acc.priceRange?.min || 0;
                    onUpdate(acc.id, { priceRange: { min, max } });
                  }}
                  css={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label css={fieldLabelStyle} htmlFor={`${acc.id}-booking-status`}>
                  예약 상태
                </label>
                <select
                  id={`${acc.id}-booking-status`}
                  value={acc.bookingStatus}
                  onChange={(e) => onUpdate(acc.id, { bookingStatus: e.target.value as BookingStatus })}
                  css={selectStyle}
                  style={{ width: "100%" }}
                >
                  <option value="AVAILABLE">예약 가능</option>
                  <option value="NEED_CHECK">확인 필요</option>
                  <option value="FULL">만실</option>
                  <option value="NOT_CHECKED">확인 전</option>
                </select>
              </div>

              <div>
                <label css={fieldLabelStyle} htmlFor={`${acc.id}-booking-url`}>
                  예약 링크 (선택)
                </label>
                <input
                  id={`${acc.id}-booking-url`}
                  type="url"
                  placeholder="https://"
                  value={acc.bookingUrl || ""}
                  onChange={(e) => onUpdate(acc.id, { bookingUrl: e.target.value })}
                  css={inputStyle}
                />
              </div>
            </div>
          </div>
        ))}

        <button type="button" onClick={handleAddNew} css={addAccButtonStyle}>
          + 숙소 구간 추가
        </button>
      </div>
    </section>
  );
}
