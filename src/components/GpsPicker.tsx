import React, { useState } from "react";
import { MapPin, Loader2 } from "lucide-react";

type Props = {
  lat: number | null;
  lng: number | null;
  label: string;
  onPick: (lat: number, lng: number, addressHint: string) => void;
  pickLabel: string;
  loadingLabel: string;
  errorLabel: string;
};

export function GpsPicker({
  lat,
  lng,
  label,
  onPick,
  pickLabel,
  loadingLabel,
  errorLabel,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  function locate() {
    setErr("");
    if (!navigator.geolocation) {
      setErr(errorLabel);
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false);
        const { latitude, longitude } = pos.coords;
        const hint = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        onPick(latitude, longitude, hint);
      },
      () => {
        setLoading(false);
        setErr(errorLabel);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  return (
    <div className="gps-block">
      <div className="gps-label">
        <MapPin size={16} />
        {label}
      </div>
      {lat != null && lng != null && (
        <div className="gps-coords">
          {lat.toFixed(5)}, {lng.toFixed(5)}
          <a
            className="gps-map-link"
            href={`https://www.google.com/maps?q=${lat},${lng}`}
            target="_blank"
            rel="noreferrer"
          >
            Google Maps
          </a>
        </div>
      )}
      <button type="button" className="gps-btn" onClick={locate} disabled={loading}>
        {loading ? <Loader2 className="spin" size={16} /> : <MapPin size={16} />}
        {loading ? loadingLabel : pickLabel}
      </button>
      {err && <p className="gps-err">{err}</p>}
    </div>
  );
}
