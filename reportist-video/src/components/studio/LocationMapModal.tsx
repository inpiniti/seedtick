// components/studio/LocationMapModal.tsx - 촬영 위치 확인용 경량 Leaflet 지도 모달
// React.lazy로 불러와 Leaflet 번들·CSS가 초기 스튜디오 로딩에 포함되지 않게 한다.
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ExternalLink, MapPin, X } from 'lucide-react';
import { useI18n } from '../../i18n/index.tsx';
import type { HighlightSegment } from '../../types/video.ts';
import './LocationMapModal.css';

export type LocationMapTarget = Partial<
  Pick<HighlightSegment, 'latitude' | 'longitude' | 'locationName' | 'subtitleTitle' | 'reason'>
>;

interface LocationMapModalProps extends LocationMapTarget {
  onClose: () => void;
}

export const LocationMapModal = ({
  latitude,
  longitude,
  locationName,
  subtitleTitle,
  reason,
  onClose,
}: LocationMapModalProps) => {
  const { dict, interpolate } = useI18n();
  const canvasRef = useRef<HTMLDivElement>(null);
  const hasGps = latitude != null && longitude != null;
  const label = locationName || subtitleTitle || reason || dict.common.videos;

  useEffect(() => {
    if (!hasGps || !canvasRef.current) return;

    const lat = latitude as number;
    const lng = longitude as number;
    const map = L.map(canvasRef.current, {
      center: [lat, lng],
      zoom: 15,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
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

    // 바텀시트 오픈 애니메이션 중 크기 변화를 따라가며 타일 잘림·회색 여백 방지
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(canvasRef.current);
    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 320);

    return () => {
      window.clearTimeout(resizeTimer);
      observer.disconnect();
      map.remove();
    };
  }, [hasGps, latitude, longitude]);

  return (
    <div className="model-modal-backdrop" onClick={onClose}>
      <div
        className="model-modal-card toss-map-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="model-modal-header">
          <div className="model-modal-title-row">
            <div className="model-modal-icon-badge" style={{ backgroundColor: '#fef2f2', color: '#ef4444' }}>
              <MapPin size={22} color="#ef4444" />
            </div>
            <div className="model-modal-titles">
              <h2 id="map-modal-title" className="model-modal-title">
                {dict.mapModal.title}
              </h2>
              <p className="model-modal-subtitle">{label}</p>
            </div>
          </div>
          <button
            type="button"
            className="model-modal-close-btn"
            onClick={onClose}
            aria-label={dict.common.close}
          >
            <X size={18} />
          </button>
        </div>

        <div className="toss-map-body">
          {hasGps ? (
            <div ref={canvasRef} className="toss-map-canvas" />
          ) : (
            <div className="toss-map-empty">
              <MapPin size={28} />
              <p className="toss-map-empty-title">
                {interpolate(dict.mapModal.noGpsTitle, {
                  location: locationName || dict.common.videos,
                })}
              </p>
              <p className="toss-map-empty-desc">{dict.mapModal.noGpsDesc}</p>
            </div>
          )}
        </div>

        <div className="model-modal-footer">
          <div className="toss-map-footer-links">
            <a
              href={
                locationName
                  ? `https://map.naver.com/v5/search/${encodeURIComponent(locationName)}`
                  : hasGps
                  ? `https://map.naver.com/v5/search/${latitude},${longitude}`
                  : `https://map.naver.com/v5/search/${encodeURIComponent(label)}`
              }
              target="_blank"
              rel="noreferrer"
              className="toss-map-footer-link"
            >
              <ExternalLink size={13} />
              <span>{dict.mapModal.viewNaverMap}</span>
            </a>
            <a
              href={
                hasGps
                  ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`
              }
              target="_blank"
              rel="noreferrer"
              className="toss-map-footer-link"
            >
              <ExternalLink size={13} />
              <span>{dict.mapModal.viewGoogleMap}</span>
            </a>
          </div>
          <button type="button" className="toss-modal-btn-close" onClick={onClose}>
            {dict.common.close}
          </button>
        </div>
      </div>
    </div>
  );
};
