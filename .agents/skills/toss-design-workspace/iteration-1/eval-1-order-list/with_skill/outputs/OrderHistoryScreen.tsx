import React, { useEffect, useState } from "react";

/**
 * 주문 내역 화면 — 토스 스타일
 *
 * - 로딩: 스켈레톤 (스피너 단독 금지, 실제 행과 높이 일치 → 레이아웃 시프트 없음)
 * - 빈 상태: 이모지 + 해요체 안내 + 다음 행동 버튼
 * - 리스트: ListRow 3영역(contents / right), 행 전체 탭 영역 ≥ 48px
 * - 상태 뱃지: weak variant, 의미 색상 고정 (파랑=진행, 초록=완료, 주황=대기, 빨강=취소)
 */

/* ---------- 디자인 토큰 ---------- */

const token = {
  bg: "var(--bg, #f7f9fc)",
  surface: "var(--surface, #ffffff)",
  textPrimary: "var(--text-primary, #191f28)",
  textSecondary: "var(--text-secondary, #4e5968)",
  textTertiary: "var(--text-tertiary, #8b95a1)",
  divider: "var(--divider, #e5e8eb)",
  primary: "var(--primary, #3182f6)",
  danger: "var(--danger, #f04452)",
  success: "var(--success, #03b26c)",
  pending: "var(--pending, #ff9500)",
} as const;

/* ---------- 타입 ---------- */

export type OrderStatus = "IN_DELIVERY" | "DELIVERED" | "PAYMENT_PENDING" | "CANCELED";

export interface Order {
  id: string;
  productName: string;
  orderedAt: string; // ISO 날짜 문자열
  amount: number; // 원 단위
  status: OrderStatus;
}

export interface OrderHistoryScreenProps {
  orders: Order[];
  loading?: boolean;
  /** 행을 누르면 주문 상세로 이동 */
  onOrderClick?: (order: Order) => void;
  /** 빈 상태에서 "상품 보러 가기"를 누르면 실행 */
  onBrowseProducts?: () => void;
}

/* ---------- 포맷터 (숫자·날짜 청킹) ---------- */

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString("ko-KR")}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/* ---------- 상태 뱃지 ---------- */

const STATUS_META: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  IN_DELIVERY: { label: "배송 중", color: token.primary, bg: "rgba(49, 130, 246, 0.10)" },
  DELIVERED: { label: "배송 완료", color: token.success, bg: "rgba(3, 178, 108, 0.10)" },
  PAYMENT_PENDING: { label: "결제 대기", color: token.pending, bg: "rgba(255, 149, 0, 0.12)" },
  CANCELED: { label: "주문 취소", color: token.danger, bg: "rgba(240, 68, 82, 0.10)" },
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 8px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.4,
        color: meta.color,
        background: meta.bg,
      }}
    >
      {meta.label}
    </span>
  );
}

/* ---------- 주문 행 (ListRow) ---------- */

function OrderRow({ order, onClick }: { order: Order; onClick?: (order: Order) => void }) {
  const canceled = order.status === "CANCELED";
  return (
    <li>
      <button
        type="button"
        className="order-row"
        onClick={() => onClick?.(order)}
        aria-label={`${order.productName}, ${formatDate(order.orderedAt)}, ${formatAmount(order.amount)}, ${STATUS_META[order.status].label}. 주문 상세 보기`}
      >
        <span className="order-row__contents">
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              lineHeight: 1.45,
              color: token.textPrimary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {order.productName}
          </span>
          <span style={{ fontSize: 13, lineHeight: 1.4, color: token.textTertiary }}>
            {formatDate(order.orderedAt)}
          </span>
        </span>

        <span className="order-row__right">
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              lineHeight: 1.45,
              color: canceled ? token.textTertiary : token.textPrimary,
              textDecoration: canceled ? "line-through" : "none",
            }}
          >
            {formatAmount(order.amount)}
          </span>
          <StatusBadge status={order.status} />
        </span>

        <svg
          className="order-row__chevron"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M6 3.5 10.5 8 6 12.5"
            stroke={token.textTertiary}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </li>
  );
}

/* ---------- 스켈레톤 (실제 행과 동일한 높이) ---------- */

function SkeletonRow() {
  return (
    <li className="order-row order-row--skeleton" aria-hidden="true">
      <span className="order-row__contents">
        <span className="skeleton-bar" style={{ width: "62%", height: 16, marginBottom: 6 }} />
        <span className="skeleton-bar" style={{ width: "38%", height: 12 }} />
      </span>
      <span className="order-row__right">
        <span className="skeleton-bar" style={{ width: 72, height: 16, marginBottom: 6 }} />
        <span className="skeleton-bar" style={{ width: 52, height: 14 }} />
      </span>
    </li>
  );
}

/* ---------- 빈 상태 (피크엔드 — 차갑게 두지 않는다) ---------- */

function EmptyOrders({ onBrowseProducts }: { onBrowseProducts?: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "64px 24px 48px",
      }}
    >
      <span style={{ fontSize: 44, lineHeight: 1 }} aria-hidden="true">
        📦
      </span>
      <p
        style={{
          margin: "20px 0 0",
          fontSize: 17,
          fontWeight: 700,
          lineHeight: 1.45,
          color: token.textPrimary,
        }}
      >
        아직 주문한 내역이 없어요
      </p>
      <p
        style={{
          margin: "6px 0 0",
          fontSize: 15,
          lineHeight: 1.5,
          color: token.textSecondary,
        }}
      >
        첫 주문을 하면 여기에 나타나요
      </p>
      {onBrowseProducts && (
        <button type="button" className="cta-button" onClick={onBrowseProducts}>
          상품 보러 가기
        </button>
      )}
    </div>
  );
}

/* ---------- 메인 화면 ---------- */

export function OrderHistoryScreen({
  orders,
  loading = false,
  onOrderClick,
  onBrowseProducts,
}: OrderHistoryScreenProps) {
  const isEmpty = !loading && orders.length === 0;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: token.bg,
        padding: "0 0 env(safe-area-inset-bottom)",
        fontFamily:
          "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <style>{styles}</style>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px 40px" }}>
        <h1
          style={{
            margin: "8px 4px 20px",
            fontSize: 22,
            fontWeight: 700,
            lineHeight: 1.4,
            color: token.textPrimary,
          }}
        >
          주문 내역
        </h1>

        <section
          aria-label="주문 목록"
          aria-busy={loading}
          style={{
            background: token.surface,
            borderRadius: 20,
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
            overflow: "hidden",
          }}
        >
          {loading ? (
            <ul className="order-list">
              {[1, 2, 3, 4].map((i) => (
                <SkeletonRow key={i} />
              ))}
              <li className="visually-hidden" role="status">
                주문 내역을 불러오고 있어요
              </li>
            </ul>
          ) : isEmpty ? (
            <EmptyOrders onBrowseProducts={onBrowseProducts} />
          ) : (
            <ul className="order-list">
              {orders.map((order) => (
                <OrderRow key={order.id} order={order} onClick={onOrderClick} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

/* ---------- 스타일 (shimmer·터치 피드백은 클래스로) ---------- */

const styles = `
  .order-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .order-list > li + li .order-row,
  .order-list > li + li.order-row {
    border-top: 1px solid ${token.divider};
  }

  .order-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 72px;
    padding: 16px;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background-color 0.15s ease;
  }
  .order-row:active {
    background: #f2f4f6;
  }
  .order-row--skeleton {
    cursor: default;
  }

  .order-row__contents {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 0;
  }
  .order-row__right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    flex-shrink: 0;
  }
  .order-row__chevron {
    flex-shrink: 0;
  }

  .skeleton-bar {
    display: block;
    border-radius: 6px;
    background: linear-gradient(90deg, #eef1f4 25%, #f7f9fc 50%, #eef1f4 75%);
    background-size: 200% 100%;
    animation: order-shimmer 1.4s ease-in-out infinite;
  }
  @keyframes order-shimmer {
    from { background-position: 200% 0; }
    to { background-position: -200% 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .skeleton-bar { animation: none; }
  }

  .cta-button {
    margin-top: 24px;
    min-height: 48px;
    padding: 12px 24px;
    border: none;
    border-radius: 12px;
    background: ${token.primary};
    color: #ffffff;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: filter 0.15s ease;
  }
  .cta-button:active {
    filter: brightness(0.92);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
`;

/* ---------- 데모 (데이터 로딩 시뮬레이션) ---------- */

const SAMPLE_ORDERS: Order[] = [
  {
    id: "order-1",
    productName: "무선 블루투스 이어폰",
    orderedAt: "2026-07-06",
    amount: 74330,
    status: "IN_DELIVERY",
  },
  {
    id: "order-2",
    productName: "프리미엄 원두 1kg (다크 로스트)",
    orderedAt: "2026-07-02",
    amount: 28900,
    status: "DELIVERED",
  },
  {
    id: "order-3",
    productName: "접이식 노트북 거치대",
    orderedAt: "2026-06-28",
    amount: 19800,
    status: "PAYMENT_PENDING",
  },
  {
    id: "order-4",
    productName: "스테인리스 텀블러 500ml",
    orderedAt: "2026-06-21",
    amount: 15400,
    status: "CANCELED",
  },
];

export default function OrderHistoryDemo() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOrders(SAMPLE_ORDERS);
      setLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <OrderHistoryScreen
      orders={orders}
      loading={loading}
      onOrderClick={(order) => console.log("주문 상세로 이동:", order.id)}
      onBrowseProducts={() => console.log("상품 목록으로 이동")}
    />
  );
}
