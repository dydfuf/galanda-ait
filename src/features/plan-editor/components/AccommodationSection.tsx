import { css } from "@emotion/react";
import {
  getStayNightCount,
  type AccommodationSnapshot,
  type BookingStatus,
  type CityStay,
} from "../../../core/domain/room.ts";
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

const accItemStyle = css`
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background-color: var(--surface-subtle);
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const accHeaderStyle = css`
  min-width: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 8px;
`;

const accCityBadgeStyle = css`
  min-width: 0;
  max-width: 100%;
  margin: 0;
  padding: 6px 10px;
  border-radius: 8px;
  background-color: var(--info-muted);
  color: var(--info);
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

const responsiveGridStyle = css`
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;

  @media (min-width: 390px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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

const addAccButtonStyle = css`
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

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
      city: route?.city ?? "",
      period: route ? `${route.arrivalDate} ~ ${route.departureDate}` : "",
      nights: route ? Math.max(0, getStayNightCount(route)) : 0,
      hotelName: "",
      isSearching: true,
      bookingStatus: "NOT_CHECKED",
    });
  };

  return (
    <section css={cardStyle} data-galanda-surface="content">
      <h2 css={sectionTitleStyle}>
        {PLAN_EDITOR_SECTION_PRESENTATION.accommodation.sectionHeading}
      </h2>

      <div css={itemListStyle}>
        {accommodations.map((acc, idx) => (
          <div key={acc.id} css={accItemStyle}>
            <div css={accHeaderStyle}>
              <h3 css={accCityBadgeStyle}>
                구간 {idx + 1} · {acc.city} ({acc.nights}박)
              </h3>
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

            <div css={fieldStyle}>
              <label css={fieldLabelStyle} htmlFor={`${acc.id}-hotel-name`}>
                숙소명 / 호텔명
              </label>
              <input
                id={`${acc.id}-hotel-name`}
                type="text"
                placeholder="예: 그랜드 조선 호텔 제주"
                value={acc.hotelName}
                onChange={(e) =>
                  onUpdate(acc.id, {
                    hotelName: e.target.value,
                    isSearching: false,
                  })
                }
                css={inputStyle}
              />
            </div>

            <label css={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={Boolean(acc.isSearching)}
                onChange={(e) =>
                  onUpdate(acc.id, {
                    isSearching: e.target.checked,
                    hotelName: e.target.checked ? "" : acc.hotelName,
                  })
                }
              />
              숙소 찾는 중 (미정)
            </label>

            <div css={responsiveGridStyle}>
              <div css={fieldStyle}>
                <label css={fieldLabelStyle} htmlFor={`${acc.id}-price-min`}>
                  예상 최소 금액(원)
                </label>
                <input
                  id={`${acc.id}-price-min`}
                  type="number"
                  placeholder="0"
                  step="10000"
                  min="0"
                  value={acc.priceRange?.min ?? ""}
                  onChange={(e) => {
                    if (!e.target.value)
                      return onUpdate(acc.id, { priceRange: undefined });
                    const min = Number(e.target.value);
                    onUpdate(acc.id, {
                      priceRange: {
                        min,
                        max: Math.max(min, acc.priceRange?.max ?? min),
                      },
                    });
                  }}
                  css={inputStyle}
                />
              </div>
              <div css={fieldStyle}>
                <label css={fieldLabelStyle} htmlFor={`${acc.id}-price-max`}>
                  예상 최대 금액(원)
                </label>
                <input
                  id={`${acc.id}-price-max`}
                  type="number"
                  placeholder="0"
                  step="10000"
                  min="0"
                  value={acc.priceRange?.max ?? ""}
                  onChange={(e) => {
                    if (!e.target.value)
                      return onUpdate(acc.id, { priceRange: undefined });
                    const max = Number(e.target.value);
                    onUpdate(acc.id, {
                      priceRange: {
                        min: Math.min(acc.priceRange?.min ?? max, max),
                        max,
                      },
                    });
                  }}
                  css={inputStyle}
                />
              </div>
            </div>

            <div css={responsiveGridStyle}>
              <div css={fieldStyle}>
                <label
                  css={fieldLabelStyle}
                  htmlFor={`${acc.id}-booking-status`}
                >
                  예약 상태
                </label>
                <select
                  id={`${acc.id}-booking-status`}
                  value={acc.bookingStatus}
                  onChange={(e) =>
                    onUpdate(acc.id, {
                      bookingStatus: e.target.value as BookingStatus,
                    })
                  }
                  css={selectStyle}
                >
                  <option value="AVAILABLE">예약 가능</option>
                  <option value="NEED_CHECK">확인 필요</option>
                  <option value="FULL">만실</option>
                  <option value="NOT_CHECKED">확인 전</option>
                </select>
              </div>

              <div css={fieldStyle}>
                <label css={fieldLabelStyle} htmlFor={`${acc.id}-booking-url`}>
                  예약 링크 (선택)
                </label>
                <input
                  id={`${acc.id}-booking-url`}
                  type="url"
                  placeholder="https://"
                  value={acc.bookingUrl || ""}
                  onChange={(e) =>
                    onUpdate(acc.id, { bookingUrl: e.target.value })
                  }
                  css={inputStyle}
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          disabled={
            routes.length === 0 || accommodations.length >= routes.length
          }
          onClick={handleAddNew}
          css={addAccButtonStyle}
        >
          + 숙소 구간 추가
        </button>
      </div>
    </section>
  );
}
