import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';
import { useI18n } from '../../i18n/index.tsx';

// components/studio-v2/ReferenceLocationMap.tsx
// 우측 인스펙터 하단의 '참고용' 경량 지도. LocationMapModal의 지도 로직을 재사용하되
// 모달 크롬 없이 인스펙터 패널에 바로 붙는다. React.lazy로 초기 번들에 포함되지 않는다.

interface ReferenceLocationMapProps {
  latitude?: number;
  longitude?: number;
  label?: string;
}

export const ReferenceLocationMap = ({
  latitude,
  longitude,
  label,
}: ReferenceLocationMapProps) => {
  const { ui } = useI18n();
  const canvasRef = useRef<HTMLDivElement>(null);
  const hasGps = latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude);

  useEffect(() => {
    if (!hasGps || !canvasRef.current) return;
    const lat = latitude as number;
    const lng = longitude as number;

    const map = L.map(canvasRef.current, {
      center: [lat, lng],
      zoom: 15,
      zoomControl: true,
      attributionControl: true,
      // 참고 지도 위에서 스크롤하면 지도 확대/축소가 되도록 활성화
      scrollWheelZoom: true,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'toss-map-pin',
        html: '<span class="toss-map-pin-dot"></span>',
        iconSize: [24, 32],
        iconAnchor: [12, 32],
      }),
      keyboard: false,
    }).addTo(map);

    // 슬라이드 애니메이션이 끝나는 동안 타일 깨짐 방지
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(canvasRef.current);
    const timer = window.setTimeout(() => map.invalidateSize(), 420);

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      map.remove();
    };
  }, [hasGps, latitude, longitude]);

  if (!hasGps) {
    return (
      <div className="sv2-map-empty">
        <MapPin size={26} />
        <strong>{ui('위치를 입력해주세요')}</strong>
        <span>{ui('GPS 정보가 없는 영상이에요. 위 입력창에 장소를 직접 입력하면 지도 대신 장소명이 영상에 표시돼요.')}</span>
      </div>
    );
  }

  return <div ref={canvasRef} className="sv2-map-canvas" aria-label={label || ui('참고 지도')} />;
};
