import React, { useEffect, useState } from "react";

/** 주문 상태 */
type OrderStatus = "PAID" | "PREPARING" | "SHIPPING" | "DELIVERED" | "CANCELED";

/** 주문 항목 */
interface Order {
  id: string;
  productName: string;
  orderedAt: string; // ISO 8601
  amount: number; // 원 단위
  status: OrderStatus;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  PAID: "결제 완료",
  PREPARING: "상품 준비 중",
  SHIPPING: "배송 중",
  DELIVERED: "배송 완료",
  CANCELED: "주문 취소",
};

const STATUS_COLOR: Record<OrderStatus, { bg: string; fg: string }> = {
  PAID: { bg: "#e8f0fe", fg: "#1a56db" },
  PREPARING: { bg: "#fef3e2", fg: "#b45309" },
  SHIPPING: { bg: "#e0f2f1", fg: "#0f766e" },
  DELIVERED: { bg: "#e8f5e9", fg: "#15803d" },
  CANCELED: { bg: "#f3f4f6", fg: "#6b7280" },
};

/** 실제 서비스에서는 API 호출로 대체하세요. */
async function fetchOrders(): Promise<Order[]> {
  await new Promise((resolve) => setTimeout(resolve, 800));
  return [
    {
      id: "ORD-20260701-001",
      productName: "무선 블루투스 이어폰",
      orderedAt: "2026-07-01T10:24:00+09:00",
      amount: 89000,
      status: "DELIVERED",
    },
    {
      id: "ORD-20260703-014",
      productName: "스테인리스 텀블러 500ml",
      orderedAt: "2026-07-03T15:02:00+09:00",
      amount: 24500,
      status: "SHIPPING",
    },
    {
      id: "ORD-20260705-027",
      productName: "기계식 키보드 (적축)",
      orderedAt: "2026-07-05T21:47:00+09:00",
      amount: 132000,
      status: "PREPARING",
    },
    {
      id: "ORD-20260706-003",
      productName: "여름용 리넨 셔츠",
      orderedAt: "2026-07-06T09:11:00+09:00",
      amount: 39900,
      status: "CANCELED",
    },
  ];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

function formatAmount(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

/** 상태 배지 */
function StatusBadge({ status }: { status: OrderStatus }) {
  const color = STATUS_COLOR[status];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        backgroundColor: color.bg,
        color: color.fg,
        whiteSpace: "nowrap",
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/** 로딩 상태 */
function LoadingView() {
  return (
    <div style={styles.centerBox} role="status" aria-live="polite">
      <div style={styles.spinner} aria-hidden="true" />
      <p style={styles.stateText}>주문 내역을 불러오는 중...</p>
      <style>{`
        @keyframes order-list-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/** 빈 상태 */
function EmptyView() {
  return (
    <div style={styles.centerBox}>
      <div style={{ fontSize: 40, marginBottom: 12 }} aria-hidden="true">
        🛒
      </div>
      <p style={{ ...styles.stateText, fontWeight: 600, color: "#374151" }}>
        주문 내역이 없습니다
      </p>
      <p style={styles.stateText}>첫 주문을 시작해 보세요.</p>
    </div>
  );
}

/** 에러 상태 */
function ErrorView({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={styles.centerBox} role="alert">
      <p style={styles.stateText}>주문 내역을 불러오지 못했습니다.</p>
      <button type="button" onClick={onRetry} style={styles.retryButton}>
        다시 시도
      </button>
    </div>
  );
}

/** 주문 한 건 */
function OrderItem({ order }: { order: Order }) {
  return (
    <li style={styles.item}>
      <div style={styles.itemLeft}>
        <span style={styles.productName}>{order.productName}</span>
        <span style={styles.orderDate}>{formatDate(order.orderedAt)}</span>
      </div>
      <div style={styles.itemRight}>
        <span
          style={{
            ...styles.amount,
            ...(order.status === "CANCELED"
              ? { textDecoration: "line-through", color: "#9ca3af" }
              : null),
          }}
        >
          {formatAmount(order.amount)}
        </span>
        <StatusBadge status={order.status} />
      </div>
    </li>
  );
}

/** 쇼핑몰 주문 내역 화면 */
export default function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const load = () => {
    setIsLoading(true);
    setHasError(false);
    fetchOrders()
      .then((data) => setOrders(data))
      .catch(() => setHasError(true))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    let canceled = false;
    setIsLoading(true);
    setHasError(false);
    fetchOrders()
      .then((data) => {
        if (!canceled) setOrders(data);
      })
      .catch(() => {
        if (!canceled) setHasError(true);
      })
      .finally(() => {
        if (!canceled) setIsLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, []);

  return (
    <section style={styles.container}>
      <h1 style={styles.title}>주문 내역</h1>

      {isLoading ? (
        <LoadingView />
      ) : hasError ? (
        <ErrorView onRetry={load} />
      ) : orders.length === 0 ? (
        <EmptyView />
      ) : (
        <ul style={styles.list}>
          {orders.map((order) => (
            <OrderItem key={order.id} order={order} />
          ))}
        </ul>
      )}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 640,
    margin: "0 auto",
    padding: "24px 16px",
    fontFamily:
      "'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
    color: "#111827",
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    margin: "0 0 16px",
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
  },
  item: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "16px",
    borderBottom: "1px solid #f3f4f6",
    backgroundColor: "#fff",
  },
  itemLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
  },
  itemRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 6,
    flexShrink: 0,
  },
  productName: {
    fontSize: 15,
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  orderDate: {
    fontSize: 13,
    color: "#6b7280",
  },
  amount: {
    fontSize: 15,
    fontWeight: 700,
  },
  centerBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "64px 16px",
    textAlign: "center",
  },
  stateText: {
    margin: "4px 0",
    fontSize: 14,
    color: "#6b7280",
  },
  spinner: {
    width: 32,
    height: 32,
    marginBottom: 12,
    border: "3px solid #e5e7eb",
    borderTopColor: "#3b82f6",
    borderRadius: "50%",
    animation: "order-list-spin 0.8s linear infinite",
  },
  retryButton: {
    marginTop: 12,
    padding: "8px 20px",
    fontSize: 14,
    fontWeight: 600,
    color: "#fff",
    backgroundColor: "#3b82f6",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },
};
